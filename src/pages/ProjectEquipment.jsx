import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';

// ============================================================================
// PROJECT EQUIPMENT PAGE
// Gestione Equipment di processo: Compressori, Pompe, Vessel, Scambiatori, etc.
// ============================================================================

// Configurazione tipi equipment con icone e colori
const EQUIPMENT_TYPE_CONFIG = {
  COMPRESSOR: { icon: '🌀', color: 'bg-blue-100 text-blue-700', label: 'Compressore', labelEn: 'Compressor' },
  AIR_COOLER: { icon: '❄️', color: 'bg-cyan-100 text-cyan-700', label: 'Air Cooler', labelEn: 'Air Cooler' },
  HEAT_EXCHANGER: { icon: '🔥', color: 'bg-orange-100 text-orange-700', label: 'Scambiatore', labelEn: 'Heat Exchanger' },
  PUMP: { icon: '💧', color: 'bg-blue-100 text-blue-700', label: 'Pompa', labelEn: 'Pump' },
  VESSEL: { icon: '🛢️', color: 'bg-gray-100 text-gray-700', label: 'Vessel', labelEn: 'Vessel' },
  TANK: { icon: '🏗️', color: 'bg-amber-100 text-amber-700', label: 'Serbatoio', labelEn: 'Tank' },
  FILTER: { icon: '🔲', color: 'bg-green-100 text-green-700', label: 'Filtro', labelEn: 'Filter' },
  SEPARATOR: { icon: '⚗️', color: 'bg-purple-100 text-purple-700', label: 'Separatore', labelEn: 'Separator' },
  REACTOR: { icon: '⚡', color: 'bg-red-100 text-red-700', label: 'Reattore', labelEn: 'Reactor' },
  COLUMN: { icon: '🗼', color: 'bg-indigo-100 text-indigo-700', label: 'Colonna', labelEn: 'Column' },
  MOTOR: { icon: '⚙️', color: 'bg-slate-100 text-slate-700', label: 'Motore', labelEn: 'Motor' },
  GENERATOR: { icon: '🔌', color: 'bg-yellow-100 text-yellow-700', label: 'Generatore', labelEn: 'Generator' },
  VALVE: { icon: '🔧', color: 'bg-pink-100 text-pink-700', label: 'Valvola', labelEn: 'Valve' },
  INSTRUMENT: { icon: '📊', color: 'bg-teal-100 text-teal-700', label: 'Strumento', labelEn: 'Instrument' },
  PIPING_SPECIALTY: { icon: '🔩', color: 'bg-violet-100 text-violet-700', label: 'Specialità Piping', labelEn: 'Piping Specialty' }
};

export default function ProjectEquipment() {
  const { t, i18n } = useTranslation();
  const { activeProject, loading: projectLoading } = useProject();
  const isItalian = i18n.language === 'it';

  // Data state
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterArea, setFilterArea] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedMain, setExpandedMain] = useState({});

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importDiffs, setImportDiffs] = useState([]);
  const [selectedDiffs, setSelectedDiffs] = useState({});
  const [importing, setImporting] = useState(false);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    if (activeProject?.id) {
      fetchEquipment();
    }
  }, [activeProject?.id]);

  const fetchEquipment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_equipment')
        .select('*')
        .eq('project_id', activeProject.id)
        .is('deleted_at', null)
        .order('tag');

      if (error) throw error;
      setEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // COMPUTED DATA
  // ============================================================================

  const stats = useMemo(() => {
    const total = equipment.length;
    const installed = equipment.filter(e => e.installation_date).length;
    const mainEquipment = equipment.filter(e => e.is_main_equipment).length;
    const subEquipment = equipment.filter(e => !e.is_main_equipment).length;
    const totalWeight = equipment.reduce((sum, e) => sum + (e.weight_kg || 0), 0);
    
    // Count by type
    const byType = {};
    equipment.forEach(e => {
      if (!byType[e.equipment_type]) {
        byType[e.equipment_type] = { total: 0, installed: 0 };
      }
      byType[e.equipment_type].total++;
      if (e.installation_date) byType[e.equipment_type].installed++;
    });

    return { total, installed, mainEquipment, subEquipment, totalWeight, byType };
  }, [equipment]);

  // Get unique areas
  const areas = useMemo(() => {
    const uniqueAreas = [...new Set(equipment.map(e => e.area).filter(Boolean))];
    return uniqueAreas.sort();
  }, [equipment]);

  // Get main equipment for hierarchy
  const mainEquipmentList = useMemo(() => {
    return equipment.filter(e => e.is_main_equipment);
  }, [equipment]);

  // Build hierarchy map
  const hierarchyMap = useMemo(() => {
    const map = {};
    mainEquipmentList.forEach(main => {
      map[main.id] = {
        main,
        children: equipment.filter(e => e.main_equipment_id === main.id)
      };
    });
    return map;
  }, [equipment, mainEquipmentList]);

  // Filtered equipment
  const filteredEquipment = useMemo(() => {
    return equipment.filter(e => {
      if (filterType !== 'all' && e.equipment_type !== filterType) return false;
      if (filterArea !== 'all' && e.area !== filterArea) return false;
      if (filterStatus === 'installed' && !e.installation_date) return false;
      if (filterStatus === 'pending' && e.installation_date) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!e.tag?.toLowerCase().includes(search) &&
            !e.description?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [equipment, filterType, filterArea, filterStatus, searchTerm]);

  // ============================================================================
  // CRUD HANDLERS
  // ============================================================================

  const handleAdd = async (data) => {
    try {
      const { error } = await supabase.from('project_equipment').insert({
        project_id: activeProject.id,
        ...data
      });
      if (error) throw error;
      fetchEquipment();
      setShowAddModal(false);
    } catch (error) {
      alert('Errore: ' + error.message);
    }
  };

  const handleUpdate = async (id, updates) => {
    try {
      const { error } = await supabase
        .from('project_equipment')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      fetchEquipment();
      setEditingItem(null);
    } catch (error) {
      alert('Errore: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo equipment?')) return;
    try {
      const { error } = await supabase
        .from('project_equipment')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      fetchEquipment();
    } catch (error) {
      alert('Errore: ' + error.message);
    }
  };

  // ============================================================================
  // IMPORT EXCEL
  // ============================================================================

  const parseExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(worksheet);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const parseExcelDate = (value) => {
    if (!value) return null;
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date)) return date.toISOString().split('T')[0];
    }
    return null;
  };

  const mapExcelToDb = (row) => ({
    external_id: row.Equipment_ID?.toString(),
    tag: row.Tag,
    description: row.Description,
    equipment_type: row.Type,
    weight_kg: parseFloat(row.Weight_kg) || null,
    dimensions: row.Dimensions,
    is_main_equipment: row.Is_Main === 'Yes',
    area: row.Area,
    zone: row.Zone,
    elevation: row.Elevation,
    planned_date: parseExcelDate(row.Planned_Date),
    installation_date: parseExcelDate(row.Installation_Date),
    week_plan: row.Week_Plan
  });

  const analyzeImport = async () => {
    if (!importFile) return;
    setImporting(true);
    
    try {
      const newData = await parseExcelFile(importFile);
      const existingMap = new Map(equipment.map(e => [e.tag, e]));
      const diffs = [];

      // First pass: create all equipment (to get IDs for hierarchy)
      const newItems = newData.map(row => mapExcelToDb(row));
      
      newItems.forEach((newItem, idx) => {
        const existing = existingMap.get(newItem.tag);
        if (!existing) {
          diffs.push({
            type: 'new',
            key: newItem.tag,
            data: newItem,
            originalRow: newData[idx],
            details: `Nuovo: ${newItem.tag} - ${newItem.description || ''}`
          });
        } else {
          // Check for changes
          const changes = [];
          const fieldsToCheck = ['description', 'equipment_type', 'weight_kg', 'dimensions', 'area', 'zone', 'elevation', 'planned_date', 'installation_date'];
          fieldsToCheck.forEach(field => {
            const oldVal = existing[field]?.toString() || '';
            const newVal = newItem[field]?.toString() || '';
            if (oldVal !== newVal) {
              changes.push({ field, old: oldVal || '(vuoto)', new: newVal || '(vuoto)' });
            }
          });
          if (changes.length > 0) {
            diffs.push({
              type: 'modified',
              key: newItem.tag,
              existingData: existing,
              newData: newItem,
              originalRow: newData[idx],
              changes,
              details: changes.map(c => `${c.field}: ${c.old} → ${c.new}`).join(', ')
            });
          }
        }
      });

      // Check for deleted
      const newTags = new Set(newItems.map(i => i.tag));
      equipment.forEach(existing => {
        if (!newTags.has(existing.tag)) {
          diffs.push({
            type: 'deleted',
            key: existing.tag,
            data: existing,
            details: `Rimosso: ${existing.tag}`
          });
        }
      });

      setImportDiffs(diffs);
      setSelectedDiffs({});
      setShowImportModal(false);
      setShowDiffModal(true);
    } catch (error) {
      console.error('Import error:', error);
      alert('Errore analisi file: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const applySelectedDiffs = async () => {
    setImporting(true);
    const selectedList = importDiffs.filter((_, idx) => selectedDiffs[idx]);

    try {
      // First, handle new and modified items
      for (const diff of selectedList) {
        if (diff.type === 'new') {
          const insertData = {
            project_id: activeProject.id,
            ...diff.data,
            imported_at: new Date().toISOString()
          };
          // Handle main_equipment_tag reference
          if (diff.originalRow?.Main_Equipment_Tag) {
            const mainEq = equipment.find(e => e.tag === diff.originalRow.Main_Equipment_Tag);
            if (mainEq) {
              insertData.main_equipment_id = mainEq.id;
            }
          }
          const { error } = await supabase.from('project_equipment').insert(insertData);
          if (error) throw error;
        } else if (diff.type === 'modified') {
          const updateData = { ...diff.newData, updated_at: new Date().toISOString() };
          // Handle main_equipment_tag reference
          if (diff.originalRow?.Main_Equipment_Tag) {
            const mainEq = equipment.find(e => e.tag === diff.originalRow.Main_Equipment_Tag);
            if (mainEq) {
              updateData.main_equipment_id = mainEq.id;
            }
          }
          const { error } = await supabase
            .from('project_equipment')
            .update(updateData)
            .eq('id', diff.existingData.id);
          if (error) throw error;
        } else if (diff.type === 'deleted') {
          const { error } = await supabase
            .from('project_equipment')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', diff.data.id);
          if (error) throw error;
        }
      }

      // Refresh and fix hierarchy references
      await fetchEquipment();
      
      // Second pass: update main_equipment_id for newly created items
      const updatedEquipment = (await supabase
        .from('project_equipment')
        .select('*')
        .eq('project_id', activeProject.id)
        .is('deleted_at', null)).data || [];

      for (const diff of selectedList) {
        if (diff.type === 'new' && diff.originalRow?.Main_Equipment_Tag) {
          const mainEq = updatedEquipment.find(e => e.tag === diff.originalRow.Main_Equipment_Tag);
          const newItem = updatedEquipment.find(e => e.tag === diff.data.tag);
          if (mainEq && newItem && !newItem.main_equipment_id) {
            await supabase
              .from('project_equipment')
              .update({ main_equipment_id: mainEq.id })
              .eq('id', newItem.id);
          }
        }
      }

      await fetchEquipment();
      setShowDiffModal(false);
      setImportDiffs([]);
      setImportFile(null);
      alert(`Import completato! ${selectedList.length} modifiche applicate.`);
    } catch (error) {
      console.error('Apply diffs error:', error);
      alert('Errore: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  // ============================================================================
  // EXPORT TEMPLATE
  // ============================================================================

  const exportTemplate = () => {
    const template = {
      columns: ['Equipment_ID', 'Tag', 'Description', 'Type', 'Weight_kg', 'Dimensions', 'Is_Main', 'Main_Equipment_Tag', 'Area', 'Zone', 'Elevation', 'Planned_Date', 'Installation_Date', 'Week_Plan'],
      example: {
        Equipment_ID: 1,
        Tag: 'C-101',
        Description: 'Main Process Compressor',
        Type: 'COMPRESSOR',
        Weight_kg: 12500,
        Dimensions: '4.5m x 2.5m x 3.0m',
        Is_Main: 'Yes',
        Main_Equipment_Tag: '',
        Area: 'PROCESS',
        Zone: 'A',
        Elevation: '+0.0m',
        Planned_Date: '2025-03-15',
        Installation_Date: '',
        Week_Plan: 'W11-2025'
      }
    };

    const ws = XLSX.utils.json_to_sheet([template.example], { header: template.columns });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipment');
    XLSX.writeFile(wb, 'Project_Equipment_Template.xlsx');
  };

  // ============================================================================
  // RENDER
  // ============================================================================

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

  const tabs = [
    { id: 'list', label: '📋 Lista', count: equipment.length },
    { id: 'hierarchy', label: '🏗️ Gerarchia', count: mainEquipmentList.length },
    { id: 'summary', label: '📊 Riepilogo', count: null }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              🏭 Project Equipment
            </h1>
            <p className="text-gray-500 mt-1">{activeProject?.name} • Equipment di processo</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowImportModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium">
              📥 Importa Excel
            </button>
            <button onClick={exportTemplate} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium">
              📤 Esporta Template
            </button>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium">
              ➕ Aggiungi
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <StatCard icon="🏭" bg="bg-blue-50" border="border-blue-200" value={stats.total} label="Totale" sub={`${stats.mainEquipment} main`} />
          <StatCard icon="✅" bg="bg-emerald-50" border="border-emerald-200" value={stats.installed} label="Installati" sub={`${((stats.installed/stats.total)*100 || 0).toFixed(0)}%`} />
          <StatCard icon="⏳" bg="bg-amber-50" border="border-amber-200" value={stats.total - stats.installed} label="Da installare" />
          <StatCard icon="🔗" bg="bg-purple-50" border="border-purple-200" value={stats.subEquipment} label="Sub-Equipment" />
          <StatCard icon="⚖️" bg="bg-gray-50" border="border-gray-200" value={`${(stats.totalWeight/1000).toFixed(1)}t`} label="Peso Totale" />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {tab.count !== null && <span className="ml-2 px-2 py-0.5 bg-gray-200 rounded-full text-xs">{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Filters */}
        {activeTab !== 'summary' && (
          <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Cerca tag o descrizione..." className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 border rounded-lg">
              <option value="all">Tutti i tipi</option>
              {Object.entries(EQUIPMENT_TYPE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.icon} {isItalian ? cfg.label : cfg.labelEn}</option>
              ))}
            </select>
            <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)} className="px-3 py-2 border rounded-lg">
              <option value="all">Tutte le aree</option>
              {areas.map(area => <option key={area} value={area}>{area}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg">
              <option value="all">Tutti gli stati</option>
              <option value="installed">✅ Installati</option>
              <option value="pending">⏳ Da installare</option>
            </select>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'list' && (
            <EquipmentTable
              equipment={filteredEquipment}
              allEquipment={equipment}
              isItalian={isItalian}
              onEdit={setEditingItem}
              onDelete={handleDelete}
            />
          )}
          {activeTab === 'hierarchy' && (
            <HierarchyView
              hierarchyMap={hierarchyMap}
              expandedMain={expandedMain}
              setExpandedMain={setExpandedMain}
              isItalian={isItalian}
              onEdit={setEditingItem}
            />
          )}
          {activeTab === 'summary' && (
            <SummaryView stats={stats} isItalian={isItalian} />
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddEditModal
          equipment={equipment}
          isItalian={isItalian}
          onSave={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {editingItem && (
        <AddEditModal
          item={editingItem}
          equipment={equipment}
          isItalian={isItalian}
          onSave={(data) => handleUpdate(editingItem.id, data)}
          onClose={() => setEditingItem(null)}
        />
      )}
      {showImportModal && (
        <ImportModal
          importFile={importFile}
          onFileSelect={setImportFile}
          onAnalyze={analyzeImport}
          onClose={() => setShowImportModal(false)}
          importing={importing}
        />
      )}
      {showDiffModal && (
        <DiffModal
          diffs={importDiffs}
          selectedDiffs={selectedDiffs}
          setSelectedDiffs={setSelectedDiffs}
          onApply={applySelectedDiffs}
          onClose={() => setShowDiffModal(false)}
          importing={importing}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const StatCard = ({ icon, bg, border, value, label, sub }) => (
  <div className={`${bg} rounded-lg p-4 border ${border}`}>
    <div className="flex items-center gap-2">
      <span className="text-xl">{icon}</span>
      <div>
        <div className="text-2xl font-bold text-gray-700">{value}</div>
        <div className="text-xs text-gray-600">{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  </div>
);

const TypeBadge = ({ type, isItalian }) => {
  const config = EQUIPMENT_TYPE_CONFIG[type] || { icon: '📦', color: 'bg-gray-100 text-gray-700', label: type, labelEn: type };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color} whitespace-nowrap`}>
      {config.icon} {isItalian ? config.label : config.labelEn}
    </span>
  );
};

const StatusBadge = ({ installed }) => (
  <span className={`px-2 py-1 rounded-full text-xs font-medium ${installed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
    {installed ? '✅ Installato' : '⏳ Pending'}
  </span>
);

// Equipment Table
const EquipmentTable = ({ equipment, allEquipment, isItalian, onEdit, onDelete }) => (
  <div className="overflow-x-auto border rounded-lg">
    <table className="w-full text-sm">
      <thead className="bg-gray-100">
        <tr>
          <th className="text-left p-3 font-medium">Tag</th>
          <th className="text-left p-3 font-medium">Descrizione</th>
          <th className="text-center p-3 font-medium">Tipo</th>
          <th className="text-center p-3 font-medium">Area / Zona</th>
          <th className="text-center p-3 font-medium">Peso</th>
          <th className="text-center p-3 font-medium">Main Equipment</th>
          <th className="text-center p-3 font-medium">Stato</th>
          <th className="text-center p-3 font-medium">Data Inst.</th>
          <th className="text-center p-3 font-medium">Azioni</th>
        </tr>
      </thead>
      <tbody>
        {equipment.length === 0 ? (
          <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nessun equipment trovato</td></tr>
        ) : equipment.map(eq => {
          const mainEq = allEquipment.find(e => e.id === eq.main_equipment_id);
          return (
            <tr key={eq.id} className={`border-t hover:bg-gray-50 ${!eq.is_main_equipment ? 'bg-blue-50/30' : ''}`}>
              <td className="p-3">
                <div className="font-mono font-bold text-blue-600">{eq.tag}</div>
                {!eq.is_main_equipment && <div className="text-xs text-gray-400">↳ Sub-equipment</div>}
              </td>
              <td className="p-3 text-gray-700 max-w-[200px] truncate">{eq.description}</td>
              <td className="p-3 text-center"><TypeBadge type={eq.equipment_type} isItalian={isItalian} /></td>
              <td className="p-3 text-center text-xs">
                <span className="text-gray-600">{eq.area}</span>
                {eq.zone && <span className="text-gray-400"> / {eq.zone}</span>}
              </td>
              <td className="p-3 text-center">{eq.weight_kg ? `${eq.weight_kg.toLocaleString()} kg` : '—'}</td>
              <td className="p-3 text-center">
                {eq.is_main_equipment ? (
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">⭐ MAIN</span>
                ) : (
                  <span className="text-xs text-blue-600 font-mono">{mainEq?.tag || '—'}</span>
                )}
              </td>
              <td className="p-3 text-center"><StatusBadge installed={!!eq.installation_date} /></td>
              <td className="p-3 text-center text-xs">{eq.installation_date || '—'}</td>
              <td className="p-3 text-center">
                <button onClick={() => onEdit(eq)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600">✏️</button>
                <button onClick={() => onDelete(eq.id)} className="p-1.5 hover:bg-red-100 rounded text-red-600 ml-1">🗑️</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// Hierarchy View
const HierarchyView = ({ hierarchyMap, expandedMain, setExpandedMain, isItalian, onEdit }) => (
  <div className="space-y-4">
    {Object.entries(hierarchyMap).length === 0 ? (
      <p className="text-center text-gray-400 py-8">Nessun Main Equipment trovato</p>
    ) : (
      Object.entries(hierarchyMap).map(([mainId, { main, children }]) => {
        const isExpanded = expandedMain[mainId] !== false;
        return (
          <div key={mainId} className="border rounded-lg overflow-hidden">
            {/* Main Equipment Header */}
            <div
              className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 flex items-center gap-4 cursor-pointer hover:bg-indigo-100 transition-colors"
              onClick={() => setExpandedMain({ ...expandedMain, [mainId]: !isExpanded })}
            >
              <button className="text-indigo-600 font-bold text-lg">
                {isExpanded ? '▼' : '▶'}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-indigo-700 font-mono">{main.tag}</span>
                  <TypeBadge type={main.equipment_type} isItalian={isItalian} />
                  <StatusBadge installed={!!main.installation_date} />
                </div>
                <p className="text-gray-600 text-sm mt-1">{main.description}</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <div>{main.area} {main.zone && `/ ${main.zone}`}</div>
                {main.weight_kg && <div>{main.weight_kg.toLocaleString()} kg</div>}
              </div>
              <button onClick={(e) => { e.stopPropagation(); onEdit(main); }} className="p-2 hover:bg-blue-200 rounded text-blue-600">✏️</button>
            </div>
            
            {/* Sub-Equipment */}
            {isExpanded && children.length > 0 && (
              <div className="bg-white border-t">
                {children.map(child => (
                  <div key={child.id} className="flex items-center gap-4 p-3 pl-12 border-b last:border-0 hover:bg-gray-50">
                    <span className="text-gray-300">↳</span>
                    <span className="font-mono font-medium text-blue-600">{child.tag}</span>
                    <TypeBadge type={child.equipment_type} isItalian={isItalian} />
                    <span className="flex-1 text-gray-600 text-sm truncate">{child.description}</span>
                    <StatusBadge installed={!!child.installation_date} />
                    <button onClick={() => onEdit(child)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600 text-sm">✏️</button>
                  </div>
                ))}
              </div>
            )}
            {isExpanded && children.length === 0 && (
              <div className="bg-white border-t p-4 text-center text-gray-400 text-sm">
                Nessun sub-equipment collegato
              </div>
            )}
          </div>
        );
      })
    )}
  </div>
);

// Summary View
const SummaryView = ({ stats, isItalian }) => (
  <div className="space-y-6">
    <div className="bg-gray-50 rounded-xl p-5 border">
      <h4 className="font-semibold text-gray-700 mb-4">📊 Riepilogo per Tipo</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white">
            <tr>
              <th className="text-left p-3 font-medium border">Tipo</th>
              <th className="text-center p-3 font-medium border bg-blue-50">Totale</th>
              <th className="text-center p-3 font-medium border bg-green-50">Installati</th>
              <th className="text-center p-3 font-medium border bg-amber-50">Da Installare</th>
              <th className="text-center p-3 font-medium border">Progresso</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.byType).length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-gray-400">Nessun dato</td></tr>
            ) : Object.entries(stats.byType).map(([type, data]) => {
              const progress = (data.installed / data.total * 100).toFixed(0);
              return (
                <tr key={type} className="border-t">
                  <td className="p-3 border"><TypeBadge type={type} isItalian={isItalian} /></td>
                  <td className="p-3 border text-center font-bold text-blue-700">{data.total}</td>
                  <td className="p-3 border text-center text-green-700">{data.installed}</td>
                  <td className="p-3 border text-center text-amber-700">{data.total - data.installed}</td>
                  <td className="p-3 border">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 w-10">{progress}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// Add/Edit Modal
const AddEditModal = ({ item, equipment, isItalian, onSave, onClose }) => {
  const [formData, setFormData] = useState(item || {
    tag: '',
    description: '',
    equipment_type: 'COMPRESSOR',
    weight_kg: '',
    dimensions: '',
    is_main_equipment: true,
    main_equipment_id: '',
    area: '',
    zone: '',
    elevation: '',
    planned_date: '',
    installation_date: ''
  });

  const mainEquipmentOptions = equipment.filter(e => e.is_main_equipment && (!item || e.id !== item.id));

  const handleSubmit = () => {
    if (!formData.tag) {
      alert('Il Tag è obbligatorio');
      return;
    }
    const data = {
      ...formData,
      weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
      main_equipment_id: formData.is_main_equipment ? null : (formData.main_equipment_id || null)
    };
    onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-800">
            {item ? `✏️ Modifica: ${item.tag}` : '🏭 Nuovo Equipment'}
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tag *</label>
              <input type="text" value={formData.tag} onChange={e => setFormData({...formData, tag: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="C-101" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select value={formData.equipment_type} onChange={e => setFormData({...formData, equipment_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                {Object.entries(EQUIPMENT_TYPE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.icon} {isItalian ? cfg.label : cfg.labelEn}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
            <input type="text" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="Main Process Compressor" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
              <input type="number" value={formData.weight_kg || ''} onChange={e => setFormData({...formData, weight_kg: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dimensioni</label>
              <input type="text" value={formData.dimensions || ''} onChange={e => setFormData({...formData, dimensions: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="4.5m x 2.5m x 3.0m" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
              <input type="text" value={formData.area || ''} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="PROCESS" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
              <input type="text" value={formData.zone || ''} onChange={e => setFormData({...formData, zone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="A" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Elevazione</label>
              <input type="text" value={formData.elevation || ''} onChange={e => setFormData({...formData, elevation: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="+0.0m" />
            </div>
          </div>

          <div className="border-t pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.is_main_equipment} onChange={e => setFormData({...formData, is_main_equipment: e.target.checked})} className="w-4 h-4" />
              <span className="text-sm font-medium text-gray-700">⭐ È Main Equipment</span>
            </label>
          </div>

          {!formData.is_main_equipment && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Main Equipment Parent</label>
              <select value={formData.main_equipment_id || ''} onChange={e => setFormData({...formData, main_equipment_id: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                <option value="">-- Seleziona Main Equipment --</option>
                {mainEquipmentOptions.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.tag} - {eq.description}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Pianificata</label>
              <input type="date" value={formData.planned_date || ''} onChange={e => setFormData({...formData, planned_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Installazione</label>
              <input type="date" value={formData.installation_date || ''} onChange={e => setFormData({...formData, installation_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">✔ Salva</button>
        </div>
      </div>
    </div>
  );
};

// Import Modal
const ImportModal = ({ importFile, onFileSelect, onAnalyze, onClose, importing }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-gray-800">📥 Importa Equipment da Excel</h2>
        <p className="text-sm text-gray-500 mt-1">Seleziona il file Excel con i dati equipment</p>
      </div>
      <div className="p-6">
        <div className={`flex items-center gap-4 p-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${importFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl">🏭</div>
          <div className="flex-1">
            <p className="font-medium text-gray-700">Equipment</p>
            <p className="text-xs text-gray-400">{importFile ? importFile.name : 'Clicca per selezionare'}</p>
          </div>
          <label className="cursor-pointer">
            {importFile ? <span className="text-green-600 text-xl">✔</span> : <span className="text-gray-300 text-xl">📎</span>}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files[0] && onFileSelect(e.target.files[0])} />
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
        <button onClick={onAnalyze} disabled={!importFile || importing} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {importing ? 'Analisi...' : 'Analizza File →'}
        </button>
      </div>
    </div>
  </div>
);

// Diff Modal
const DiffModal = ({ diffs, selectedDiffs, setSelectedDiffs, onApply, onClose, importing }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-gray-800">🔍 Differenze Rilevate ({diffs.length})</h2>
        <p className="text-sm text-gray-500 mt-1">Seleziona le modifiche da applicare</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {diffs.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Nessuna differenza. I dati sono già aggiornati.</p>
        ) : (
          <div className="space-y-3">
            {diffs.map((diff, idx) => (
              <label key={idx} className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${selectedDiffs[idx] ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="checkbox" checked={selectedDiffs[idx] || false} onChange={(e) => setSelectedDiffs({ ...selectedDiffs, [idx]: e.target.checked })} className="mt-1 w-5 h-5 text-blue-600 rounded" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${diff.type === 'new' ? 'bg-green-100 text-green-700' : diff.type === 'modified' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {diff.type === 'new' ? '➕ NUOVO' : diff.type === 'modified' ? '✏️ MODIFICATO' : '🗑️ RIMOSSO'}
                    </span>
                    <span className="font-mono text-sm text-blue-600 font-bold">{diff.key}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{diff.details}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between p-4 border-t bg-gray-50">
        <button onClick={() => { const all = {}; diffs.forEach((_, idx) => all[idx] = true); setSelectedDiffs(all); }} className="text-sm text-blue-600 hover:text-blue-800">✔ Seleziona Tutti</button>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={onApply} disabled={Object.values(selectedDiffs).filter(Boolean).length === 0 || importing} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {importing ? 'Applicazione...' : `✔ Applica (${Object.values(selectedDiffs).filter(Boolean).length})`}
          </button>
        </div>
      </div>
    </div>
  </div>
);
