import { useState, useMemo, useRef } from 'react'
import { 
  ChevronLeft, ChevronRight, Calendar,
  Users, AlertTriangle, CheckCircle2
} from 'lucide-react'

// ============================================================================
// UTILITÀ DATE
// ============================================================================

const addDays = (date, days) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

const diffDays = (date1, date2) => {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24))
}

const formatDate = (date, format = 'short') => {
  const d = new Date(date)
  if (format === 'day') return d.getDate()
  if (format === 'month') return d.toLocaleDateString('it-IT', { month: 'short' })
  if (format === 'full') return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

const isSameDay = (d1, d2) => {
  const date1 = new Date(d1)
  const date2 = new Date(d2)
  return date1.toDateString() === date2.toDateString()
}

const isWeekend = (date) => {
  const d = new Date(date)
  return d.getDay() === 0 || d.getDay() === 6
}

// ============================================================================
// CONFIGURAZIONE
// ============================================================================

const ZOOM_LEVELS = {
  week: { label: 'Settimana', daysVisible: 14, cellWidth: 40 },
  month: { label: 'Mese', daysVisible: 31, cellWidth: 30 },
  quarter: { label: 'Trimestre', daysVisible: 90, cellWidth: 12 }
}

const DISCIPLINE_COLORS = {
  piping: '#3B82F6',
  civil: '#F59E0B',
  mechanical: '#10B981',
  electrical: '#EAB308',
  instrumentation: '#8B5CF6',
  other: '#6B7280'
}

// ============================================================================
// COMPONENTE PRINCIPALE GANTT
// ============================================================================

export default function WorkPackagesGantt({ 
  workPackages, 
  squads, 
  projectHoursPerDay = 8,
  onWPClick
}) {
  const containerRef = useRef(null)
  const [zoom, setZoom] = useState('month')
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    today.setDate(today.getDate() - 7)
    return today
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const zoomConfig = ZOOM_LEVELS[zoom]

  // ============================================================================
  // CALCOLO DATE RANGE
  // ============================================================================
  
  const dateRange = useMemo(() => {
    const dates = []
    for (let i = 0; i < zoomConfig.daysVisible; i++) {
      dates.push(addDays(startDate, i))
    }
    return dates
  }, [startDate, zoomConfig.daysVisible])

  const endDate = dateRange[dateRange.length - 1]

  // ============================================================================
  // FILTRA WP CON DATE
  // ============================================================================
  
  const wpsWithDates = useMemo(() => {
    return workPackages.filter(wp => wp.planned_start && wp.planned_end)
  }, [workPackages])

  // ============================================================================
  // CALCOLO RISORSE PER GIORNO
  // ============================================================================
  
  const resourcesPerDay = useMemo(() => {
    const resources = {}
    
    dateRange.forEach(date => {
      const dateStr = date.toISOString().split('T')[0]
      resources[dateStr] = { theoretical: 0, actual: 0 }
      
      wpsWithDates.forEach(wp => {
        const wpStart = new Date(wp.planned_start)
        const wpEnd = new Date(wp.planned_end)
        
        if (date >= wpStart && date <= wpEnd) {
          if (wp.squad_id) {
            const squad = squads.find(s => s.id === wp.squad_id)
            const memberCount = squad?.memberCount || 0
            resources[dateStr].theoretical += memberCount
            
            if (date <= today) {
              resources[dateStr].actual += memberCount
            }
          } else if (wp.budget_hours) {
            const wpDays = diffDays(wp.planned_start, wp.planned_end) + 1
            const hoursPerDay = wp.budget_hours / wpDays
            const peopleNeeded = Math.ceil(hoursPerDay / projectHoursPerDay)
            resources[dateStr].theoretical += peopleNeeded
          }
        }
      })
    })
    
    return resources
  }, [dateRange, wpsWithDates, squads, projectHoursPerDay, today])

  // ============================================================================
  // NAVIGAZIONE
  // ============================================================================
  
  const navigate = (direction) => {
    const days = direction === 'prev' 
      ? -Math.floor(zoomConfig.daysVisible / 2) 
      : Math.floor(zoomConfig.daysVisible / 2)
    setStartDate(addDays(startDate, days))
  }

  const goToToday = () => {
    const newStart = new Date(today)
    newStart.setDate(newStart.getDate() - 7)
    setStartDate(newStart)
  }

  // ============================================================================
  // CALCOLO POSIZIONE BARRA WP
  // ============================================================================
  
  const getBarPosition = (wp) => {
    const wpStart = new Date(wp.planned_start)
    const wpEnd = new Date(wp.planned_end)
    
    const rangeStart = new Date(startDate)
    const rangeEnd = new Date(endDate)
    
    if (wpEnd < rangeStart || wpStart > rangeEnd) {
      return null
    }
    
    const effectiveStart = wpStart < rangeStart ? rangeStart : wpStart
    const effectiveEnd = wpEnd > rangeEnd ? rangeEnd : wpEnd
    
    const startOffset = diffDays(rangeStart, effectiveStart)
    const duration = diffDays(effectiveStart, effectiveEnd) + 1
    
    const left = startOffset * zoomConfig.cellWidth
    const width = duration * zoomConfig.cellWidth - 4
    
    const isClippedLeft = wpStart < rangeStart
    const isClippedRight = wpEnd > rangeEnd
    
    return { left, width, isClippedLeft, isClippedRight }
  }

  // ============================================================================
  // RENDER HEADER MESI
  // ============================================================================
  
  const renderMonthHeaders = () => {
    const months = []
    let currentMonth = null
    let monthStart = 0
    let monthWidth = 0
    
    dateRange.forEach((date, idx) => {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`
      
      if (monthKey !== currentMonth) {
        if (currentMonth !== null) {
          months.push({ 
            label: formatDate(dateRange[monthStart], 'month').toUpperCase() + ' ' + dateRange[monthStart].getFullYear(),
            width: monthWidth * zoomConfig.cellWidth 
          })
        }
        currentMonth = monthKey
        monthStart = idx
        monthWidth = 1
      } else {
        monthWidth++
      }
    })
    
    if (currentMonth !== null) {
      months.push({ 
        label: formatDate(dateRange[monthStart], 'month').toUpperCase() + ' ' + dateRange[monthStart].getFullYear(),
        width: monthWidth * zoomConfig.cellWidth 
      })
    }
    
    return months
  }

  // ============================================================================
  // RENDER
  // ============================================================================
  
  const months = renderMonthHeaders()
  const todayIndex = dateRange.findIndex(d => isSameDay(d, today))

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('prev')} className="p-2 hover:bg-gray-200 rounded-lg">
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1"
          >
            <Calendar size={16} />
            Oggi
          </button>
          <button onClick={() => navigate('next')} className="p-2 hover:bg-gray-200 rounded-lg">
            <ChevronRight size={20} />
          </button>
          
          <span className="ml-4 text-sm text-gray-600 hidden sm:inline">
            {formatDate(startDate, 'full')} - {formatDate(endDate, 'full')}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Zoom:</span>
          {Object.entries(ZOOM_LEVELS).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setZoom(key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                zoom === key 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gantt Container */}
      <div className="overflow-x-auto" ref={containerRef}>
        <div style={{ minWidth: dateRange.length * zoomConfig.cellWidth + 250 }}>
          {/* Header Row - Months */}
          <div className="flex border-b bg-gray-100">
            <div className="w-[250px] flex-shrink-0 px-4 py-2 font-semibold text-gray-700 border-r">
              Work Package
            </div>
            <div className="flex">
              {months.map((month, idx) => (
                <div 
                  key={idx} 
                  className="text-center text-xs font-semibold text-gray-600 py-2 border-r border-gray-200"
                  style={{ width: month.width }}
                >
                  {month.label}
                </div>
              ))}
            </div>
          </div>
          
          {/* Header Row - Days */}
          <div className="flex border-b bg-gray-50">
            <div className="w-[250px] flex-shrink-0 px-4 py-1 text-xs text-gray-500 border-r">
              Squadra
            </div>
            <div className="flex relative">
              {dateRange.map((date, idx) => (
                <div 
                  key={idx}
                  className={`text-center text-xs py-1 border-r border-gray-100 ${
                    isWeekend(date) ? 'bg-gray-100' : ''
                  } ${isSameDay(date, today) ? 'bg-red-100 font-bold text-red-600' : 'text-gray-500'}`}
                  style={{ width: zoomConfig.cellWidth }}
                >
                  {formatDate(date, 'day')}
                </div>
              ))}
            </div>
          </div>

          {/* Work Packages Rows */}
          {wpsWithDates.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Calendar size={32} className="mx-auto mb-2 text-gray-300" />
              <p>Nessun Work Package con date pianificate</p>
              <p className="text-sm">Assegna date ai WP per visualizzarli nel Gantt</p>
            </div>
          ) : (
            wpsWithDates.map(wp => {
              const barPos = getBarPosition(wp)
              const squad = squads.find(s => s.id === wp.squad_id)
              const color = DISCIPLINE_COLORS[wp.discipline] || DISCIPLINE_COLORS.other
              const progressWidth = barPos ? (barPos.width * wp.progress / 100) : 0
              
              return (
                <div 
                  key={wp.id} 
                  className="flex border-b hover:bg-gray-50 group"
                >
                  {/* WP Info */}
                  <div 
                    className="w-[250px] flex-shrink-0 px-4 py-3 border-r cursor-pointer"
                    onClick={() => onWPClick?.(wp)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {wp.code}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate" title={wp.name}>
                        {wp.name}
                      </span>
                      {wp.hasGenericEquipment && (
                        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      {squad ? (
                        <>
                          <Users size={12} />
                          Sq. {squad.squad_number}
                        </>
                      ) : (
                        <span className="text-gray-400">No squadra</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Timeline */}
                  <div className="flex-1 relative" style={{ height: 48 }}>
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {dateRange.map((date, idx) => (
                        <div 
                          key={idx}
                          className={`border-r border-gray-100 ${
                            isWeekend(date) ? 'bg-gray-50' : ''
                          }`}
                          style={{ width: zoomConfig.cellWidth }}
                        />
                      ))}
                    </div>
                    
                    {/* Today marker */}
                    {todayIndex >= 0 && (
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                        style={{ left: todayIndex * zoomConfig.cellWidth + zoomConfig.cellWidth / 2 }}
                      />
                    )}
                    
                    {/* WP Bar */}
                    {barPos && (
                      <div
                        className="absolute top-2 h-8 rounded cursor-pointer transition-all group-hover:shadow-md"
                        style={{ 
                          left: barPos.left, 
                          width: Math.max(barPos.width, 20),
                          backgroundColor: `${color}30`,
                          borderLeft: barPos.isClippedLeft ? 'none' : `3px solid ${color}`,
                          borderRadius: barPos.isClippedLeft ? '0 4px 4px 0' : barPos.isClippedRight ? '4px 0 0 4px' : '4px'
                        }}
                        onClick={() => onWPClick?.(wp)}
                      >
                        {/* Progress fill */}
                        <div 
                          className="h-full rounded-l"
                          style={{ 
                            width: progressWidth,
                            backgroundColor: color,
                            borderRadius: barPos.isClippedLeft ? '0 0 0 0' : '4px 0 0 4px'
                          }}
                        />
                        
                        {/* Label */}
                        {barPos.width > 60 && (
                          <span 
                            className="absolute inset-0 flex items-center px-2 text-xs font-medium truncate"
                            style={{ color: wp.progress > 50 ? 'white' : color }}
                          >
                            {wp.progress.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {/* Resources Row */}
          <div className="border-t-2 border-gray-300">
            {/* Theoretical Resources */}
            <div className="flex bg-blue-50">
              <div className="w-[250px] flex-shrink-0 px-4 py-2 border-r text-sm font-medium text-blue-700 flex items-center gap-2">
                <Users size={16} />
                Risorse Teoriche
              </div>
              <div className="flex">
                {dateRange.map((date, idx) => {
                  const dateStr = date.toISOString().split('T')[0]
                  const value = resourcesPerDay[dateStr]?.theoretical || 0
                  return (
                    <div 
                      key={idx}
                      className={`text-center text-xs py-2 border-r border-blue-100 font-medium ${
                        isWeekend(date) ? 'bg-blue-100/50' : ''
                      } ${value > 0 ? 'text-blue-700' : 'text-gray-400'}`}
                      style={{ width: zoomConfig.cellWidth }}
                    >
                      {value > 0 ? value : '-'}
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Actual Resources */}
            <div className="flex bg-green-50">
              <div className="w-[250px] flex-shrink-0 px-4 py-2 border-r text-sm font-medium text-green-700 flex items-center gap-2">
                <CheckCircle2 size={16} />
                Risorse Reali
              </div>
              <div className="flex">
                {dateRange.map((date, idx) => {
                  const dateStr = date.toISOString().split('T')[0]
                  const value = resourcesPerDay[dateStr]?.actual || 0
                  const isFuture = date > today
                  return (
                    <div 
                      key={idx}
                      className={`text-center text-xs py-2 border-r border-green-100 font-medium ${
                        isWeekend(date) ? 'bg-green-100/50' : ''
                      } ${isFuture ? 'text-gray-300' : value > 0 ? 'text-green-700' : 'text-gray-400'}`}
                      style={{ width: zoomConfig.cellWidth }}
                    >
                      {isFuture ? '--' : (value > 0 ? value : '-')}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 p-4 border-t bg-gray-50 text-xs flex-wrap">
        <span className="font-medium text-gray-600">Legenda:</span>
        {Object.entries(DISCIPLINE_COLORS).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
            <span className="capitalize">{key}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 ml-4">
          <div className="w-4 h-0.5 bg-red-500" />
          <span>Oggi</span>
        </div>
      </div>
    </div>
  )
}
