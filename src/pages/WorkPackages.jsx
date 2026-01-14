import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import WorkPackagesGantt from '../components/WorkPackagesGantt';

// ============================================================================
// WORK PACKAGES PAGE - WP-P (Piping) e WP-A (Action)
// ============================================================================

export default function WorkPackages() {
  // Get project from context (same as Dashboard)
  const { activeProject, loading: projectLoading } = useProject();
  // State principale
  const [workPackages, setWorkPackages] = useState([]);
  const [squads, setSquads] = useState([]);
  const [isometrics, setIsometrics] = useState([]);
  const [spools, setSpools] = useState([]);
  const [welds, setWelds] = useState([]);
  const [supports, setSupports] = useState([]);
  const [flanges, setFlanges] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [activeTab, setActiveTab] = useState('list');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSquad, setFilterSquad] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedWP, setExpandedWP] = useState(null);
  
  // Modal State
  const [showCreateWPP, setShowCreateWPP] = useState(false);
  const [showCreateWPA, setShowCreateWPA] = useState(false);
  const [editingWP, setEditingWP] = useState(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================
  
  useEffect(() => {
    if (activeProject?.id) {
      fetchAllData();
    }
  }, [activeProject?.id]);

  const fetchAllData = async () => {
    setLoading(true);
    console.log('WorkPackages: Fetching data for project:', activeProject?.id);
    try {
      await Promise.all([
        fetchWorkPackages(),
        fetchSquads(),
        fetchMTOData()
      ]);
      console.log('WorkPackages: Data loaded successfully');
    } catch (error) {
      console.error('WorkPackages: Error fetching data:', error);
      alert('Errore caricamento dati: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkPackages = async () => {
    console.log('Fetching work_packages...');
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
    
    if (error) {
      console.error('Error fetching work_packages:', error);
      throw error;
    }
    
    console.log('Work packages loaded:', data?.length || 0);
    
    // Fetch activities per WP
    const wpIds = data?.map(wp => wp.id) || [];
    if (wpIds.length > 0) {
      const { data: activities, error: actError } = await supabase
        .from('wp_activities')
        .select('*')
        .in('work_package_id', wpIds);
      
      if (actError) {
        console.error('Error fetching wp_activities:', actError);
      }
      
      // Attach activities to WPs
      data.forEach(wp => {
        wp.activities = activities?.filter(a => a.work_package_id === wp.id) || [];
      });
    }
    
    setWorkPackages(data || []);
  };

  const fetchSquads = async () => {
    console.log('Fetching squads...');
    const { data, error } = await supabase
      .from('squads')
      .select('*, squad_members(id)')
      .eq('project_id', activeProject.id)
      .eq('is_active', true)
      .order('squad_number');
    
    if (error) {
      console.error('Error fetching squads:', error);
      // Non bloccare per errore squads
    }
    console.log('Squads loaded:', data?.length || 0);
    setSquads(data || []);
  };

  const fetchMTOData = async () => {
    console.log('Fetching MTO data...');
    
    try {
      const { data: isoData, error: isoError } = await supabase
        .from('mto_isometrics')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('status', 'active');
      if (isoError) console.error('Error fetching isometrics:', isoError);
      setIsometrics(isoData || []);
      console.log('Isometrics loaded:', isoData?.length || 0);
    } catch (e) {
      console.error('Isometrics fetch failed:', e);
      setIsometrics([]);
    }
    
    try {
      const { data: spoolData, error: spoolError } = await supabase
        .from('mto_spools')
        .select('*')
        .eq('project_id', activeProject.id);
      if (spoolError) console.error('Error fetching spools:', spoolError);
      setSpools(spoolData || []);
      console.log('Spools loaded:', spoolData?.length || 0);
    } catch (e) {
      console.error('Spools fetch failed:', e);
      setSpools([]);
    }
    
    try {
      const { data: weldData, error: weldError } = await supabase
        .from('mto_welds')
        .select('*')
        .eq('project_id', activeProject.id);
      if (weldError) console.error('Error fetching welds:', weldError);
      setWelds(weldData || []);
      console.log('Welds loaded:', weldData?.length || 0);
    } catch (e) {
      console.error('Welds fetch failed:', e);
      setWelds([]);
    }
    
    try {
      const { data: suppData, error: suppError } = await supabase
        .from('mto_supports')
        .select('*')
        .eq('project_id', activeProject.id);
      if (suppError) console.error('Error fetching supports:', suppError);
      setSupports(suppData || []);
      console.log('Supports loaded:', suppData?.length || 0);
    } catch (e) {
      console.error('Supports fetch failed:', e);
      setSupports([]);
    }
    
    try {
      const { data: flangeData, error: flangeError } = await supabase
        .from('mto_flanges')
        .select('*')
        .eq('project_id', activeProject.id);
      if (flangeError) console.error('Error fetching flanges:', flangeError);
      setFlanges(flangeData || []);
      console.log('Flanges loaded:', flangeData?.length || 0);
    } catch (e) {
      console.error('Flanges fetch failed:', e);
      setFlanges([]);
    }
  };

  // ============================================================================
  // CALCULATIONS
  // ============================================================================
  
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

  // ============================================================================
  // FILTERS
  // ============================================================================
  
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

  // ============================================================================
  // HANDLERS
  // ============================================================================
  
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

  // ============================================================================
  // RENDER
  // ============================================================================
  
  if (!projectLoading && !activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p className="text-lg">Nessun progetto selezionato</p>
        <p className="text-sm mt-2">Seleziona un progetto dal menu</p>
      </div>
    );
  }
  
  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (loading) {
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
        <WorkPackagesGantt workPackages={workPackages} squads={squads} calculateProgress={calculateWPProgress} />
      )}

      {/* Modals */}
      {showCreateWPP && (
        <CreateWPPWizard project={activeProject} squads={squads} isometrics={isometrics} spools={spools} welds={welds} supports={supports} flanges={flanges} onClose={() => setShowCreateWPP(false)} onSuccess={() => { setShowCreateWPP(false); fetchWorkPackages(); }} />
      )}
      
      {showCreateWPA && (
        <CreateWPAModal project={activeProject} squads={squads} onClose={() => setShowCreateWPA(false)} onSuccess={() => { setShowCreateWPA(false); fetchWorkPackages(); }} />
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
            <h3 className="font-medium text-gray-800">{wp.description}</h3>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            {wp.area && <span>📍 {wp.area}</span>}
            {wp.squad && <span>👥 Sq.{wp.squad.squad_number}</span>}
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
// CREATE WP-P WIZARD
// ============================================================================

const CreateWPPWizard = ({ project, squads, isometrics, spools, welds, supports, flanges, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ description: '', area: '', notes: '' });
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedIso, setSelectedIso] = useState('');
  const [selectedSpools, setSelectedSpools] = useState([]);
  const [selectedSquad, setSelectedSquad] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  
  const areas = [...new Set(isometrics.map(i => i.area).filter(Boolean))];
  const filteredIsos = selectedArea ? isometrics.filter(i => i.area === selectedArea) : isometrics;
  const filteredSpools = selectedIso ? spools.filter(s => s.isometric_id === selectedIso) : selectedArea ? spools.filter(s => { const iso = isometrics.find(i => i.id === s.isometric_id); return iso?.area === selectedArea; }) : spools;

  const totals = useMemo(() => {
    let weldsSet = new Set();
    let supportsKg = 0;
    let flangesCount = 0;
    let hasDissimilar = false;
    selectedSpools.forEach(spoolId => {
      welds.filter(w => w.spool_1_id === spoolId || w.spool_2_id === spoolId).forEach(w => { weldsSet.add(w.id); if (w.is_dissimilar) hasDissimilar = true; });
      supports.filter(s => s.spool_id === spoolId).forEach(s => supportsKg += Number(s.total_weight_kg || 0));
      flangesCount += flanges.filter(f => f.part_1_id === spoolId).length;
    });
    return { welds: weldsSet.size, supportsKg, flanges: flangesCount, hasDissimilar };
  }, [selectedSpools, welds, supports, flanges]);

  const weights = useMemo(() => {
    let count = 0;
    if (totals.welds > 0) count++;
    if (totals.supportsKg > 0) count++;
    if (totals.flanges > 0) count++;
    const w = count > 0 ? (100 / count).toFixed(1) : '-';
    return { welding: totals.welds > 0 ? w : '-', supports: totals.supportsKg > 0 ? w : '-', flanges: totals.flanges > 0 ? w : '-' };
  }, [totals]);

  const [nextCode, setNextCode] = useState('WP-P-001');
  useEffect(() => {
    const generateCode = async () => {
      const { data } = await supabase.rpc('generate_wp_code', { p_project_id: project.id, p_type: 'piping' });
      if (data) setNextCode(data);
    };
    generateCode();
  }, [project.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: wpData, error: wpError } = await supabase.from('work_packages').insert({
        project_id: project.id, code: nextCode, wp_type: 'piping', description: formData.description,
        area: formData.area || null, squad_id: selectedSquad || null, planned_start: plannedStart || null,
        planned_end: plannedEnd || null, notes: formData.notes || null, status: selectedSquad ? 'planned' : 'not_assigned'
      }).select().single();
      if (wpError) throw wpError;
      
      if (selectedSpools.length > 0) {
        const spoolInserts = selectedSpools.map(spoolId => {
          const spool = spools.find(s => s.id === spoolId);
          return { work_package_id: wpData.id, spool_id: spoolId, spool_number: spool?.spool_number };
        });
        const { error: spoolError } = await supabase.from('wp_spools').insert(spoolInserts);
        if (spoolError) throw spoolError;
      }
      
      await supabase.rpc('generate_wp_activities', { p_wp_id: wpData.id });
      onSuccess();
    } catch (error) {
      alert('Errore: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <div><h2 className="text-xl font-bold text-gray-800">🔧 Nuovo Work Package Piping</h2><p className="text-sm text-gray-500">Step {step} di 4</p></div>
          <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg text-gray-500">✕</button>
        </div>
        
        <div className="flex border-b">
          {['Info Base', 'Seleziona Spool', 'Riepilogo', 'Assegnazione'].map((label, idx) => (
            <div key={idx} className={`flex-1 py-3 text-center text-sm font-medium border-b-2 ${step === idx + 1 ? 'border-blue-500 text-blue-600 bg-blue-50' : step > idx + 1 ? 'border-green-500 text-green-600 bg-green-50' : 'border-transparent text-gray-400'}`}>
              {step > idx + 1 ? '✓ ' : `${idx + 1}. `}{label}
            </div>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-4 max-w-2xl">
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Codice WP</label><input type="text" value={nextCode} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Area</label><select value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full px-3 py-2 border rounded-lg"><option value="">Seleziona...</option>{areas.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Descrizione *</label><input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Es: Linea 24&quot; HC" className="w-full px-3 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Note</label><textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            </div>
          )}
          
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Area</label><select value={selectedArea} onChange={e => { setSelectedArea(e.target.value); setSelectedIso(''); }} className="w-full px-3 py-2 border rounded-lg bg-white"><option value="">Tutte</option>{areas.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Isometrico</label><select value={selectedIso} onChange={e => setSelectedIso(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white"><option value="">Tutti</option>{filteredIsos.map(iso => <option key={iso.id} value={iso.id}>{iso.iso_number}</option>)}</select></div>
              </div>
              <div className="flex items-center justify-between mb-2"><h4 className="font-medium text-gray-700">Spool ({filteredSpools.length})</h4><span className="text-sm text-blue-600 font-medium">{selectedSpools.length} sel.</span></div>
              <div className="border rounded-lg divide-y max-h-80 overflow-y-auto bg-white">
                {filteredSpools.map(spool => {
                  const iso = isometrics.find(i => i.id === spool.isometric_id);
                  const spoolWelds = welds.filter(w => w.spool_1_id === spool.id || w.spool_2_id === spool.id);
                  const spoolSupports = supports.filter(s => s.spool_id === spool.id);
                  const spoolFlanges = flanges.filter(f => f.part_1_id === spool.id);
                  const hasDissimilar = spoolWelds.some(w => w.is_dissimilar);
                  const isSelected = selectedSpools.includes(spool.id);
                  return (
                    <label key={spool.id} className={`flex items-center gap-3 p-3 cursor-pointer ${hasDissimilar ? 'bg-yellow-50' : isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={isSelected} onChange={e => { if (e.target.checked) setSelectedSpools([...selectedSpools, spool.id]); else setSelectedSpools(selectedSpools.filter(id => id !== spool.id)); }} className="w-4 h-4 text-blue-600 rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><span className="font-mono font-medium text-sm">{spool.spool_number}</span>{hasDissimilar && <span className="text-yellow-600 text-xs bg-yellow-100 px-1.5 py-0.5 rounded">⚠️</span>}</div>
                        <div className="text-xs text-gray-500">{iso?.iso_number} • {iso?.area}</div>
                      </div>
                      <div className="flex gap-3 text-xs"><span className="text-orange-600">{spoolWelds.length}W</span><span className="text-gray-500">{spoolSupports.reduce((s,x) => s + Number(x.total_weight_kg || 0), 0).toFixed(0)}kg</span><span className="text-purple-600">{spoolFlanges.length}F</span></div>
                      <SiteStatusBadge status={spool.site_status} />
                    </label>
                  );
                })}
              </div>
              {selectedSpools.length > 0 && <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex justify-between"><span className="font-medium text-blue-800">📦 {selectedSpools.length} spool</span><button onClick={() => setSelectedSpools([])} className="text-sm text-blue-600">Deseleziona</button></div>}
            </div>
          )}
          
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4"><h4 className="font-bold text-green-800 mb-2">✓ {selectedSpools.length} Spool</h4><div className="flex flex-wrap gap-2">{selectedSpools.map(spId => { const sp = spools.find(s => s.id === spId); return <span key={spId} className="bg-white px-2 py-1 rounded text-xs border font-mono">{sp?.short_name || sp?.spool_number}</span>; })}</div></div>
              {totals.hasDissimilar && <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-start gap-3"><span className="text-2xl">⚠️</span><div><h4 className="font-bold text-yellow-800">Giunti Dissimili</h4><p className="text-sm text-yellow-700">WPS speciale richiesta</p></div></div>}
              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-3 font-semibold border-b">📊 Quantità</div>
                <div className="p-4 space-y-4">
                  <div className="flex justify-between py-3 border-b"><span>🔥 Welding</span><span className="font-bold text-xl">{totals.welds} joints</span></div>
                  <div className="flex justify-between py-3 border-b"><span>🔩 Supports</span><span className="font-bold text-xl">{totals.supportsKg.toFixed(1)} kg</span></div>
                  <div className="flex justify-between py-3"><span>⚙️ Flanges</span><span className="font-bold text-xl">{totals.flanges} joints</span></div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-3">📐 Pesi</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className={`rounded-lg p-3 ${totals.welds > 0 ? 'bg-white border-2 border-orange-300' : 'bg-gray-100 opacity-50'}`}><div className="text-2xl font-bold text-orange-600">{weights.welding}%</div><div className="text-xs">Welding</div></div>
                  <div className={`rounded-lg p-3 ${totals.supportsKg > 0 ? 'bg-white border-2 border-gray-400' : 'bg-gray-100 opacity-50'}`}><div className="text-2xl font-bold text-gray-600">{weights.supports}%</div><div className="text-xs">Supports</div></div>
                  <div className={`rounded-lg p-3 ${totals.flanges > 0 ? 'bg-white border-2 border-purple-300' : 'bg-gray-100 opacity-50'}`}><div className="text-2xl font-bold text-purple-600">{weights.flanges}%</div><div className="text-xs">Flanges</div></div>
                </div>
              </div>
            </div>
          )}
          
          {step === 4 && (
            <div className="space-y-4 max-w-2xl">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Squadra</label><select value={selectedSquad} onChange={e => setSelectedSquad(e.target.value)} className="w-full px-3 py-2 border rounded-lg"><option value="">-- Non assegnare --</option>{squads.map(sq => <option key={sq.id} value={sq.id}>Sq. {sq.squad_number} - {sq.name} ({sq.squad_members?.length || 0})</option>)}</select></div>
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Inizio</label><input type="date" value={plannedStart} onChange={e => setPlannedStart(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Fine</label><input type="date" value={plannedEnd} onChange={e => setPlannedEnd(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4"><p className="text-sm text-amber-700">💡 Puoi assegnare anche dopo</p></div>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <button onClick={() => step > 1 && setStep(step - 1)} disabled={step === 1} className={`px-4 py-2 rounded-lg font-medium ${step === 1 ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-200'}`}>← Indietro</button>
          {step < 4 ? (
            <button onClick={() => setStep(step + 1)} disabled={(step === 1 && !formData.description) || (step === 2 && selectedSpools.length === 0)} className={`px-6 py-2 rounded-lg font-medium ${(step === 1 && !formData.description) || (step === 2 && selectedSpools.length === 0) ? 'bg-gray-300 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Avanti →</button>
          ) : (
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50">{saving ? 'Salvataggio...' : '✓ Crea WP'}</button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// CREATE WP-A MODAL
// ============================================================================

const CreateWPAModal = ({ project, squads, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ description: '', area: '', notes: '', squad_id: '', planned_start: '', planned_end: '' });
  const [nextCode, setNextCode] = useState('WP-A-001');
  
  useEffect(() => {
    const generateCode = async () => {
      const { data } = await supabase.rpc('generate_wp_code', { p_project_id: project.id, p_type: 'action' });
      if (data) setNextCode(data);
    };
    generateCode();
  }, [project.id]);

  const handleSave = async () => {
    if (!formData.description) { alert('Descrizione obbligatoria'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('work_packages').insert({
        project_id: project.id, code: nextCode, wp_type: 'action', description: formData.description,
        area: formData.area || null, squad_id: formData.squad_id || null, planned_start: formData.planned_start || null,
        planned_end: formData.planned_end || null, notes: formData.notes || null, status: formData.squad_id ? 'planned' : 'not_assigned', manual_progress: 0
      });
      if (error) throw error;
      onSuccess();
    } catch (error) { alert('Errore: ' + error.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-50 to-green-100"><h2 className="text-xl font-bold text-gray-800">⚡ Nuovo WP Action</h2><button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg">✕</button></div>
        <div className="p-6 space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Codice</label><input type="text" value={nextCode} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Descrizione *</label><input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Es: Preparazione area..." className="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Dettagli</label><textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Area</label><input type="text" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Squadra</label><select value={formData.squad_id} onChange={e => setFormData({...formData, squad_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg"><option value="">--</option>{squads.map(sq => <option key={sq.id} value={sq.id}>Sq. {sq.squad_number}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Inizio</label><input type="date" value={formData.planned_start} onChange={e => setFormData({...formData, planned_start: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Fine</label><input type="date" value={formData.planned_end} onChange={e => setFormData({...formData, planned_end: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{saving ? 'Salvataggio...' : '✓ Crea'}</button>
        </div>
      </div>
    </div>
  );
};
