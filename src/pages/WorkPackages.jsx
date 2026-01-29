import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';

// ============================================================================
// WORK PACKAGES PAGE - VERSIONE 2
// FIX COMPLETO per tutti i 7 problemi identificati:
// 1. Revisione visibile (Rev.0)
// 2. Saldature con Spool1↔Spool2 + pallini stato + tooltip
// 3. Supporti con Tag, Mark, ISO, Spool, Peso, Qty Nec, Qty Disp
// 4. Flanges con Gasket/Bolts/INT Code + qty
// 5. Gantt in pagina separata (rimosso da qui)
// 6. Modifica WP completa (spools + welds + supports + flanges)
// 7. Creazione WP con salvataggio corretto di tutti gli elementi
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

// Utility: Calcola giorni trascorsi
const calculateDaysElapsed = (fromDate) => {
  if (!fromDate) return null;
  const from = new Date(fromDate);
  const now = new Date();
  return Math.ceil(Math.abs(now - from) / (1000 * 60 * 60 * 24));
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
  const [supportSummary, setSupportSummary] = useState([]);
  const [flangeMaterialsSummary, setFlangeMaterialsSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  
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
        fetchMTOData(),
        fetchInventorySummaries()
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
        wp_spools(id, spool_id, spool_number, spool:mto_spools(*)),
        wp_welds(id, weld_id, weld:mto_welds(*)),
        wp_supports(id, support_id, support:mto_supports(*)),
        wp_flanges(id, flange_id, flange:mto_flanged_joints(*))
      `)
      .eq('project_id', activeProject.id)
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error fetching WPs:', error);
    setWorkPackages(data || []);
  };

  const fetchSquads = async () => {
    const { data } = await supabase
      .from('squads')
      .select('*, squad_members(*)')
      .eq('project_id', activeProject.id)
      .eq('status', 'active');
    setSquads(data || []);
  };

  const fetchMTOData = async () => {
    const { data: isoData } = await supabase.from('mto_isometrics').select('*').eq('project_id', activeProject.id).eq('status', 'active');
    setIsometrics(isoData || []);

    const { data: spoolData } = await supabase.from('mto_spools').select('*').eq('project_id', activeProject.id).is('deleted_at', null);
    setSpools(spoolData || []);

    const { data: weldData } = await supabase.from('mto_welds').select('*').eq('project_id', activeProject.id).is('deleted_at', null);
    setWelds(weldData || []);

    const { data: suppData } = await supabase.from('mto_supports').select('*').eq('project_id', activeProject.id).is('deleted_at', null);
    setSupports(suppData || []);

    const { data: flangeData } = await supabase.from('mto_flanged_joints').select('*').eq('project_id', activeProject.id).is('deleted_at', null);
    setFlanges(flangeData || []);
  };

  const fetchInventorySummaries = async () => {
    const { data: supSum } = await supabase.from('v_mto_support_summary').select('*').eq('project_id', activeProject.id);
    setSupportSummary(supSum || []);
    
    const { data: flangeSum } = await supabase.from('v_mto_flange_materials_summary').select('*').eq('project_id', activeProject.id);
    setFlangeMaterialsSummary(flangeSum || []);
  };

  // Filtri
  const filteredWPs = useMemo(() => {
    return workPackages.filter(wp => {
      if (filterType !== 'all' && wp.wp_type !== filterType) return false;
      if (filterStatus !== 'all' && wp.status !== filterStatus) return false;
      if (filterSquad !== 'all' && wp.squad_id !== filterSquad) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!wp.code?.toLowerCase().includes(search) && !wp.description?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [workPackages, filterType, filterStatus, filterSquad, searchTerm]);

  const wpPiping = filteredWPs.filter(wp => wp.wp_type === 'piping');
  const wpAction = filteredWPs.filter(wp => wp.wp_type === 'action');

  // Calcolo progress
  const calculateProgress = useCallback((wp) => {
    if (wp.wp_type === 'action') return wp.manual_progress || 0;
    
    const wpSpools = wp.wp_spools || [];
    const wpWelds = wp.wp_welds || [];
    const wpSupports = wp.wp_supports || [];
    const wpFlanges = wp.wp_flanges || [];
    
    if (wpSpools.length === 0) return 0;
    
    // Progress basato su welds completate (principale per piping)
    const totalWelds = wpWelds.length;
    const completedWelds = wpWelds.filter(ww => ww.weld?.weld_date).length;
    
    if (totalWelds > 0) {
      return Math.round((completedWelds / totalWelds) * 100);
    }
    
    // Fallback: spools eretti
    const erecteds = wpSpools.filter(ws => ws.spool?.site_status === 'erected').length;
    return Math.round((erecteds / wpSpools.length) * 100);
  }, []);

  // Quantità per WP
  const getQuantities = useCallback((wp) => {
    const wpSpools = wp.wp_spools || [];
    const wpWelds = wp.wp_welds || [];
    const wpSupports = wp.wp_supports || [];
    const wpFlanges = wp.wp_flanges || [];
    
    return {
      spools: { total: wpSpools.length, completed: wpSpools.filter(ws => ws.spool?.site_status === 'erected').length },
      welds: { total: wpWelds.length, completed: wpWelds.filter(ww => ww.weld?.weld_date).length },
      supports: { total: wpSupports.length, completed: wpSupports.filter(ws => ws.support?.assembly_date).length },
      flanges: { total: wpFlanges.length, completed: wpFlanges.filter(wf => wf.flange?.assembly_date).length }
    };
  }, []);

  // Delete WP
  const handleDeleteWP = async (wpId) => {
    if (!confirm('Sei sicuro di voler eliminare questo Work Package?')) return;
    
    const { error } = await supabase.from('work_packages').delete().eq('id', wpId);
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchWorkPackages();
    }
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
              📋 Work Packages
            </h1>
            <p className="text-gray-500 mt-1">{activeProject?.name} • {workPackages.length} WP totali</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowCreateWPP(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium">
              🔧 Nuovo WP-P
            </button>
            <button onClick={() => setShowCreateWPA(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium">
              ⚡ Nuovo WP-A
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <StatCard icon="🔧" bg="bg-blue-50" border="border-blue-200" value={wpPiping.length} label="WP Piping" />
          <StatCard icon="⚡" bg="bg-green-50" border="border-green-200" value={wpAction.length} label="WP Action" />
          <StatCard icon="✅" bg="bg-emerald-50" border="border-emerald-200" value={filteredWPs.filter(wp => wp.status === 'completed').length} label="Completati" />
          <StatCard icon="🚧" bg="bg-amber-50" border="border-amber-200" value={filteredWPs.filter(wp => wp.status === 'in_progress').length} label="In Corso" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Cerca WP..." className="w-full pl-10 pr-4 py-2 border rounded-lg" />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="all">Tutti i tipi</option>
            <option value="piping">WP-P Piping</option>
            <option value="action">WP-A Action</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="all">Tutti gli stati</option>
            <option value="not_assigned">Non Assegnato</option>
            <option value="planned">Pianificato</option>
            <option value="in_progress">In Corso</option>
            <option value="completed">Completato</option>
          </select>
          <select value={filterSquad} onChange={(e) => setFilterSquad(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="all">Tutte le squadre</option>
            {squads.map(s => <option key={s.id} value={s.id}>SQ{s.squad_number}</option>)}
          </select>
        </div>
      </div>

      {/* WP List */}
      <div className="space-y-4">
        {filteredWPs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-gray-500">Nessun Work Package trovato</p>
          </div>
        ) : (
          <>
            {/* WP Piping */}
            {wpPiping.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  🔧 WP Piping <span className="text-sm font-normal text-gray-400">({wpPiping.length})</span>
                </h3>
                <div className="space-y-3">
                  {wpPiping.map(wp => (
                    <WPPipingCard 
                      key={wp.id} 
                      wp={wp} 
                      expanded={expandedWP === wp.id}
                      onToggle={() => setExpandedWP(expandedWP === wp.id ? null : wp.id)}
                      onEdit={() => setEditingWP(wp)}
                      onDelete={() => handleDeleteWP(wp.id)}
                      calculateProgress={calculateProgress}
                      getQuantities={getQuantities}
                      spools={spools}
                      welds={welds}
                      supports={supports}
                      flanges={flanges}
                      supportSummary={supportSummary}
                      flangeMaterialsSummary={flangeMaterialsSummary}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* WP Action */}
            {wpAction.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  ⚡ WP Action <span className="text-sm font-normal text-gray-400">({wpAction.length})</span>
                </h3>
                <div className="space-y-3">
                  {wpAction.map(wp => (
                    <WPActionCard 
                      key={wp.id} 
                      wp={wp} 
                      onEdit={() => setEditingWP(wp)}
                      onDelete={() => handleDeleteWP(wp.id)}
                      calculateProgress={calculateProgress}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
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
          onSuccess={() => { setShowCreateWPP(false); fetchWorkPackages(); }}
        />
      )}
      
      {showCreateWPA && (
        <CreateWPAModal 
          workPackages={workPackages}
          squads={squads}
          projectId={activeProject.id}
          onClose={() => setShowCreateWPA(false)}
          onSuccess={() => { setShowCreateWPA(false); fetchWorkPackages(); }}
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
          supportSummary={supportSummary}
          flangeMaterialsSummary={flangeMaterialsSummary}
          onClose={() => setEditingWP(null)}
          onSuccess={() => { setEditingWP(null); fetchWorkPackages(); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// COMPONENTI UI BASE
// ============================================================================

const StatCard = ({ icon, bg, border, value, label }) => (
  <div className={`${bg} rounded-lg p-4 border ${border}`}>
    <div className="flex items-center gap-2">
      <span className="text-xl">{icon}</span>
      <div>
        <div className="text-2xl font-bold text-gray-700">{value}</div>
        <div className="text-xs text-gray-600">{label}</div>
      </div>
    </div>
  </div>
);

const ProgressBar = ({ percent, size = 'default', color = 'bg-blue-500' }) => (
  <div className={`flex-1 bg-gray-200 rounded-full overflow-hidden ${size === 'small' ? 'h-1.5' : 'h-2.5'}`}>
    <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
  </div>
);

const StatusBadge = ({ status }) => {
  const configs = {
    not_assigned: { label: 'Non Assegnato', color: 'bg-gray-100 text-gray-600' },
    planned: { label: 'Pianificato', color: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'In Corso', color: 'bg-amber-100 text-amber-700' },
    completed: { label: 'Completato', color: 'bg-emerald-100 text-emerald-700' }
  };
  const config = configs[status] || configs.not_assigned;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>{config.label}</span>;
};

// FIX #1: RevisionBadge mostra ANCHE Rev.0
const RevisionBadge = ({ revision }) => {
  if (revision === null || revision === undefined) return null;
  return <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 text-xs rounded font-medium">Rev.{revision}</span>;
};

const DaysBadge = ({ wp }) => {
  if (wp.status === 'completed') return null;
  
  const days = calculateDaysElapsed(wp.created_at);
  if (!days || days < 7) return null;
  
  const color = days > 30 ? 'bg-red-100 text-red-700' : days > 14 ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700';
  return <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${color}`}>{days}gg</span>;
};

// FIX #2: Site Status con pallini colorati
const SiteStatusDot = ({ status }) => {
  const configs = {
    in_production: { color: 'bg-gray-400', label: 'In Produzione' },
    shipped: { color: 'bg-purple-400', label: 'Spedito' },
    ir_issued: { color: 'bg-amber-400', label: 'IR Emesso' },
    at_laydown: { color: 'bg-cyan-400', label: 'Laydown' },
    at_site: { color: 'bg-blue-400', label: 'Al Sito' },
    erected: { color: 'bg-emerald-400', label: 'Eretto' }
  };
  const config = configs[status] || configs.in_production;
  return (
    <span className={`w-3 h-3 rounded-full ${config.color} inline-block`} title={config.label}></span>
  );
};

const SiteStatusBadge = ({ status }) => {
  const configs = {
    in_production: { label: 'Prod', color: 'bg-gray-100 text-gray-600' },
    shipped: { label: 'Spedito', color: 'bg-purple-100 text-purple-700' },
    ir_issued: { label: 'IR', color: 'bg-amber-100 text-amber-700' },
    at_laydown: { label: 'Laydown', color: 'bg-cyan-100 text-cyan-700' },
    at_site: { label: 'Sito', color: 'bg-blue-100 text-blue-700' },
    erected: { label: 'Eretto', color: 'bg-emerald-100 text-emerald-700' }
  };
  const config = configs[status] || configs.in_production;
  return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${config.color}`}>{config.label}</span>;
};


// ============================================================================
// WP PIPING CARD - Con espansione dettagli
// FIX #2, #3, #4: Visualizzazione corretta di Welds, Supports, Flanges
// ============================================================================

const WPPipingCard = ({ 
  wp, expanded, onToggle, onEdit, onDelete, calculateProgress, getQuantities, 
  spools, welds, supports, flanges, supportSummary, flangeMaterialsSummary 
}) => {
  const progress = calculateProgress(wp);
  const quantities = getQuantities(wp);
  const wpSpoolNos = wp.wp_spools?.map(ws => ws.spool_number || ws.spool?.spool_no) || [];
  
  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">🔧</div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-blue-600">{wp.code}</span>
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
          <div className="text-center">
            <p className="text-xs text-gray-500">Spools</p>
            <p className="font-medium text-sm">{quantities.spools.completed}/{quantities.spools.total}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Welds</p>
            <p className="font-medium text-sm">{quantities.welds.completed}/{quantities.welds.total}</p>
          </div>
          <div className="w-24">
            <div className="flex items-center gap-2">
              <ProgressBar percent={progress} size="small" color="bg-blue-500" />
              <span className="text-xs font-medium text-gray-600">{progress}%</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">✏️</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 hover:bg-red-50 rounded-lg text-red-500">🗑️</button>
          <span className="text-gray-400 text-lg">{expanded ? '▼' : '▶'}</span>
        </div>
      </div>
      
      {/* Expanded Content - FIX #2, #3, #4 */}
      {expanded && (
        <div className="border-t bg-gray-50 p-4 space-y-6">
          {/* Progress bars dettagliati */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">📦 Spools</span>
                <span className="font-medium">{quantities.spools.completed}/{quantities.spools.total}</span>
              </div>
              <ProgressBar percent={quantities.spools.total > 0 ? (quantities.spools.completed / quantities.spools.total) * 100 : 0} size="small" color="bg-blue-500" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">🔥 Saldature</span>
                <span className="font-medium">{quantities.welds.completed}/{quantities.welds.total}</span>
              </div>
              <ProgressBar percent={quantities.welds.total > 0 ? (quantities.welds.completed / quantities.welds.total) * 100 : 0} size="small" color="bg-orange-500" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">🔩 Supporti</span>
                <span className="font-medium">{quantities.supports.completed}/{quantities.supports.total}</span>
              </div>
              <ProgressBar percent={quantities.supports.total > 0 ? (quantities.supports.completed / quantities.supports.total) * 100 : 0} size="small" color="bg-gray-500" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">⚙️ Flangie</span>
                <span className="font-medium">{quantities.flanges.completed}/{quantities.flanges.total}</span>
              </div>
              <ProgressBar percent={quantities.flanges.total > 0 ? (quantities.flanges.completed / quantities.flanges.total) * 100 : 0} size="small" color="bg-amber-500" />
            </div>
          </div>
          
          {/* FIX #2: SALDATURE con Spool1 ↔ Spool2 + pallini stato + tooltip lente */}
          {wp.wp_welds?.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">🔥 Saldature ({wp.wp_welds.length})</h4>
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left p-2 font-medium">Weld No</th>
                      <th className="text-center p-2 font-medium">Spool 1</th>
                      <th className="text-center p-2 font-medium"></th>
                      <th className="text-center p-2 font-medium">Spool 2</th>
                      <th className="text-center p-2 font-medium">Ø</th>
                      <th className="text-center p-2 font-medium">Tipo</th>
                      <th className="text-center p-2 font-medium">Stato</th>
                      <th className="text-center p-2 font-medium">Info</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wp.wp_welds.slice(0, 10).map(ww => {
                      const weld = ww.weld;
                      if (!weld) return null;
                      
                      // Trova i dati degli spool
                      const spool1 = spools.find(s => s.full_spool_no === weld.full_first_spool);
                      const spool2 = spools.find(s => s.full_spool_no === weld.full_second_spool);
                      
                      return (
                        <tr key={ww.id} className={`border-t hover:bg-gray-50 ${weld.is_dissimilar ? 'bg-yellow-50' : ''}`}>
                          <td className="p-2 font-mono text-orange-600 font-medium">{weld.weld_no}</td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <SiteStatusDot status={spool1?.site_status} />
                              <span className="font-mono text-xs text-blue-600">{weld.full_first_spool?.split('-').pop() || '-'}</span>
                            </div>
                          </td>
                          <td className="p-2 text-center text-gray-400">↔</td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <SiteStatusDot status={spool2?.site_status} />
                              <span className="font-mono text-xs text-blue-600">{weld.full_second_spool?.split('-').pop() || '-'}</span>
                            </div>
                          </td>
                          <td className="p-2 text-center text-xs">{weld.diameter_inch}"</td>
                          <td className="p-2 text-center">
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">{weld.weld_type}</span>
                          </td>
                          <td className="p-2 text-center">
                            {weld.weld_date ? (
                              <span className="text-emerald-600">✓</span>
                            ) : weld.fitup_date ? (
                              <span className="text-amber-500">◐</span>
                            ) : (
                              <span className="text-gray-300">○</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <WeldInfoTooltip weld={weld} spool1={spool1} spool2={spool2} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {wp.wp_welds.length > 10 && (
                  <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 border-t">
                    +{wp.wp_welds.length - 10} altre saldature
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* FIX #3: SUPPORTI con Tag, Mark, ISO, Spool, Peso, Qty Nec, Qty Disp */}
          {wp.wp_supports?.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">🔩 Supporti ({wp.wp_supports.length})</h4>
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left p-2 font-medium">Tag</th>
                      <th className="text-center p-2 font-medium">Support Mark</th>
                      <th className="text-left p-2 font-medium">ISO</th>
                      <th className="text-center p-2 font-medium">Spool</th>
                      <th className="text-right p-2 font-medium">Peso</th>
                      <th className="text-center p-2 font-medium">Qty Nec</th>
                      <th className="text-center p-2 font-medium">Qty Disp</th>
                      <th className="text-center p-2 font-medium">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wp.wp_supports.slice(0, 10).map(ws => {
                      const support = ws.support;
                      if (!support) return null;
                      
                      // Trova disponibilità dal summary
                      const markSummary = supportSummary.find(s => s.support_mark === support.support_mark);
                      const qtyNecessaria = markSummary?.qty_necessary || 0;
                      const qtyDisponibile = (markSummary?.qty_warehouse || 0) - (markSummary?.qty_delivered || 0);
                      const isOk = qtyDisponibile >= 1;
                      
                      return (
                        <tr key={ws.id} className="border-t hover:bg-gray-50">
                          <td className="p-2 font-mono text-xs">{support.support_tag_no}</td>
                          <td className="p-2 text-center">
                            <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{support.support_mark}</span>
                          </td>
                          <td className="p-2 text-xs text-gray-600">{support.iso_number}</td>
                          <td className="p-2 text-center">
                            <span className="font-mono text-xs text-blue-600">{support.full_spool_no?.split('-').pop() || '-'}</span>
                          </td>
                          <td className="p-2 text-right text-xs">{support.weight_kg?.toFixed(2)} kg</td>
                          <td className="p-2 text-center text-xs font-medium">{qtyNecessaria}</td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${isOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {qtyDisponibile}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            {support.assembly_date ? (
                              <span className="text-emerald-600">✓</span>
                            ) : support.delivered_to_site ? (
                              <span className="text-blue-500">◐</span>
                            ) : (
                              <span className="text-gray-300">○</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {wp.wp_supports.length > 10 && (
                  <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 border-t">
                    +{wp.wp_supports.length - 10} altri supporti
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* FIX #4: FLANGES con Gasket/Bolts/INT Code + qty */}
          {wp.wp_flanges?.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">⚙️ Accoppiamenti Flangiati ({wp.wp_flanges.length})</h4>
              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left p-2 font-medium">Tag</th>
                      <th className="text-center p-2 font-medium">Gasket</th>
                      <th className="text-center p-2 font-medium">Qty N/D</th>
                      <th className="text-center p-2 font-medium">Bolts</th>
                      <th className="text-center p-2 font-medium">Qty N/D</th>
                      <th className="text-center p-2 font-medium">INT Code</th>
                      <th className="text-center p-2 font-medium">Qty N/D</th>
                      <th className="text-center p-2 font-medium">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wp.wp_flanges.slice(0, 10).map(wf => {
                      const flange = wf.flange;
                      if (!flange) return null;
                      
                      // Trova disponibilità
                      const gasketSum = flangeMaterialsSummary.find(m => m.material_code === flange.gasket_code && m.material_type === 'gasket');
                      const boltSum = flangeMaterialsSummary.find(m => m.material_code === flange.bolt_code && m.material_type === 'bolt');
                      const insSum = flange.insulation_code ? flangeMaterialsSummary.find(m => m.material_code === flange.insulation_code && m.material_type === 'insulation') : null;
                      
                      const gasketDisp = (gasketSum?.qty_warehouse || 0) - (gasketSum?.qty_delivered || 0);
                      const boltDisp = (boltSum?.qty_warehouse || 0) - (boltSum?.qty_delivered || 0);
                      const insDisp = insSum ? (insSum.qty_warehouse || 0) - (insSum.qty_delivered || 0) : 0;
                      
                      const gasketOk = !flange.gasket_code || gasketDisp >= (flange.gasket_qty || 1);
                      const boltOk = !flange.bolt_code || boltDisp >= (flange.bolt_qty || 0);
                      const insOk = !flange.insulation_code || insDisp >= (flange.insulation_qty || 0);
                      
                      return (
                        <tr key={wf.id} className="border-t hover:bg-gray-50">
                          <td className="p-2 font-mono text-xs text-amber-700">{flange.flange_tag}</td>
                          <td className="p-2 text-center">
                            <span className="font-mono text-xs">{flange.gasket_code || '-'}</span>
                          </td>
                          <td className="p-2 text-center">
                            {flange.gasket_code ? (
                              <span className={`px-1.5 py-0.5 rounded text-xs ${gasketOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {flange.gasket_qty || 1}/{gasketDisp}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="p-2 text-center">
                            <span className="font-mono text-xs">{flange.bolt_code || '-'}</span>
                          </td>
                          <td className="p-2 text-center">
                            {flange.bolt_code ? (
                              <span className={`px-1.5 py-0.5 rounded text-xs ${boltOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {flange.bolt_qty || 0}/{boltDisp}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="p-2 text-center">
                            <span className="font-mono text-xs">{flange.insulation_code || '-'}</span>
                          </td>
                          <td className="p-2 text-center">
                            {flange.insulation_code ? (
                              <span className={`px-1.5 py-0.5 rounded text-xs ${insOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {flange.insulation_qty || 0}/{insDisp}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="p-2 text-center">
                            {flange.assembly_date ? (
                              <span className="text-emerald-600">✓</span>
                            ) : flange.delivered_to_site ? (
                              <span className="text-blue-500">◐</span>
                            ) : (
                              <span className="text-gray-300">○</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {wp.wp_flanges.length > 10 && (
                  <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 border-t">
                    +{wp.wp_flanges.length - 10} altre flangie
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Spools list (semplice) */}
          {wpSpoolNos.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">📦 Spools ({wpSpoolNos.length})</h4>
              <div className="flex flex-wrap gap-2">
                {wpSpoolNos.slice(0, 15).map((sn, idx) => {
                  const spoolData = spools.find(s => s.spool_no === sn || s.full_spool_no?.endsWith(sn));
                  return (
                    <div key={idx} className="flex items-center gap-1 bg-white border rounded px-2 py-1 text-xs">
                      <span className="font-mono">{sn}</span>
                      {spoolData && <SiteStatusBadge status={spoolData.site_status} />}
                    </div>
                  );
                })}
                {wpSpoolNos.length > 15 && <span className="text-xs text-gray-500">+{wpSpoolNos.length - 15} altri</span>}
              </div>
            </div>
          )}
          
          {/* Date */}
          {(wp.planned_start || wp.planned_end || wp.created_at) && (
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 pt-2 border-t">
              {wp.created_at && <span>📅 Creato: {new Date(wp.created_at).toLocaleDateString('it-IT')}</span>}
              {wp.planned_start && <span>📅 Inizio: {new Date(wp.planned_start).toLocaleDateString('it-IT')}</span>}
              {wp.planned_end && <span>📅 Fine: {new Date(wp.planned_end).toLocaleDateString('it-IT')}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// FIX #2: Tooltip con lente per info dettagliate saldatura
const WeldInfoTooltip = ({ weld, spool1, spool2 }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div className="relative inline-block">
      <button 
        className="p-1 hover:bg-gray-100 rounded text-gray-500"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        🔍
      </button>
      
      {showTooltip && (
        <div className="absolute z-50 right-0 top-full mt-1 w-64 bg-white border rounded-lg shadow-xl p-3 text-xs">
          <div className="font-bold text-gray-800 mb-2 border-b pb-1">
            Weld: {weld.full_weld_no}
          </div>
          
          <div className="space-y-2">
            <div>
              <p className="text-gray-500 font-medium">Spool 1:</p>
              <p className="font-mono text-blue-600">{weld.full_first_spool || '-'}</p>
              {spool1 && (
                <>
                  <p className="text-gray-600">Materiale: {spool1.service_class || '-'}</p>
                  <p className="text-gray-600">Ø {spool1.diameter_inch}" • {spool1.weight_kg?.toFixed(1)} kg</p>
                </>
              )}
            </div>
            
            <div>
              <p className="text-gray-500 font-medium">Spool 2:</p>
              <p className="font-mono text-blue-600">{weld.full_second_spool || '-'}</p>
              {spool2 && (
                <>
                  <p className="text-gray-600">Materiale: {spool2.service_class || '-'}</p>
                  <p className="text-gray-600">Ø {spool2.diameter_inch}" • {spool2.weight_kg?.toFixed(1)} kg</p>
                </>
              )}
            </div>
            
            <div className="border-t pt-2">
              <p className="text-gray-600">Ø Weld: {weld.diameter_inch}" • Spess: {weld.thickness_mm}mm</p>
              {weld.is_dissimilar && <p className="text-yellow-600 font-medium">⚠️ Saldatura Dissimile</p>}
            </div>
          </div>
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
      
      {/* Info extra */}
      {(wp.planned_start || wp.created_at) && (
        <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-xs text-gray-500">
          {wp.created_at && <span>Creato: {new Date(wp.created_at).toLocaleDateString('it-IT')}</span>}
          {wp.planned_start && <span>Inizio: {new Date(wp.planned_start).toLocaleDateString('it-IT')}</span>}
          {wp.planned_end && <span>Fine: {new Date(wp.planned_end).toLocaleDateString('it-IT')}</span>}
        </div>
      )}
    </div>
  );
};


// ============================================================================
// CREATE WP-P WIZARD
// FIX #7: Salvataggio corretto di tutti gli elementi (spools, welds, supports, flanges)
// ============================================================================

const CreateWPPWizard = ({ workPackages, squads, isometrics, spools, welds, supports, flanges, projectId, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  
  // Step 1: ISO Selection
  const [selectedISOs, setSelectedISOs] = useState([]);
  
  // Step 2: Spool selection (from selected ISOs)
  const [selectedSpools, setSelectedSpools] = useState([]);
  
  // Step 3: Review (auto-derived welds, supports, flanges)
  const [formData, setFormData] = useState({
    description: '',
    area: '',
    notes: ''
  });

  // Find already assigned spools/welds
  const assignedSpoolIds = useMemo(() => {
    const ids = new Set();
    workPackages.forEach(wp => {
      wp.wp_spools?.forEach(ws => { if (ws.spool_id) ids.add(ws.spool_id); });
    });
    return ids;
  }, [workPackages]);

  const assignedWeldIds = useMemo(() => {
    const ids = new Set();
    workPackages.forEach(wp => {
      wp.wp_welds?.forEach(ww => { if (ww.weld_id) ids.add(ww.weld_id); });
    });
    return ids;
  }, [workPackages]);

  // Available spools (from selected ISOs, not assigned)
  const availableSpools = useMemo(() => {
    if (selectedISOs.length === 0) return [];
    return spools.filter(s => 
      selectedISOs.includes(s.iso_number) && 
      !assignedSpoolIds.has(s.id)
    );
  }, [spools, selectedISOs, assignedSpoolIds]);

  // Auto-derive welds from selected spools
  const derivedWelds = useMemo(() => {
    if (selectedSpools.length === 0) return [];
    const spoolFullNos = selectedSpools.map(id => {
      const spool = spools.find(s => s.id === id);
      return spool?.full_spool_no;
    }).filter(Boolean);
    
    return welds.filter(w => 
      !assignedWeldIds.has(w.id) &&
      (spoolFullNos.includes(w.full_first_spool) || spoolFullNos.includes(w.full_second_spool))
    );
  }, [selectedSpools, spools, welds, assignedWeldIds]);

  // Auto-derive supports from selected spools
  const derivedSupports = useMemo(() => {
    if (selectedSpools.length === 0) return [];
    const spoolFullNos = selectedSpools.map(id => {
      const spool = spools.find(s => s.id === id);
      return spool?.full_spool_no;
    }).filter(Boolean);
    
    return supports.filter(s => spoolFullNos.includes(s.full_spool_no));
  }, [selectedSpools, spools, supports]);

  // Auto-derive flanges from selected spools
  const derivedFlanges = useMemo(() => {
    if (selectedSpools.length === 0) return [];
    const spoolFullNos = selectedSpools.map(id => {
      const spool = spools.find(s => s.id === id);
      return spool?.full_spool_no;
    }).filter(Boolean);
    
    return flanges.filter(f => 
      spoolFullNos.includes(f.first_part_code) || spoolFullNos.includes(f.second_part_code)
    );
  }, [selectedSpools, spools, flanges]);

  // Generate WP code
  const generateWPCode = () => {
    const existingPiping = workPackages.filter(wp => wp.wp_type === 'piping');
    const nextNum = existingPiping.length + 1;
    return `WP-P-${String(nextNum).padStart(3, '0')}`;
  };

  // FIX #7: Handle save with correct storage of ALL elements
  const handleSave = async () => {
    if (selectedSpools.length === 0) {
      alert('Seleziona almeno uno spool');
      return;
    }
    
    setSaving(true);
    try {
      const wpCode = generateWPCode();
      
      // 1. Create WP with revision 0
      const { data: newWP, error: wpError } = await supabase.from('work_packages').insert({
        project_id: projectId,
        code: wpCode,
        wp_type: 'piping',
        description: formData.description || null,
        area: formData.area || null,
        notes: formData.notes || null,
        status: 'not_assigned',
        revision: 0,
        created_at: new Date().toISOString()
      }).select().single();
      
      if (wpError) throw wpError;
      
      // 2. Save spools
      const spoolsToInsert = selectedSpools.map(spoolId => {
        const spool = spools.find(s => s.id === spoolId);
        return {
          work_package_id: newWP.id,
          spool_id: spoolId,
          spool_number: spool?.spool_no || spool?.full_spool_no
        };
      });
      
      const { error: spoolError } = await supabase.from('wp_spools').insert(spoolsToInsert);
      if (spoolError) console.error('Error saving spools:', spoolError);
      
      // 3. FIX #7: Save welds to wp_welds
      if (derivedWelds.length > 0) {
        const weldsToInsert = derivedWelds.map(weld => ({
          work_package_id: newWP.id,
          weld_id: weld.id
        }));
        
        const { error: weldError } = await supabase.from('wp_welds').insert(weldsToInsert);
        if (weldError) console.error('Error saving welds:', weldError);
      }
      
      // 4. FIX #7: Save supports to wp_supports
      if (derivedSupports.length > 0) {
        const supportsToInsert = derivedSupports.map(support => ({
          work_package_id: newWP.id,
          support_id: support.id
        }));
        
        const { error: supportError } = await supabase.from('wp_supports').insert(supportsToInsert);
        if (supportError) console.error('Error saving supports:', supportError);
      }
      
      // 5. FIX #7: Save flanges to wp_flanges
      if (derivedFlanges.length > 0) {
        const flangesToInsert = derivedFlanges.map(flange => ({
          work_package_id: newWP.id,
          flange_id: flange.id
        }));
        
        const { error: flangeError } = await supabase.from('wp_flanges').insert(flangesToInsert);
        if (flangeError) console.error('Error saving flanges:', flangeError);
      }
      
      // 6. Log revision
      await supabase.from('wp_revisions').insert({
        work_package_id: newWP.id,
        revision_number: 0,
        change_type: 'created',
        change_description: `WP creato con ${selectedSpools.length} spools, ${derivedWelds.length} welds, ${derivedSupports.length} supports, ${derivedFlanges.length} flanges`
      });
      
      onSuccess();
    } catch (error) {
      console.error('Error creating WP:', error);
      alert('Errore: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔧</span>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Nuovo WP Piping</h2>
              <p className="text-sm text-gray-500">Step {step} di 3</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg">✕</button>
        </div>
        
        {/* Progress */}
        <div className="flex border-b">
          <div className={`flex-1 p-3 text-center text-sm font-medium ${step >= 1 ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}>
            1. Seleziona ISO
          </div>
          <div className={`flex-1 p-3 text-center text-sm font-medium ${step >= 2 ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}>
            2. Seleziona Spools
          </div>
          <div className={`flex-1 p-3 text-center text-sm font-medium ${step >= 3 ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}>
            3. Riepilogo
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: ISO Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-gray-600">Seleziona gli isometrici da includere nel Work Package:</p>
              
              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                {isometrics.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">Nessun isometrico disponibile</div>
                ) : (
                  isometrics.map(iso => {
                    const isoSpools = spools.filter(s => s.iso_number === iso.iso_number && !assignedSpoolIds.has(s.id));
                    const isSelected = selectedISOs.includes(iso.iso_number);
                    
                    return (
                      <label key={iso.id} className={`flex items-center gap-4 p-4 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedISOs([...selectedISOs, iso.iso_number]);
                            } else {
                              setSelectedISOs(selectedISOs.filter(i => i !== iso.iso_number));
                              // Remove spools from this ISO
                              const isoSpoolIds = isoSpools.map(s => s.id);
                              setSelectedSpools(selectedSpools.filter(id => !isoSpoolIds.includes(id)));
                            }
                          }}
                          className="w-5 h-5 text-blue-600 rounded"
                        />
                        <div className="flex-1">
                          <p className="font-mono font-medium text-blue-600">{iso.iso_number}</p>
                          <p className="text-xs text-gray-500">{isoSpools.length} spools disponibili</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              
              {selectedISOs.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  {selectedISOs.length} ISO selezionati • {availableSpools.length} spools disponibili
                </div>
              )}
            </div>
          )}
          
          {/* Step 2: Spool Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-600">Seleziona gli spools:</p>
                <button 
                  onClick={() => setSelectedSpools(availableSpools.map(s => s.id))}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  ✓ Seleziona tutti
                </button>
              </div>
              
              <div className="border rounded-lg max-h-[350px] overflow-y-auto">
                {availableSpools.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">Nessuno spool disponibile. Torna indietro e seleziona ISO.</div>
                ) : (
                  availableSpools.map(spool => {
                    const isSelected = selectedSpools.includes(spool.id);
                    return (
                      <label key={spool.id} className={`flex items-center gap-4 p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSpools([...selectedSpools, spool.id]);
                            } else {
                              setSelectedSpools(selectedSpools.filter(id => id !== spool.id));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <div className="flex-1 flex items-center gap-4">
                          <span className="font-mono text-sm text-blue-600">{spool.spool_no}</span>
                          <span className="text-xs text-gray-500">{spool.iso_number}</span>
                          <SiteStatusBadge status={spool.site_status} />
                        </div>
                        <span className="text-xs text-gray-400">{spool.diameter_inch}" • {spool.weight_kg?.toFixed(1)}kg</span>
                      </label>
                    );
                  })
                )}
              </div>
              
              {selectedSpools.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  {selectedSpools.length} spools selezionati
                </div>
              )}
            </div>
          )}
          
          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              {/* FIX #1: Mostra Rev.0 */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono font-bold text-xl text-blue-600">{generateWPCode()}</span>
                  <RevisionBadge revision={0} />
                </div>
                <p className="text-sm text-gray-600">Nuovo Work Package Piping</p>
              </div>
              
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{selectedSpools.length}</div>
                  <div className="text-xs text-gray-600">📦 Spools</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-600">{derivedWelds.length}</div>
                  <div className="text-xs text-gray-600">🔥 Saldature</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-600">{derivedSupports.length}</div>
                  <div className="text-xs text-gray-600">🔩 Supporti</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600">{derivedFlanges.length}</div>
                  <div className="text-xs text-gray-600">⚙️ Flangie</div>
                </div>
              </div>
              
              {/* Form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                  <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="Opzionale" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                  <input type="text" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="Es. Area 100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <textarea rows={2} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-between gap-3 p-4 border-t bg-gray-50">
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
            {step > 1 ? '← Indietro' : 'Annulla'}
          </button>
          
          {step < 3 ? (
            <button 
              onClick={() => setStep(step + 1)} 
              disabled={(step === 1 && selectedISOs.length === 0) || (step === 2 && selectedSpools.length === 0)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Avanti →
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
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
    area: '',
    notes: '',
    estimated_hours: ''
  });

  const generateWPCode = () => {
    const existingAction = workPackages.filter(wp => wp.wp_type === 'action');
    const nextNum = existingAction.length + 1;
    return `WP-A-${String(nextNum).padStart(3, '0')}`;
  };

  const handleSave = async () => {
    if (!formData.description) {
      alert('Descrizione obbligatoria per WP-A');
      return;
    }
    
    setSaving(true);
    try {
      const wpCode = generateWPCode();
      
      const { data: newWP, error } = await supabase.from('work_packages').insert({
        project_id: projectId,
        code: wpCode,
        wp_type: 'action',
        description: formData.description,
        area: formData.area || null,
        notes: formData.notes || null,
        estimated_hours: formData.estimated_hours ? Number(formData.estimated_hours) : null,
        status: 'not_assigned',
        revision: 0,
        manual_progress: 0,
        created_at: new Date().toISOString()
      }).select().single();
      
      if (error) throw error;
      
      // Log revision
      await supabase.from('wp_revisions').insert({
        work_package_id: newWP.id,
        revision_number: 0,
        change_type: 'created',
        change_description: 'WP Action creato'
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-50 to-green-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Nuovo WP Action</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{generateWPCode()}</span>
                <RevisionBadge revision={0} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg">✕</button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione *</label>
            <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="Es. Installazione valvole area 100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
            <input type="text" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ore Stimate</label>
            <input type="number" value={formData.estimated_hours} onChange={e => setFormData({...formData, estimated_hours: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea rows={2} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Creazione...' : '✓ Crea WP'}
          </button>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// EDIT WP MODAL
// FIX #6: Modifica completa con spools + welds + supports + flanges
// ============================================================================

const EditWPModal = ({ 
  wp, squads, allWorkPackages, spools, welds, supports, flanges, 
  supportSummary, flangeMaterialsSummary, onClose, onSuccess 
}) => {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  
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
  const [wpWelds, setWpWelds] = useState([]);
  const [wpSupports, setWpSupports] = useState([]);
  const [wpFlanges, setWpFlanges] = useState([]);
  
  // Pending changes
  const [spoolsToAdd, setSpoolsToAdd] = useState([]);
  const [spoolsToRemove, setSpoolsToRemove] = useState([]);
  const [weldsToAdd, setWeldsToAdd] = useState([]);
  const [weldsToRemove, setWeldsToRemove] = useState([]);
  const [supportsToAdd, setSupportsToAdd] = useState([]);
  const [supportsToRemove, setSupportsToRemove] = useState([]);
  const [flangesToAdd, setFlangesToAdd] = useState([]);
  const [flangesToRemove, setFlangesToRemove] = useState([]);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(null); // 'spools', 'welds', 'supports', 'flanges'
  const [showConfirmSave, setShowConfirmSave] = useState(false);

  const isPiping = wp.wp_type === 'piping';
  const contentChanged = spoolsToAdd.length > 0 || spoolsToRemove.length > 0 ||
                         weldsToAdd.length > 0 || weldsToRemove.length > 0 ||
                         supportsToAdd.length > 0 || supportsToRemove.length > 0 ||
                         flangesToAdd.length > 0 || flangesToRemove.length > 0;

  // Load current WP content
  useEffect(() => {
    if (isPiping) {
      loadWPContent();
    }
  }, [wp.id]);

  const loadWPContent = async () => {
    const { data: spoolData } = await supabase
      .from('wp_spools')
      .select('*, spool:mto_spools(*)')
      .eq('work_package_id', wp.id);
    setWpSpools(spoolData || []);
    
    const { data: weldData } = await supabase
      .from('wp_welds')
      .select('*, weld:mto_welds(*)')
      .eq('work_package_id', wp.id);
    setWpWelds(weldData || []);
    
    const { data: supportData } = await supabase
      .from('wp_supports')
      .select('*, support:mto_supports(*)')
      .eq('work_package_id', wp.id);
    setWpSupports(supportData || []);
    
    const { data: flangeData } = await supabase
      .from('wp_flanges')
      .select('*, flange:mto_flanged_joints(*)')
      .eq('work_package_id', wp.id);
    setWpFlanges(flangeData || []);
  };

  // Available items for adding
  const currentSpoolIds = wpSpools.map(ws => ws.spool_id);
  const currentWeldIds = wpWelds.map(ww => ww.weld_id);
  const currentSupportIds = wpSupports.map(ws => ws.support_id);
  const currentFlangeIds = wpFlanges.map(wf => wf.flange_id);
  
  const availableSpools = spools.filter(s => 
    !currentSpoolIds.includes(s.id) && !spoolsToAdd.includes(s.id)
  );
  const availableWelds = welds.filter(w => 
    !currentWeldIds.includes(w.id) && !weldsToAdd.includes(w.id)
  );
  const availableSupports = supports.filter(s => 
    !currentSupportIds.includes(s.id) && !supportsToAdd.includes(s.id)
  );
  const availableFlanges = flanges.filter(f => 
    !currentFlangeIds.includes(f.id) && !flangesToAdd.includes(f.id)
  );

  // Save info
  const handleSaveInfo = async () => {
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
        updated_at: new Date().toISOString()
      };
      
      if (!isPiping) {
        updateData.manual_progress = Number(formData.manual_progress) || 0;
        updateData.estimated_hours = formData.estimated_hours ? Number(formData.estimated_hours) : null;
      }
      
      const { error } = await supabase
        .from('work_packages')
        .update(updateData)
        .eq('id', wp.id);
      
      if (error) throw error;
      onSuccess();
    } catch (error) {
      alert('Errore: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // FIX #6: Save content changes (all types)
  const handleSaveContent = async () => {
    setShowConfirmSave(false);
    setSaving(true);
    
    try {
      // Remove spools
      for (const spoolId of spoolsToRemove) {
        await supabase.from('wp_spools').delete().eq('work_package_id', wp.id).eq('spool_id', spoolId);
      }
      
      // Add spools
      for (const spoolId of spoolsToAdd) {
        const spool = spools.find(s => s.id === spoolId);
        await supabase.from('wp_spools').insert({
          work_package_id: wp.id,
          spool_id: spoolId,
          spool_number: spool?.spool_no || spool?.full_spool_no
        });
      }
      
      // Remove welds
      for (const weldId of weldsToRemove) {
        await supabase.from('wp_welds').delete().eq('work_package_id', wp.id).eq('weld_id', weldId);
      }
      
      // Add welds
      for (const weldId of weldsToAdd) {
        await supabase.from('wp_welds').insert({
          work_package_id: wp.id,
          weld_id: weldId
        });
      }
      
      // Remove supports
      for (const supportId of supportsToRemove) {
        await supabase.from('wp_supports').delete().eq('work_package_id', wp.id).eq('support_id', supportId);
      }
      
      // Add supports
      for (const supportId of supportsToAdd) {
        await supabase.from('wp_supports').insert({
          work_package_id: wp.id,
          support_id: supportId
        });
      }
      
      // Remove flanges
      for (const flangeId of flangesToRemove) {
        await supabase.from('wp_flanges').delete().eq('work_package_id', wp.id).eq('flange_id', flangeId);
      }
      
      // Add flanges
      for (const flangeId of flangesToAdd) {
        await supabase.from('wp_flanges').insert({
          work_package_id: wp.id,
          flange_id: flangeId
        });
      }
      
      // Increment revision
      const newRevision = (wp.revision || 0) + 1;
      await supabase.from('work_packages').update({ 
        revision: newRevision,
        updated_at: new Date().toISOString()
      }).eq('id', wp.id);
      
      // Log revision
      await supabase.from('wp_revisions').insert({
        work_package_id: wp.id,
        revision_number: newRevision,
        change_type: 'content_modified',
        change_description: `Modifiche: ${spoolsToAdd.length} spools aggiunti, ${spoolsToRemove.length} rimossi; ${weldsToAdd.length} welds aggiunti, ${weldsToRemove.length} rimossi; ${supportsToAdd.length} supports aggiunti, ${supportsToRemove.length} rimossi; ${flangesToAdd.length} flanges aggiunti, ${flangesToRemove.length} rimossi`
      });
      
      onSuccess();
    } catch (error) {
      alert('Errore: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const headerColor = isPiping ? 'from-blue-50 to-blue-100' : 'from-green-50 to-green-100';
  const buttonColor = isPiping ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700';
  const icon = isPiping ? '🔧' : '⚡';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b bg-gradient-to-r ${headerColor}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{icon}</span>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Modifica {wp.code}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-500">{isPiping ? 'WP Piping' : 'WP Action'}</span>
                  <RevisionBadge revision={wp.revision} />
                  {wp.created_at && <span className="text-xs text-gray-400">Creato: {new Date(wp.created_at).toLocaleDateString('it-IT')}</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg">✕</button>
          </div>
          
          {/* Tabs */}
          <div className="flex border-b overflow-x-auto">
            <button onClick={() => setActiveTab('info')} className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'info' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500'}`}>
              📝 Info
            </button>
            {isPiping && (
              <>
                <button onClick={() => setActiveTab('spools')} className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'spools' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500'}`}>
                  📦 Spools {(spoolsToAdd.length > 0 || spoolsToRemove.length > 0) && <span className="ml-1 w-2 h-2 bg-orange-500 rounded-full inline-block"></span>}
                </button>
                <button onClick={() => setActiveTab('welds')} className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'welds' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500'}`}>
                  🔥 Saldature {(weldsToAdd.length > 0 || weldsToRemove.length > 0) && <span className="ml-1 w-2 h-2 bg-orange-500 rounded-full inline-block"></span>}
                </button>
                <button onClick={() => setActiveTab('supports')} className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'supports' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500'}`}>
                  🔩 Supporti {(supportsToAdd.length > 0 || supportsToRemove.length > 0) && <span className="ml-1 w-2 h-2 bg-orange-500 rounded-full inline-block"></span>}
                </button>
                <button onClick={() => setActiveTab('flanges')} className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'flanges' ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500'}`}>
                  ⚙️ Flangie {(flangesToAdd.length > 0 || flangesToRemove.length > 0) && <span className="ml-1 w-2 h-2 bg-orange-500 rounded-full inline-block"></span>}
                </button>
              </>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Info Tab */}
            {activeTab === 'info' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Codice WP</label>
                    <div className="font-mono text-lg font-bold text-gray-800">{wp.code}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Creato il</label>
                    <div className="text-gray-800">{wp.created_at ? new Date(wp.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</div>
                  </div>
                  {wp.squad && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Squadra Attuale</label>
                      <span className="text-purple-600 font-medium">SQ{wp.squad.squad_number} {wp.squad.name ? `- ${wp.squad.name}` : ''}</span>
                    </div>
                  )}
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
                    {squads.map(s => <option key={s.id} value={s.id}>SQ{s.squad_number} {s.name ? `- ${s.name}` : ''}</option>)}
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
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
            )}
            
            {/* FIX #6: Spools Tab */}
            {activeTab === 'spools' && isPiping && (
              <EditContentSection
                title="Spools"
                icon="📦"
                items={wpSpools}
                itemsToAdd={spoolsToAdd}
                itemsToRemove={spoolsToRemove}
                onAdd={(id) => setSpoolsToAdd([...spoolsToAdd, id])}
                onRemove={(id) => setSpoolsToRemove([...spoolsToRemove, id])}
                onUndoAdd={(id) => setSpoolsToAdd(spoolsToAdd.filter(i => i !== id))}
                onUndoRemove={(id) => setSpoolsToRemove(spoolsToRemove.filter(i => i !== id))}
                availableItems={availableSpools}
                renderItem={(ws) => (
                  <>
                    <span className="font-mono text-blue-600">{ws.spool_number || ws.spool?.spool_no}</span>
                    {ws.spool && <SiteStatusBadge status={ws.spool.site_status} />}
                    <span className="text-xs text-gray-500">{ws.spool?.diameter_inch}" • {ws.spool?.weight_kg?.toFixed(1)}kg</span>
                  </>
                )}
                renderAvailableItem={(spool) => (
                  <>
                    <span className="font-mono text-blue-600">{spool.spool_no}</span>
                    <span className="text-xs text-gray-500">{spool.iso_number}</span>
                    <SiteStatusBadge status={spool.site_status} />
                  </>
                )}
                getItemId={(ws) => ws.spool_id}
                getAvailableId={(s) => s.id}
              />
            )}
            
            {/* FIX #6: Welds Tab */}
            {activeTab === 'welds' && isPiping && (
              <EditContentSection
                title="Saldature"
                icon="🔥"
                items={wpWelds}
                itemsToAdd={weldsToAdd}
                itemsToRemove={weldsToRemove}
                onAdd={(id) => setWeldsToAdd([...weldsToAdd, id])}
                onRemove={(id) => setWeldsToRemove([...weldsToRemove, id])}
                onUndoAdd={(id) => setWeldsToAdd(weldsToAdd.filter(i => i !== id))}
                onUndoRemove={(id) => setWeldsToRemove(weldsToRemove.filter(i => i !== id))}
                availableItems={availableWelds}
                renderItem={(ww) => (
                  <>
                    <span className="font-mono text-orange-600">{ww.weld?.weld_no}</span>
                    <span className="text-xs text-gray-500">{ww.weld?.full_first_spool?.split('-').pop()} ↔ {ww.weld?.full_second_spool?.split('-').pop()}</span>
                    <span className="text-xs">{ww.weld?.diameter_inch}" • {ww.weld?.weld_type}</span>
                  </>
                )}
                renderAvailableItem={(weld) => (
                  <>
                    <span className="font-mono text-orange-600">{weld.weld_no}</span>
                    <span className="text-xs text-gray-500">{weld.full_first_spool?.split('-').pop()} ↔ {weld.full_second_spool?.split('-').pop()}</span>
                    <span className="text-xs">{weld.diameter_inch}" • {weld.weld_type}</span>
                  </>
                )}
                getItemId={(ww) => ww.weld_id}
                getAvailableId={(w) => w.id}
              />
            )}
            
            {/* FIX #6: Supports Tab */}
            {activeTab === 'supports' && isPiping && (
              <EditContentSection
                title="Supporti"
                icon="🔩"
                items={wpSupports}
                itemsToAdd={supportsToAdd}
                itemsToRemove={supportsToRemove}
                onAdd={(id) => setSupportsToAdd([...supportsToAdd, id])}
                onRemove={(id) => setSupportsToRemove([...supportsToRemove, id])}
                onUndoAdd={(id) => setSupportsToAdd(supportsToAdd.filter(i => i !== id))}
                onUndoRemove={(id) => setSupportsToRemove(supportsToRemove.filter(i => i !== id))}
                availableItems={availableSupports}
                renderItem={(ws) => (
                  <>
                    <span className="font-mono text-xs">{ws.support?.support_tag_no}</span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{ws.support?.support_mark}</span>
                    <span className="text-xs text-gray-500">{ws.support?.weight_kg?.toFixed(2)}kg</span>
                  </>
                )}
                renderAvailableItem={(support) => (
                  <>
                    <span className="font-mono text-xs">{support.support_tag_no}</span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{support.support_mark}</span>
                    <span className="text-xs text-gray-500">{support.iso_number}</span>
                  </>
                )}
                getItemId={(ws) => ws.support_id}
                getAvailableId={(s) => s.id}
              />
            )}
            
            {/* FIX #6: Flanges Tab */}
            {activeTab === 'flanges' && isPiping && (
              <EditContentSection
                title="Accoppiamenti Flangiati"
                icon="⚙️"
                items={wpFlanges}
                itemsToAdd={flangesToAdd}
                itemsToRemove={flangesToRemove}
                onAdd={(id) => setFlangesToAdd([...flangesToAdd, id])}
                onRemove={(id) => setFlangesToRemove([...flangesToRemove, id])}
                onUndoAdd={(id) => setFlangesToAdd(flangesToAdd.filter(i => i !== id))}
                onUndoRemove={(id) => setFlangesToRemove(flangesToRemove.filter(i => i !== id))}
                availableItems={availableFlanges}
                renderItem={(wf) => (
                  <>
                    <span className="font-mono text-amber-700">{wf.flange?.flange_tag}</span>
                    <span className="text-xs text-gray-500">{wf.flange?.iso_number}</span>
                    <span className="text-xs">{wf.flange?.diameter_inch}" • {wf.flange?.flange_type}</span>
                  </>
                )}
                renderAvailableItem={(flange) => (
                  <>
                    <span className="font-mono text-amber-700">{flange.flange_tag}</span>
                    <span className="text-xs text-gray-500">{flange.iso_number}</span>
                    <span className="text-xs">{flange.diameter_inch}" • {flange.flange_type}</span>
                  </>
                )}
                getItemId={(wf) => wf.flange_id}
                getAvailableId={(f) => f.id}
              />
            )}
          </div>
          
          {/* Footer */}
          <div className="flex justify-between gap-3 p-4 border-t bg-gray-50">
            <div>
              {contentChanged && (
                <span className="text-sm text-amber-600">⚠️ Modifiche non salvate</span>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">Chiudi</button>
              
              {activeTab === 'info' && (
                <button onClick={handleSaveInfo} disabled={saving} className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 ${buttonColor}`}>
                  {saving ? 'Salvataggio...' : '✓ Salva Info'}
                </button>
              )}
              
              {activeTab !== 'info' && contentChanged && (
                <button onClick={() => setShowConfirmSave(true)} disabled={saving} className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 ${buttonColor}`}>
                  {saving ? 'Salvataggio...' : '✓ Salva Modifiche'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Confirm Save Modal */}
      {showConfirmSave && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">⚠️ Conferma Modifiche</h3>
            <p className="text-gray-600 mb-4">
              Stai per modificare il contenuto del WP. La revisione passerà da <strong>Rev.{wp.revision}</strong> a <strong>Rev.{(wp.revision || 0) + 1}</strong>.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              {(spoolsToAdd.length > 0 || spoolsToRemove.length > 0) && (
                <p>📦 Spools: <span className="text-green-600">+{spoolsToAdd.length}</span> / <span className="text-red-600">-{spoolsToRemove.length}</span></p>
              )}
              {(weldsToAdd.length > 0 || weldsToRemove.length > 0) && (
                <p>🔥 Saldature: <span className="text-green-600">+{weldsToAdd.length}</span> / <span className="text-red-600">-{weldsToRemove.length}</span></p>
              )}
              {(supportsToAdd.length > 0 || supportsToRemove.length > 0) && (
                <p>🔩 Supporti: <span className="text-green-600">+{supportsToAdd.length}</span> / <span className="text-red-600">-{supportsToRemove.length}</span></p>
              )}
              {(flangesToAdd.length > 0 || flangesToRemove.length > 0) && (
                <p>⚙️ Flangie: <span className="text-green-600">+{flangesToAdd.length}</span> / <span className="text-red-600">-{flangesToRemove.length}</span></p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmSave(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100">Annulla</button>
              <button onClick={handleSaveContent} disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ============================================================================
// EDIT CONTENT SECTION - Componente riutilizzabile per edit di spools/welds/supports/flanges
// ============================================================================

const EditContentSection = ({ 
  title, icon, items, itemsToAdd, itemsToRemove, 
  onAdd, onRemove, onUndoAdd, onUndoRemove,
  availableItems, renderItem, renderAvailableItem,
  getItemId, getAvailableId
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredAvailable = availableItems.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return JSON.stringify(item).toLowerCase().includes(search);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-700">{icon} {title} ({items.length - itemsToRemove.length + itemsToAdd.length})</h4>
        <button onClick={() => setShowAddModal(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          ➕ Aggiungi
        </button>
      </div>
      
      <div className="border rounded-lg max-h-[400px] overflow-y-auto">
        {/* Current items */}
        {items.filter(item => !itemsToRemove.includes(getItemId(item))).map(item => (
          <div key={item.id} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50">
            <div className="flex items-center gap-3 flex-wrap">
              {renderItem(item)}
            </div>
            <button onClick={() => onRemove(getItemId(item))} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Rimuovi">
              🗑️
            </button>
          </div>
        ))}
        
        {/* Items to add (pending) */}
        {itemsToAdd.map(id => {
          const item = availableItems.find(i => getAvailableId(i) === id) || 
                       [...availableItems].find(i => getAvailableId(i) === id);
          if (!item) return null;
          return (
            <div key={id} className="flex items-center justify-between p-3 border-b last:border-b-0 bg-green-50">
              <div className="flex items-center gap-3 flex-wrap">
                {renderAvailableItem(item)}
                <span className="text-xs text-green-600 font-medium">➕ Nuovo</span>
              </div>
              <button onClick={() => onUndoAdd(id)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">
                ✕
              </button>
            </div>
          );
        })}
        
        {/* Items marked for removal */}
        {items.filter(item => itemsToRemove.includes(getItemId(item))).map(item => (
          <div key={item.id} className="flex items-center justify-between p-3 border-b last:border-b-0 bg-red-50 opacity-50">
            <div className="flex items-center gap-3 flex-wrap line-through">
              {renderItem(item)}
              <span className="text-xs text-red-600 font-medium no-underline">🗑️ Da rimuovere</span>
            </div>
            <button onClick={() => onUndoRemove(getItemId(item))} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Annulla rimozione">
              ↩️
            </button>
          </div>
        ))}
        
        {items.length === 0 && itemsToAdd.length === 0 && (
          <div className="p-8 text-center text-gray-400">Nessun elemento</div>
        )}
      </div>
      
      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Aggiungi {title}</h3>
            </div>
            
            <div className="p-4 border-b">
              <input 
                type="text" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Cerca..."
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {filteredAvailable.length === 0 ? (
                <div className="p-8 text-center text-gray-400">Nessun elemento disponibile</div>
              ) : (
                filteredAvailable.slice(0, 50).map(item => (
                  <div key={getAvailableId(item)} className="flex items-center justify-between p-3 border-b hover:bg-gray-50">
                    <div className="flex items-center gap-3 flex-wrap">
                      {renderAvailableItem(item)}
                    </div>
                    <button 
                      onClick={() => { onAdd(getAvailableId(item)); }}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                    >
                      ➕ Aggiungi
                    </button>
                  </div>
                ))
              )}
              {filteredAvailable.length > 50 && (
                <div className="p-3 text-center text-xs text-gray-500">Mostrati 50 di {filteredAvailable.length}. Usa la ricerca per filtrare.</div>
              )}
            </div>
            
            <div className="p-4 border-t bg-gray-50">
              <button onClick={() => setShowAddModal(false)} className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
