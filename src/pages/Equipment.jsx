import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';

// ============================================================================
// EQUIPMENT PAGE
// Gestione Equipment con tipi dinamici, gerarchia Main Equipment, Import Excel
// ============================================================================

export default function Equipment() {
  const { t } = useTranslation();
  const { activeProject, loading: projectLoading } = useProject();
  
  // Data state
  const [equipment, setEquipment] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'hierarchy'
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importing, setImporting] = useState(false);

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
    try {
      await Promise.all([
        fetchEquipment(),
        fetchEquipmentTypes()
      ]);
    } catch (error) {
      console.error('Equipment: Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEquipment = async () => {
    const { data, error } = await supabase
      .from('project_equipment')
      .select(`
        *,
        equipment_type:equipment_types(id, type_code, type_name, type_name_it, icon),
        main_equipment:project_equipment!main_equipment_id(id, tag, description)
      `)
      .eq('project_id', activeProject.id)
      .is('deleted_at', null)
      .order('tag');
    
    if (error) {
      console.error('Error fetching equipment:', error);
    } else {
      setEquipment(data || []);
    }
  };

  const fetchEquipmentTypes = async () => {
    // Fetch both system defaults and project-specific types
    const { data, error } = await supabase
      .from('equipment_types')
      .select('*')
      .or(`project_id.is.null,project_id.eq.${activeProject.id}`)
      .eq('is_active', true)
      .order('sort_order');
    
    if (error) {
      console.error('Error fetching equipment types:', error);
    } else {
      setEquipmentTypes(data || []);
    }
  };

  // ============================================================================
  // STATS
  // ============================================================================

  const stats = useMemo(() => {
    const total = equipment.length;
    const installed = equipment.filter(e => e.installation_date).length;
    const mainEquipment = equipment.filter(e => e.is_main_equipment).length;
    const subEquipment = equipment.filter(e => !e.is_main_equipment).length;
    const totalWeight = equipment.reduce((sum, e) => sum + (e.weight_kg || 0), 0);
    
    return { total, installed, mainEquipment, subEquipment, totalWeight };
  }, [equipment]);

  // ============================================================================
  // FILTERS
  // ============================================================================

  const filteredEquipment = useMemo(() => {
    return equipment.filter(e => {
      // Type filter
      if (filterType !== 'all' && e.equipment_type?.type_code !== filterType) return false;
      
      // Status filter
      if (filterStatus === 'installed' && !e.installation_date) return false;
      if (filterStatus === 'pending' && e.installation_date) return false;
      if (filterStatus === 'main' && !e.is_main_equipment) return false;
      if (filterStatus === 'sub' && e.is_main_equipment) return false;
      
      // Search
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!e.tag?.toLowerCase().includes(search) &&
            !e.description?.toLowerCase().includes(search) &&
            !e.equipment_type?.type_name?.toLowerCase().includes(search)) {
          return false;
        }
      }
      
      return true;
    });
  }, [equipment, filterType, filterStatus, searchTerm]);

  // Hierarchical view: group by main equipment
  const hierarchicalEquipment = useMemo(() => {
    const mainItems = equipment.filter(e => e.is_main_equipment);
    const subItems = equipment.filter(e => !e.is_main_equipment);
    
    return mainItems.map(main => ({
      ...main,
      subEquipment: subItems.filter(sub => sub.main_equipment_id === main.id)
    }));
  }, [equipment]);

  // ============================================================================
  // CRUD HANDLERS
  // ============================================================================

  const handleAddEquipment = async (data) => {
    const { error } = await supabase.from('project_equipment').insert({
      project_id: activeProject.id,
      ...data
    });
    
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchEquipment();
      setShowAddModal(false);
    }
  };

  const handleUpdateEquipment = async (id, updates) => {
    const { error } = await supabase
      .from('project_equipment')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchEquipment();
      setEditingItem(null);
    }
  };

  const handleDeleteEquipment = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo equipment?')) return;
    
    const { error } = await supabase
      .from('project_equipment')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchEquipment();
    }
  };

  // ============================================================================
  // EQUIPMENT TYPES MANAGEMENT
  // ============================================================================

  const handleAddType = async (typeData) => {
    const { error } = await supabase.from('equipment_types').insert({
      project_id: activeProject.id,
      ...typeData,
      is_system_default: false
    });
    
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchEquipmentTypes();
    }
  };

  // ============================================================================
  // IMPORT EXCEL
  // ============================================================================

  const handleFileSelect = async (file) => {
    setImportFile(file);
    
    try {
      const data = await parseExcelFile(file);
      setImportPreview(data.slice(0, 10)); // Preview first 10 rows
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Errore lettura file: ' + error.message);
    }
  };

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

  const handleImport = async () => {
    if (!importFile) return;
    
    setImporting(true);
    try {
      const data = await parseExcelFile(importFile);
      
      let imported = 0;
      let errors = 0;
      
      for (const row of data) {
        const mapped = mapExcelToDb(row);
        
        // Find or skip type
        if (mapped.equipment_type_code) {
          const type = equipmentTypes.find(t => 
            t.type_code.toLowerCase() === mapped.equipment_type_code.toLowerCase()
          );
          if (type) {
            mapped.equipment_type_id = type.id;
          }
        }
        delete mapped.equipment_type_code;
        
        // Find main equipment if specified
        if (mapped.main_equipment_tag) {
          const mainEq = equipment.find(e => e.tag === mapped.main_equipment_tag);
          if (mainEq) {
            mapped.main_equipment_id = mainEq.id;
            mapped.is_main_equipment = false;
          }
        }
        delete mapped.main_equipment_tag;
        
        mapped.project_id = activeProject.id;
        mapped.imported_at = new Date().toISOString();
        
        const { error } = await supabase
          .from('project_equipment')
          .upsert(mapped, { onConflict: 'project_id,tag' });
        
        if (error) {
          console.error('Import error for row:', row, error);
          errors++;
        } else {
          imported++;
        }
      }
      
      await fetchEquipment();
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview([]);
      
      alert(`Import completato!\n✅ Importati: ${imported}\n❌ Errori: ${errors}`);
    } catch (error) {
      console.error('Import error:', error);
      alert('Errore import: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const mapExcelToDb = (row) => {
    return {
      equipment_id: row.Equipment_ID?.toString(),
      tag: row.Tag || row.Equipment_Tag,
      description: row.Description,
      equipment_type_code: row.Type || row.Equipment_Type,
      weight_kg: parseFloat(row.Weight_kg) || null,
      dimensions: row.Dimensions,
      is_main_equipment: row.Is_Main === 'Yes' || row.Is_Main === true || row.Is_Main === 1,
      main_equipment_tag: row.Main_Equipment_Tag || row.Parent_Tag,
      area: row.Area,
      zone: row.Zone,
      elevation: row.Elevation,
      planned_installation_date: parseExcelDate(row.Planned_Date),
      installation_date: parseExcelDate(row.Installation_Date),
      week_plan: row.Week_Plan
    };
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

  // ============================================================================
  // EXPORT TEMPLATE
  // ============================================================================

  const exportTemplate = () => {
    const template = [{
      Equipment_ID: 1,
      Tag: 'C-101',
      Description: 'Main Process Compressor',
      Type: 'COMPRESSOR',
      Weight_kg: 5000,
      Dimensions: '3.0m x 2.0m x 2.5m',
      Is_Main: 'Yes',
      Main_Equipment_Tag: '',
      Area: 'PROCESS',
      Zone: 'A',
      Elevation: '+5.0m',
      Planned_Date: '2025-03-15',
      Installation_Date: '',
      Week_Plan: 'W12-2025'
    }];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipment');
    XLSX.writeFile(wb, 'Equipment_Template.xlsx');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              🏭 Equipment
            </h1>
            <p className="text-gray-500 mt-1">{activeProject?.name} • Gestione apparecchiature</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium"
            >
              ➕ Nuovo Equipment
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
            >
              📥 Importa Excel
            </button>
            <button
              onClick={exportTemplate}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 text-sm font-medium"
            >
              📤 Esporta Template
            </button>
            <button
              onClick={() => setShowTypeModal(true)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium"
            >
              ⚙️ Gestisci Tipi
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <StatCard icon="🏭" bg="bg-blue-50" border="border-blue-200" 
            value={stats.total} label="Totale" />
          <StatCard icon="✅" bg="bg-green-50" border="border-green-200" 
            value={stats.installed} label="Installati" 
            sub={stats.total > 0 ? `${Math.round(stats.installed/stats.total*100)}%` : '0%'} />
          <StatCard icon="⭐" bg="bg-purple-50" border="border-purple-200" 
            value={stats.mainEquipment} label="Main Equipment" />
          <StatCard icon="🔗" bg="bg-amber-50" border="border-amber-200" 
            value={stats.subEquipment} label="Sub-Equipment" />
          <StatCard icon="⚖️" bg="bg-gray-50" border="border-gray-200" 
            value={`${(stats.totalWeight/1000).toFixed(1)}t`} label="Peso Totale" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca per tag, descrizione..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">Tutti i tipi</option>
            {equipmentTypes.map(type => (
              <option key={type.id} value={type.type_code}>
                {type.icon} {type.type_name}
              </option>
            ))}
          </select>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">Tutti gli stati</option>
            <option value="installed">✅ Installati</option>
            <option value="pending">⏳ Da installare</option>
            <option value="main">⭐ Solo Main</option>
            <option value="sub">🔗 Solo Sub</option>
          </select>
          
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              📋 Lista
            </button>
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`px-3 py-2 text-sm ${viewMode === 'hierarchy' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              🌳 Gerarchia
            </button>
          </div>
        </div>
      </div>

      {/* Equipment List/Hierarchy */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {viewMode === 'list' ? (
          <EquipmentTable
            equipment={filteredEquipment}
            onEdit={setEditingItem}
            onDelete={handleDeleteEquipment}
          />
        ) : (
          <EquipmentHierarchy
            equipment={hierarchicalEquipment}
            onEdit={setEditingItem}
            onDelete={handleDeleteEquipment}
          />
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddEquipmentModal
          equipmentTypes={equipmentTypes}
          mainEquipmentList={equipment.filter(e => e.is_main_equipment)}
          onSave={handleAddEquipment}
          onClose={() => setShowAddModal(false)}
        />
      )}
      
      {editingItem && (
        <EditEquipmentModal
          item={editingItem}
          equipmentTypes={equipmentTypes}
          mainEquipmentList={equipment.filter(e => e.is_main_equipment && e.id !== editingItem.id)}
          onSave={(updates) => handleUpdateEquipment(editingItem.id, updates)}
          onClose={() => setEditingItem(null)}
        />
      )}
      
      {showImportModal && (
        <ImportModal
          importFile={importFile}
          importPreview={importPreview}
          onFileSelect={handleFileSelect}
          onImport={handleImport}
          onClose={() => { setShowImportModal(false); setImportFile(null); setImportPreview([]); }}
          importing={importing}
        />
      )}
      
      {showTypeModal && (
        <TypesModal
          types={equipmentTypes}
          projectId={activeProject.id}
          onAddType={handleAddType}
          onClose={() => setShowTypeModal(false)}
          onRefresh={fetchEquipmentTypes}
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

// Equipment Table (List View)
const EquipmentTable = ({ equipment, onEdit, onDelete }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-gray-100">
        <tr>
          <th className="text-left p-3 font-medium">Tag</th>
          <th className="text-left p-3 font-medium">Tipo</th>
          <th className="text-left p-3 font-medium">Descrizione</th>
          <th className="text-center p-3 font-medium">Main/Sub</th>
          <th className="text-center p-3 font-medium">Peso</th>
          <th className="text-center p-3 font-medium">Installato</th>
          <th className="text-center p-3 font-medium">Azioni</th>
        </tr>
      </thead>
      <tbody>
        {equipment.length === 0 ? (
          <tr>
            <td colSpan={7} className="p-8 text-center text-gray-400">
              Nessun equipment trovato
            </td>
          </tr>
        ) : equipment.map(eq => (
          <tr key={eq.id} className="border-t hover:bg-gray-50">
            <td className="p-3">
              <div className="font-mono font-bold text-blue-600">{eq.tag}</div>
              {eq.main_equipment && (
                <div className="text-xs text-gray-400">
                  └ {eq.main_equipment.tag}
                </div>
              )}
            </td>
            <td className="p-3">
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                {eq.equipment_type?.icon || '🔧'} {eq.equipment_type?.type_name || eq.equipment_type_code || '-'}
              </span>
            </td>
            <td className="p-3 max-w-[200px] truncate text-gray-600" title={eq.description}>
              {eq.description || '-'}
            </td>
            <td className="p-3 text-center">
              {eq.is_main_equipment ? (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">⭐ Main</span>
              ) : (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">🔗 Sub</span>
              )}
            </td>
            <td className="p-3 text-center text-gray-600">
              {eq.weight_kg ? `${eq.weight_kg.toLocaleString()} kg` : '-'}
            </td>
            <td className="p-3 text-center">
              {eq.installation_date ? (
                <span className="text-green-600 font-medium">✅ {eq.installation_date}</span>
              ) : (
                <span className="text-gray-400">⏳ Pending</span>
              )}
            </td>
            <td className="p-3 text-center">
              <button onClick={() => onEdit(eq)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600">✏️</button>
              <button onClick={() => onDelete(eq.id)} className="p-1.5 hover:bg-red-100 rounded text-red-600 ml-1">🗑️</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Equipment Hierarchy View
const EquipmentHierarchy = ({ equipment, onEdit, onDelete }) => (
  <div className="p-4 space-y-4">
    {equipment.length === 0 ? (
      <p className="text-center text-gray-400 py-8">Nessun equipment trovato</p>
    ) : equipment.map(main => (
      <div key={main.id} className="border rounded-lg overflow-hidden">
        {/* Main Equipment */}
        <div className="flex items-center justify-between p-4 bg-purple-50 border-b">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{main.equipment_type?.icon || '🏭'}</span>
            <div>
              <div className="font-bold text-purple-900">{main.tag}</div>
              <div className="text-sm text-purple-700">{main.description}</div>
            </div>
            <span className="px-2 py-1 bg-purple-200 text-purple-800 rounded text-xs font-medium">
              {main.equipment_type?.type_name || 'Equipment'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {main.installation_date ? (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">✅ Installato</span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">⏳ Pending</span>
            )}
            <button onClick={() => onEdit(main)} className="p-1.5 hover:bg-purple-200 rounded text-purple-600">✏️</button>
            <button onClick={() => onDelete(main.id)} className="p-1.5 hover:bg-red-100 rounded text-red-600">🗑️</button>
          </div>
        </div>
        
        {/* Sub Equipment */}
        {main.subEquipment && main.subEquipment.length > 0 && (
          <div className="bg-white">
            {main.subEquipment.map(sub => (
              <div key={sub.id} className="flex items-center justify-between p-3 pl-12 border-b last:border-b-0 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">└</span>
                  <span className="text-lg">{sub.equipment_type?.icon || '🔧'}</span>
                  <div>
                    <div className="font-medium text-gray-800">{sub.tag}</div>
                    <div className="text-xs text-gray-500">{sub.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sub.installation_date ? (
                    <span className="text-green-600 text-xs">✅</span>
                  ) : (
                    <span className="text-gray-400 text-xs">⏳</span>
                  )}
                  <button onClick={() => onEdit(sub)} className="p-1 hover:bg-blue-100 rounded text-blue-600 text-sm">✏️</button>
                  <button onClick={() => onDelete(sub.id)} className="p-1 hover:bg-red-100 rounded text-red-600 text-sm">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {(!main.subEquipment || main.subEquipment.length === 0) && (
          <div className="p-3 pl-12 text-gray-400 text-sm italic">
            Nessun sub-equipment
          </div>
        )}
      </div>
    ))}
  </div>
);

// Add Equipment Modal
const AddEquipmentModal = ({ equipmentTypes, mainEquipmentList, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    tag: '',
    description: '',
    equipment_type_id: '',
    weight_kg: '',
    dimensions: '',
    is_main_equipment: true,
    main_equipment_id: '',
    area: '',
    zone: '',
    elevation: '',
    planned_installation_date: ''
  });

  const handleSubmit = () => {
    if (!formData.tag) {
      alert('Il Tag è obbligatorio');
      return;
    }
    
    const data = {
      ...formData,
      weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
      equipment_type_id: formData.equipment_type_id || null,
      main_equipment_id: formData.is_main_equipment ? null : (formData.main_equipment_id || null),
      planned_installation_date: formData.planned_installation_date || null
    };
    
    onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-800">🏭 Nuovo Equipment</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tag *</label>
            <input
              type="text"
              value={formData.tag}
              onChange={e => setFormData({...formData, tag: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="es. C-101"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
            <input
              type="text"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="es. Main Process Compressor"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={formData.equipment_type_id}
              onChange={e => setFormData({...formData, equipment_type_id: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">-- Seleziona tipo --</option>
              {equipmentTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.icon} {type.type_name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
              <input
                type="number"
                step="0.01"
                value={formData.weight_kg}
                onChange={e => setFormData({...formData, weight_kg: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dimensioni</label>
              <input
                type="text"
                value={formData.dimensions}
                onChange={e => setFormData({...formData, dimensions: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="es. 2.0m x 1.5m x 3.0m"
              />
            </div>
          </div>
          
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_main_equipment}
                onChange={e => setFormData({...formData, is_main_equipment: e.target.checked, main_equipment_id: ''})}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">È un Main Equipment</span>
            </label>
          </div>
          
          {!formData.is_main_equipment && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Main Equipment (Parent)</label>
              <select
                value={formData.main_equipment_id}
                onChange={e => setFormData({...formData, main_equipment_id: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">-- Seleziona Main Equipment --</option>
                {mainEquipmentList.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    {eq.tag} - {eq.description}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
              <input
                type="text"
                value={formData.area}
                onChange={e => setFormData({...formData, area: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
              <input
                type="text"
                value={formData.zone}
                onChange={e => setFormData({...formData, zone: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Elevazione</label>
              <input
                type="text"
                value={formData.elevation}
                onChange={e => setFormData({...formData, elevation: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="es. +5.0m"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Installazione Pianificata</label>
            <input
              type="date"
              value={formData.planned_installation_date}
              onChange={e => setFormData({...formData, planned_installation_date: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">✓ Salva</button>
        </div>
      </div>
    </div>
  );
};

// Edit Equipment Modal
const EditEquipmentModal = ({ item, equipmentTypes, mainEquipmentList, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    tag: item.tag || '',
    description: item.description || '',
    equipment_type_id: item.equipment_type_id || '',
    weight_kg: item.weight_kg || '',
    dimensions: item.dimensions || '',
    is_main_equipment: item.is_main_equipment,
    main_equipment_id: item.main_equipment_id || '',
    area: item.area || '',
    zone: item.zone || '',
    elevation: item.elevation || '',
    planned_installation_date: item.planned_installation_date || '',
    installation_date: item.installation_date || '',
    installation_notes: item.installation_notes || ''
  });

  const handleSave = () => {
    const updates = {
      ...formData,
      weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
      equipment_type_id: formData.equipment_type_id || null,
      main_equipment_id: formData.is_main_equipment ? null : (formData.main_equipment_id || null),
      planned_installation_date: formData.planned_installation_date || null,
      installation_date: formData.installation_date || null
    };
    onSave(updates);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-800">✏️ Modifica: {item.tag}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
            <input
              type="text"
              value={formData.tag}
              onChange={e => setFormData({...formData, tag: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
            <input
              type="text"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={formData.equipment_type_id}
              onChange={e => setFormData({...formData, equipment_type_id: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">-- Seleziona --</option>
              {equipmentTypes.map(type => (
                <option key={type.id} value={type.id}>{type.icon} {type.type_name}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
              <input
                type="number"
                value={formData.weight_kg}
                onChange={e => setFormData({...formData, weight_kg: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dimensioni</label>
              <input
                type="text"
                value={formData.dimensions}
                onChange={e => setFormData({...formData, dimensions: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
          
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_main_equipment}
                onChange={e => setFormData({...formData, is_main_equipment: e.target.checked, main_equipment_id: ''})}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">È un Main Equipment</span>
            </label>
          </div>
          
          {!formData.is_main_equipment && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Main Equipment (Parent)</label>
              <select
                value={formData.main_equipment_id}
                onChange={e => setFormData({...formData, main_equipment_id: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">-- Nessuno --</option>
                {mainEquipmentList.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.tag} - {eq.description}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="border-t pt-4 mt-4">
            <h3 className="font-medium text-gray-800 mb-3">📅 Installazione</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Pianificata</label>
                <input
                  type="date"
                  value={formData.planned_installation_date}
                  onChange={e => setFormData({...formData, planned_installation_date: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Effettiva</label>
                <input
                  type="date"
                  value={formData.installation_date}
                  onChange={e => setFormData({...formData, installation_date: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Note Installazione</label>
              <textarea
                value={formData.installation_notes}
                onChange={e => setFormData({...formData, installation_notes: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                rows={2}
                placeholder="es. Installato con gru da 50t..."
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">✓ Salva</button>
        </div>
      </div>
    </div>
  );
};

// Import Modal
const ImportModal = ({ importFile, importPreview, onFileSelect, onImport, onClose, importing }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-gray-800">📥 Importa Equipment da Excel</h2>
      </div>
      <div className="p-6 space-y-4">
        <div className={`flex items-center gap-4 p-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${importFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400'}`}>
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">📄</div>
          <div className="flex-1">
            <p className="font-medium text-gray-700">File Excel</p>
            <p className="text-xs text-gray-400">{importFile ? importFile.name : 'Clicca per selezionare'}</p>
          </div>
          <label className="cursor-pointer">
            {importFile ? <span className="text-green-600 text-xl">✓</span> : <span className="text-gray-300 text-xl">📎</span>}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files[0] && onFileSelect(e.target.files[0])} />
          </label>
        </div>
        
        {importPreview.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-100 p-2 text-sm font-medium text-gray-600">
              Preview (primi 10 record)
            </div>
            <div className="overflow-x-auto max-h-[200px]">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(importPreview[0]).slice(0, 5).map(key => (
                      <th key={key} className="p-2 text-left">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      {Object.values(row).slice(0, 5).map((val, i) => (
                        <td key={i} className="p-2">{String(val || '-')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <p className="font-medium text-blue-800 mb-1">📋 Colonne supportate:</p>
          <p className="text-blue-700 text-xs">
            Equipment_ID, Tag, Description, Type, Weight_kg, Dimensions, Is_Main, Main_Equipment_Tag, Area, Zone, Elevation, Planned_Date, Installation_Date, Week_Plan
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
        <button onClick={onImport} disabled={!importFile || importing} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {importing ? 'Importazione...' : '📥 Importa'}
        </button>
      </div>
    </div>
  </div>
);

// Types Management Modal
const TypesModal = ({ types, projectId, onAddType, onClose, onRefresh }) => {
  const [newType, setNewType] = useState({ type_code: '', type_name: '', icon: '🔧' });
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newType.type_code || !newType.type_name) {
      alert('Codice e Nome sono obbligatori');
      return;
    }
    setAdding(true);
    await onAddType(newType);
    setNewType({ type_code: '', type_name: '', icon: '🔧' });
    setAdding(false);
    onRefresh();
  };

  const systemTypes = types.filter(t => t.project_id === null);
  const customTypes = types.filter(t => t.project_id !== null);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">⚙️ Gestione Tipi Equipment</h2>
        </div>
        <div className="p-6 space-y-4">
          {/* Add new type */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium text-gray-700 mb-3">➕ Aggiungi Nuovo Tipo</h3>
            <div className="grid grid-cols-4 gap-2">
              <input
                type="text"
                value={newType.icon}
                onChange={e => setNewType({...newType, icon: e.target.value})}
                className="px-2 py-2 border rounded text-center text-xl"
                placeholder="🔧"
                maxLength={2}
              />
              <input
                type="text"
                value={newType.type_code}
                onChange={e => setNewType({...newType, type_code: e.target.value.toUpperCase().replace(/\s/g, '_')})}
                className="col-span-1 px-3 py-2 border rounded text-sm"
                placeholder="CODICE"
              />
              <input
                type="text"
                value={newType.type_name}
                onChange={e => setNewType({...newType, type_name: e.target.value})}
                className="col-span-2 px-3 py-2 border rounded text-sm"
                placeholder="Nome tipo"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="mt-2 w-full px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 text-sm"
            >
              {adding ? 'Aggiunta...' : '➕ Aggiungi'}
            </button>
          </div>
          
          {/* Custom types */}
          {customTypes.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-700 mb-2">📁 Tipi Personalizzati</h3>
              <div className="space-y-1">
                {customTypes.map(type => (
                  <div key={type.id} className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-200">
                    <span>{type.icon} {type.type_name}</span>
                    <span className="text-xs text-gray-400 font-mono">{type.type_code}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* System types */}
          <div>
            <h3 className="font-medium text-gray-700 mb-2">🔒 Tipi di Sistema (non modificabili)</h3>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {systemTypes.map(type => (
                <div key={type.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                  <span>{type.icon} {type.type_name}</span>
                  <span className="text-xs text-gray-400 font-mono">{type.type_code}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Chiudi</button>
        </div>
      </div>
    </div>
  );
};
