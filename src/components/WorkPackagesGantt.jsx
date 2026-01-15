import React, { useState, useMemo } from 'react';

// ============================================================================
// WORK PACKAGES GANTT CHART
// Con supporto per:
// - Giorni lavorativi configurabili per progetto
// - Visualizzazione conflitti risorse (sovrapposizioni squadre)
// - Calcolo risorse effettive con divisioni
// ============================================================================

const DISCIPLINE_COLORS = {
  piping: '#3B82F6',  // blue
  action: '#10B981'   // green
};

// Helper per parsing date senza timezone issues
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Helper per formattare date in YYYY-MM-DD
const formatDateISO = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Mappa giorno settimana JS (0=Dom, 1=Lun...) a chiave working_days
const jsDateToDayKey = (date) => {
  const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return dayMap[date.getDay()];
};

// Confronta due date (solo giorno, senza ora)
const isSameDay = (d1, d2) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

export default function WorkPackagesGantt({ workPackages, squads, calculateProgress, activeProject }) {
  const [zoom, setZoom] = useState('month');
  const [showConflictTooltip, setShowConflictTooltip] = useState(null);
  
  // Date range state con date pickers
  const [rangeStart, setRangeStart] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7);
    return formatDateISO(today);
  });
  const [rangeEnd, setRangeEnd] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 30);
    return formatDateISO(today);
  });

  // Configurazione giorni lavorativi dal progetto (default: Lun-Ven)
  const workingDays = activeProject?.working_days || {
    mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false
  };

  // Helper per verificare se un giorno è lavorativo
  const isWorkingDay = (date) => {
    const dayKey = jsDateToDayKey(date);
    return workingDays[dayKey] === true;
  };

  // Conta giorni lavorativi configurati
  const workingDaysCount = Object.values(workingDays).filter(Boolean).length;

  // Configurazione zoom
  const zoomConfig = {
    week: { cellWidth: 40, label: 'Settimana' },
    month: { cellWidth: 30, label: 'Mese' },
    quarter: { cellWidth: 12, label: 'Trimestre' }
  };

  const config = zoomConfig[zoom];

  // Genera array di date dal range selezionato
  const dates = useMemo(() => {
    const result = [];
    const start = parseDate(rangeStart);
    const end = parseDate(rangeEnd);
    if (!start || !end || start > end) return [];
    
    const current = new Date(start);
    while (current <= end) {
      result.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [rangeStart, rangeEnd]);

  // Filtra WP con date
  const wpsWithDates = workPackages.filter(wp => wp.planned_start && wp.planned_end);

  // ============================================================================
  // CONFLICT DETECTION
  // ============================================================================
  
  // Trova conflitti per ogni WP (stessa squadra, date sovrapposte)
  const wpConflicts = useMemo(() => {
    const conflicts = {};
    
    wpsWithDates.forEach(wp => {
      if (!wp.squad_id) return;
      
      const wpStart = parseDate(wp.planned_start);
      const wpEnd = parseDate(wp.planned_end);
      
      // Trova altri WP con stessa squadra e date sovrapposte
      const overlapping = wpsWithDates.filter(other => {
        if (other.id === wp.id) return false;
        if (other.squad_id !== wp.squad_id) return false;
        if (other.status === 'completed') return false;
        
        const otherStart = parseDate(other.planned_start);
        const otherEnd = parseDate(other.planned_end);
        
        // Check sovrapposizione
        return !(wpEnd < otherStart || wpStart > otherEnd);
      });
      
      if (overlapping.length > 0) {
        conflicts[wp.id] = overlapping;
      }
    });
    
    return conflicts;
  }, [wpsWithDates]);

  // Calcola per ogni giorno quali squadre hanno conflitti
  const dailyConflicts = useMemo(() => {
    const result = {};
    
    dates.forEach(date => {
      const dateKey = formatDateISO(date);
      const squadsOnDay = {};
      
      // Raggruppa WP per squadra in questo giorno
      wpsWithDates.forEach(wp => {
        if (!wp.squad_id) return;
        
        const wpStart = parseDate(wp.planned_start);
        const wpEnd = parseDate(wp.planned_end);
        
        if (date >= wpStart && date <= wpEnd) {
          if (!squadsOnDay[wp.squad_id]) {
            squadsOnDay[wp.squad_id] = [];
          }
          squadsOnDay[wp.squad_id].push(wp);
        }
      });
      
      // Identifica squadre con più di un WP
      const conflictingSquads = Object.entries(squadsOnDay)
        .filter(([_, wps]) => wps.length > 1)
        .map(([squadId, wps]) => ({ squadId, wps }));
      
      if (conflictingSquads.length > 0) {
        result[dateKey] = conflictingSquads;
      }
    });
    
    return result;
  }, [dates, wpsWithDates]);

  // ============================================================================
  // RESOURCE CALCULATION
  // ============================================================================

  // Conta membri squadra (foreman + membri, NO supervisor)
  const getSquadMemberCount = (squadId) => {
    const squad = squads.find(s => s.id === squadId);
    if (!squad) return 0;
    
    let count = squad.squad_members?.length || 0;
    if (squad.foreman_id) count++;
    
    return count;
  };

  // Calcola risorse effettive per un giorno (con divisioni)
  const getEffectiveResources = (date) => {
    const dateKey = formatDateISO(date);
    const squadResources = {};
    
    // Raggruppa WP per squadra attivi in questo giorno
    wpsWithDates.forEach(wp => {
      if (!wp.squad_id) return;
      
      const wpStart = parseDate(wp.planned_start);
      const wpEnd = parseDate(wp.planned_end);
      
      if (date >= wpStart && date <= wpEnd) {
        if (!squadResources[wp.squad_id]) {
          squadResources[wp.squad_id] = {
            memberCount: getSquadMemberCount(wp.squad_id),
            wps: []
          };
        }
        squadResources[wp.squad_id].wps.push(wp);
      }
    });
    
    // Calcola risorse totali
    let total = 0;
    
    Object.values(squadResources).forEach(({ memberCount, wps }) => {
      if (wps.length > 1) {
        // Controlla se almeno uno ha split_resources
        const anySplit = wps.some(wp => wp.split_resources);
        
        if (anySplit) {
          // Risorse divise: conta solo una volta
          total += memberCount;
        } else {
          // Nessuna divisione: potenziale errore di pianificazione
          // Mostra comunque il totale ma sarà evidenziato come conflitto
          total += memberCount;
        }
      } else {
        total += memberCount;
      }
    });
    
    return total;
  };

  // Calcola risorse per WP specifico in un giorno (per tooltip)
  const getWPResourcesOnDay = (wp, date) => {
    if (!wp.squad_id) return 0;
    
    const memberCount = getSquadMemberCount(wp.squad_id);
    
    // Controlla se ci sono altri WP della stessa squadra in questo giorno
    const sameSquadWPs = wpsWithDates.filter(other => {
      if (other.squad_id !== wp.squad_id) return false;
      
      const otherStart = parseDate(other.planned_start);
      const otherEnd = parseDate(other.planned_end);
      
      return date >= otherStart && date <= otherEnd;
    });
    
    if (sameSquadWPs.length > 1 && wp.split_resources) {
      return memberCount / sameSquadWPs.length;
    }
    
    return memberCount;
  };

  // ============================================================================
  // NAVIGATION & UI
  // ============================================================================

  const goToToday = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    setRangeStart(formatDateISO(start));
    setRangeEnd(formatDateISO(end));
  };

  const shiftRange = (days) => {
    const start = parseDate(rangeStart);
    const end = parseDate(rangeEnd);
    start.setDate(start.getDate() + days);
    end.setDate(end.getDate() + days);
    setRangeStart(formatDateISO(start));
    setRangeEnd(formatDateISO(end));
  };

  // Calcola posizione barra WP
  const getBarStyle = (wp) => {
    const wpStart = parseDate(wp.planned_start);
    const wpEnd = parseDate(wp.planned_end);
    if (!wpStart || !wpEnd || dates.length === 0) return null;
    
    const viewStart = dates[0];
    const viewEnd = dates[dates.length - 1];

    if (wpEnd < viewStart || wpStart > viewEnd) return null;

    const startDiff = Math.max(0, Math.round((wpStart - viewStart) / (1000 * 60 * 60 * 24)));
    const endDiff = Math.min(dates.length - 1, Math.round((wpEnd - viewStart) / (1000 * 60 * 60 * 24)));

    const left = startDiff * config.cellWidth;
    const width = Math.max(config.cellWidth, (endDiff - startDiff + 1) * config.cellWidth - 4);

    return { left, width };
  };

  // Check se oggi è visibile
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIndex = dates.findIndex(d => isSameDay(d, today));

  // Formatta header mese
  const getMonthHeaders = () => {
    if (dates.length === 0) return [];
    const headers = [];
    let currentMonth = null;
    let startIdx = 0;

    dates.forEach((date, idx) => {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (monthKey !== currentMonth) {
        if (currentMonth !== null) {
          headers.push({
            label: new Date(dates[startIdx]).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }),
            span: idx - startIdx
          });
        }
        currentMonth = monthKey;
        startIdx = idx;
      }
    });
    
    if (dates.length > 0) {
      headers.push({
        label: new Date(dates[startIdx]).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }),
        span: dates.length - startIdx
      });
    }

    return headers;
  };

  const monthHeaders = getMonthHeaders();

  // Genera etichette giorni lavorativi per la legenda
  const getWorkingDaysLabel = () => {
    const dayNames = { mon: 'Lun', tue: 'Mar', wed: 'Mer', thu: 'Gio', fri: 'Ven', sat: 'Sab', sun: 'Dom' };
    const activeDays = Object.entries(workingDays)
      .filter(([_, active]) => active)
      .map(([key, _]) => dayNames[key]);
    return activeDays.join('-');
  };

  // Conta conflitti totali
  const totalConflicts = Object.keys(wpConflicts).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b bg-gray-50">
        {/* Date Range Pickers */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Da:</label>
          <input
            type="date"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            className="px-2 py-1.5 border rounded-lg text-sm"
          />
          <label className="text-sm text-gray-600">A:</label>
          <input
            type="date"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
            className="px-2 py-1.5 border rounded-lg text-sm"
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftRange(-14)}
            className="px-3 py-1.5 bg-white border rounded-lg hover:bg-gray-100 text-sm"
          >
            ◀◀ -2 sett
          </button>
          <button
            onClick={() => shiftRange(-7)}
            className="px-3 py-1.5 bg-white border rounded-lg hover:bg-gray-100 text-sm"
          >
            ◀ -1 sett
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            📅 Oggi
          </button>
          <button
            onClick={() => shiftRange(7)}
            className="px-3 py-1.5 bg-white border rounded-lg hover:bg-gray-100 text-sm"
          >
            +1 sett ▶
          </button>
          <button
            onClick={() => shiftRange(14)}
            className="px-3 py-1.5 bg-white border rounded-lg hover:bg-gray-100 text-sm"
          >
            +2 sett ▶▶
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Zoom:</span>
          <div className="flex bg-white border rounded-lg">
            {Object.entries(zoomConfig).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setZoom(key)}
                className={`px-3 py-1.5 text-sm ${
                  zoom === key
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 border-b bg-gray-50 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded" style={{ backgroundColor: DISCIPLINE_COLORS.piping }}></div>
          <span>Piping</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded" style={{ backgroundColor: DISCIPLINE_COLORS.action }}></div>
          <span>Action</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 bg-red-500"></div>
          <span>Oggi</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded bg-gray-300"></div>
          <span>Non lavorativo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded bg-amber-200 border border-amber-400"></div>
          <span>Conflitto risorse</span>
        </div>
        <span className="text-gray-400">|</span>
        <span className="text-gray-500">
          📅 {getWorkingDaysLabel()} ({workingDaysCount}gg/sett)
        </span>
        {totalConflicts > 0 && (
          <>
            <span className="text-gray-400">|</span>
            <span className="text-amber-600 font-medium">
              ⚠️ {totalConflicts} WP con conflitti
            </span>
          </>
        )}
        <span className="text-gray-400">|</span>
        <span className="text-gray-500">Periodo: {dates.length} giorni</span>
      </div>

      {/* Gantt */}
      {dates.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          Seleziona un intervallo di date valido
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: dates.length * config.cellWidth + 300 }}>
            {/* Header Mesi */}
            <div className="flex border-b bg-gray-100">
              <div className="w-[300px] shrink-0 px-4 py-2 font-medium text-sm border-r">
                Work Package
              </div>
              <div className="flex">
                {monthHeaders.map((header, idx) => (
                  <div
                    key={idx}
                    style={{ width: header.span * config.cellWidth }}
                    className="px-2 py-2 text-sm font-medium text-center border-r text-gray-700"
                  >
                    {header.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Header Giorni */}
            <div className="flex border-b bg-gray-50">
              <div className="w-[300px] shrink-0 border-r"></div>
              <div className="flex">
                {dates.map((date, idx) => {
                  const dateKey = formatDateISO(date);
                  const isNonWorking = !isWorkingDay(date);
                  const isToday = idx === todayIndex;
                  const hasConflict = dailyConflicts[dateKey];
                  
                  return (
                    <div
                      key={idx}
                      style={{ width: config.cellWidth }}
                      className={`text-center text-xs py-1 border-r ${
                        isToday ? 'bg-red-100 text-red-700 font-bold' : 
                        isNonWorking ? 'bg-gray-200 text-gray-400' :
                        hasConflict ? 'bg-amber-100 text-amber-700' : 'text-gray-600'
                      }`}
                      title={hasConflict ? `${hasConflict.length} squadre con sovrapposizione` : ''}
                    >
                      {zoom === 'quarter' ? '' : date.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Righe WP */}
            {wpsWithDates.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                Nessun WP con date pianificate nel periodo selezionato
              </div>
            ) : (
              wpsWithDates.map(wp => {
                const barStyle = getBarStyle(wp);
                const progress = calculateProgress(wp);
                const color = DISCIPLINE_COLORS[wp.wp_type] || DISCIPLINE_COLORS.piping;
                const hasConflict = wpConflicts[wp.id];
                const conflictCount = hasConflict?.length || 0;

                return (
                  <div key={wp.id} className="flex border-b hover:bg-gray-50">
                    {/* Info WP */}
                    <div className="w-[300px] shrink-0 px-4 py-3 border-r">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                          wp.wp_type === 'piping' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {wp.code}
                        </span>
                        <span className="text-sm text-gray-700 truncate flex-1">{wp.description}</span>
                        {hasConflict && (
                          <span 
                            className="text-amber-500 cursor-help"
                            title={`Conflitto con: ${hasConflict.map(c => c.code).join(', ')}`}
                          >
                            ⚠️
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <span>
                          {wp.squad ? `Sq.${wp.squad.squad_number} (${getSquadMemberCount(wp.squad_id)} pers.)` : 'Non assegnato'}
                        </span>
                        {wp.split_resources && (
                          <span className="bg-amber-100 text-amber-700 px-1 rounded text-[10px]">
                            ➗ diviso
                          </span>
                        )}
                        <span>• {progress.toFixed(0)}%</span>
                      </div>
                    </div>

                    {/* Area Gantt */}
                    <div className="flex-1 relative" style={{ height: 50 }}>
                      {/* Griglia giorni */}
                      <div className="absolute inset-0 flex">
                        {dates.map((date, idx) => {
                          const dateKey = formatDateISO(date);
                          const isNonWorking = !isWorkingDay(date);
                          const dayConflicts = dailyConflicts[dateKey];
                          
                          // Controlla se QUESTO WP ha conflitto in questo giorno
                          const wpHasConflictOnDay = dayConflicts?.some(c => 
                            c.wps.some(cwp => cwp.id === wp.id)
                          );
                          
                          return (
                            <div
                              key={idx}
                              style={{ width: config.cellWidth }}
                              className={`border-r ${
                                isNonWorking ? 'bg-gray-100' :
                                wpHasConflictOnDay ? 'bg-amber-50' : ''
                              }`}
                            />
                          );
                        })}
                      </div>

                      {/* Marker TODAY */}
                      {todayIndex >= 0 && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                          style={{ left: todayIndex * config.cellWidth + config.cellWidth / 2 }}
                        />
                      )}

                      {/* Barra WP */}
                      {barStyle && (
                        <div
                          className={`absolute top-2 h-7 rounded-md flex items-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${
                            hasConflict ? 'ring-2 ring-amber-400 ring-offset-1' : ''
                          }`}
                          style={{
                            left: barStyle.left + 2,
                            width: barStyle.width,
                            backgroundColor: color
                          }}
                          title={`${wp.code}: ${wp.description}\n${wp.planned_start} → ${wp.planned_end}\nProgress: ${progress.toFixed(1)}%${hasConflict ? `\n⚠️ Conflitto con: ${hasConflict.map(c => c.code).join(', ')}` : ''}`}
                        >
                          {/* Progress fill */}
                          <div
                            className="absolute inset-0 bg-black/20"
                            style={{ width: `${progress}%` }}
                          />
                          {/* Conflict stripe pattern */}
                          {hasConflict && !wp.split_resources && (
                            <div 
                              className="absolute inset-0 opacity-30"
                              style={{
                                background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(245, 158, 11, 0.5) 3px, rgba(245, 158, 11, 0.5) 6px)'
                              }}
                            />
                          )}
                          {/* Label */}
                          {barStyle.width > 60 && (
                            <span className="relative z-10 text-white text-xs px-2 truncate">
                              {wp.code}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Footer Risorse */}
            <div className="border-t-2 border-gray-300">
              <div className="flex border-b bg-blue-50">
                <div className="w-[300px] shrink-0 px-4 py-2 font-medium text-sm border-r text-blue-800">
                  👥 Risorse Pianificate
                </div>
                <div className="flex">
                  {dates.map((date, idx) => {
                    const dateKey = formatDateISO(date);
                    const isNonWorking = !isWorkingDay(date);
                    const hasConflict = dailyConflicts[dateKey];
                    
                    if (isNonWorking) {
                      return (
                        <div
                          key={idx}
                          style={{ width: config.cellWidth }}
                          className="text-center text-xs py-1.5 border-r font-medium bg-gray-200 text-gray-400"
                        >
                          -
                        </div>
                      );
                    }

                    const resources = getEffectiveResources(date);
                    
                    return (
                      <div
                        key={idx}
                        style={{ width: config.cellWidth }}
                        className={`text-center text-xs py-1.5 border-r font-medium ${
                          hasConflict ? 'bg-amber-100 text-amber-700' :
                          resources > 0 ? 'bg-blue-100 text-blue-700' : 'text-gray-400'
                        }`}
                        title={hasConflict ? 'Risorse con sovrapposizione' : ''}
                      >
                        {resources > 0 ? (
                          Number.isInteger(resources) ? resources : resources.toFixed(1)
                        ) : '-'}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
