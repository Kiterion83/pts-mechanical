import React, { useState, useMemo } from 'react';

// ============================================================================
// WORK PACKAGES GANTT CHART
// ============================================================================

const DISCIPLINE_COLORS = {
  piping: '#3B82F6',  // blue
  action: '#10B981'   // green
};

export default function WorkPackagesGantt({ workPackages, squads, calculateProgress }) {
  const [zoom, setZoom] = useState('month');
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7);
    return today;
  });

  // Configurazione zoom
  const zoomConfig = {
    week: { days: 14, cellWidth: 40, label: 'Settimana' },
    month: { days: 31, cellWidth: 30, label: 'Mese' },
    quarter: { days: 90, cellWidth: 12, label: 'Trimestre' }
  };

  const config = zoomConfig[zoom];

  // Genera array di date
  const dates = useMemo(() => {
    const result = [];
    const current = new Date(startDate);
    for (let i = 0; i < config.days; i++) {
      result.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [startDate, config.days]);

  // Filtra WP con date
  const wpsWithDates = workPackages.filter(wp => wp.planned_start && wp.planned_end);

  // Navigazione
  const navigate = (direction) => {
    const newDate = new Date(startDate);
    const days = direction === 'prev' ? -config.days / 2 : config.days / 2;
    newDate.setDate(newDate.getDate() + days);
    setStartDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    today.setDate(today.getDate() - 7);
    setStartDate(today);
  };

  // Calcola posizione barra WP
  const getBarStyle = (wp) => {
    const wpStart = new Date(wp.planned_start);
    const wpEnd = new Date(wp.planned_end);
    const viewStart = dates[0];
    const viewEnd = dates[dates.length - 1];

    // Se completamente fuori vista
    if (wpEnd < viewStart || wpStart > viewEnd) {
      return null;
    }

    // Calcola posizione
    const startDiff = Math.max(0, Math.floor((wpStart - viewStart) / (1000 * 60 * 60 * 24)));
    const endDiff = Math.min(config.days - 1, Math.floor((wpEnd - viewStart) / (1000 * 60 * 60 * 24)));

    const left = startDiff * config.cellWidth;
    const width = Math.max(config.cellWidth, (endDiff - startDiff + 1) * config.cellWidth - 4);

    return { left, width };
  };

  // Check se oggi è visibile
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIndex = dates.findIndex(d => d.toDateString() === today.toDateString());

  // Formatta header mese
  const getMonthHeaders = () => {
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
    
    // Ultimo mese
    headers.push({
      label: new Date(dates[startIdx]).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }),
      span: dates.length - startIdx
    });

    return headers;
  };

  const monthHeaders = getMonthHeaders();

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('prev')}
            className="px-3 py-1.5 bg-white border rounded-lg hover:bg-gray-100"
          >
            ← 
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Oggi
          </button>
          <button
            onClick={() => navigate('next')}
            className="px-3 py-1.5 bg-white border rounded-lg hover:bg-gray-100"
          >
            →
          </button>
        </div>

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

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: DISCIPLINE_COLORS.piping }}></div>
            <span>Piping</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: DISCIPLINE_COLORS.action }}></div>
            <span>Action</span>
          </div>
        </div>
      </div>

      {/* Gantt */}
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
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isToday = date.toDateString() === today.toDateString();
                return (
                  <div
                    key={idx}
                    style={{ width: config.cellWidth }}
                    className={`text-center text-xs py-1 border-r ${
                      isToday ? 'bg-red-100 text-red-700 font-bold' : 
                      isWeekend ? 'bg-gray-200 text-gray-500' : 'text-gray-600'
                    }`}
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
              Nessun WP con date pianificate
            </div>
          ) : (
            wpsWithDates.map(wp => {
              const barStyle = getBarStyle(wp);
              const progress = calculateProgress(wp);
              const color = DISCIPLINE_COLORS[wp.wp_type] || DISCIPLINE_COLORS.piping;

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
                      <span className="text-sm text-gray-700 truncate">{wp.description}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {wp.squad ? `Sq.${wp.squad.squad_number}` : 'Non assegnato'} • {progress.toFixed(0)}%
                    </div>
                  </div>

                  {/* Area Gantt */}
                  <div className="flex-1 relative" style={{ height: 50 }}>
                    {/* Griglia weekend */}
                    <div className="absolute inset-0 flex">
                      {dates.map((date, idx) => {
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return (
                          <div
                            key={idx}
                            style={{ width: config.cellWidth }}
                            className={`border-r ${isWeekend ? 'bg-gray-100' : ''}`}
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
                        className="absolute top-2 h-7 rounded-md flex items-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                        style={{
                          left: barStyle.left + 2,
                          width: barStyle.width,
                          backgroundColor: color
                        }}
                        title={`${wp.code}: ${wp.description}\n${wp.planned_start} → ${wp.planned_end}\nProgress: ${progress.toFixed(1)}%`}
                      >
                        {/* Progress fill */}
                        <div
                          className="absolute inset-0 bg-black/20"
                          style={{ width: `${progress}%` }}
                        />
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
                📊 Risorse Teoriche
              </div>
              <div className="flex">
                {dates.map((date, idx) => {
                  // Conta WP attivi in questa data
                  let resources = 0;
                  wpsWithDates.forEach(wp => {
                    const wpStart = new Date(wp.planned_start);
                    const wpEnd = new Date(wp.planned_end);
                    if (date >= wpStart && date <= wpEnd) {
                      // Usa membri squadra se assegnata
                      if (wp.squad) {
                        const squad = squads.find(s => s.id === wp.squad_id);
                        resources += squad?.squad_members?.length || 0;
                      }
                    }
                  });

                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                  return (
                    <div
                      key={idx}
                      style={{ width: config.cellWidth }}
                      className={`text-center text-xs py-1.5 border-r ${
                        isWeekend ? 'bg-gray-200' : resources > 0 ? 'bg-blue-100' : ''
                      }`}
                    >
                      {resources > 0 ? resources : '-'}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex bg-green-50">
              <div className="w-[300px] shrink-0 px-4 py-2 font-medium text-sm border-r text-green-800">
                ✓ Risorse Reali
              </div>
              <div className="flex">
                {dates.map((date, idx) => {
                  const isPast = date < today;
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                  // Per ora mostra -- per date future
                  // In produzione, questo verrà da daily reports
                  return (
                    <div
                      key={idx}
                      style={{ width: config.cellWidth }}
                      className={`text-center text-xs py-1.5 border-r ${
                        isWeekend ? 'bg-gray-200' : isPast ? 'bg-green-100' : ''
                      }`}
                    >
                      {isPast ? '-' : '--'}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
