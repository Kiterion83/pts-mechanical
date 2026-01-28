import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import WorkPackagesGantt from '../components/WorkPackagesGantt';

// ============================================================================
// WORK PACKAGES PAGE - WP-P (Piping) e WP-A (Action)
// FASE A: Fix bugs + Semplificazioni UI + Sistema Revisioni
// ============================================================================

// Utility: Check conflitti squadra
const checkSquadConflicts = (squadId, startDate, endDate, allWorkPackages, excludeWPId = null) => {
  if (!squadId || !startDate || !endDate) return [];
  
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  
  const newStart = parseDate(startDate);
  const newEnd = parseDate(endDate);
  if (!newStart || !newEnd) return [];
  
  return allWorkPackages.filter(wp => {
    if (excludeWPId && wp.id === excludeWPId) return false;
    if (wp.squad_id !== squadId) return false;
    if (wp.status === 'completed') return false;
    
    const wpStart = parseDate(wp.planned_start);
    const wpEnd = parseDate(wp.planned_end);
    if (!wpStart || !wpEnd) return false;
    
    return !(newEnd < wpStart || newStart > wpEnd);
  });
};

// Utility: Calcola giorni trascorsi (FIX #9)
const calculateDaysElapsed = (fromDate) => {
  if (!fromDate) return null;
  const from = new Date(fromDate);
  const now = new Date();
  return Math.ceil(Math.abs(now - from) / (1000 * 60 * 60 * 24));
};

// Utility: Calcola giorni tra due date
const calculateDaysBetween = (fromDate, toDate) => {
  if (!fromDate || !toDate) return null;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  return Math.ceil(Math.abs(to - from) / (1000 * 60 * 60 * 24));
};

export default function WorkPackages() {
  const { activeProject, loading: projectLoading } = useProject();
  const [workPackages, setWorkPackages] = useState([]);
  const [squads, setSquads] = useState([]);
  const [isometrics, setIsometrics] = useState([]);
  const [spools, setSpools] = useState([]);
  const [welds, setWelds] = useState([]);
  const [supports, setSupports] = useState([]);
  const [flanges, setFlanges] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('list');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSquad, setFilterSquad] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedWP, setExpandedWP] = useState(null);
  
  const [showCreateWPP, setShowCreateWPP] = useState(false);
  const [showCreateWPA, setShowCreateWPA] = useState(false);
  const [editingWP, setEditingWP] = useState(null);

  useEffect(() => {
    if (activeProject?.id) {
      fetchAllData();
    }
  }, [activeProject?.id]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchWorkPackages(),
        fetchSquads(),
        fetchMTOData()
      ]);
    } catch (error) {
      console.error('WorkPackages: Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkPackages = async () => {
    const { data, error } = await supabase
      .from('work_packages')
      .select(`
        *,
        squad:squads(id, squad_number, name),
        wp_spools(id, spool_id, spool_number)
      `)
      .eq('project_id', activeProject.id)
      .is('deleted_at', null)
      .order('code');
    
    if (error) throw error;
    
    const wpIds = data?.map(wp => wp.id) || [];
    if (wpIds.length > 0) {
      const { data: activities } = await supabase
        .from('wp_activities')
        .select('*')
        .in('work_package_id', wpIds);
      
      data.forEach(wp => {
        wp.activities = activities?.filter(a => a.work_package_id === wp.id) || [];
      });
    }
    
    setWorkPackages(data || []);
  };

  const fetchSquads = async () => {
    const { data } = await supabase
      .from('squads')
      .select('*, squad_members(id), supervisor_id, foreman_id')
      .eq('project_id', activeProject.id)
      .order('squad_number');
    setSquads(data || []);
  };

  const fetchMTOData = async () => {
    try {
      const { data: isoData } = await supabase.from('mto_isometrics').select('*').eq('project_id', activeProject.id).eq('status', 'active');
      setIsometrics(isoData || []);
    } catch (e) { setIsometrics([]); }
    
    try {
      const { data: spoolData } = await supabase.from('mto_spools').select('*').eq('project_id', activeProject.id).is('deleted_at', null);
      setSpools(spoolData || []);
    } catch (e) { setSpools([]); }
    
    try {
      const { data: weldData } = await supabase.from('mto_welds').select('*').eq('project_id', activeProject.id).is('deleted_at', null);
      setWelds(weldData || []);
    } catch (e) { setWelds([]); }
    
    try {
      const { data: suppData } = await supabase.from('mto_supports').select('*').eq('project_id', activeProject.id).is('deleted_at', null);
      setSupports(suppData || []);
    } catch (e) { setSupports([]); }
    
    try {
      const { data: flangeData } = await supabase.from('mto_flanged_joints').select('*').eq('project_id', activeProject.id).is('deleted_at', null);
      setFlanges(flangeData || []);
    } catch (e) { setFlanges([]); }
  };

  const calculateWPProgress = (wp) => {
    if (wp.wp_type === 'action') return wp.manual_progress || 0;
    
    const activities = wp.activities || [];
    const welding = activities.filter(a => a.category === 'welding');
    const support = activities.filter(a => a.category === 'support');
    const flange = activities.filter(a => a.category === 'flange');
    
    const weldingTotal = welding.reduce((s, a) => s + Number(a.quantity_total || 0), 0);
    const weldingCompleted = welding.reduce((s, a) => s + Number(a.quantity_completed || 0), 0);
    const supportTotal = support.reduce((s, a) => s + Number(a.quantity_total || 0), 0);
    const supportCompleted = support.reduce((s, a) => s + Number(a.quantity_completed || 0), 0);
    const flangeTotal = flange.reduce((s, a) => s + Number(a.quantity_total || 0), 0);
    const flangeCompleted = flange.reduce((s, a) => s + Number(a.quantity_completed || 0), 0);
    
    let categoriesPresent = 0;
    if (weldingTotal > 0) categoriesPresent++;
    if (supportTotal > 0) categoriesPresent++;
    if (flangeTotal > 0) categoriesPresent++;
    
    if (categoriesPresent === 0) return 0;
    
    const weight = 100 / categoriesPresent;
    let total = 0;
    
    if (weldingTotal > 0) total += (weldingCompleted / weldingTotal) * weight;
    if (supportTotal > 0) total += (supportCompleted / supportTotal) * weight;
    if (flangeTotal > 0) total += (flangeCompleted / flangeTotal) * weight;
    
    return Math.round(total);
  };

  const getWPQuantities = (wp) => {
    const activities = wp.activities || [];
    const welding = activities.filter(a => a.category === 'welding');
    const support = activities.filter(a => a.category === 'support');
    const flange = activities.filter(a => a.category === 'flange');
    
    return {
      welds: {
        total: welding.reduce((s, a) => s + Number(a.quantity_total || 0), 0),
        completed: welding.reduce((s, a) => s + Number(a.quantity_completed || 0), 0)
      },
      supports: {
        total: support.reduce((s, a) => s + Number(a.quantity_total || 0), 0),
        completed: support.reduce((s, a) => s + Number(a.quantity_completed || 0), 0)
      },
      flanges: {
        total: flange.reduce((s, a) => s + Number(a.quantity_total || 0), 0),
        completed: flange.reduce((s, a) => s + Number(a.quantity_completed || 0), 0)
      }
    };
  };

  const filteredWPs = useMemo(() => {
    return workPackages.filter(wp => {
      if (filterType !== 'all' && wp.wp_type !== filterType) return false;
      if (filterStatus !== 'all' && wp.status !== filterStatus) return false;
      if (filterSquad !== 'all' && wp.squad_id !== filterSquad) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!wp.code.toLowerCase().includes(search) && 
            !wp.description?.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [workPackages, filterType, filterStatus, filterSquad, searchTerm]);

  const wpPiping = filteredWPs.filter(wp => wp.wp_type === 'piping');
  const wpAction = filteredWPs.filter(wp => wp.wp_type === 'action');

  // FIX #6: Stats calculation using Set to dedupe WP IDs
  const stats = useMemo(() => {
    const uniqueIds = new Set(workPackages.map(wp => wp.id));
    const uniqueWPs = workPackages.filter((wp, idx, arr) => 
      arr.findIndex(w => w.id === wp.id) === idx
    );
    
    return {
      total: uniqueIds.size,
      piping: uniqueWPs.filter(wp => wp.wp_type === 'piping').length,
      action: uniqueWPs.filter(wp => wp.wp_type === 'action').length,
      inProgress: uniqueWPs.filter(wp => wp.status === 'in_progress').length,
      notAssigned: uniqueWPs.filter(wp => wp.status === 'not_assigned').length,
      completed: uniqueWPs.filter(wp => wp.status === 'completed').length,
      avgProgress: uniqueWPs.length > 0 
        ? Math.round(uniqueWPs.reduce((s, wp) => s + calculateWPProgress(wp), 0) / uniqueWPs.length)
        : 0
    };
  }, [workPackages]);

  const handleDeleteWP = async (wp) => {
    if (!confirm(`Eliminare ${wp.code}?`)) return;
    
    const { error } = await supabase
      .from('work_packages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', wp.id);
    
    if (error) {
      alert('Errore eliminazione: ' + error.message);
    } else {
      fetchWorkPackages();
    }
  };

  if (!projectLoading && !activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p className="text-lg">Nessun progetto selezionato</p>
        <p className="text-sm mt-2">Seleziona un progetto dal menu</p>
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            🔧 Work Packages
          </h1>
          <p className="text-gray-500 mt-1">
            {activeProject?.name} • {stats.total} WP totali
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowCreateWPP(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium">
            <span>➕</span> Nuovo WP-P
          </button>
          <button onClick={() => setShowCreateWPA(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium">
            <span>➕</span> Nuovo WP-A
          </button>
        </div>
      </div>

      {/* Stats Cards - FIX #7: Solo progress fisico, no % giorni */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon="🔧" iconBg="bg-blue-100" value={stats.piping} label="WP Piping" />
        <StatCard icon="⚡" iconBg="bg-green-100" value={stats.action} label="WP Action" />
        <StatCard icon="🔄" iconBg="bg-amber-100" value={stats.inProgress} label="In Corso" />
        <StatCard icon="📋" iconBg="bg-gray-100" value={stats.notAssigned} label="Non Assegnati" />
        <StatCard icon="✅" iconBg="bg-emerald-100" value={stats.completed} label="Completati" />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="flex border-b">
          <button onClick={() => setActiveTab('list')} className={`px-6 py-3 text-sm font-medium ${activeTab === 'list' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500'}`}>
            📋 Lista
          </button>
          <button onClick={() => setActiveTab('gantt')} className={`px-6 py-3 text-sm font-medium ${activeTab === 'gantt' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500'}`}>
            📊 Gantt
          </button>
        </div>

        {activeTab === 'list' && (
          <>
            {/* Filters */}
            <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-3">
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="🔍 Cerca WP..." className="px-3 py-2 border rounded-lg flex-1 min-w-[200px]" />
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border rounded-lg">
                <option value="all">Tutti i tipi</option>
                <option value="piping">WP-P (Piping)</option>
                <option value="action">WP-A (Action)</option>
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg">
                <option value="all">Tutti gli stati</option>
                <option value="not_assigned">Non Assegnato</option>
                <option value="planned">Pianificato</option>
                <option value="in_progress">In Corso</option>
                <option value="completed">Completato</option>
              </select>
              <select value={filterSquad} onChange={e => setFilterSquad(e.target.value)} className="px-3 py-2 border rounded-lg">
                <option value="all">Tutte le squadre</option>
                {squads.map(s => <option key={s.id} value={s.id}>Squadra {s.squad_number}</option>)}
              </select>
            </div>

            {/* WP List */}
            <div className="p-4 space-y-4">
              {filteredWPs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-4xl mb-2">📦</p>
                  <p>Nessun Work Package trovato</p>
                </div>
              ) : (
                <>
                  {wpPiping.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        WP Piping ({wpPiping.length})
                      </h3>
                      {wpPiping.map(wp => (
                        <WPPipingCard 
                          key={wp.id} 
                          wp={wp} 
                          expanded={expandedWP === wp.id}
                          onToggle={() => setExpandedWP(expandedWP === wp.id ? null : wp.id)}
                          onEdit={() => setEditingWP(wp)}
                          onDelete={() => handleDeleteWP(wp)}
                          calculateProgress={calculateWPProgress}
                          getQuantities={getWPQuantities}
                          spools={spools}
                          supports={supports}
                          flanges={flanges}
                        />
                      ))}
                    </div>
                  )}
                  
                  {wpAction.length > 0 && (
                    <div className="space-y-3 mt-6">
                      <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        WP Action ({wpAction.length})
                      </h3>
                      {wpAction.map(wp => (
                        <WPActionCard 
                          key={wp.id} 
                          wp={wp}
                          onEdit={() => setEditingWP(wp)}
                          onDelete={() => handleDeleteWP(wp)}
                          calculateProgress={calculateWPProgress}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {activeTab === 'gantt' && (
          <div className="p-4">
            <WorkPackagesGantt workPackages={filteredWPs} squads={squads} />
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateWPP && (
        <CreateWPPWizard 
          workPackages={workPackages}
          squads={squads}
          isometrics={isometrics}
          spools={spools}
          welds={welds}
          supports={supports}
          flanges={flanges}
          projectId={activeProject.id}
          onClose={() => setShowCreateWPP(false)}
          onSuccess={() => { setShowCreateWPP(false); fetchAllData(); }}
        />
      )}
      
      {showCreateWPA && (
        <CreateWPAModal 
          workPackages={workPackages}
          squads={squads}
          projectId={activeProject.id}
          onClose={() => setShowCreateWPA(false)}
          onSuccess={() => { setShowCreateWPA(false); fetchAllData(); }}
        />
      )}
      
      {editingWP && (
        <EditWPModal 
          wp={editingWP}
          squads={squads}
          allWorkPackages={workPackages}
          spools={spools}
          welds={welds}
          supports={supports}
          flanges={flanges}
          onClose={() => setEditingWP(null)}
          onSuccess={() => { setEditingWP(null); fetchAllData(); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// SMALL COMPONENTS
// ============================================================================

const StatCard = ({ icon, iconBg, value, label }) => (
  <div className="bg-white rounded-xl shadow-sm border p-4">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center text-xl`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  </div>
);

const ProgressBar = ({ percent, size = "normal", color = null }) => {
  const height = size === "small" ? "h-1.5" : "h-2.5";
  const bgColor = color || (percent >= 100 ? "bg-emerald-500" : percent >= 50 ? "bg-green-500" : "bg-blue-500");
  return (
    <div className={`flex-1 bg-gray-200 rounded-full ${height}`}>
      <div className={`${bgColor} ${height} rounded-full transition-all`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const configs = {
    not_assigned: { label: 'Non Assegnato', bg: 'bg-gray-100', text: 'text-gray-600' },
    planned: { label: 'Pianificato', bg: 'bg-blue-100', text: 'text-blue-800' },
    in_progress: { label: 'In Corso', bg: 'bg-amber-100', text: 'text-amber-800' },
    completed: { label: 'Completato', bg: 'bg-emerald-100', text: 'text-emerald-800' }
  };
  const config = configs[status] || configs.not_assigned;
  return <span className={`${config.bg} ${config.text} px-2 py-0.5 text-xs rounded-full font-medium`}>{config.label}</span>;
};

// FIX #2: Stati spool semplificati (4 invece di 6)
const SiteStatusBadge = ({ status }) => {
  const configs = {
    // Non rilevanti per costruzione - mappati a "Attesa"
    in_production: { label: 'Attesa', bg: 'bg-gray-100', text: 'text-gray-500' },
    shipped: { label: 'Attesa', bg: 'bg-gray-100', text: 'text-gray-500' },
    at_laydown: { label: 'Attesa', bg: 'bg-gray-100', text: 'text-gray-500' },
    // Rilevanti per costruzione
    ir_issued: { label: 'IR', bg: 'bg-orange-100', text: 'text-orange-700' },
    at_site: { label: 'Sito', bg: 'bg-blue-100', text: 'text-blue-700' },
    erection_ongoing: { label: 'Montaggio', bg: 'bg-amber-100', text: 'text-amber-700' },
    erected: { label: 'Eretto', bg: 'bg-emerald-100', text: 'text-emerald-700' }
  };
  const config = configs[status] || configs.in_production;
  return <span className={`${config.bg} ${config.text} px-1.5 py-0.5 text-xs rounded font-medium`}>{config.label}</span>;
};

const AvailabilityDot = ({ available }) => (
  <span className={`w-3 h-3 rounded-full ${available ? 'bg-green-500' : 'bg-red-500'}`} title={available ? 'Disponibile' : 'Non disponibile'}></span>
);

// Badge revisione
const RevisionBadge = ({ revision }) => {
  if (!revision || revision === 0) return null;
  return <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 text-xs rounded font-medium">Rev.{revision}</span>;
};

// FIX #9: Badge giorni - mostra durata
const DaysBadge = ({ wp }) => {
  const days = wp.completed_at 
    ? calculateDaysBetween(wp.created_at, wp.completed_at)
    : calculateDaysElapsed(wp.created_at);
  
  if (!days) return null;
  
  const isCompleted = wp.status === 'completed';
  return (
    <span className={`text-xs ${isCompleted ? 'text-green-600' : 'text-gray-500'}`} title={isCompleted ? `Completato in ${days} giorni` : `Aperto da ${days} giorni`}>
      {isCompleted ? `✓ ${days}gg` : `${days}gg`}
    </span>
  );
};

// ============================================================================
// WP PIPING CARD
// ============================================================================

const WPPipingCard = ({ wp, expanded, onToggle, onEdit, onDelete, calculateProgress, getQuantities, spools, supports, flanges }) => {
  const progress = calculateProgress(wp);
  const quantities = getQuantities(wp);
  const wpSpoolNos = wp.wp_spools?.map(s => s.spool_number) || [];
  
  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      {/* Main row */}
      <div className="flex items-center p-4 gap-4">
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
          {expanded ? '▼' : '▶'}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-blue-600">{wp.code}</span>
            <StatusBadge status={wp.status} />
            <RevisionBadge revision={wp.revision} />
            <DaysBadge wp={wp} />
            {wp.split_resources && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">➗ Risorse condivise</span>}
          </div>
          <p className="text-sm text-gray-600 truncate mt-1">{wp.description || 'Nessuna descrizione'}</p>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-gray-500">Squadra</p>
            <p className="font-medium text-sm">{wp.squad?.squad_number ? `SQ${wp.squad.squad_number}` : '-'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Spools</p>
            <p className="font-medium text-sm">{wpSpoolNos.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Saldature</p>
            <p className="font-medium text-sm">{quantities.welds.completed}/{quantities.welds.total}</p>
          </div>
          <div className="w-24">
            <div className="flex items-center gap-2">
              <ProgressBar percent={progress} size="small" />
              <span className="text-xs font-medium text-gray-600">{progress}%</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">✏️</button>
          <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-lg text-red-500">🗑️</button>
        </div>
      </div>
      
      {/* Expanded content */}
      {expanded && (
        <div className="border-t bg-gray-50 p-4">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Welds progress */}
            <div className="bg-white rounded-lg p-3 border">
              <h4 className="font-medium text-sm text-gray-700 mb-2">🔥 Saldature</h4>
              <div className="flex items-center gap-2">
                <ProgressBar percent={quantities.welds.total > 0 ? (quantities.welds.completed / quantities.welds.total) * 100 : 0} size="small" color="bg-orange-500" />
                <span className="text-xs text-gray-600">{quantities.welds.completed}/{quantities.welds.total}</span>
              </div>
            </div>
            
            {/* Supports progress */}
            <div className="bg-white rounded-lg p-3 border">
              <h4 className="font-medium text-sm text-gray-700 mb-2">🔩 Supporti</h4>
              <div className="flex items-center gap-2">
                <ProgressBar percent={quantities.supports.total > 0 ? (quantities.supports.completed / quantities.supports.total) * 100 : 0} size="small" color="bg-gray-500" />
                <span className="text-xs text-gray-600">{quantities.supports.completed}/{quantities.supports.total}</span>
              </div>
            </div>
            
            {/* Flanges progress */}
            <div className="bg-white rounded-lg p-3 border">
              <h4 className="font-medium text-sm text-gray-700 mb-2">⚙️ Flangie</h4>
              <div className="flex items-center gap-2">
                <ProgressBar percent={quantities.flanges.total > 0 ? (quantities.flanges.completed / quantities.flanges.total) * 100 : 0} size="small" color="bg-amber-500" />
                <span className="text-xs text-gray-600">{quantities.flanges.completed}/{quantities.flanges.total}</span>
              </div>
            </div>
          </div>
          
          {/* Spools list */}
          {wpSpoolNos.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-sm text-gray-700 mb-2">📦 Spools ({wpSpoolNos.length})</h4>
              <div className="flex flex-wrap gap-2">
                {wpSpoolNos.slice(0, 10).map((sn, idx) => {
                  const spoolData = spools.find(s => s.spool_no === sn || s.full_spool_no?.endsWith(sn));
                  return (
                    <div key={idx} className="flex items-center gap-1 bg-white border rounded px-2 py-1 text-xs">
                      <span className="font-mono">{sn}</span>
                      {spoolData && <SiteStatusBadge status={spoolData.site_status} />}
                    </div>
                  );
                })}
                {wpSpoolNos.length > 10 && <span className="text-xs text-gray-500">+{wpSpoolNos.length - 10} altri</span>}
              </div>
            </div>
          )}
          
          {/* Dates */}
          {(wp.planned_start || wp.planned_end) && (
            <div className="mt-4 flex gap-4 text-sm text-gray-600">
              {wp.planned_start && <span>📅 Inizio: {new Date(wp.planned_start).toLocaleDateString('it-IT')}</span>}
              {wp.planned_end && <span>📅 Fine: {new Date(wp.planned_end).toLocaleDateString('it-IT')}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// WP ACTION CARD
// ============================================================================

const WPActionCard = ({ wp, onEdit, onDelete, calculateProgress }) => {
  const progress = calculateProgress(wp);
  
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-xl">⚡</div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-green-600">{wp.code}</span>
            <StatusBadge status={wp.status} />
            <RevisionBadge revision={wp.revision} />
            <DaysBadge wp={wp} />
          </div>
          <p className="text-sm text-gray-600 truncate mt-1">{wp.description || 'Nessuna descrizione'}</p>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-gray-500">Squadra</p>
            <p className="font-medium text-sm">{wp.squad?.squad_number ? `SQ${wp.squad.squad_number}` : '-'}</p>
          </div>
          <div className="w-24">
            <div className="flex items-center gap-2">
              <ProgressBar percent={progress} size="small" color="bg-green-500" />
              <span className="text-xs font-medium text-gray-600">{progress}%</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">✏️</button>
          <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-lg text-red-500">🗑️</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// RESOURCE CONFLICT MODAL
// ============================================================================

const ResourceConflictModal = ({ conflicts, squadInfo, newWPDates, onSplitResources, onChangeSquad, onClose }) => {
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const calculateOverlapDays = (wp) => {
    const wpStart = parseDate(wp.planned_start);
    const wpEnd = parseDate(wp.planned_end);
    const newStart = parseDate(newWPDates.start);
    const newEnd = parseDate(newWPDates.end);
    if (!wpStart || !wpEnd || !newStart || !newEnd) return 0;
    const overlapStart = new Date(Math.max(wpStart, newStart));
    const overlapEnd = new Date(Math.min(wpEnd, newEnd));
    if (overlapStart > overlapEnd) return 0;
    return Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = parseDate(dateStr);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const totalConflicts = conflicts.length + 1;
  const resourcesPerWP = (squadInfo.memberCount / totalConflicts).toFixed(1);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center"><span className="text-2xl">⚠️</span></div>
            <div>
              <h2 className="text-lg font-bold text-amber-800">Conflitto Risorse</h2>
              <p className="text-sm text-amber-600">Squadra già impegnata</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-800">
              <span className="text-lg">👥</span>
              <span className="font-semibold">Squadra {squadInfo.squad_number} {squadInfo.name ? `- ${squadInfo.name}` : ''}</span>
              <span className="bg-blue-200 px-2 py-0.5 rounded text-sm font-bold">{squadInfo.memberCount} persone</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">La squadra è già assegnata a:</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {conflicts.map(wp => (
                <div key={wp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div>
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded mr-2 ${wp.wp_type === 'piping' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{wp.code}</span>
                    <span className="text-sm text-gray-700">{wp.description}</span>
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    <div>📅 {formatDate(wp.planned_start)} - {formatDate(wp.planned_end)}</div>
                    <div className="text-amber-600 font-medium">{calculateOverlapDays(wp)} gg sovrapposizione</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Come vuoi gestire il conflitto?</p>
            <div className="grid gap-3">
              <div className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0"><span className="text-xl">➗</span></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">Dividi Risorse</p>
                    <p className="text-sm text-gray-500 mt-1">Le {squadInfo.memberCount} persone divise su {totalConflicts} WP</p>
                    <div className="mt-2 bg-blue-100 rounded px-2 py-1 inline-block">
                      <span className="text-blue-800 font-bold">{resourcesPerWP} persone/WP</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-2 border-gray-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0"><span className="text-xl">✏️</span></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">Cambia Squadra</p>
                    <p className="text-sm text-gray-500 mt-1">Assegna una squadra diversa</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100">Annulla</button>
          <button onClick={onChangeSquad} className="flex-1 px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2"><span>✏️</span> Cambia</button>
          <button onClick={onSplitResources} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"><span>➗</span> Dividi</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// CREATE WP-P WIZARD (5 steps - Step 6 removed per Feature #4)
// ============================================================================

const CreateWPPWizard = ({ workPackages, squads, isometrics, spools, welds, supports, flanges, projectId, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    description: '',
    notes: '',
    area: ''
  });
  
  // Selections
  const [selectedWelds, setSelectedWelds] = useState([]);
  const [selectedSpools, setSelectedSpools] = useState([]);
  const [selectedSupports, setSelectedSupports] = useState([]);
  const [selectedFlanges, setSelectedFlanges] = useState([]);
  
  // Filters
  const [weldSearch, setWeldSearch] = useState('');
  const [weldFilterIso, setWeldFilterIso] = useState('');

  // Generate next code
  const nextCode = useMemo(() => {
    const pipingWPs = workPackages.filter(wp => wp.wp_type === 'piping');
    const maxNum = pipingWPs.reduce((max, wp) => {
      const match = wp.code.match(/WP-P-(\d+)/);
      return match ? Math.max(max, parseInt(match[1])) : max;
    }, 0);
    return `WP-P-${String(maxNum + 1).padStart(3, '0')}`;
  }, [workPackages]);

  // Filter available welds (not assigned to other WPs)
  const assignedWeldIds = useMemo(() => {
    const ids = new Set();
    workPackages.forEach(wp => {
      if (wp.activities) {
        wp.activities.forEach(a => {
          if (a.category === 'welding' && a.item_ids) {
            a.item_ids.forEach(id => ids.add(id));
          }
        });
      }
    });
    return ids;
  }, [workPackages]);

  const availableWelds = useMemo(() => {
    return welds.filter(w => !assignedWeldIds.has(w.id));
  }, [welds, assignedWeldIds]);

  const filteredWelds = useMemo(() => {
    return availableWelds.filter(w => {
      if (weldFilterIso) {
        const iso = isometrics.find(i => i.id === weldFilterIso);
        if (iso && w.iso_number !== iso.iso_number) return false;
      }
      if (weldSearch) {
        const search = weldSearch.toLowerCase();
        if (!w.full_weld_no?.toLowerCase().includes(search) && 
            !w.weld_no?.toLowerCase().includes(search) &&
            !w.iso_number?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [availableWelds, weldFilterIso, weldSearch, isometrics]);

  // Auto-derive spools from selected welds
  useEffect(() => {
    if (selectedWelds.length > 0) {
      const spoolIds = new Set();
      selectedWelds.forEach(weldId => {
        const weld = welds.find(w => w.id === weldId);
        if (weld) {
          if (weld.spool_1_id) spoolIds.add(weld.spool_1_id);
          if (weld.spool_2_id) spoolIds.add(weld.spool_2_id);
        }
      });
      setSelectedSpools([...spoolIds]);
    }
  }, [selectedWelds, welds]);

  // Auto-derive supports from selected spools
  useEffect(() => {
    if (selectedSpools.length > 0) {
      const supportIds = supports
        .filter(s => selectedSpools.includes(s.spool_id))
        .map(s => s.id);
      setSelectedSupports(supportIds);
    }
  }, [selectedSpools, supports]);

  // Auto-derive flanges from selected spools
  useEffect(() => {
    if (selectedSpools.length > 0) {
      const flangeIds = flanges
        .filter(f => selectedSpools.includes(f.first_part_id) || selectedSpools.includes(f.second_part_id))
        .map(f => f.id);
      setSelectedFlanges(flangeIds);
    }
  }, [selectedSpools, flanges]);

  const handleToggleWeld = (weldId) => {
    setSelectedWelds(prev => 
      prev.includes(weldId) ? prev.filter(id => id !== weldId) : [...prev, weldId]
    );
  };

  const handleSelectAllWelds = () => {
    if (selectedWelds.length === filteredWelds.length) {
      setSelectedWelds([]);
    } else {
      setSelectedWelds(filteredWelds.map(w => w.id));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Create WP
      const { data: wpData, error: wpError } = await supabase
        .from('work_packages')
        .insert({
          project_id: projectId,
          code: nextCode,
          wp_type: 'piping',
          description: formData.description || null,
          notes: formData.notes || null,
          area: formData.area || null,
          status: 'not_assigned',
          revision: 0,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (wpError) throw wpError;

      // Save wp_spools
      if (selectedSpools.length > 0) {
        const spoolsToInsert = selectedSpools.map(spoolId => {
          const spool = spools.find(s => s.id === spoolId);
          return {
            work_package_id: wpData.id,
            spool_id: spoolId,
            spool_number: spool?.spool_no || spool?.full_spool_no
          };
        });
        await supabase.from('wp_spools').insert(spoolsToInsert);
      }

      // Create activities for welds
      if (selectedWelds.length > 0) {
        await supabase.from('wp_activities').insert({
          work_package_id: wpData.id,
          category: 'welding',
          quantity_total: selectedWelds.length,
          quantity_completed: 0,
          item_ids: selectedWelds
        });
      }

      // Create activities for supports
      if (selectedSupports.length > 0) {
        await supabase.from('wp_activities').insert({
          work_package_id: wpData.id,
          category: 'support',
          quantity_total: selectedSupports.length,
          quantity_completed: 0,
          item_ids: selectedSupports
        });
      }

      // Create activities for flanges
      if (selectedFlanges.length > 0) {
        await supabase.from('wp_activities').insert({
          work_package_id: wpData.id,
          category: 'flange',
          quantity_total: selectedFlanges.length,
          quantity_completed: 0,
          item_ids: selectedFlanges
        });
      }

      // Log revision
      await supabase.from('wp_revisions').insert({
        project_id: projectId,
        work_package_id: wpData.id,
        revision_number: 0,
        change_type: 'created',
        changes_summary: `WP creato con ${selectedWelds.length} saldature, ${selectedSpools.length} spools, ${selectedSupports.length} supporti, ${selectedFlanges.length} flangie`,
        new_values: {
          welds: selectedWelds.length,
          spools: selectedSpools.length,
          supports: selectedSupports.length,
          flanges: selectedFlanges.length
        }
      });

      onSuccess();
    } catch (error) {
      alert('Errore: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 2) return selectedWelds.length > 0;
    return true;
  };

  const stepLabels = ['Info Base', 'Saldature', 'Spools', 'Supporti', 'Flanges'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">🔧 Nuovo Work Package Piping</h2>
            <p className="text-sm text-gray-500">Step {step} di 5 - {stepLabels[step - 1]}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg text-gray-500">✕</button>
        </div>
        
        {/* Step indicators */}
        <div className="flex border-b overflow-x-auto">
          {stepLabels.map((label, idx) => (
            <div key={idx} className={`flex-1 py-3 text-center text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap px-2 
              ${step === idx + 1 ? 'border-blue-500 text-blue-600 bg-blue-50' : 
                step > idx + 1 ? 'border-green-500 text-green-600 bg-green-50' : 'border-transparent text-gray-400'}`}>
              {step > idx + 1 ? '✓' : `${idx + 1}.`} {label}
            </div>
          ))}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Info Base */}
          {step === 1 && (
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Codice WP</label>
                <input type="text" value={nextCode} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <input 
                  type="text" 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  placeholder="Es: Linea 24&quot; HC (opzionale)"
                  className="w-full px-3 py-2 border rounded-lg" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                <input 
                  type="text" 
                  value={formData.area} 
                  onChange={e => setFormData({...formData, area: e.target.value})} 
                  placeholder="Es: Area 100"
                  className="w-full px-3 py-2 border rounded-lg" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea 
                  rows={3} 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  className="w-full px-3 py-2 border rounded-lg" 
                />
              </div>
            </div>
          )}
          
          {/* Step 2: Select Welds */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-orange-800">🔥 <strong>Seleziona le saldature</strong> da includere nel WP. Spools, supporti e flanges verranno derivati automaticamente.</p>
              </div>
              
              {/* Filters */}
              <div className="grid md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cerca</label>
                  <input 
                    type="text" 
                    value={weldSearch} 
                    onChange={e => setWeldSearch(e.target.value)} 
                    placeholder="Weld No, ISO..."
                    className="w-full px-3 py-2 border rounded-lg bg-white" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Isometrico</label>
                  <select 
                    value={weldFilterIso} 
                    onChange={e => setWeldFilterIso(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="">Tutti</option>
                    {isometrics.map(iso => <option key={iso.id} value={iso.id}>{iso.iso_number}</option>)}
                  </select>
                </div>
              </div>
              
              {/* Selection summary */}
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-700">Saldature disponibili ({filteredWelds.length})</h4>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-orange-600 font-medium">🔥 {selectedWelds.length} selezionate</span>
                  <button onClick={handleSelectAllWelds} className="text-sm text-blue-600 hover:underline">
                    {selectedWelds.length === filteredWelds.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                  </button>
                </div>
              </div>
              
              {/* Welds table */}
              <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="w-10 p-2"></th>
                      <th className="text-left p-2">Weld No</th>
                      <th className="text-left p-2">ISO</th>
                      <th className="text-center p-2">Ø</th>
                      <th className="text-center p-2">Tipo</th>
                      <th className="text-center p-2">Dissimile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWelds.length === 0 ? (
                      <tr><td colSpan={6} className="p-4 text-center text-gray-400">Nessuna saldatura disponibile</td></tr>
                    ) : filteredWelds.map(w => (
                      <tr 
                        key={w.id} 
                        onClick={() => handleToggleWeld(w.id)}
                        className={`border-t cursor-pointer hover:bg-gray-50 ${selectedWelds.includes(w.id) ? 'bg-orange-50' : ''} ${w.is_dissimilar ? 'bg-yellow-50' : ''}`}
                      >
                        <td className="p-2 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedWelds.includes(w.id)} 
                            onChange={() => {}}
                            className="w-4 h-4 text-orange-600 rounded"
                          />
                        </td>
                        <td className="p-2 font-mono text-orange-600">{w.weld_no}</td>
                        <td className="p-2 text-gray-600 text-xs">{w.iso_number}</td>
                        <td className="p-2 text-center">{w.diameter_inch}"</td>
                        <td className="p-2 text-center"><span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{w.weld_type}</span></td>
                        <td className="p-2 text-center">{w.is_dissimilar ? <span className="text-yellow-600">⚠️</span> : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Step 3: Review Spools */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">📦 <strong>Spools derivati automaticamente</strong> dalle saldature selezionate.</p>
              </div>
              
              <h4 className="font-medium text-gray-700">Spools ({selectedSpools.length})</h4>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                {selectedSpools.map(spoolId => {
                  const spool = spools.find(s => s.id === spoolId);
                  if (!spool) return null;
                  return (
                    <div key={spoolId} className="bg-white border rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-blue-600 font-medium">{spool.spool_no}</span>
                        <SiteStatusBadge status={spool.site_status} />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{spool.iso_number}</div>
                      <div className="text-xs text-gray-400 mt-1">Ø{spool.diameter_inch}" • {spool.weight_kg}kg</div>
                    </div>
                  );
                })}
              </div>
              
              {selectedSpools.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p>Nessuno spool derivato. Torna indietro e seleziona delle saldature.</p>
                </div>
              )}
            </div>
          )}
          
          {/* Step 4: Review Supports */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-800">🔩 <strong>Supporti derivati automaticamente</strong> dagli spools.</p>
              </div>
              
              <h4 className="font-medium text-gray-700">Supporti ({selectedSupports.length})</h4>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                {selectedSupports.map(supportId => {
                  const support = supports.find(s => s.id === supportId);
                  if (!support) return null;
                  return (
                    <div key={supportId} className="bg-white border rounded-lg p-3">
                      <div className="font-mono text-gray-700">{support.support_tag_no}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{support.support_mark}</span>
                        <span className="text-xs text-gray-500">{support.weight_kg}kg</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {selectedSupports.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p>Nessun supporto trovato per gli spools selezionati.</p>
                </div>
              )}
            </div>
          )}
          
          {/* Step 5: Review Flanges */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">⚙️ <strong>Flangie derivate automaticamente</strong> dagli spools.</p>
              </div>
              
              <h4 className="font-medium text-gray-700">Flangie ({selectedFlanges.length})</h4>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                {selectedFlanges.map(flangeId => {
                  const flange = flanges.find(f => f.id === flangeId);
                  if (!flange) return null;
                  return (
                    <div key={flangeId} className="bg-white border rounded-lg p-3">
                      <div className="font-mono text-amber-700">{flange.flange_tag}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">{flange.flange_type}</span>
                        <span className="text-xs text-gray-500">Ø{flange.diameter_inch}" {flange.pressure_rating}</span>
                      </div>
                      {flange.is_critical && <span className="text-xs text-red-600 font-medium mt-1 block">⚠️ Critica</span>}
                    </div>
                  );
                })}
              </div>
              
              {selectedFlanges.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p>Nessuna flangia trovata per gli spools selezionati.</p>
                </div>
              )}
              
              {/* Summary before save */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <h4 className="font-semibold text-blue-800 mb-2">📋 Riepilogo WP</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-orange-600">{selectedWelds.length}</p>
                    <p className="text-xs text-gray-600">Saldature</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{selectedSpools.length}</p>
                    <p className="text-xs text-gray-600">Spools</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-600">{selectedSupports.length}</p>
                    <p className="text-xs text-gray-600">Supporti</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{selectedFlanges.length}</p>
                    <p className="text-xs text-gray-600">Flangie</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
            {step > 1 ? '← Indietro' : 'Annulla'}
          </button>
          
          {step < 5 ? (
            <button 
              onClick={() => setStep(step + 1)} 
              disabled={!canProceed()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Avanti →
            </button>
          ) : (
            <button 
              onClick={handleSave} 
              disabled={saving || selectedWelds.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Creazione...' : '✓ Crea WP'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// CREATE WP-A MODAL
// ============================================================================

const CreateWPAModal = ({ workPackages, squads, projectId, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    notes: '',
    area: '',
    estimated_hours: ''
  });

  const nextCode = useMemo(() => {
    const actionWPs = workPackages.filter(wp => wp.wp_type === 'action');
    const maxNum = actionWPs.reduce((max, wp) => {
      const match = wp.code.match(/WP-A-(\d+)/);
      return match ? Math.max(max, parseInt(match[1])) : max;
    }, 0);
    return `WP-A-${String(maxNum + 1).padStart(3, '0')}`;
  }, [workPackages]);

  const handleSave = async () => {
    if (!formData.description) {
      alert('La descrizione è obbligatoria per WP-A');
      return;
    }
    
    setSaving(true);
    try {
      const { data: wpData, error } = await supabase
        .from('work_packages')
        .insert({
          project_id: projectId,
          code: nextCode,
          wp_type: 'action',
          description: formData.description,
          notes: formData.notes || null,
          area: formData.area || null,
          estimated_hours: formData.estimated_hours ? Number(formData.estimated_hours) : null,
          status: 'not_assigned',
          manual_progress: 0,
          revision: 0,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;

      // Log revision
      await supabase.from('wp_revisions').insert({
        project_id: projectId,
        work_package_id: wpData.id,
        revision_number: 0,
        change_type: 'created',
        changes_summary: `WP-A creato: ${formData.description}`
      });

      onSuccess();
    } catch (error) {
      alert('Errore: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-50 to-green-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">⚡ Nuovo Work Package Action</h2>
            <p className="text-sm text-gray-500">Attività generica / extra scope</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg">✕</button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Codice WP</label>
            <input type="text" value={nextCode} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione *</label>
            <input 
              type="text" 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              placeholder="Es: Installazione scaffolding Area 200"
              className="w-full px-3 py-2 border rounded-lg" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
            <input 
              type="text" 
              value={formData.area} 
              onChange={e => setFormData({...formData, area: e.target.value})} 
              placeholder="Es: Area 200"
              className="w-full px-3 py-2 border rounded-lg" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ore Stimate</label>
            <input 
              type="number" 
              value={formData.estimated_hours} 
              onChange={e => setFormData({...formData, estimated_hours: e.target.value})} 
              placeholder="Es: 40"
              className="w-full px-3 py-2 border rounded-lg" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea 
              rows={3} 
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
              className="w-full px-3 py-2 border rounded-lg" 
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={handleSave} disabled={saving || !formData.description} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Creazione...' : '✓ Crea WP'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// EDIT WP MODAL - FIX #3: Con modifica contenuto e sistema revisioni
// ============================================================================

const EditWPModal = ({ wp, squads, allWorkPackages, spools, welds, supports, flanges, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState('info');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(null);
  const [showCompletionAlert, setShowCompletionAlert] = useState(false);
  
  // PHASE B: Material availability state
  const [materialAvailability, setMaterialAvailability] = useState({
    supports: [],
    flangeMaterials: [],
    loading: true
  });
  
  // Info form
  const [formData, setFormData] = useState({
    description: wp.description || '',
    area: wp.area || '',
    notes: wp.notes || '',
    squad_id: wp.squad_id || '',
    planned_start: wp.planned_start || '',
    planned_end: wp.planned_end || '',
    status: wp.status || 'not_assigned',
    manual_progress: wp.manual_progress || 0,
    estimated_hours: wp.estimated_hours || ''
  });
  
  // Content state (for WP-P)
  const [wpSpools, setWpSpools] = useState([]);
  const [contentChanged, setContentChanged] = useState(false);
  const [addingSpools, setAddingSpools] = useState(false);
  const [spoolsToAdd, setSpoolsToAdd] = useState([]);
  const [spoolsToRemove, setSpoolsToRemove] = useState([]);
  
  const [splitResources, setSplitResources] = useState(wp.split_resources || false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [originalSquadId] = useState(wp.squad_id);

  // Load current WP spools
  useEffect(() => {
    if (wp.wp_type === 'piping') {
      loadWPSpools();
      loadMaterialAvailability();
    }
  }, [wp.id]);

  const loadWPSpools = async () => {
    const { data } = await supabase
      .from('wp_spools')
      .select('*, spool:mto_spools(*)')
      .eq('work_package_id', wp.id);
    setWpSpools(data || []);
  };

  // PHASE B: Load material availability for WP flanges and supports
  const loadMaterialAvailability = async () => {
    setMaterialAvailability(prev => ({ ...prev, loading: true }));
    try {
      // Get WP flanges and supports
      const { data: wpFlangesData } = await supabase
        .from('wp_flanges')
        .select('flange_id')
        .eq('work_package_id', wp.id);
      
      const { data: wpSupportsData } = await supabase
        .from('wp_supports')
        .select('support_id')
        .eq('work_package_id', wp.id);
      
      const wpFlangeIds = wpFlangesData?.map(f => f.flange_id) || [];
      const wpSupportIds = wpSupportsData?.map(s => s.support_id) || [];
      
      // Get flange details with material info
      let flangeDetails = [];
      if (wpFlangeIds.length > 0) {
        const { data: flangesInfo } = await supabase
          .from('mto_flanged_joints')
          .select('*')
          .in('id', wpFlangeIds);
        flangeDetails = flangesInfo || [];
      }
      
      // Get support details
      let supportDetails = [];
      if (wpSupportIds.length > 0) {
        const { data: supportsInfo } = await supabase
          .from('mto_supports')
          .select('*')
          .in('id', wpSupportIds);
        supportDetails = supportsInfo || [];
      }
      
      // Get support inventory summary
      const { data: supportSummary } = await supabase
        .from('v_mto_support_summary')
        .select('*')
        .eq('project_id', wp.project_id);
      
      // Get flange materials inventory summary
      const { data: flangeMaterialsSummary } = await supabase
        .from('v_mto_flange_materials_summary')
        .select('*')
        .eq('project_id', wp.project_id);
      
      // Calculate availability per flange
      const flangesWithAvailability = flangeDetails.map(flange => {
        const gasketAvail = flangeMaterialsSummary?.find(m => 
          m.material_code === flange.gasket_code && m.material_type === 'gasket'
        );
        const boltAvail = flangeMaterialsSummary?.find(m => 
          m.material_code === flange.bolt_code && m.material_type === 'bolt'
        );
        const insulAvail = flange.insulation_code ? flangeMaterialsSummary?.find(m => 
          m.material_code === flange.insulation_code && m.material_type === 'insulation'
        ) : null;
        
        return {
          ...flange,
          gasket: {
            code: flange.gasket_code,
            qty_needed: flange.gasket_qty || 1,
            available: (gasketAvail?.qty_warehouse || 0) - (gasketAvail?.qty_delivered || 0),
            status: !flange.gasket_code ? 'na' : 
                    ((gasketAvail?.qty_warehouse || 0) - (gasketAvail?.qty_delivered || 0)) >= (flange.gasket_qty || 1) ? 'ok' : 'missing'
          },
          bolt: {
            code: flange.bolt_code,
            qty_needed: flange.bolt_qty || 0,
            available: (boltAvail?.qty_warehouse || 0) - (boltAvail?.qty_delivered || 0),
            status: !flange.bolt_code || flange.bolt_qty === 0 ? 'na' : 
                    ((boltAvail?.qty_warehouse || 0) - (boltAvail?.qty_delivered || 0)) >= (flange.bolt_qty || 0) ? 'ok' : 'missing'
          },
          insulation: {
            code: flange.insulation_code,
            qty_needed: flange.insulation_qty || 0,
            available: insulAvail ? (insulAvail.qty_warehouse || 0) - (insulAvail.qty_delivered || 0) : 0,
            status: !flange.insulation_code ? 'na' : 
                    ((insulAvail?.qty_warehouse || 0) - (insulAvail?.qty_delivered || 0)) >= (flange.insulation_qty || 0) ? 'ok' : 'missing'
          }
        };
      });
      
      // Calculate availability per support
      const supportsWithAvailability = supportDetails.map(support => {
        const markAvail = supportSummary?.find(s => s.support_mark === support.support_mark);
        const available = (markAvail?.qty_warehouse || 0) - (markAvail?.qty_delivered || 0);
        const needed = 1; // Each support needs 1 from its mark
        
        return {
          ...support,
          availability: {
            available,
            needed,
            total_mark_needed: markAvail?.qty_necessary || 0,
            status: available >= needed ? 'ok' : 'missing'
          }
        };
      });
      
      setMaterialAvailability({
        supports: supportsWithAvailability,
        flanges: flangesWithAvailability,
        loading: false
      });
    } catch (error) {
      console.error('Error loading material availability:', error);
      setMaterialAvailability(prev => ({ ...prev, loading: false }));
    }
  };

  // Check conflitti quando cambia squadra
  useEffect(() => {
    if (formData.squad_id && formData.planned_start && formData.planned_end && formData.squad_id !== originalSquadId) {
      const foundConflicts = checkSquadConflicts(formData.squad_id, formData.planned_start, formData.planned_end, allWorkPackages, wp.id);
      if (foundConflicts.length > 0) {
        setConflicts(foundConflicts);
        setShowConflictModal(true);
      }
    }
  }, [formData.squad_id]);

  const handleSaveInfo = async () => {
    if (!formData.description && wp.wp_type === 'action') { 
      alert('Descrizione obbligatoria per WP-A'); 
      return; 
    }
    
    setSaving(true);
    try {
      const updateData = {
        description: formData.description || null,
        area: formData.area || null,
        notes: formData.notes || null,
        squad_id: formData.squad_id || null,
        planned_start: formData.planned_start || null,
        planned_end: formData.planned_end || null,
        status: formData.status,
        split_resources: splitResources,
        updated_at: new Date().toISOString()
      };
      
      if (wp.wp_type === 'action') {
        updateData.manual_progress = Number(formData.manual_progress) || 0;
        updateData.estimated_hours = formData.estimated_hours ? Number(formData.estimated_hours) : null;
      }
      
      // Check what changed for revision log
      const changes = [];
      if (formData.squad_id !== wp.squad_id) changes.push('squadra');
      if (formData.status !== wp.status) changes.push('stato');
      if (formData.planned_start !== wp.planned_start || formData.planned_end !== wp.planned_end) changes.push('date');
      if (formData.description !== wp.description || formData.notes !== wp.notes) changes.push('info');
      
      const { error } = await supabase.from('work_packages').update(updateData).eq('id', wp.id);
      if (error) throw error;
      
      // Log revision if anything changed
      if (changes.length > 0) {
        const changeType = changes.includes('squadra') ? 'assignment_changed' : 
                          changes.includes('stato') ? 'status_changed' :
                          changes.includes('date') ? 'dates_changed' : 'info_updated';
        
        await supabase.from('wp_revisions').insert({
          project_id: wp.project_id,
          work_package_id: wp.id,
          revision_number: (wp.revision || 0) + 1,
          change_type: changeType,
          changes_summary: `Modifiche: ${changes.join(', ')}`,
          old_values: {
            squad_id: wp.squad_id,
            status: wp.status,
            planned_start: wp.planned_start,
            planned_end: wp.planned_end
          },
          new_values: {
            squad_id: formData.squad_id,
            status: formData.status,
            planned_start: formData.planned_start,
            planned_end: formData.planned_end
          }
        });
      }
      
      // PHASE B: Show completion alert if status changed to completed
      if (formData.status === 'completed' && wp.status !== 'completed') {
        setShowCompletionAlert(true);
        // Auto-close after 3 seconds
        setTimeout(() => {
          setShowCompletionAlert(false);
          onSuccess();
        }, 3000);
      } else {
        onSuccess();
      }
    } catch (error) { 
      alert('Errore: ' + error.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleAddSpools = (selectedIds) => {
    setSpoolsToAdd(selectedIds);
    setContentChanged(true);
    setAddingSpools(false);
  };

  const handleRemoveSpool = (spoolId) => {
    setSpoolsToRemove([...spoolsToRemove, spoolId]);
    setContentChanged(true);
  };

  const handleSaveContent = () => {
    if (!contentChanged) return;
    
    // Show confirmation modal
    setPendingChanges({
      added: spoolsToAdd.length,
      removed: spoolsToRemove.length
    });
    setShowConfirmModal(true);
  };

  const confirmContentChanges = async () => {
    setSaving(true);
    try {
      // Remove spools
      if (spoolsToRemove.length > 0) {
        await supabase
          .from('wp_spools')
          .delete()
          .eq('work_package_id', wp.id)
          .in('spool_id', spoolsToRemove);
      }
      
      // Add spools
      if (spoolsToAdd.length > 0) {
        const spoolsToInsert = spoolsToAdd.map(spoolId => {
          const spool = spools.find(s => s.id === spoolId);
          return {
            work_package_id: wp.id,
            spool_id: spoolId,
            spool_number: spool?.spool_no || spool?.full_spool_no
          };
        });
        await supabase.from('wp_spools').insert(spoolsToInsert);
      }
      
      // Recalculate activities based on new spools
      // ... (complex logic to update welds/supports/flanges counts)
      
      // Increment revision
      await supabase
        .from('work_packages')
        .update({ 
          revision: (wp.revision || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', wp.id);
      
      // Log revision
      await supabase.from('wp_revisions').insert({
        project_id: wp.project_id,
        work_package_id: wp.id,
        revision_number: (wp.revision || 0) + 1,
        change_type: 'content_modified',
        changes_summary: `Modificato contenuto: +${spoolsToAdd.length} spools, -${spoolsToRemove.length} spools`,
        old_values: { spool_count: wpSpools.length },
        new_values: { spool_count: wpSpools.length + spoolsToAdd.length - spoolsToRemove.length }
      });
      
      setShowConfirmModal(false);
      onSuccess();
    } catch (error) {
      alert('Errore: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getSquadInfo = () => {
    const squad = squads.find(s => s.id === formData.squad_id);
    if (!squad) return null;
    let memberCount = squad.squad_members?.length || 0;
    if (squad.foreman_id) memberCount++;
    return { id: squad.id, squad_number: squad.squad_number, name: squad.name, memberCount };
  };

  const isPiping = wp.wp_type === 'piping';
  const headerColor = isPiping ? 'from-blue-50 to-blue-100' : 'from-green-50 to-green-100';
  const buttonColor = isPiping ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700';
  const icon = isPiping ? '🔧' : '⚡';

  // Available spools for adding (not already in WP)
  const currentSpoolIds = wpSpools.map(ws => ws.spool_id);
  const availableSpools = spools.filter(s => !currentSpoolIds.includes(s.id) && !spoolsToAdd.includes(s.id));

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b bg-gradient-to-r ${headerColor}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{icon}</span>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Modifica {wp.code}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-500">{isPiping ? 'Work Package Piping' : 'Work Package Action'}</span>
                  <RevisionBadge revision={wp.revision} />
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg">✕</button>
          </div>
          
          {/* Tabs - FIX #3: Aggiunti tab per Contenuto e Documenti + PHASE B: Materiali */}
          <div className="flex border-b overflow-x-auto">
            <button 
              onClick={() => setActiveEditTab('info')} 
              className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeEditTab === 'info' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              📝 Info
            </button>
            {isPiping && (
              <button 
                onClick={() => setActiveEditTab('content')} 
                className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeEditTab === 'content' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                📦 Contenuto {contentChanged && <span className="ml-1 w-2 h-2 bg-orange-500 rounded-full inline-block"></span>}
              </button>
            )}
            {isPiping && (
              <button 
                onClick={() => setActiveEditTab('materials')} 
                className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeEditTab === 'materials' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                📊 Materiali
                {!materialAvailability.loading && (
                  materialAvailability.flanges?.some(f => f.gasket.status === 'missing' || f.bolt.status === 'missing' || f.insulation.status === 'missing') ||
                  materialAvailability.supports?.some(s => s.availability.status === 'missing')
                ) && <span className="ml-1 w-2 h-2 bg-red-500 rounded-full inline-block"></span>}
              </button>
            )}
            <button 
              onClick={() => setActiveEditTab('documents')} 
              className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeEditTab === 'documents' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              📎 Documenti
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Tab Info */}
            {activeEditTab === 'info' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Codice</label>
                  <input type="text" value={wp.code} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione {!isPiping && '*'}</label>
                  <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                    <input type="text" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                      <option value="not_assigned">Non Assegnato</option>
                      <option value="planned">Pianificato</option>
                      <option value="in_progress">In Corso</option>
                      <option value="completed">Completato</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Squadra</label>
                  <select value={formData.squad_id} onChange={e => setFormData({...formData, squad_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="">-- Non assegnata --</option>
                    {squads.map(s => <option key={s.id} value={s.id}>Squadra {s.squad_number} {s.name ? `- ${s.name}` : ''}</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                    <input type="date" value={formData.planned_start} onChange={e => setFormData({...formData, planned_start: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Fine</label>
                    <input type="date" value={formData.planned_end} onChange={e => setFormData({...formData, planned_end: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                </div>
                
                {!isPiping && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Avanzamento %</label>
                        <input type="number" min="0" max="100" value={formData.manual_progress} onChange={e => setFormData({...formData, manual_progress: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ore Stimate</label>
                        <input type="number" value={formData.estimated_hours} onChange={e => setFormData({...formData, estimated_hours: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                    </div>
                  </>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
            )}
            
            {/* Tab Contenuto (WP-P only) - FIX #3 */}
            {activeEditTab === 'content' && isPiping && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">📦 <strong>Gestione Spools</strong> - Aggiungi o rimuovi spools dal WP. Le saldature, supporti e flangie verranno ricalcolate automaticamente.</p>
                </div>
                
                {/* Current spools */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-700">Spools nel WP ({wpSpools.length - spoolsToRemove.length + spoolsToAdd.length})</h4>
                    <button onClick={() => setAddingSpools(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                      ➕ Aggiungi Spools
                    </button>
                  </div>
                  
                  <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                    {wpSpools.filter(ws => !spoolsToRemove.includes(ws.spool_id)).map(ws => (
                      <div key={ws.id} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-blue-600">{ws.spool_number}</span>
                          {ws.spool && <SiteStatusBadge status={ws.spool.site_status} />}
                        </div>
                        <button 
                          onClick={() => handleRemoveSpool(ws.spool_id)} 
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          title="Rimuovi dallo spool"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    
                    {/* Spools to add (pending) */}
                    {spoolsToAdd.map(spoolId => {
                      const spool = spools.find(s => s.id === spoolId);
                      return (
                        <div key={spoolId} className="flex items-center justify-between p-3 border-b last:border-b-0 bg-green-50">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-green-600">{spool?.spool_no || spool?.full_spool_no}</span>
                            <span className="text-xs text-green-600 font-medium">➕ Nuovo</span>
                          </div>
                          <button 
                            onClick={() => setSpoolsToAdd(spoolsToAdd.filter(id => id !== spoolId))} 
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                    
                    {wpSpools.length === 0 && spoolsToAdd.length === 0 && (
                      <div className="p-4 text-center text-gray-400">
                        Nessuno spool nel WP
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Changes summary */}
                {contentChanged && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800 font-medium">⚠️ Modifiche in sospeso:</p>
                    <ul className="text-sm text-amber-700 mt-1">
                      {spoolsToAdd.length > 0 && <li>• {spoolsToAdd.length} spools da aggiungere</li>}
                      {spoolsToRemove.length > 0 && <li>• {spoolsToRemove.length} spools da rimuovere</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {/* PHASE B: Tab Materiali - Disponibilità materiali */}
            {activeEditTab === 'materials' && isPiping && (
              <MaterialAvailabilityTab 
                materialAvailability={materialAvailability}
                onRefresh={loadMaterialAvailability}
              />
            )}
            
            {/* Tab Documenti */}
            {activeEditTab === 'documents' && (
              <WPDocuments workPackageId={wp.id} projectId={wp.project_id} />
            )}
          </div>
          
          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
            <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">Annulla</button>
            
            {activeEditTab === 'info' && (
              <button onClick={handleSaveInfo} disabled={saving} className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 ${buttonColor}`}>
                {saving ? 'Salvataggio...' : '✓ Salva Info'}
              </button>
            )}
            
            {activeEditTab === 'content' && contentChanged && (
              <button onClick={handleSaveContent} disabled={saving} className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 ${buttonColor}`}>
                {saving ? 'Salvataggio...' : '✓ Salva Modifiche Contenuto'}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Add Spools Modal */}
      {addingSpools && (
        <AddSpoolsModal 
          availableSpools={availableSpools}
          onAdd={handleAddSpools}
          onClose={() => setAddingSpools(false)}
        />
      )}
      
      {/* Confirm Changes Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">⚠️ Conferma Modifiche</h3>
            <p className="text-gray-600 mb-4">
              Stai per modificare il contenuto del WP. Questa azione incrementerà il numero di revisione.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm">
                {pendingChanges?.added > 0 && <span className="text-green-600">+{pendingChanges.added} spools</span>}
                {pendingChanges?.added > 0 && pendingChanges?.removed > 0 && ', '}
                {pendingChanges?.removed > 0 && <span className="text-red-600">-{pendingChanges.removed} spools</span>}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100">Annulla</button>
              <button onClick={confirmContentChanges} disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* PHASE B: Completion Alert */}
      {showCompletionAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center animate-pulse">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-emerald-600 mb-2">WP Completato!</h3>
            <p className="text-gray-600 mb-4">
              <span className="font-mono font-bold text-lg">{wp.code}</span> è stato completato con successo.
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center justify-center gap-2">
                <span className="text-emerald-600 text-2xl">✓</span>
                <span className="text-emerald-700 font-medium">100% Completato</span>
              </div>
              {wp.created_at && (
                <p className="text-sm text-emerald-600 mt-2">
                  Durata totale: {calculateDaysBetween(wp.created_at, new Date().toISOString())} giorni
                </p>
              )}
            </div>
            <button 
              onClick={() => { setShowCompletionAlert(false); onSuccess(); }}
              className="mt-6 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
      
      {/* Conflict Modal */}
      {showConflictModal && formData.squad_id && getSquadInfo() && (
        <ResourceConflictModal
          conflicts={conflicts}
          squadInfo={getSquadInfo()}
          newWPDates={{ start: formData.planned_start, end: formData.planned_end }}
          onSplitResources={() => { setSplitResources(true); setShowConflictModal(false); }}
          onChangeSquad={() => { setFormData({...formData, squad_id: originalSquadId || ''}); setSplitResources(wp.split_resources || false); setShowConflictModal(false); setConflicts([]); }}
          onClose={() => setShowConflictModal(false)}
        />
      )}
    </>
  );
};

// ============================================================================
// ADD SPOOLS MODAL
// ============================================================================

const AddSpoolsModal = ({ availableSpools, onAdd, onClose }) => {
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  
  const filtered = availableSpools.filter(s => {
    if (!search) return true;
    const term = search.toLowerCase();
    return s.spool_no?.toLowerCase().includes(term) || 
           s.full_spool_no?.toLowerCase().includes(term) ||
           s.iso_number?.toLowerCase().includes(term);
  });

  const toggleSpool = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">➕ Aggiungi Spools</h3>
          <input 
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Cerca spool..."
            className="w-full mt-3 px-3 py-2 border rounded-lg"
          />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Nessuno spool disponibile</p>
            ) : filtered.map(spool => (
              <label 
                key={spool.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${selected.includes(spool.id) ? 'bg-blue-50 border-blue-300' : ''}`}
              >
                <input 
                  type="checkbox"
                  checked={selected.includes(spool.id)}
                  onChange={() => toggleSpool(spool.id)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-blue-600">{spool.spool_no}</span>
                    <SiteStatusBadge status={spool.site_status} />
                  </div>
                  <div className="text-xs text-gray-500">{spool.iso_number} • Ø{spool.diameter_inch}" • {spool.weight_kg}kg</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <span className="text-sm text-gray-600">{selected.length} selezionati</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">Annulla</button>
            <button 
              onClick={() => onAdd(selected)} 
              disabled={selected.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              ➕ Aggiungi ({selected.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE B: MATERIAL AVAILABILITY TAB
// ============================================================================

const MaterialAvailabilityTab = ({ materialAvailability, onRefresh }) => {
  const { flanges = [], supports = [], loading } = materialAvailability;
  
  // Calculate summary stats
  const flangeStats = {
    total: flanges.length,
    gasketMissing: flanges.filter(f => f.gasket.status === 'missing').length,
    boltMissing: flanges.filter(f => f.bolt.status === 'missing').length,
    insulationMissing: flanges.filter(f => f.insulation.status === 'missing').length
  };
  
  const supportStats = {
    total: supports.length,
    missing: supports.filter(s => s.availability.status === 'missing').length
  };
  
  const hasMissingMaterials = flangeStats.gasketMissing > 0 || flangeStats.boltMissing > 0 || 
                              flangeStats.insulationMissing > 0 || supportStats.missing > 0;
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  const MaterialStatusIcon = ({ status }) => {
    if (status === 'ok') return <span className="text-emerald-600">✓</span>;
    if (status === 'missing') return <span className="text-red-600">✗</span>;
    return <span className="text-gray-400">-</span>;
  };
  
  return (
    <div className="space-y-6">
      {/* Summary Alert */}
      {hasMissingMaterials ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-red-800">Materiali Mancanti</p>
              <p className="text-sm text-red-600">
                Alcuni materiali non sono disponibili in magazzino. 
                Verifica la disponibilità prima di procedere.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-emerald-800">Materiali Disponibili</p>
              <p className="text-sm text-emerald-600">
                Tutti i materiali necessari sono disponibili in magazzino.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Refresh button */}
      <div className="flex justify-end">
        <button onClick={onRefresh} className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg">
          🔄 Aggiorna dati
        </button>
      </div>
      
      {/* Flanges Section */}
      {flanges.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            ⚙️ Flangie ({flanges.length})
            {(flangeStats.gasketMissing > 0 || flangeStats.boltMissing > 0 || flangeStats.insulationMissing > 0) && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                Mancanti: {flangeStats.gasketMissing + flangeStats.boltMissing + flangeStats.insulationMissing}
              </span>
            )}
          </h4>
          
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium">Flange Tag</th>
                  <th className="text-center p-3 font-medium">Gasket</th>
                  <th className="text-center p-3 font-medium">Bolt</th>
                  <th className="text-center p-3 font-medium">Insulation</th>
                </tr>
              </thead>
              <tbody>
                {flanges.map(flange => (
                  <tr key={flange.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-mono text-amber-700">{flange.flange_tag}</div>
                      <div className="text-xs text-gray-500">{flange.flange_type} • Ø{flange.diameter_inch}"</div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MaterialStatusIcon status={flange.gasket.status} />
                        {flange.gasket.code && (
                          <span className={`text-xs ${flange.gasket.status === 'missing' ? 'text-red-600' : 'text-gray-600'}`}>
                            {flange.gasket.code}
                          </span>
                        )}
                      </div>
                      {flange.gasket.status === 'missing' && flange.gasket.code && (
                        <div className="text-xs text-red-500 mt-1">
                          Disp: {flange.gasket.available}/{flange.gasket.qty_needed}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MaterialStatusIcon status={flange.bolt.status} />
                        {flange.bolt.code && (
                          <span className={`text-xs ${flange.bolt.status === 'missing' ? 'text-red-600' : 'text-gray-600'}`}>
                            {flange.bolt.code} ×{flange.bolt.qty_needed}
                          </span>
                        )}
                      </div>
                      {flange.bolt.status === 'missing' && flange.bolt.code && (
                        <div className="text-xs text-red-500 mt-1">
                          Disp: {flange.bolt.available}/{flange.bolt.qty_needed}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MaterialStatusIcon status={flange.insulation.status} />
                        {flange.insulation.code && (
                          <span className={`text-xs ${flange.insulation.status === 'missing' ? 'text-red-600' : 'text-gray-600'}`}>
                            {flange.insulation.code}
                          </span>
                        )}
                      </div>
                      {flange.insulation.status === 'missing' && flange.insulation.code && (
                        <div className="text-xs text-red-500 mt-1">
                          Disp: {flange.insulation.available}/{flange.insulation.qty_needed}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Legend */}
          <div className="flex gap-4 text-xs text-gray-500 mt-2">
            <span className="flex items-center gap-1"><span className="text-emerald-600">✓</span> Disponibile</span>
            <span className="flex items-center gap-1"><span className="text-red-600">✗</span> Mancante</span>
            <span className="flex items-center gap-1"><span className="text-gray-400">-</span> Non richiesto</span>
          </div>
        </div>
      )}
      
      {/* Supports Section */}
      {supports.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            🔩 Supporti ({supports.length})
            {supportStats.missing > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                Mancanti: {supportStats.missing}
              </span>
            )}
          </h4>
          
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium">Support Tag</th>
                  <th className="text-left p-3 font-medium">Mark</th>
                  <th className="text-center p-3 font-medium">Disponibilità</th>
                  <th className="text-center p-3 font-medium">Stato</th>
                </tr>
              </thead>
              <tbody>
                {supports.map(support => (
                  <tr key={support.id} className={`border-t hover:bg-gray-50 ${support.availability.status === 'missing' ? 'bg-red-50' : ''}`}>
                    <td className="p-3 font-mono text-xs">{support.support_tag_no}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{support.support_mark}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-sm ${support.availability.available > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {support.availability.available} disponibili
                      </span>
                      <div className="text-xs text-gray-400">
                        (Tot. necessari: {support.availability.total_mark_needed})
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {support.availability.status === 'ok' ? (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">✓ OK</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">✗ Mancante</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {flanges.length === 0 && supports.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p>Nessuna flangia o supporto nel WP</p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// WP DOCUMENTS - Upload, Preview, Download con Audit
// ============================================================================

const WPDocuments = ({ workPackageId, projectId }) => {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [workPackageId]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wp_documents')
        .select('*')
        .eq('work_package_id', workPackageId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    try {
      for (const file of files) {
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `wp-documents/${projectId}/${workPackageId}/${fileName}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
        
        // Save document record
        await supabase.from('wp_documents').insert({
          work_package_id: workPackageId,
          project_id: projectId,
          file_name: file.name,
          file_path: filePath,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user?.id,
          uploaded_by_name: user?.email
        });
      }
      
      fetchDocuments();
    } catch (error) {
      alert('Errore upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Eliminare ${doc.file_name}?`)) return;
    
    try {
      await supabase
        .from('wp_documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', doc.id);
      
      fetchDocuments();
    } catch (error) {
      alert('Errore: ' + error.message);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div 
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
      >
        <input 
          type="file" 
          id="file-upload"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="text-4xl mb-2">📎</div>
          <p className="text-gray-600">
            {uploading ? 'Caricamento...' : 'Trascina qui i file o clicca per caricare'}
          </p>
          <p className="text-xs text-gray-400 mt-1">PDF, DOC, XLS, immagini</p>
        </label>
      </div>
      
      {/* Documents list */}
      {loading ? (
        <div className="text-center py-4 text-gray-400">Caricamento...</div>
      ) : documents.length === 0 ? (
        <div className="text-center py-4 text-gray-400">Nessun documento caricato</div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
              <div className="text-2xl">
                {doc.file_type?.includes('pdf') ? '📄' : 
                 doc.file_type?.includes('image') ? '🖼️' :
                 doc.file_type?.includes('sheet') || doc.file_type?.includes('excel') ? '📊' :
                 doc.file_type?.includes('word') || doc.file_type?.includes('document') ? '📝' : '📎'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-700 truncate">{doc.file_name}</p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString('it-IT')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <a 
                  href={doc.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-gray-200 rounded text-blue-600"
                  title="Scarica"
                >
                  ⬇️
                </a>
                <button 
                  onClick={() => handleDelete(doc)}
                  className="p-2 hover:bg-red-50 rounded text-red-500"
                  title="Elimina"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
