import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import WorkPackagesGantt from '../components/WorkPackagesGantt';

// ============================================================================
// WORK PACKAGES PAGE - WP-P (Piping) e WP-A (Action)
// Con gestione conflitti risorse per squadre sovrapposte
// ============================================================================

// Utility function per check conflitti squadra
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
  
  const conflicts = allWorkPackages.filter(wp => {
    if (excludeWPId && wp.id === excludeWPId) return false;
    if (wp.squad_id !== squadId) return false;
    if (wp.status === 'completed') return false;
    
    const wpStart = parseDate(wp.planned_start);
    const wpEnd = parseDate(wp.planned_end);
    
    if (!wpStart || !wpEnd) return false;
    
    const hasOverlap = !(newEnd < wpStart || newStart > wpEnd);
    return hasOverlap;
  });
  
  return conflicts;
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
      alert('Errore caricamento dati: ' + error.message);
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
    const { data, error } = await supabase
      .from('squads')
      .select('*, squad_members(id), supervisor_id, foreman_id')
      .eq('project_id', activeProject.id)
      .order('squad_number');
    
    if (error) console.error('Error fetching squads:', error);
    setSquads(data || []);
  };

  const fetchMTOData = async () => {
    try {
      const { data: isoData } = await supabase
        .from('mto_isometrics')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('status', 'active');
      setIsometrics(isoData || []);
    } catch (e) { setIsometrics([]); }
    
    try {
      const { data: spoolData } = await supabase
        .from('mto_spools')
        .select('*')
        .eq('project_id', activeProject.id);
      setSpools(spoolData || []);
    } catch (e) { setSpools([]); }
    
    try {
      const { data: weldData } = await supabase
        .from('mto_welds')
        .select('*')
        .eq('project_id', activeProject.id);
      setWelds(weldData || []);
    } catch (e) { setWelds([]); }
    
    try {
      const { data: suppData } = await supabase
        .from('mto_supports')
        .select('*')
        .eq('project_id', activeProject.id);
      setSupports(suppData || []);
    } catch (e) { setSupports([]); }
    
    try {
      const { data: flangeData } = await supabase
        .from('mto_flanges')
        .select('*')
        .eq('project_id', activeProject.id);
      setFlanges(flangeData || []);
    } catch (e) { setFlanges([]); }
  };

  const calculateWPProgress = (wp) => {
    if (wp.wp_type === 'action') {
      return wp.manual_progress || 0;
    }
    
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
    let progress = 0;
    
    if (weldingTotal > 0) progress += (weldingCompleted / weldingTotal) * weight;
    if (supportTotal > 0) progress += (supportCompleted / supportTotal) * weight;
    if (flangeTotal > 0) progress += (flangeCompleted / flangeTotal) * weight;
    
    return Math.min(100, progress);
  };

  const getWPStats = (wp) => {
    const activities = wp.activities || [];
    const welding = activities.filter(a => a.category === 'welding');
    const support = activities.filter(a => a.category === 'support');
    const flange = activities.filter(a => a.category === 'flange');
    
    return {
      welding: {
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

  const stats = useMemo(() => {
    const all = workPackages;
    return {
      piping: all.filter(wp => wp.wp_type === 'piping').length,
      action: all.filter(wp => wp.wp_type === 'action').length,
      inProgress: all.filter(wp => wp.status === 'in_progress').length,
      notAssigned: all.filter(wp => wp.status === 'not_assigned').length,
      avgProgress: all.length > 0 
        ? all.reduce((s, wp) => s + calculateWPProgress(wp), 0) / all.length 
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
            {activeProject?.name} • {workPackages.length} WP totali
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="flex bg-white rounded-lg p-1 shadow-sm border">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📋 Lista
            </button>
            <button
              onClick={() => setActiveTab('gantt')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'gantt' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📈 Gantt
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateWPP(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium shadow-sm"
            >
              ➕ WP Piping
            </button>
            <button
              onClick={() => setShowCreateWPA(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium shadow-sm"
            >
              ➕ WP Action
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <DashboardCard icon="🔧" iconBg="bg-blue-100" value={stats.piping} label="WP Piping" active={filterType === 'piping'} onClick={() => setFilterType(filterType === 'piping' ? 'all' : 'piping')} />
        <DashboardCard icon="⚡" iconBg="bg-green-100" value={stats.action} label="WP Action" active={filterType === 'action'} onClick={() => setFilterType(filterType === 'action' ? 'all' : 'action')} />
        <DashboardCard icon="▶️" iconBg="bg-amber-100" value={stats.inProgress} label="In Corso" />
        <DashboardCard icon="🕐" iconBg="bg-gray-100" value={stats.notAssigned} label="Da Assegnare" />
        <div className="bg-white rounded-xl p-4 shadow-sm border col-span-2 md:col-span-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-xl">📊</div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.avgProgress.toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Avanzamento</p>
            </div>
          </div>
          <ProgressBar percent={stats.avgProgress} size="small" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca codice, descrizione..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="all">Tutti gli stati</option>
            <option value="not_assigned">Non Assegnato</option>
            <option value="planned">Pianificato</option>
            <option value="in_progress">In Corso</option>
            <option value="completed">Completato</option>
          </select>
          <select value={filterSquad} onChange={(e) => setFilterSquad(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="all">Tutte le squadre</option>
            {squads.map(sq => (
              <option key={sq.id} value={sq.id}>Sq. {sq.squad_number} - {sq.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'list' ? (
        <div className="space-y-6">
          {(filterType === 'all' || filterType === 'piping') && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">🔧 Work Packages Piping ({wpPiping.length})</h3>
              {wpPiping.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center text-gray-500 border">Nessun WP Piping</div>
              ) : (
                <div className="space-y-3">
                  {wpPiping.map(wp => (
                    <WPPipingCard key={wp.id} wp={wp} stats={getWPStats(wp)} progress={calculateWPProgress(wp)} spools={spools} welds={welds} supports={supports} flanges={flanges} expanded={expandedWP === wp.id} onToggle={() => setExpandedWP(expandedWP === wp.id ? null : wp.id)} onEdit={() => setEditingWP(wp)} onDelete={() => handleDeleteWP(wp)} />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {(filterType === 'all' || filterType === 'action') && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">⚡ Work Packages Action ({wpAction.length})</h3>
              {wpAction.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center text-gray-500 border">Nessun WP Action</div>
              ) : (
                <div className="space-y-3">
                  {wpAction.map(wp => (
                    <WPActionCard key={wp.id} wp={wp} onEdit={() => setEditingWP(wp)} onDelete={() => handleDeleteWP(wp)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <WorkPackagesGantt workPackages={workPackages} squads={squads} calculateProgress={calculateWPProgress} activeProject={activeProject} />
      )}

      {/* Modals */}
      {showCreateWPP && (
        <CreateWPPWizard 
          project={activeProject} 
          squads={squads} 
          isometrics={isometrics} 
          spools={spools} 
          welds={welds} 
          supports={supports} 
          flanges={flanges} 
          allWorkPackages={workPackages}
          onClose={() => setShowCreateWPP(false)} 
          onSuccess={() => { setShowCreateWPP(false); fetchWorkPackages(); }} 
        />
      )}
      
      {showCreateWPA && (
        <CreateWPAModal 
          project={activeProject} 
          squads={squads} 
          allWorkPackages={workPackages}
          onClose={() => setShowCreateWPA(false)} 
          onSuccess={() => { setShowCreateWPA(false); fetchWorkPackages(); }} 
        />
      )}
      
      {editingWP && (
        <EditWPModal 
          wp={editingWP} 
          squads={squads} 
          allWorkPackages={workPackages}
          onClose={() => setEditingWP(null)} 
          onSuccess={() => { setEditingWP(null); fetchWorkPackages(); }} 
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const DashboardCard = ({ icon, iconBg, value, label, active, onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer hover:shadow-md transition-all ${active ? 'ring-2 ring-blue-500' : ''}`}>
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

const SiteStatusBadge = ({ status }) => {
  const configs = {
    not_received: { label: 'Non Ricevuto', bg: 'bg-gray-100', text: 'text-gray-600' },
    received: { label: 'Ricevuto', bg: 'bg-green-100', text: 'text-green-700' },
    stored: { label: 'Magazzino', bg: 'bg-blue-100', text: 'text-blue-700' },
    in_progress: { label: 'In Lavoro', bg: 'bg-amber-100', text: 'text-amber-700' },
    installed: { label: 'Installato', bg: 'bg-emerald-100', text: 'text-emerald-700' }
  };
  const config = configs[status] || configs.not_received;
  return <span className={`${config.bg} ${config.text} px-1.5 py-0.5 text-xs rounded font-medium`}>{config.label}</span>;
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
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-amber-800">Conflitto Risorse</h2>
              <p className="text-sm text-amber-600">Squadra già impegnata su altri WP</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Squad Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-800">
              <span className="text-lg">👥</span>
              <span className="font-semibold">
                Squadra {squadInfo.squad_number} {squadInfo.name ? `- ${squadInfo.name}` : ''}
              </span>
              <span className="bg-blue-200 px-2 py-0.5 rounded text-sm font-bold">
                {squadInfo.memberCount} persone
              </span>
            </div>
          </div>

          {/* Conflicting WPs */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">La squadra è già assegnata a:</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {conflicts.map(wp => (
                <div key={wp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div>
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded mr-2 ${
                      wp.wp_type === 'piping' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {wp.code}
                    </span>
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

          {/* Options */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Come vuoi gestire il conflitto?</p>
            
            <div className="grid gap-3">
              <div className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-xl">➗</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">Dividi Risorse</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Le {squadInfo.memberCount} persone verranno divise su {totalConflicts} WP
                    </p>
                    <div className="mt-2 bg-blue-100 rounded px-2 py-1 inline-block">
                      <span className="text-blue-800 font-bold">{resourcesPerWP} persone/WP</span>
                      <span className="text-blue-600 text-sm ml-1">nei giorni sovrapposti</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-xl">✏️</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">Cambia Squadra</p>
                    <p className="text-sm text-gray-500 mt-1">Assegna una squadra diversa a questo WP</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            Annulla
          </button>
          <button onClick={onChangeSquad} className="flex-1 px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
            <span>✏️</span> Cambia Squadra
          </button>
          <button onClick={onSplitResources} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            <span>➗</span> Dividi ({resourcesPerWP})
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// WP PIPING CARD
// ============================================================================

const WPPipingCard = ({ wp, stats, progress, spools, welds, supports, flanges, expanded, onToggle, onEdit, onDelete }) => {
  const wpSpoolIds = wp.wp_spools?.map(ws => ws.spool_id) || [];
  
  const wpSpoolsInfo = wpSpoolIds.map(spId => {
    const spool = spools.find(s => s.id === spId);
    if (!spool) return null;
    const spoolWelds = welds.filter(w => w.spool_1_id === spId || w.spool_2_id === spId);
    const spoolSupports = supports.filter(s => s.spool_id === spId);
    const spoolFlanges = flanges.filter(f => f.part_1_id === spId);
    const hasDissimilar = spoolWelds.some(w => w.is_dissimilar);
    return { ...spool, weldsCount: spoolWelds.length, supportsKg: spoolSupports.reduce((s, x) => s + Number(x.total_weight_kg || 0), 0), flangesCount: spoolFlanges.length, hasDissimilar };
  }).filter(Boolean);

  let categoriesPresent = 0;
  if (stats.welding.total > 0) categoriesPresent++;
  if (stats.supports.total > 0) categoriesPresent++;
  if (stats.flanges.total > 0) categoriesPresent++;
  const weightPerCategory = categoriesPresent > 0 ? (100 / categoriesPresent).toFixed(1) : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={onToggle}>
        <div className="flex items-start gap-3">
          <button className="mt-1 text-gray-400 hover:text-gray-600">{expanded ? '▼' : '▶'}</button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">{wp.code}</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 text-xs rounded-full font-medium">Piping</span>
              <StatusBadge status={wp.status} />
              {wp.split_resources && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 text-xs rounded-full font-medium">➗ Diviso</span>}
              <h3 className="font-medium text-gray-800 truncate">{wp.description}</h3>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              {wp.area && <span>📍 {wp.area}</span>}
              {wp.squad && <span>👥 Sq.{wp.squad.squad_number} - {wp.squad.name}</span>}
              {wp.planned_start && <span>📅 {wp.planned_start} → {wp.planned_end}</span>}
            </div>
            <div className="mt-3 flex items-center gap-3 max-w-lg">
              <ProgressBar percent={progress} />
              <span className="text-sm font-semibold text-gray-700 w-14 text-right">{progress.toFixed(1)}%</span>
            </div>
          </div>
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={onEdit} className="p-2 hover:bg-blue-50 rounded-lg text-blue-600">✏️</button>
            <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-lg text-red-600">🗑️</button>
          </div>
        </div>
      </div>
      
      {expanded && (
        <div className="border-t bg-gray-50 p-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border p-4">
              <h4 className="font-semibold text-gray-700 mb-3">📊 Progress per Categoria</h4>
              <div className="space-y-4">
                <CategoryProgress label="🔥 Welding" weight={weightPerCategory} completed={stats.welding.completed} total={stats.welding.total} unit="joints" color="bg-orange-500" />
                <CategoryProgress label="🔩 Supports" weight={weightPerCategory} completed={stats.supports.completed} total={stats.supports.total} unit="kg" color="bg-gray-500" />
                <CategoryProgress label="⚙️ Flanges" weight={weightPerCategory} completed={stats.flanges.completed} total={stats.flanges.total} unit="joints" color="bg-purple-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg border p-4">
              <h4 className="font-semibold text-gray-700 mb-3">📦 Spool ({wpSpoolsInfo.length})</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {wpSpoolsInfo.map(spool => (
                  <div key={spool.id} className={`flex items-center justify-between p-2 rounded-lg ${spool.hasDissimilar ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      {spool.hasDissimilar && <span>⚠️</span>}
                      <span className="font-mono text-xs">{spool.short_name}</span>
                      <SiteStatusBadge status={spool.site_status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-orange-600">{spool.weldsCount}W</span>
                      <span className="text-gray-500">{spool.supportsKg.toFixed(0)}kg</span>
                      <span className="text-purple-600">{spool.flangesCount}F</span>
                    </div>
                  </div>
                ))}
                {wpSpoolsInfo.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Nessuno spool</p>}
              </div>
            </div>
            
            <div className="bg-white rounded-lg border p-4">
              <h4 className="font-semibold text-gray-700 mb-3">📋 Riepilogo</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Spool totali</span><span className="font-medium">{wpSpoolsInfo.length}</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Saldature</span><span className="font-medium">{stats.welding.total} joints</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Supporti</span><span className="font-medium">{stats.supports.total.toFixed(1)} kg</span></div>
                <div className="flex justify-between py-1 border-b"><span className="text-gray-500">Accopp. Flangiati</span><span className="font-medium">{stats.flanges.total}</span></div>
                <div className="flex justify-between py-2 pt-3 border-t"><span className="text-gray-700 font-medium">Progress</span><span className="font-bold text-blue-600">{progress.toFixed(1)}%</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CategoryProgress = ({ label, weight, completed, total, unit, color }) => {
  const percent = total > 0 ? (completed / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-600">{label} <span className="text-xs text-gray-400">({weight}%)</span></span>
        <span className="text-xs text-gray-500">{typeof completed === 'number' && completed % 1 !== 0 ? completed.toFixed(1) : completed}/{typeof total === 'number' && total % 1 !== 0 ? total.toFixed(1) : total} {unit}</span>
      </div>
      <div className="flex items-center gap-2">
        <ProgressBar percent={percent} size="small" color={color} />
        <span className="text-xs font-medium w-10 text-right">{percent.toFixed(0)}%</span>
      </div>
    </div>
  );
};

// ============================================================================
// WP ACTION CARD
// ============================================================================

const WPActionCard = ({ wp, onEdit, onDelete }) => {
  const progress = wp.manual_progress || 0;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm bg-green-50 text-green-700 px-2 py-0.5 rounded font-semibold">{wp.code}</span>
            <span className="bg-green-100 text-green-800 px-2 py-0.5 text-xs rounded-full font-medium">Action</span>
            <StatusBadge status={wp.status} />
            {wp.split_resources && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 text-xs rounded-full font-medium">➗ Diviso</span>}
            <h3 className="font-medium text-gray-800">{wp.description}</h3>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            {wp.area && <span>📍 {wp.area}</span>}
            {wp.squad && <span>👥 Sq.{wp.squad.squad_number}</span>}
            {wp.planned_start && <span>📅 {wp.planned_start} → {wp.planned_end}</span>}
          </div>
          <div className="mt-3 flex items-center gap-3 max-w-md">
            <ProgressBar percent={progress} color="bg-green-500" />
            <span className="text-sm font-semibold text-gray-700 w-14 text-right">{progress}%</span>
          </div>
          {wp.notes && <p className="mt-2 text-sm text-gray-600 italic bg-gray-50 p-2 rounded">💬 {wp.notes}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="p-2 hover:bg-blue-50 rounded-lg text-blue-600">✏️</button>
          <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-lg text-red-600">🗑️</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// CREATE WP-P WIZARD - 6 Steps Weld-Centric
// Step 1: Info Base | Step 2: Welds | Step 3: Spools | Step 4: Supports | Step 5: Flanges | Step 6: Assignment
// ============================================================================

// Spool Status Badge with colored dots
const SpoolStatusDot = ({ status }) => {
  const configs = {
    in_production: { color: 'bg-gray-400', label: 'In Produzione' },
    shipped: { color: 'bg-yellow-400', label: 'Shipment' },
    at_laydown: { color: 'bg-blue-400', label: 'Laydown' },
    ir_issued: { color: 'bg-orange-400', label: 'IR Issued' },
    at_site: { color: 'bg-purple-400', label: 'To Site' },
    erected: { color: 'bg-green-500', label: 'Erected' }
  };
  const config = configs[status] || configs.in_production;
  return (
    <span className={`inline-flex items-center gap-1`} title={config.label}>
      <span className={`w-3 h-3 rounded-full ${config.color}`}></span>
      <span className="text-xs text-gray-500 hidden sm:inline">{config.label}</span>
    </span>
  );
};

// Availability dot for supports/flanges
const AvailabilityDot = ({ available }) => (
  <span className={`w-3 h-3 rounded-full ${available ? 'bg-green-500' : 'bg-red-500'}`} 
        title={available ? 'Disponibile' : 'Non disponibile'}></span>
);

const CreateWPPWizard = ({ project, squads, isometrics, spools, welds, supports, flanges, allWorkPackages, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  
  // Step 1: Info Base
  const [formData, setFormData] = useState({ description: '', notes: '' });
  const [nextCode, setNextCode] = useState('WP-P-001');
  
  // Step 2: Welds selection (primary)
  const [selectedWelds, setSelectedWelds] = useState([]);
  const [weldSearch, setWeldSearch] = useState('');
  const [weldFilterIso, setWeldFilterIso] = useState('');
  
  // Step 3: Spools (derived from welds, can deselect)
  const [excludedSpools, setExcludedSpools] = useState([]);
  
  // Step 4: Supports (derived from spools, can deselect)
  const [excludedSupports, setExcludedSupports] = useState([]);
  const [supportSummary, setSupportSummary] = useState([]);
  
  // Step 5: Flanges (derived from spools, can deselect)
  const [excludedFlanges, setExcludedFlanges] = useState([]);
  const [flangeSummary, setFlangeSummary] = useState([]);
  
  // Step 6: Assignment
  const [selectedSquad, setSelectedSquad] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [splitResources, setSplitResources] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflicts, setConflicts] = useState([]);

  // Generate WP code
  useEffect(() => {
    const generateCode = async () => {
      const { data } = await supabase.rpc('generate_wp_code', { p_project_id: project.id, p_type: 'piping' });
      if (data) setNextCode(data);
    };
    generateCode();
  }, [project.id]);

  // Fetch inventory summaries
  useEffect(() => {
    const fetchSummaries = async () => {
      try {
        const { data: suppData } = await supabase
          .from('v_mto_support_summary')
          .select('*')
          .eq('project_id', project.id);
        setSupportSummary(suppData || []);
      } catch (e) { console.error('Support summary error:', e); }
      
      try {
        const { data: flangeData } = await supabase
          .from('v_mto_flange_materials_summary')
          .select('*')
          .eq('project_id', project.id);
        setFlangeSummary(flangeData || []);
      } catch (e) { console.error('Flange summary error:', e); }
    };
    fetchSummaries();
  }, [project.id]);

  // Derive spools from selected welds
  const derivedSpools = useMemo(() => {
    const spoolIds = new Set();
    selectedWelds.forEach(weldId => {
      const weld = welds.find(w => w.id === weldId);
      if (weld?.spool_1_id) spoolIds.add(weld.spool_1_id);
      if (weld?.spool_2_id) spoolIds.add(weld.spool_2_id);
    });
    return spools.filter(s => spoolIds.has(s.id) && !excludedSpools.includes(s.id));
  }, [selectedWelds, welds, spools, excludedSpools]);

  // Derive supports from derived spools
  const derivedSupports = useMemo(() => {
    const spoolIds = derivedSpools.map(s => s.id);
    return supports.filter(s => spoolIds.includes(s.spool_id) && !excludedSupports.includes(s.id));
  }, [derivedSpools, supports, excludedSupports]);

  // Derive flanges from derived spools
  const derivedFlanges = useMemo(() => {
    const spoolIds = derivedSpools.map(s => s.id);
    return flanges.filter(f => (spoolIds.includes(f.part_1_id) || spoolIds.includes(f.first_part_id)) && !excludedFlanges.includes(f.id));
  }, [derivedSpools, flanges, excludedFlanges]);

  // Check support availability
  const getSupportAvailability = (support) => {
    const summary = supportSummary.find(s => s.support_mark === support.support_mark);
    if (!summary) return false;
    const qtyNecessarie = (summary.qty_necessary || 0) - (summary.qty_delivered || 0);
    return (summary.qty_warehouse || 0) >= qtyNecessarie;
  };

  // Check flange material availability
  const getFlangeAvailability = (flange) => {
    // Check gasket
    if (flange.gasket_code) {
      const gasketSummary = flangeSummary.find(s => s.material_code === flange.gasket_code && s.material_type === 'gasket');
      if (!gasketSummary) return false;
      const qtyNecessarie = (gasketSummary.qty_necessary || 0) - (gasketSummary.qty_delivered || 0);
      if ((gasketSummary.qty_warehouse || 0) < qtyNecessarie) return false;
    }
    // Check bolts
    if (flange.bolt_code) {
      const boltSummary = flangeSummary.find(s => s.material_code === flange.bolt_code && s.material_type === 'bolt');
      if (!boltSummary) return false;
      const qtyNecessarie = (boltSummary.qty_necessary || 0) - (boltSummary.qty_delivered || 0);
      if ((boltSummary.qty_warehouse || 0) < qtyNecessarie) return false;
    }
    return true;
  };

  // Filter welds for display
  const filteredWelds = useMemo(() => {
    return welds.filter(w => {
      if (weldFilterIso && w.isometric_id !== weldFilterIso) return false;
      if (weldSearch) {
        const search = weldSearch.toLowerCase();
        if (!w.weld_no?.toLowerCase().includes(search) && 
            !w.full_weld_no?.toLowerCase().includes(search) &&
            !w.iso_number?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [welds, weldFilterIso, weldSearch]);

  // Check for dissimilar welds
  const hasDissimilar = useMemo(() => {
    return selectedWelds.some(weldId => {
      const weld = welds.find(w => w.id === weldId);
      return weld?.is_dissimilar;
    });
  }, [selectedWelds, welds]);

  // Calculate totals
  const totals = useMemo(() => ({
    welds: selectedWelds.length,
    spools: derivedSpools.length,
    supports: derivedSupports.length,
    supportsKg: derivedSupports.reduce((sum, s) => sum + Number(s.weight_kg || s.total_weight_kg || 0), 0),
    flanges: derivedFlanges.length
  }), [selectedWelds, derivedSpools, derivedSupports, derivedFlanges]);

  // Check conflicts when squad/dates change
  useEffect(() => {
    if (selectedSquad && plannedStart && plannedEnd) {
      const foundConflicts = checkSquadConflicts(selectedSquad, plannedStart, plannedEnd, allWorkPackages);
      if (foundConflicts.length > 0) {
        setConflicts(foundConflicts);
        setShowConflictModal(true);
      } else {
        setConflicts([]);
        setSplitResources(false);
      }
    }
  }, [selectedSquad, plannedStart, plannedEnd]);

  const getSquadInfo = () => {
    const squad = squads.find(s => s.id === selectedSquad);
    if (!squad) return null;
    let memberCount = squad.squad_members?.length || 0;
    if (squad.foreman_id) memberCount++;
    return { id: squad.id, squad_number: squad.squad_number, name: squad.name, memberCount };
  };

  // Save WP
  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: wpData, error: wpError } = await supabase.from('work_packages').insert({
        project_id: project.id, 
        code: nextCode, 
        wp_type: 'piping', 
        description: formData.description || null,
        squad_id: selectedSquad || null, 
        planned_start: plannedStart || null,
        planned_end: plannedEnd || null, 
        notes: formData.notes || null, 
        status: selectedSquad ? 'planned' : 'not_assigned',
        split_resources: splitResources
      }).select().single();
      if (wpError) throw wpError;
      
      // Insert spools
      if (derivedSpools.length > 0) {
        const spoolInserts = derivedSpools.map(spool => ({
          work_package_id: wpData.id, 
          spool_id: spool.id, 
          spool_number: spool.spool_number
        }));
        const { error: spoolError } = await supabase.from('wp_spools').insert(spoolInserts);
        if (spoolError) throw spoolError;
      }
      
      // Generate activities
      await supabase.rpc('generate_wp_activities', { p_wp_id: wpData.id });
      onSuccess();
    } catch (error) {
      alert('Errore: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Can proceed to next step?
  const canProceed = () => {
    if (step === 2) return selectedWelds.length > 0;
    return true;
  };

  const stepLabels = ['Info Base', 'Saldature', 'Spools', 'Supporti', 'Flanges', 'Assegnazione'];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-blue-100">
            <div>
              <h2 className="text-xl font-bold text-gray-800">🔧 Nuovo Work Package Piping</h2>
              <p className="text-sm text-gray-500">Step {step} di 6 - {stepLabels[step - 1]}</p>
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
                  <h4 className="font-medium text-gray-700">Saldature ({filteredWelds.length})</h4>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-orange-600 font-medium">🔥 {selectedWelds.length} selezionate</span>
                    {selectedWelds.length > 0 && (
                      <button onClick={() => setSelectedWelds([])} className="text-sm text-gray-500 hover:text-gray-700">Deseleziona</button>
                    )}
                  </div>
                </div>
                
                {/* Welds list */}
                <div className="border rounded-lg divide-y max-h-80 overflow-y-auto bg-white">
                  {filteredWelds.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">Nessuna saldatura trovata</div>
                  ) : filteredWelds.map(weld => {
                    const isSelected = selectedWelds.includes(weld.id);
                    const spool1 = spools.find(s => s.id === weld.spool_1_id);
                    const spool2 = spools.find(s => s.id === weld.spool_2_id);
                    return (
                      <label key={weld.id} className={`flex items-center gap-3 p-3 cursor-pointer ${weld.is_dissimilar ? 'bg-yellow-50' : isSelected ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={e => {
                            if (e.target.checked) setSelectedWelds([...selectedWelds, weld.id]);
                            else setSelectedWelds(selectedWelds.filter(id => id !== weld.id));
                          }} 
                          className="w-4 h-4 text-orange-600 rounded" 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-sm text-orange-700">{weld.weld_no}</span>
                            {weld.is_dissimilar && <span className="text-yellow-600 text-xs bg-yellow-100 px-1.5 py-0.5 rounded">⚠️ Dissimilare</span>}
                          </div>
                          <div className="text-xs text-gray-500">{weld.iso_number}</div>
                        </div>
                        <div className="text-xs text-gray-600 text-right">
                          <div className="font-mono">{spool1?.spool_number || '?'} ↔ {spool2?.spool_number || '?'}</div>
                          <div>{weld.diameter_inch}" × {weld.thickness_mm}mm</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs ${weld.weld_type === 'BW' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                          {weld.weld_type}
                        </span>
                      </label>
                    );
                  })}
                </div>
                
                {hasDissimilar && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <h4 className="font-bold text-yellow-800">Giunti Dissimili Selezionati</h4>
                      <p className="text-sm text-yellow-700">WPS speciale richiesta per queste saldature</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Step 3: Spools (derived, can exclude) */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">📦 Spools derivati dalle saldature selezionate. Puoi <strong>escludere</strong> singoli spools se necessario.</p>
                </div>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-3 text-xs bg-gray-50 p-3 rounded-lg">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400"></span> In Produzione</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400"></span> Shipment</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-400"></span> Laydown</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400"></span> IR Issued</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-400"></span> To Site</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> Erected</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-700">Spools inclusi ({derivedSpools.length})</h4>
                  {excludedSpools.length > 0 && (
                    <button onClick={() => setExcludedSpools([])} className="text-sm text-blue-600">Ripristina tutti</button>
                  )}
                </div>
                
                <div className="border rounded-lg divide-y max-h-80 overflow-y-auto bg-white">
                  {derivedSpools.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">Nessuno spool derivato</div>
                  ) : derivedSpools.map(spool => {
                    const iso = isometrics.find(i => i.id === spool.isometric_id);
                    const spoolWelds = welds.filter(w => (w.spool_1_id === spool.id || w.spool_2_id === spool.id) && selectedWelds.includes(w.id));
                    return (
                      <div key={spool.id} className="flex items-center gap-3 p-3 hover:bg-gray-50">
                        <button 
                          onClick={() => setExcludedSpools([...excludedSpools, spool.id])}
                          className="p-1 hover:bg-red-100 rounded text-red-500 text-xs"
                          title="Escludi"
                        >✕</button>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-medium text-sm">{spool.spool_number}</div>
                          <div className="text-xs text-gray-500">{iso?.iso_number} • {spool.diameter_inch}" • {spool.weight_kg}kg</div>
                        </div>
                        <div className="text-xs text-orange-600">{spoolWelds.length} welds</div>
                        <SpoolStatusDot status={spool.site_status} />
                      </div>
                    );
                  })}
                </div>
                
                {excludedSpools.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">⚠️ {excludedSpools.length} spools esclusi</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Step 4: Supports (derived, can exclude) */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-800">🔩 Supporti derivati dagli spools. Puoi <strong>escludere</strong> singoli supporti se necessario.</p>
                </div>
                
                {/* Legend */}
                <div className="flex gap-4 text-xs bg-gray-50 p-3 rounded-lg">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> Disponibile a magazzino</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> Non disponibile</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-700">Supporti inclusi ({derivedSupports.length}) - {derivedSupports.reduce((s,x) => s + Number(x.weight_kg || x.total_weight_kg || 0), 0).toFixed(1)} kg</h4>
                  {excludedSupports.length > 0 && (
                    <button onClick={() => setExcludedSupports([])} className="text-sm text-blue-600">Ripristina tutti</button>
                  )}
                </div>
                
                <div className="border rounded-lg divide-y max-h-80 overflow-y-auto bg-white">
                  {derivedSupports.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">Nessun supporto derivato</div>
                  ) : derivedSupports.map(support => {
                    const spool = spools.find(s => s.id === support.spool_id);
                    const isAvailable = getSupportAvailability(support);
                    return (
                      <div key={support.id} className="flex items-center gap-3 p-3 hover:bg-gray-50">
                        <button 
                          onClick={() => setExcludedSupports([...excludedSupports, support.id])}
                          className="p-1 hover:bg-red-100 rounded text-red-500 text-xs"
                          title="Escludi"
                        >✕</button>
                        <AvailabilityDot available={isAvailable} />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-medium text-sm">{support.support_tag_no || support.tag_no}</div>
                          <div className="text-xs text-gray-500">
                            <span className="bg-gray-100 px-1 rounded">{support.support_mark}</span> • {spool?.spool_number}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600">{support.weight_kg || support.total_weight_kg || 0} kg</div>
                      </div>
                    );
                  })}
                </div>
                
                {excludedSupports.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">⚠️ {excludedSupports.length} supporti esclusi</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Step 5: Flanges (derived, can exclude) */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-purple-800">⚙️ Giunti flangiati derivati dagli spools. Puoi <strong>escludere</strong> singole flanges se necessario.</p>
                </div>
                
                {/* Legend */}
                <div className="flex gap-4 text-xs bg-gray-50 p-3 rounded-lg">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> Materiali disponibili</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> Materiali non disponibili</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-700">Flanges incluse ({derivedFlanges.length})</h4>
                  {excludedFlanges.length > 0 && (
                    <button onClick={() => setExcludedFlanges([])} className="text-sm text-blue-600">Ripristina tutti</button>
                  )}
                </div>
                
                <div className="border rounded-lg divide-y max-h-80 overflow-y-auto bg-white">
                  {derivedFlanges.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">Nessuna flange derivata</div>
                  ) : derivedFlanges.map(flange => {
                    const isAvailable = getFlangeAvailability(flange);
                    return (
                      <div key={flange.id} className="flex items-center gap-3 p-3 hover:bg-gray-50">
                        <button 
                          onClick={() => setExcludedFlanges([...excludedFlanges, flange.id])}
                          className="p-1 hover:bg-red-100 rounded text-red-500 text-xs"
                          title="Escludi"
                        >✕</button>
                        <AvailabilityDot available={isAvailable} />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-medium text-sm text-purple-700">{flange.flange_tag || flange.tag}</div>
                          <div className="text-xs text-gray-500">{flange.iso_number} • {flange.flange_type || flange.type}</div>
                        </div>
                        <div className="text-xs text-right">
                          <div className="text-gray-600">{flange.diameter_inch}" / {flange.pressure_rating}</div>
                          <div className="text-gray-400">G: {flange.gasket_code} • B: {flange.bolt_code} ×{flange.bolt_qty}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {excludedFlanges.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">⚠️ {excludedFlanges.length} flanges escluse</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Step 6: Assignment */}
            {step === 6 && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-bold text-green-800 mb-3">📊 Riepilogo WP</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-2xl font-bold text-orange-600">{totals.welds}</div>
                      <div className="text-xs text-gray-500">Saldature</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-2xl font-bold text-blue-600">{totals.spools}</div>
                      <div className="text-xs text-gray-500">Spools</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-2xl font-bold text-gray-600">{totals.supportsKg.toFixed(1)}</div>
                      <div className="text-xs text-gray-500">kg Supporti</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-2xl font-bold text-purple-600">{totals.flanges}</div>
                      <div className="text-xs text-gray-500">Flanges</div>
                    </div>
                  </div>
                </div>
                
                {hasDissimilar && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <h4 className="font-bold text-yellow-800">Giunti Dissimili Presenti</h4>
                      <p className="text-sm text-yellow-700">WPS speciale richiesta</p>
                    </div>
                  </div>
                )}
                
                {/* Assignment fields */}
                <div className="space-y-4 max-w-2xl">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                      <input type="date" value={plannedStart} onChange={e => setPlannedStart(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data Fine</label>
                      <input type="date" value={plannedEnd} onChange={e => setPlannedEnd(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Squadra
                      {splitResources && <span className="ml-2 text-amber-600 text-xs font-normal">➗ risorse divise</span>}
                    </label>
                    <select 
                      value={selectedSquad} 
                      onChange={e => { setSelectedSquad(e.target.value); setSplitResources(false); }} 
                      className={`w-full px-3 py-2 border rounded-lg ${splitResources ? 'border-amber-400 bg-amber-50' : ''}`}
                    >
                      <option value="">-- Non assegnare --</option>
                      {squads.map(sq => {
                        let count = sq.squad_members?.length || 0;
                        if (sq.foreman_id) count++;
                        return <option key={sq.id} value={sq.id}>Sq. {sq.squad_number} - {sq.name} ({count} pers.)</option>;
                      })}
                    </select>
                  </div>
                  {splitResources && conflicts.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-amber-500 text-lg">⚠️</span>
                        <div className="text-sm">
                          <p className="font-medium text-amber-800">Risorse divise</p>
                          <p className="text-amber-700">La squadra è condivisa con: {conflicts.map(c => c.code).join(', ')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-700">💡 Puoi assegnare la squadra anche dopo la creazione</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="flex justify-between items-center p-4 border-t bg-gray-50">
            <button 
              onClick={() => step > 1 && setStep(step - 1)} 
              disabled={step === 1} 
              className={`px-4 py-2 rounded-lg font-medium ${step === 1 ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-200'}`}
            >
              ← Indietro
            </button>
            {step < 6 ? (
              <button 
                onClick={() => setStep(step + 1)} 
                disabled={!canProceed()} 
                className={`px-6 py-2 rounded-lg font-medium ${!canProceed() ? 'bg-gray-300 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                Avanti →
              </button>
            ) : (
              <button 
                onClick={handleSave} 
                disabled={saving || selectedWelds.length === 0} 
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
              >
                {saving ? 'Salvataggio...' : '✓ Crea WP'}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Conflict Modal */}
      {showConflictModal && selectedSquad && getSquadInfo() && (
        <ResourceConflictModal
          conflicts={conflicts}
          squadInfo={getSquadInfo()}
          newWPDates={{ start: plannedStart, end: plannedEnd }}
          onSplitResources={() => { setSplitResources(true); setShowConflictModal(false); }}
          onChangeSquad={() => { setSelectedSquad(''); setSplitResources(false); setShowConflictModal(false); setConflicts([]); }}
          onClose={() => setShowConflictModal(false)}
        />
      )}
    </>
  );
};

// ============================================================================
// CREATE WP-A MODAL - Con gestione conflitti
// ============================================================================

const CreateWPAModal = ({ project, squads, allWorkPackages, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ 
    description: '', area: '', notes: '', squad_id: '', 
    planned_start: '', planned_end: '', estimated_hours: ''
  });
  const [nextCode, setNextCode] = useState('WP-A-001');
  const [splitResources, setSplitResources] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [conflictChecked, setConflictChecked] = useState(false);
  
  useEffect(() => {
    const generateCode = async () => {
      const { data } = await supabase.rpc('generate_wp_code', { p_project_id: project.id, p_type: 'action' });
      if (data) setNextCode(data);
    };
    generateCode();
  }, [project.id]);

  // Check conflitti quando cambiano squadra o date
  useEffect(() => {
    if (formData.squad_id && formData.planned_start && formData.planned_end && !conflictChecked) {
      const foundConflicts = checkSquadConflicts(formData.squad_id, formData.planned_start, formData.planned_end, allWorkPackages);
      if (foundConflicts.length > 0) {
        setConflicts(foundConflicts);
        setShowConflictModal(true);
        setConflictChecked(true);
      }
    }
  }, [formData.squad_id, formData.planned_start, formData.planned_end, conflictChecked]);

  const handleSave = async () => {
    if (!formData.description) { alert('Descrizione obbligatoria'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('work_packages').insert({
        project_id: project.id, code: nextCode, wp_type: 'action', description: formData.description,
        area: formData.area || null, squad_id: formData.squad_id || null, planned_start: formData.planned_start || null,
        planned_end: formData.planned_end || null, notes: formData.notes || null, status: formData.squad_id ? 'planned' : 'not_assigned', 
        manual_progress: 0, estimated_hours: formData.estimated_hours ? Number(formData.estimated_hours) : null,
        split_resources: splitResources
      });
      if (error) throw error;
      onSuccess();
    } catch (error) { alert('Errore: ' + error.message); } finally { setSaving(false); }
  };

  const getSquadInfo = () => {
    const squad = squads.find(s => s.id === formData.squad_id);
    if (!squad) return null;
    let memberCount = squad.squad_members?.length || 0;
    if (squad.foreman_id) memberCount++;
    return { id: squad.id, squad_number: squad.squad_number, name: squad.name, memberCount };
  };

  const handleSquadChange = (e) => {
    setFormData({...formData, squad_id: e.target.value});
    setSplitResources(false);
    setConflictChecked(false);
    setConflicts([]);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-50 to-green-100 sticky top-0">
            <h2 className="text-xl font-bold text-gray-800">⚡ Nuovo WP Action</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg">✕</button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codice</label>
              <input type="text" value={nextCode} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione *</label>
              <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Es: Preparazione area..." className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dettagli</label>
              <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                <input type="text" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monte Ore Stimato</label>
                <input type="number" value={formData.estimated_hours} onChange={e => setFormData({...formData, estimated_hours: e.target.value})} placeholder="Es: 40" className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                <input type="date" value={formData.planned_start} onChange={e => { setFormData({...formData, planned_start: e.target.value}); setConflictChecked(false); }} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Fine</label>
                <input type="date" value={formData.planned_end} onChange={e => { setFormData({...formData, planned_end: e.target.value}); setConflictChecked(false); }} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Squadra
                  {splitResources && <span className="ml-2 text-amber-600 text-xs font-normal">➗ diviso</span>}
                </label>
                <select 
                  value={formData.squad_id} 
                  onChange={handleSquadChange} 
                  className={`w-full px-3 py-2 border rounded-lg ${splitResources ? 'border-amber-400 bg-amber-50' : ''}`}
                >
                  <option value="">-- Seleziona --</option>
                  {squads.map(sq => {
                    let count = sq.squad_members?.length || 0;
                    if (sq.foreman_id) count++;
                    return <option key={sq.id} value={sq.id}>Sq. {sq.squad_number} - {sq.name} ({count} pers.)</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                <input type="text" value={formData.squad_id ? 'Pianificato' : 'Non Assegnato'} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50" />
              </div>
            </div>
            
            {splitResources && conflicts.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 text-lg">⚠️</span>
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Risorse divise</p>
                    <p className="text-amber-700">La squadra è condivisa con: {conflicts.map(c => c.code).join(', ')}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <span className="text-blue-500">📁</span>
              <p className="text-sm text-blue-700">I documenti possono essere aggiunti dopo la creazione del WP.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
            <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">Annulla</button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{saving ? 'Salvataggio...' : '✓ Crea'}</button>
          </div>
        </div>
      </div>
      
      {showConflictModal && formData.squad_id && getSquadInfo() && (
        <ResourceConflictModal
          conflicts={conflicts}
          squadInfo={getSquadInfo()}
          newWPDates={{ start: formData.planned_start, end: formData.planned_end }}
          onSplitResources={() => { setSplitResources(true); setShowConflictModal(false); }}
          onChangeSquad={() => { setFormData({...formData, squad_id: ''}); setSplitResources(false); setShowConflictModal(false); setConflicts([]); }}
          onClose={() => setShowConflictModal(false)}
        />
      )}
    </>
  );
};

// ============================================================================
// EDIT WP MODAL - Con gestione conflitti
// ============================================================================

const EditWPModal = ({ wp, squads, allWorkPackages, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false);
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
  
  const [splitResources, setSplitResources] = useState(wp.split_resources || false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [originalSquadId] = useState(wp.squad_id);

  // Check conflitti quando cambia squadra (solo se diversa dall'originale)
  useEffect(() => {
    if (formData.squad_id && formData.planned_start && formData.planned_end && formData.squad_id !== originalSquadId) {
      const foundConflicts = checkSquadConflicts(formData.squad_id, formData.planned_start, formData.planned_end, allWorkPackages, wp.id);
      if (foundConflicts.length > 0) {
        setConflicts(foundConflicts);
        setShowConflictModal(true);
      }
    }
  }, [formData.squad_id]);

  const handleSave = async () => {
    if (!formData.description) { alert('Descrizione obbligatoria'); return; }
    setSaving(true);
    try {
      const updateData = {
        description: formData.description,
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
      
      const { error } = await supabase.from('work_packages').update(updateData).eq('id', wp.id);
      if (error) throw error;
      onSuccess();
    } catch (error) { alert('Errore: ' + error.message); } finally { setSaving(false); }
  };

  const getSquadInfo = () => {
    const squad = squads.find(s => s.id === formData.squad_id);
    if (!squad) return null;
    let memberCount = squad.squad_members?.length || 0;
    if (squad.foreman_id) memberCount++;
    return { id: squad.id, squad_number: squad.squad_number, name: squad.name, memberCount };
  };

  const handleSquadChange = (e) => {
    const newSquadId = e.target.value;
    setFormData({...formData, squad_id: newSquadId});
    if (newSquadId === originalSquadId) {
      setSplitResources(wp.split_resources || false);
    } else {
      setSplitResources(false);
    }
  };

  const isPiping = wp.wp_type === 'piping';
  const headerColor = isPiping ? 'from-blue-50 to-blue-100' : 'from-green-50 to-green-100';
  const buttonColor = isPiping ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700';
  const icon = isPiping ? '🔧' : '⚡';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className={`flex items-center justify-between p-4 border-b bg-gradient-to-r ${headerColor} sticky top-0`}>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{icon} Modifica {wp.code}</h2>
              <p className="text-sm text-gray-500">{isPiping ? 'Work Package Piping' : 'Work Package Action'}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg">✕</button>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codice</label>
              <input type="text" value={wp.code} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione *</label>
              <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                <input type="text" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Squadra
                  {splitResources && <span className="ml-2 text-amber-600 text-xs font-normal">➗ diviso</span>}
                </label>
                <select 
                  value={formData.squad_id} 
                  onChange={handleSquadChange} 
                  className={`w-full px-3 py-2 border rounded-lg ${splitResources ? 'border-amber-400 bg-amber-50' : ''}`}
                >
                  <option value="">-- Non assegnato --</option>
                  {squads.map(sq => {
                    let count = sq.squad_members?.length || 0;
                    if (sq.foreman_id) count++;
                    return <option key={sq.id} value={sq.id}>Sq. {sq.squad_number} - {sq.name} ({count} pers.)</option>;
                  })}
                </select>
              </div>
            </div>
            
            {splitResources && conflicts.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 text-lg">⚠️</span>
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Risorse divise</p>
                    <p className="text-amber-700">La squadra è condivisa con: {conflicts.map(c => c.code).join(', ')}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                  <option value="not_assigned">Non Assegnato</option>
                  <option value="planned">Pianificato</option>
                  <option value="in_progress">In Corso</option>
                  <option value="completed">Completato</option>
                </select>
              </div>
              {!isPiping && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Progress %</label>
                  <input type="number" min="0" max="100" value={formData.manual_progress} onChange={e => setFormData({...formData, manual_progress: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              )}
              {isPiping && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Progress</label>
                  <input type="text" value="Calcolato automaticamente" readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500" />
                </div>
              )}
            </div>
            
            {!isPiping && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monte Ore Stimato</label>
                <input type="number" value={formData.estimated_hours} onChange={e => setFormData({...formData, estimated_hours: e.target.value})} placeholder="Es: 40" className="w-full px-3 py-2 border rounded-lg" />
              </div>
            )}
            
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
              <WPDocuments workPackageId={wp.id} projectId={wp.project_id} />
            )}
          </div>
          
          <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
            <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">Annulla</button>
            <button onClick={handleSave} disabled={saving} className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 ${buttonColor}`}>
              {saving ? 'Salvataggio...' : '✓ Salva Modifiche'}
            </button>
          </div>
        </div>
      </div>
      
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
// WP DOCUMENTS - Upload, Preview, Download con Audit
// ============================================================================

const WPDocuments = ({ workPackageId, projectId }) => {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [downloadHistory, setDownloadHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

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
    const { data, error } = await supabase
      .from('wp_documents')
      .select('*')
      .eq('work_package_id', workPackageId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error fetching documents:', error);
    setDocuments(data || []);
    setLoading(false);
  };

  const fetchDownloadHistory = async () => {
    const { data } = await supabase
      .from('wp_document_downloads')
      .select('*, document:wp_documents(file_name)')
      .eq('work_package_id', workPackageId)
      .order('downloaded_at', { ascending: false })
      .limit(50);
    
    setDownloadHistory(data || []);
  };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    
    for (const file of files) {
      try {
        const fileName = `${workPackageId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('wp-documents').upload(fileName, file);
        if (uploadError) throw uploadError;
        
        const { error: dbError } = await supabase.from('wp_documents').insert({
          work_package_id: workPackageId,
          project_id: projectId,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          storage_path: fileName,
          uploaded_by: user?.id,
          uploaded_by_name: user?.email || 'Unknown'
        });
        if (dbError) throw dbError;
      } catch (error) {
        alert(`Errore upload ${file.name}: ${error.message}`);
      }
    }
    
    setUploading(false);
    fetchDocuments();
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragOver(false); };
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleUpload(Array.from(e.dataTransfer.files)); };
  const handleFileInput = (e) => { handleUpload(Array.from(e.target.files)); };

  const handleDownload = async (doc) => {
    try {
      const { data: urlData, error: urlError } = await supabase.storage.from('wp-documents').createSignedUrl(doc.storage_path, 60);
      if (urlError) throw urlError;
      
      await supabase.from('wp_document_downloads').insert({
        document_id: doc.id,
        work_package_id: workPackageId,
        downloaded_by: user?.id,
        downloaded_by_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Unknown',
        downloaded_by_email: user?.email
      });
      
      window.open(urlData.signedUrl, '_blank');
    } catch (error) {
      alert('Errore download: ' + error.message);
    }
  };

  const handlePreview = async (doc) => {
    try {
      const { data: urlData, error } = await supabase.storage.from('wp-documents').createSignedUrl(doc.storage_path, 300);
      if (error) throw error;
      setPreviewDoc({ ...doc, previewUrl: urlData.signedUrl });
    } catch (error) {
      alert('Errore anteprima: ' + error.message);
    }
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Eliminare "${doc.file_name}"?`)) return;
    try {
      await supabase.from('wp_documents').update({ deleted_at: new Date().toISOString() }).eq('id', doc.id);
      fetchDocuments();
    } catch (error) {
      alert('Errore eliminazione: ' + error.message);
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType?.includes('pdf')) return '📄';
    if (fileType?.includes('image')) return '🖼️';
    if (fileType?.includes('word') || fileType?.includes('document')) return '📝';
    if (fileType?.includes('excel') || fileType?.includes('spreadsheet')) return '📊';
    if (fileType?.includes('zip') || fileType?.includes('rar')) return '📦';
    return '📎';
  };

  const formatSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isPreviewable = (fileType) => fileType?.includes('image') || fileType?.includes('pdf');

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-700 flex items-center gap-2">📁 Documenti ({documents.length})</h4>
        <button onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchDownloadHistory(); }} className="text-xs text-blue-600 hover:text-blue-800">
          {showHistory ? '← Torna ai documenti' : '📋 Cronologia download'}
        </button>
      </div>

      {showHistory ? (
        <div className="max-h-60 overflow-y-auto border rounded-lg">
          {downloadHistory.length === 0 ? (
            <p className="text-center text-gray-400 py-4 text-sm">Nessun download registrato</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-2">File</th>
                  <th className="text-left p-2">Utente</th>
                  <th className="text-left p-2">Data/Ora</th>
                </tr>
              </thead>
              <tbody>
                {downloadHistory.map(dl => (
                  <tr key={dl.id} className="border-t">
                    <td className="p-2">{dl.document?.file_name || 'N/A'}</td>
                    <td className="p-2">{dl.downloaded_by_name}</td>
                    <td className="p-2">{new Date(dl.downloaded_at).toLocaleString('it-IT')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                Caricamento in corso...
              </div>
            ) : (
              <>
                <p className="text-gray-500 text-sm">
                  📤 Trascina qui i file o{' '}
                  <label className="text-blue-600 hover:text-blue-800 cursor-pointer underline">
                    sfoglia
                    <input type="file" multiple onChange={handleFileInput} className="hidden" />
                  </label>
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, Immagini, Documenti (max 10MB)</p>
              </>
            )}
          </div>

          {loading ? (
            <div className="text-center py-4 text-gray-400">Caricamento...</div>
          ) : documents.length === 0 ? (
            <p className="text-center text-gray-400 py-4 text-sm">Nessun documento caricato</p>
          ) : (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg group hover:bg-gray-100">
                  <span className="text-xl">{getFileIcon(doc.file_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{doc.file_name}</p>
                    <p className="text-xs text-gray-400">{formatSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString('it-IT')}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isPreviewable(doc.file_type) && (
                      <button onClick={() => handlePreview(doc)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600" title="Anteprima">👁️</button>
                    )}
                    <button onClick={() => handleDownload(doc)} className="p-1.5 hover:bg-green-100 rounded text-green-600" title="Download">⬇️</button>
                    <button onClick={() => handleDelete(doc)} className="p-1.5 hover:bg-red-100 rounded text-red-600" title="Elimina">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {previewDoc && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={() => setPreviewDoc(null)}>
          <div className="bg-white rounded-xl max-w-4xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b bg-gray-50">
              <span className="font-medium text-sm truncate">{previewDoc.file_name}</span>
              <div className="flex gap-2">
                <button onClick={() => handleDownload(previewDoc)} className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">⬇️ Download</button>
                <button onClick={() => setPreviewDoc(null)} className="p-1 hover:bg-gray-200 rounded">✕</button>
              </div>
            </div>
            <div className="p-4 max-h-[80vh] overflow-auto">
              {previewDoc.file_type?.includes('image') ? (
                <img src={previewDoc.previewUrl} alt={previewDoc.file_name} className="max-w-full h-auto" />
              ) : previewDoc.file_type?.includes('pdf') ? (
                <iframe src={previewDoc.previewUrl} className="w-full h-[70vh]" title={previewDoc.file_name} />
              ) : (
                <p className="text-center text-gray-500">Anteprima non disponibile</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
