import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';

// ============================================================================
// WORK PACKAGES GANTT PAGE - Pagina separata per Gantt
// FIX #5: Gantt come pagina separata, non tab dentro WP
// ============================================================================

export default function WorkPackagesGanttPage() {
  const { activeProject, loading: projectLoading } = useProject();
  const [workPackages, setWorkPackages] = useState([]);
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterSquad, setFilterSquad] = useState('all');
  const [viewMode, setViewMode] = useState('month'); // 'week', 'month', 'quarter'

  useEffect(() => {
    if (activeProject?.id) {
      fetchData();
    }
  }, [activeProject?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: wpData } = await supabase
        .from('work_packages')
        .select(`
          *,
          squad:squads(id, squad_number, name)
        `)
        .eq('project_id', activeProject.id)
        .not('planned_start', 'is', null)
        .order('planned_start', { ascending: true });
      
      setWorkPackages(wpData || []);
      
      const { data: squadData } = await supabase
        .from('squads')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('status', 'active');
      
      setSquads(squadData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter WPs
  const filteredWPs = useMemo(() => {
    return workPackages.filter(wp => {
      if (filterType !== 'all' && wp.wp_type !== filterType) return false;
      if (filterSquad !== 'all' && wp.squad_id !== filterSquad) return false;
      return true;
    });
  }, [workPackages, filterType, filterSquad]);

  // Calculate date range
  const dateRange = useMemo(() => {
    if (filteredWPs.length === 0) {
      const now = new Date();
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 3, 0)
      };
    }
    
    let minDate = new Date();
    let maxDate = new Date();
    
    filteredWPs.forEach(wp => {
      if (wp.planned_start) {
        const start = new Date(wp.planned_start);
        if (start < minDate) minDate = start;
      }
      if (wp.planned_end) {
        const end = new Date(wp.planned_end);
        if (end > maxDate) maxDate = end;
      }
    });
    
    // Add padding
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);
    
    return { start: minDate, end: maxDate };
  }, [filteredWPs]);

  // Generate timeline columns
  const timelineColumns = useMemo(() => {
    const columns = [];
    const current = new Date(dateRange.start);
    
    while (current <= dateRange.end) {
      if (viewMode === 'week') {
        // Weekly columns
        const weekStart = new Date(current);
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        columns.push({
          key: `w-${weekStart.toISOString()}`,
          label: `W${getWeekNumber(weekStart)}`,
          sublabel: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
          start: new Date(weekStart),
          end: new Date(weekEnd)
        });
        
        current.setDate(current.getDate() + 7);
      } else if (viewMode === 'month') {
        // Monthly columns
        const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
        const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        
        columns.push({
          key: `m-${monthStart.toISOString()}`,
          label: monthStart.toLocaleDateString('it-IT', { month: 'short' }),
          sublabel: monthStart.getFullYear(),
          start: new Date(monthStart),
          end: new Date(monthEnd)
        });
        
        current.setMonth(current.getMonth() + 1);
      } else {
        // Quarterly columns
        const quarter = Math.floor(current.getMonth() / 3);
        const quarterStart = new Date(current.getFullYear(), quarter * 3, 1);
        const quarterEnd = new Date(current.getFullYear(), quarter * 3 + 3, 0);
        
        columns.push({
          key: `q-${quarterStart.toISOString()}`,
          label: `Q${quarter + 1}`,
          sublabel: quarterStart.getFullYear(),
          start: new Date(quarterStart),
          end: new Date(quarterEnd)
        });
        
        current.setMonth(current.getMonth() + 3);
      }
    }
    
    return columns;
  }, [dateRange, viewMode]);

  // Helper: Get week number
  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  // Calculate bar position
  const calculateBarPosition = (wp) => {
    if (!wp.planned_start || !wp.planned_end) return null;
    
    const wpStart = new Date(wp.planned_start);
    const wpEnd = new Date(wp.planned_end);
    const totalDays = (dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24);
    
    const startOffset = (wpStart - dateRange.start) / (1000 * 60 * 60 * 24);
    const duration = (wpEnd - wpStart) / (1000 * 60 * 60 * 24);
    
    const left = Math.max(0, (startOffset / totalDays) * 100);
    const width = Math.min(100 - left, (duration / totalDays) * 100);
    
    return { left: `${left}%`, width: `${Math.max(2, width)}%` };
  };

  // Get status color
  const getStatusColor = (status, wpType) => {
    if (status === 'completed') return 'bg-emerald-500';
    if (status === 'in_progress') return 'bg-amber-500';
    if (status === 'planned') return wpType === 'piping' ? 'bg-blue-500' : 'bg-green-500';
    return 'bg-gray-400';
  };

  if (!projectLoading && !activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p className="text-lg">Nessun progetto selezionato</p>
      </div>
    );
  }

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              📊 Gantt Work Packages
            </h1>
            <p className="text-gray-500 mt-1">{activeProject?.name} • {filteredWPs.length} WP con date pianificate</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* View mode */}
            <div className="flex border rounded-lg overflow-hidden">
              <button 
                onClick={() => setViewMode('week')} 
                className={`px-3 py-2 text-sm ${viewMode === 'week' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Settimane
              </button>
              <button 
                onClick={() => setViewMode('month')} 
                className={`px-3 py-2 text-sm border-l ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Mesi
              </button>
              <button 
                onClick={() => setViewMode('quarter')} 
                className={`px-3 py-2 text-sm border-l ${viewMode === 'quarter' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Trimestri
              </button>
            </div>
            
            {/* Filters */}
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="all">Tutti i tipi</option>
              <option value="piping">WP-P Piping</option>
              <option value="action">WP-A Action</option>
            </select>
            
            <select value={filterSquad} onChange={(e) => setFilterSquad(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="all">Tutte le squadre</option>
              {squads.map(s => <option key={s.id} value={s.id}>SQ{s.squad_number}</option>)}
            </select>
          </div>
        </div>
      </div>
      
      {/* Gantt Chart */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {filteredWPs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">📅</div>
            <p className="text-gray-500">Nessun Work Package con date pianificate</p>
            <p className="text-sm text-gray-400 mt-2">Assegna date di inizio e fine ai WP per visualizzarli nel Gantt</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Timeline Header */}
              <div className="flex border-b bg-gray-50">
                <div className="w-64 flex-shrink-0 p-3 border-r font-medium text-gray-700">
                  Work Package
                </div>
                <div className="flex-1 flex">
                  {timelineColumns.map(col => (
                    <div key={col.key} className="flex-1 text-center p-2 border-r last:border-r-0 text-xs">
                      <div className="font-medium text-gray-700">{col.label}</div>
                      <div className="text-gray-400">{col.sublabel}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Today marker column header */}
              {/* WP Rows */}
              {filteredWPs.map(wp => {
                const barPos = calculateBarPosition(wp);
                const statusColor = getStatusColor(wp.status, wp.wp_type);
                
                return (
                  <div key={wp.id} className="flex border-b hover:bg-gray-50">
                    {/* WP Info */}
                    <div className="w-64 flex-shrink-0 p-3 border-r">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{wp.wp_type === 'piping' ? '🔧' : '⚡'}</span>
                        <div>
                          <div className="font-mono font-medium text-sm">{wp.code}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[180px]">
                            {wp.squad ? `SQ${wp.squad.squad_number}` : 'Non assegnato'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Gantt Bar */}
                    <div className="flex-1 relative h-16 bg-gray-50">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex">
                        {timelineColumns.map(col => (
                          <div key={col.key} className="flex-1 border-r last:border-r-0 border-gray-200"></div>
                        ))}
                      </div>
                      
                      {/* Today line */}
                      {(() => {
                        const today = new Date();
                        if (today >= dateRange.start && today <= dateRange.end) {
                          const totalDays = (dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24);
                          const todayOffset = (today - dateRange.start) / (1000 * 60 * 60 * 24);
                          const left = (todayOffset / totalDays) * 100;
                          return (
                            <div 
                              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                              style={{ left: `${left}%` }}
                            >
                              <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Bar */}
                      {barPos && (
                        <div 
                          className={`absolute top-3 h-10 ${statusColor} rounded-lg shadow-sm flex items-center px-2 overflow-hidden transition-all hover:opacity-90 cursor-pointer group`}
                          style={{ left: barPos.left, width: barPos.width }}
                          title={`${wp.code}: ${new Date(wp.planned_start).toLocaleDateString('it-IT')} - ${new Date(wp.planned_end).toLocaleDateString('it-IT')}`}
                        >
                          <span className="text-white text-xs font-medium truncate">
                            {wp.code}
                          </span>
                          
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-20">
                            <div className="bg-gray-900 text-white text-xs rounded-lg p-2 whitespace-nowrap shadow-lg">
                              <div className="font-bold">{wp.code}</div>
                              <div>{wp.description || 'Nessuna descrizione'}</div>
                              <div className="mt-1 text-gray-300">
                                {new Date(wp.planned_start).toLocaleDateString('it-IT')} → {new Date(wp.planned_end).toLocaleDateString('it-IT')}
                              </div>
                              <div className="text-gray-300">
                                Squadra: {wp.squad ? `SQ${wp.squad.squad_number}` : 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-medium text-gray-700 mb-3">Legenda</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-sm text-gray-600">WP-P Pianificato</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-sm text-gray-600">WP-A Pianificato</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-500 rounded"></div>
            <span className="text-sm text-gray-600">In Corso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-500 rounded"></div>
            <span className="text-sm text-gray-600">Completato</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded"></div>
            <span className="text-sm text-gray-600">Non Assegnato</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-red-500"></div>
            <span className="text-sm text-gray-600">Oggi</span>
          </div>
        </div>
      </div>
    </div>
  );
}
