import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';

// ============================================================================
// MTO PIPING - Material Take Off Piping
// V3 - Bug Fix: Autocomplete Welds separato, Edit Modal completo, colonne Excel
// ============================================================================

export default function MTOPiping() {
  const { t } = useTranslation();
  const { activeProject, loading: projectLoading } = useProject();
  
  // Data state
  const [isometrics, setIsometrics] = useState([]);
  const [spools, setSpools] = useState([]);
  const [supports, setSupports] = useState([]);
  const [flanges, setFlanges] = useState([]);
  const [welds, setWelds] = useState([]);
  const [supportSummary, setSupportSummary] = useState([]);
  const [flangeMaterialsSummary, setFlangeMaterialsSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // WP Coverage state
  const [wpCoverage, setWpCoverage] = useState({ spools: 0, welds: 0, supports: 0, flanges: 0 });
  
  // UI state
  const [activeTab, setActiveTab] = useState('spools');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIso, setFilterIso] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);
  
  // Modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingType, setAddingType] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editingType, setEditingType] = useState(null);
  
  // Import state
  const [importFiles, setImportFiles] = useState({});
  const [importDiffs, setImportDiffs] = useState([]);
  const [selectedDiffs, setSelectedDiffs] = useState({});
  const [importing, setImporting] = useState(false);

  // ============================================================================
  // UTILITY: FORMAT DATE
  // ============================================================================
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date)) return '—';
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}/${month}/${year}`;
    } catch {
      return '—';
    }
  };

  // ============================================================================
  // CLICK OUTSIDE HANDLER FOR EXPORT MENU
  // ============================================================================
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        fetchIsometrics(),
        fetchSpools(),
        fetchSupports(),
        fetchFlanges(),
        fetchWelds(),
        fetchSupportSummary(),
        fetchFlangeMaterialsSummary()
      ]);
      // Fetch WP coverage after main data (non-blocking)
      fetchWPCoverage();
    } catch (error) {
      console.error('MTO: Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWPCoverage = async () => {
    try {
      // Get WP IDs for this project
      const { data: wps } = await supabase
        .from('work_packages')
        .select('id')
        .eq('project_id', activeProject.id);
      
      if (!wps || wps.length === 0) {
        setWpCoverage({ spools: 0, welds: 0, supports: 0, flanges: 0 });
        return;
      }
      
      const wpIds = wps.map(w => w.id);
      
      // Count covered items (handle missing tables gracefully)
      let spoolCount = 0, weldCount = 0, supportCount = 0, flangeCount = 0;
      
      try {
        const { count } = await supabase.from('wp_spools').select('spool_id', { count: 'exact', head: true }).in('work_package_id', wpIds);
        spoolCount = count || 0;
      } catch (e) { /* table may not exist */ }
      
      try {
        const { count } = await supabase.from('wp_welds').select('weld_id', { count: 'exact', head: true }).in('work_package_id', wpIds);
        weldCount = count || 0;
      } catch (e) { /* table may not exist */ }
      
      try {
        const { count } = await supabase.from('wp_supports').select('support_id', { count: 'exact', head: true }).in('work_package_id', wpIds);
        supportCount = count || 0;
      } catch (e) { /* table may not exist */ }
      
      try {
        const { count } = await supabase.from('wp_flanges').select('flange_id', { count: 'exact', head: true }).in('work_package_id', wpIds);
        flangeCount = count || 0;
      } catch (e) { /* table may not exist */ }
      
      setWpCoverage({ spools: spoolCount, welds: weldCount, supports: supportCount, flanges: flangeCount });
    } catch (error) {
      console.error('WP Coverage fetch error:', error);
      setWpCoverage({ spools: 0, welds: 0, supports: 0, flanges: 0 });
    }
  };

  const fetchIsometrics = async () => {
    const { data } = await supabase
      .from('mto_isometrics')
      .select('*')
      .eq('project_id', activeProject.id)
      .eq('status', 'active')
      .order('iso_number');
    setIsometrics(data || []);
  };

  const fetchSpools = async () => {
    const { data } = await supabase
      .from('mto_spools')
      .select('*')
      .eq('project_id', activeProject.id)
      .is('deleted_at', null)
      .order('full_spool_no');
    setSpools(data || []);
  };

  const fetchSupports = async () => {
    const { data } = await supabase
      .from('mto_supports')
      .select('*')
      .eq('project_id', activeProject.id)
      .is('deleted_at', null)
      .order('support_tag_no');
    setSupports(data || []);
  };

  const fetchFlanges = async () => {
    const { data } = await supabase
      .from('mto_flanged_joints')
      .select('*')
      .eq('project_id', activeProject.id)
      .is('deleted_at', null)
      .order('flange_tag');
    setFlanges(data || []);
  };

  const fetchWelds = async () => {
    const { data } = await supabase
      .from('mto_welds')
      .select('*')
      .eq('project_id', activeProject.id)
      .is('deleted_at', null)
      .order('full_weld_no');
    setWelds(data || []);
  };

  const fetchSupportSummary = async () => {
    const { data } = await supabase
      .from('v_mto_support_summary')
      .select('*')
      .eq('project_id', activeProject.id);
    setSupportSummary(data || []);
  };

  const fetchFlangeMaterialsSummary = async () => {
    const { data } = await supabase
      .from('v_mto_flange_materials_summary')
      .select('*')
      .eq('project_id', activeProject.id);
    setFlangeMaterialsSummary(data || []);
  };

  // ============================================================================
  // STATS
  // ============================================================================

  const stats = useMemo(() => ({
    isometrics: isometrics.length,
    spools: spools.length,
    supports: supports.length,
    flanges: flanges.length,
    welds: welds.length,
    spoolsErected: spools.filter(s => s.site_status === 'erected').length,
    spoolsOngoing: spools.filter(s => s.site_status === 'erected_ongoing').length,
    weldsCompleted: welds.filter(w => w.weld_date).length,
    supportsAssembled: supports.filter(s => s.assembly_date).length,
    flangesAssembled: flanges.filter(f => f.assembly_date).length
  }), [isometrics, spools, supports, flanges, welds]);

  // ============================================================================
  // FILTERS
  // ============================================================================

  const filteredSpools = useMemo(() => {
    return spools.filter(s => {
      if (filterIso !== 'all' && s.iso_number !== filterIso) return false;
      if (filterStatus !== 'all' && s.site_status !== filterStatus) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!s.full_spool_no?.toLowerCase().includes(search) &&
            !s.spool_no?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [spools, filterIso, filterStatus, searchTerm]);

  const filteredSupports = useMemo(() => {
    return supports.filter(s => {
      if (filterIso !== 'all' && s.iso_number !== filterIso) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!s.support_tag_no?.toLowerCase().includes(search) &&
            !s.support_mark?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [supports, filterIso, searchTerm]);

  const filteredFlanges = useMemo(() => {
    return flanges.filter(f => {
      if (filterIso !== 'all' && f.iso_number !== filterIso) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!f.flange_tag?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [flanges, filterIso, searchTerm]);

  const filteredWelds = useMemo(() => {
    return welds.filter(w => {
      if (filterIso !== 'all' && w.iso_number !== filterIso) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!w.full_weld_no?.toLowerCase().includes(search) &&
            !w.weld_no?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [welds, filterIso, searchTerm]);

  // ============================================================================
  // ADD HANDLERS (Inserimento Manuale)
  // ============================================================================

  const handleAddSpool = async (data) => {
    const { error } = await supabase.from('mto_spools').insert({
      project_id: activeProject.id,
      ...data
    });
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchSpools();
      fetchIsometrics();
      setShowAddModal(false);
    }
  };

  const handleAddSupport = async (data) => {
    const { error } = await supabase.from('mto_supports').insert({
      project_id: activeProject.id,
      ...data
    });
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchSupports();
      fetchSupportSummary();
      setShowAddModal(false);
    }
  };

  const handleAddFlange = async (data) => {
    const { error } = await supabase.from('mto_flanged_joints').insert({
      project_id: activeProject.id,
      ...data
    });
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchFlanges();
      fetchFlangeMaterialsSummary();
      setShowAddModal(false);
    }
  };

  const handleAddWeld = async (data) => {
    const { error } = await supabase.from('mto_welds').insert({
      project_id: activeProject.id,
      ...data
    });
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchWelds();
      setShowAddModal(false);
    }
  };

  // ============================================================================
  // UPDATE HANDLERS
  // ============================================================================

  const handleUpdateSpool = async (id, updates) => {
    const { error } = await supabase
      .from('mto_spools')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchSpools();
      setEditingItem(null);
    }
  };

  const handleUpdateSupport = async (id, updates) => {
    const { error } = await supabase
      .from('mto_supports')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchSupports();
      fetchSupportSummary();
      setEditingItem(null);
    }
  };

  const handleUpdateFlange = async (id, updates) => {
    const { error } = await supabase
      .from('mto_flanged_joints')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchFlanges();
      fetchFlangeMaterialsSummary();
      setEditingItem(null);
    }
  };

  const handleUpdateWeld = async (id, updates) => {
    const { error } = await supabase
      .from('mto_welds')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchWelds();
      setEditingItem(null);
    }
  };

  // ============================================================================
  // DELETE HANDLERS
  // ============================================================================

  const handleDelete = async (type, id) => {
    if (!confirm('Sei sicuro di voler eliminare questo elemento?')) return;
    
    const tables = {
      spool: 'mto_spools',
      support: 'mto_supports',
      flange: 'mto_flanged_joints',
      weld: 'mto_welds'
    };
    
    const { error } = await supabase
      .from(tables[type])
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchAllData();
    }
  };

  const handleUpdateInventory = async (type, mark, qty) => {
    if (type === 'support') {
      const { error } = await supabase
        .from('mto_support_inventory')
        .upsert({
          project_id: activeProject.id,
          support_mark: mark,
          qty_warehouse: parseInt(qty) || 0,
          updated_at: new Date().toISOString()
        }, { onConflict: 'project_id,support_mark' });
      if (!error) fetchSupportSummary();
    } else {
      const { error } = await supabase
        .from('mto_flange_materials_inventory')
        .upsert({
          project_id: activeProject.id,
          material_code: mark.code,
          material_type: mark.type,
          qty_warehouse: parseInt(qty) || 0,
          updated_at: new Date().toISOString()
        }, { onConflict: 'project_id,material_code,material_type' });
      if (!error) fetchFlangeMaterialsSummary();
    }
  };

  // ============================================================================
  // IMPORT EXCEL
  // ============================================================================

  const handleFileSelect = (type, file) => {
    setImportFiles(prev => ({ ...prev, [type]: file }));
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

  const analyzeImport = async () => {
    setImporting(true);
    const diffs = [];
    
    try {
      if (importFiles.spools) {
        const newData = await parseExcelFile(importFiles.spools);
        const spoolDiffs = compareData('spools', spools, newData, 'full_spool_no', 'Full_Spool_No');
        diffs.push(...spoolDiffs);
      }
      if (importFiles.supports) {
        const newData = await parseExcelFile(importFiles.supports);
        const supportDiffs = compareData('supports', supports, newData, 'support_tag_no', 'Support_Tag_No');
        diffs.push(...supportDiffs);
      }
      if (importFiles.flanges) {
        const newData = await parseExcelFile(importFiles.flanges);
        const flangeDiffs = compareData('flanges', flanges, newData, 'flange_tag', 'Flange_Tag');
        diffs.push(...flangeDiffs);
      }
      if (importFiles.welds) {
        const newData = await parseExcelFile(importFiles.welds);
        const weldDiffs = compareData('welds', welds, newData, 'full_weld_no', 'Full_Weld_No');
        diffs.push(...weldDiffs);
      }
      
      setImportDiffs(diffs);
      setSelectedDiffs({});
      setShowImportModal(false);
      setShowDiffModal(true);
    } catch (error) {
      console.error('Import analysis error:', error);
      alert('Errore analisi file: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const compareData = (entityType, existingData, newData, existingKey, newKey) => {
    const diffs = [];
    const existingMap = new Map(existingData.map(item => [item[existingKey], item]));
    const newMap = new Map(newData.map(item => [item[newKey], item]));
    
    newData.forEach(newItem => {
      const key = newItem[newKey];
      const existing = existingMap.get(key);
      
      if (!existing) {
        diffs.push({
          type: 'new',
          entity: entityType,
          key: key,
          data: newItem,
          details: `Nuovo ${entityType}: ${key}`
        });
      } else {
        const changes = findChanges(entityType, existing, newItem);
        if (changes.length > 0) {
          diffs.push({
            type: 'modified',
            entity: entityType,
            key: key,
            existingData: existing,
            newData: newItem,
            changes: changes,
            details: changes.map(c => `${c.field}: ${c.old} → ${c.new}`).join(', ')
          });
        }
      }
    });
    
    existingData.forEach(existing => {
      const key = existing[existingKey];
      if (!newMap.has(key)) {
        diffs.push({
          type: 'deleted',
          entity: entityType,
          key: key,
          data: existing,
          details: `Rimosso: ${key}`
        });
      }
    });
    
    return diffs;
  };

  const findChanges = (entityType, existing, newItem) => {
    const changes = [];
    const fieldsToCompare = getCompareFields(entityType);
    
    fieldsToCompare.forEach(({ dbField, excelField }) => {
      const oldVal = existing[dbField];
      const newVal = newItem[excelField];
      const oldNorm = normalizeValue(oldVal);
      const newNorm = normalizeValue(newVal);
      
      if (oldNorm !== newNorm) {
        changes.push({ field: dbField, old: oldVal ?? '(vuoto)', new: newVal ?? '(vuoto)' });
      }
    });
    
    return changes;
  };

  const getCompareFields = (entityType) => {
    switch (entityType) {
      case 'spools':
        return [
          { dbField: 'weight_kg', excelField: 'Spool_Weight' },
          { dbField: 'length_m', excelField: 'Spool_Length' },
          { dbField: 'diameter_inch', excelField: 'Spool_diameter' },
          { dbField: 'thickness_mm', excelField: 'Thickness' },
          { dbField: 'material_code', excelField: 'Material_Code' }
        ];
      case 'supports':
        return [
          { dbField: 'weight_kg', excelField: 'Weight' },
          { dbField: 'support_mark', excelField: 'Support_Mark' }
        ];
      case 'flanges':
        return [
          { dbField: 'gasket_code', excelField: 'Gasket_Code' },
          { dbField: 'bolt_code', excelField: 'Bolt_Code' },
          { dbField: 'bolt_qty', excelField: 'Bolt_Qty' },
          { dbField: 'ident_code_1', excelField: 'Ident_Code_1' },
          { dbField: 'ident_qty_1', excelField: 'Ident_Qty_1' },
          { dbField: 'ident_code_2', excelField: 'Ident_Code_2' },
          { dbField: 'ident_qty_2', excelField: 'Ident_Qty_2' }
        ];
      case 'welds':
        return [
          { dbField: 'diameter_inch', excelField: 'Dia_Inch' },
          { dbField: 'thickness_mm', excelField: 'Thickness' },
          { dbField: 'is_dissimilar', excelField: 'Dissimilar Joint' }
        ];
      default:
        return [];
    }
  };

  const normalizeValue = (val) => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'number') return val.toString();
    return String(val).trim();
  };

  const applySelectedDiffs = async () => {
    setImporting(true);
    const selectedList = importDiffs.filter((_, idx) => selectedDiffs[idx]);
    
    try {
      for (const diff of selectedList) {
        if (diff.type === 'new') {
          await insertNewRecord(diff.entity, diff.data);
        } else if (diff.type === 'modified') {
          await updateRecord(diff.entity, diff.existingData.id, diff.newData);
        } else if (diff.type === 'deleted') {
          await softDeleteRecord(diff.entity, diff.data.id);
        }
      }
      
      await fetchAllData();
      setShowDiffModal(false);
      setImportDiffs([]);
      setImportFiles({});
      alert(`Import completato! ${selectedList.length} modifiche applicate.`);
    } catch (error) {
      console.error('Apply diffs error:', error);
      alert('Errore: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const insertNewRecord = async (entity, data) => {
    const table = getTableName(entity);
    const mapped = mapExcelToDb(entity, data);
    mapped.project_id = activeProject.id;
    mapped.imported_at = new Date().toISOString();
    const { error } = await supabase.from(table).insert(mapped);
    if (error) throw error;
  };

  const updateRecord = async (entity, id, data) => {
    const table = getTableName(entity);
    const mapped = mapExcelToDb(entity, data);
    mapped.updated_at = new Date().toISOString();
    const { error } = await supabase.from(table).update(mapped).eq('id', id);
    if (error) throw error;
  };

  const softDeleteRecord = async (entity, id) => {
    const table = getTableName(entity);
    const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  };

  const getTableName = (entity) => {
    const tables = { spools: 'mto_spools', supports: 'mto_supports', flanges: 'mto_flanged_joints', welds: 'mto_welds' };
    return tables[entity];
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

  const mapExcelToDb = (entity, data) => {
    switch (entity) {
      case 'spools':
        return {
          spool_id: data.Spool_ID?.toString(),
          full_spool_no: data.Full_Spool_No,
          iso_number: data.ISO_Number,
          spool_no: data.Spool_No,
          service_class: data.Service_class,
          service_category: data.Service_Cat,
          diameter_inch: parseFloat(data.Spool_diameter) || null,
          thickness_mm: parseFloat(data.Thickness) || null,
          material_code: data.Material_Code || null,
          weight_kg: parseFloat(data.Spool_Weight) || null,
          length_m: parseFloat(data.Spool_Length) || null,
          shipment_date: parseExcelDate(data.SHIPMENT_DATE),
          ir_number: data.IR_Number,
          ir_date: parseExcelDate(data.IR_Number_Date),
          laydown_arrival: parseExcelDate(data.LAYDOWN_ARRIVAL),
          to_site: parseExcelDate(data.TO_SITE),
          erected: parseExcelDate(data.ERECTED),
          erected_ongoing: parseExcelDate(data.ERECTED_ONGOING),
          week_plan: data.Week_Plan
        };
      case 'supports':
        return {
          support_id: data.Support_ID?.toString(),
          support_tag_no: data.Support_Tag_No,
          iso_number: data.ISO_Number,
          full_tag_no: data.FullTagNo,
          support_name: data.Support_Name,
          support_mark: data.Support_Mark,
          full_spool_no: data.Full_Spool_No,
          weight_kg: parseFloat(data.Weight) || null,
          ir_number: data.IR_Number,
          ir_date: parseExcelDate(data.IR_Number_Date),
          delivered_to_site: parseExcelDate(data['Delivered to Site']),
          delivered_to: data['Delivered to'],
          assembly_date: parseExcelDate(data.Assembly_Date),
          week_plan: data.Week_Plan
        };
      case 'flanges':
        return {
          flange_id: data.Flange_ID?.toString(),
          flange_tag: data.Flange_Tag,
          iso_number: data.ISO_Number,
          flange_type: data.Flange_Type,
          first_part_code: data.First_Part_Code,
          second_part_code: data.Second_Part_Code,
          diameter_inch: parseFloat(data.Flange_Diameter) || null,
          pressure_rating: data.Pressure_Rating,
          is_critical: data.Critical_Flange === 'L1' || data.Critical_Flange === 'L2',
          critical_class: data.Critical_Flange,
          gasket_code: data.Gasket_Code,
          gasket_qty: parseInt(data.Gasket_Qty) || 1,
          bolt_code: data.Bolt_Code,
          bolt_qty: parseInt(data.Bolt_Qty) || 0,
          insulation_code: data.Insulation_Code || null,
          insulation_qty: parseFloat(data.Insulation_Qty) || null,
          insulation_alt_code: data.Insulation_Alt_Code || null,
          insulation_alt_qty: parseFloat(data.Insulation_Alt_Qty) || null,
          ident_code_1: data.Ident_Code_1 || null,
          ident_qty_1: parseInt(data.Ident_Qty_1) || null,
          ident_code_2: data.Ident_Code_2 || null,
          ident_qty_2: parseInt(data.Ident_Qty_2) || null,
          ir_number: data.IR_Number,
          ir_date: parseExcelDate(data.IR_Number_Date),
          delivered_to_site: parseExcelDate(data['Delivered to Site']),
          delivered_to: data['Delivered to'],
          assembly_date: parseExcelDate(data.Assembly_Date),
          week_plan: data.Week_Plan
        };
      case 'welds':
        return {
          full_weld_no: data.Full_Weld_No,
          weld_no: data.Weld_No,
          iso_number: data.ISO_Number,
          first_material_code: data.First_Material_Code,
          second_material_code: data.Second_Material_Code,
          full_first_spool: data.Full_First_Spool,
          full_second_spool: data.Full_Second_Spool,
          weld_type: data.Weld_Type,
          weld_category: data.Weld_Cat,
          diameter_inch: parseFloat(data.Dia_Inch) || null,
          thickness_mm: parseFloat(data.Thickness) || null,
          is_dissimilar: data['Dissimilar Joint'] === true || data['Dissimilar Joint'] === 'Yes',
          fitup_date: parseExcelDate(data.Fitup_Date),
          weld_date: parseExcelDate(data.Weld_Date),
          week_plan: data.Week_Plan
        };
      default:
        return data;
    }
  };

  // ============================================================================
  // EXPORT TEMPLATE
  // ============================================================================

  const exportTemplate = (type) => {
    const templates = {
      spools: {
        columns: ['Spool_ID', 'Full_Spool_No', 'ISO_Number', 'Spool_No', 'Service_class', 'Service_Cat', 'Spool_diameter', 'Thickness', 'Material_Code', 'Spool_Weight', 'Spool_Length', 'SHIPMENT_DATE', 'IR_Number', 'IR_Number_Date', 'LAYDOWN_ARRIVAL', 'TO_SITE', 'ERECTED', 'ERECTED_ONGOING', 'Week_Plan'],
        example: { Spool_ID: 1, Full_Spool_No: 'PRJ-ISO001-SP001', ISO_Number: 'PRJ-ISO001', Spool_No: 'SP001', Spool_diameter: 4, Thickness: 6.02, Material_Code: 'A106-B', Spool_Weight: 25.5, Spool_Length: 2.5 }
      },
      supports: {
        columns: ['Support_ID', 'Support_Tag_No', 'ISO_Number', 'FullTagNo', 'Support_Name', 'Support_Mark', 'Full_Spool_No', 'Weight', 'IR_Number', 'IR_Number_Date', 'Delivered to Site', 'Delivered to', 'Assembly_Date', 'Week_Plan'],
        example: { Support_ID: 1, Support_Tag_No: 'SUP-001', ISO_Number: 'PRJ-ISO001', Support_Mark: 'MG02-B', Full_Spool_No: 'PRJ-ISO001-SP001', Weight: 5.5 }
      },
      flanges: {
        columns: ['Flange_ID', 'Flange_Tag', 'ISO_Number', 'Flange_Type', 'First_Part_Code', 'Second_Part_Code', 'Flange_Diameter', 'Pressure_Rating', 'Critical_Flange', 'Gasket_Code', 'Gasket_Qty', 'Bolt_Code', 'Bolt_Qty', 'Insulation_Code', 'Insulation_Qty', 'Insulation_Alt_Code', 'Insulation_Alt_Qty', 'Ident_Code_1', 'Ident_Qty_1', 'Ident_Code_2', 'Ident_Qty_2', 'IR_Number', 'IR_Number_Date', 'Delivered to Site', 'Delivered to', 'Assembly_Date', 'Week_Plan'],
        example: { Flange_ID: 1, Flange_Tag: 'HF100001', ISO_Number: 'PRJ-ISO001', Flange_Type: 'SP', Gasket_Code: 'GSK001', Bolt_Code: 'BLT001', Bolt_Qty: 8, Ident_Code_1: 'ID001', Ident_Qty_1: 2 }
      },
      welds: {
        columns: ['Full_Weld_No', 'Weld_No', 'ISO_Number', 'First_Material_Code', 'Second_Material_Code', 'Full_First_Spool', 'Full_Second_Spool', 'Weld_Type', 'Weld_Cat', 'Dia_Inch', 'Thickness', 'Dissimilar Joint', 'Fitup_Date', 'Weld_Date', 'Week_Plan'],
        example: { Full_Weld_No: 'PRJ-ISO001-W001', Weld_No: 'W001', ISO_Number: 'PRJ-ISO001', Weld_Type: 'BW', Dia_Inch: 4, Thickness: 6.02 }
      }
    };
    
    const template = templates[type];
    if (!template) return;
    
    const ws = XLSX.utils.json_to_sheet([template.example], { header: template.columns });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type.charAt(0).toUpperCase() + type.slice(1));
    XLSX.writeFile(wb, `MTO_Template_${type}.xlsx`);
    setExportMenuOpen(false);
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
    { id: 'spools', label: '📦 Spools', count: spools.length },
    { id: 'supports', label: '🔩 Supports', count: supports.length },
    { id: 'flanges', label: '⚙️ Flanges', count: flanges.length },
    { id: 'welds', label: '🔥 Welds', count: welds.length },
    { id: 'summary', label: '📊 Riepilogo', count: null }
  ];

  const openAddModal = (type) => {
    setAddingType(type);
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              📋 MTO - Material Take Off
            </h1>
            <p className="text-gray-500 mt-1">{activeProject?.name} • Database materiali e tracking</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowImportModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium">
              📥 Importa Excel
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button 
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
              >
                📤 Esporta Template ▼
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-10">
                  <button onClick={() => exportTemplate('spools')} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">📦 Spools</button>
                  <button onClick={() => exportTemplate('supports')} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">🔩 Supports</button>
                  <button onClick={() => exportTemplate('flanges')} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">⚙️ Flanges</button>
                  <button onClick={() => exportTemplate('welds')} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">🔥 Welds</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Compact Stats with WP Coverage */}
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 mt-4">
          {/* MTO Totals */}
          <MiniStat icon="🔍" value={stats.isometrics} label="ISO" color="blue" />
          <MiniStat icon="📦" value={stats.spools} label="Spools" sub={`${stats.spoolsErected} eretti`} color="purple" />
          <MiniStat icon="🔩" value={stats.supports} label="Supports" sub={`${stats.supportsAssembled} ass.`} color="gray" />
          <MiniStat icon="🔥" value={stats.welds} label="Welds" sub={`${stats.weldsCompleted} compl.`} color="orange" />
          
          {/* WP Coverage */}
          <CoverageStat icon="📦" total={stats.spools} covered={wpCoverage.spools} label="Spools in WP" />
          <CoverageStat icon="🔥" total={stats.welds} covered={wpCoverage.welds} label="Welds in WP" />
          <CoverageStat icon="🔩" total={stats.supports} covered={wpCoverage.supports} label="Supports in WP" />
          <CoverageStat icon="⚙️" total={stats.flanges} covered={wpCoverage.flanges} label="Flanges in WP" />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchTerm(''); setFilterIso('all'); setFilterStatus('all'); }}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {tab.count !== null && <span className="ml-2 px-2 py-0.5 bg-gray-200 rounded-full text-xs">{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Filters + Add Button */}
        {activeTab !== 'summary' && (
          <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Cerca..." className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={filterIso} onChange={(e) => setFilterIso(e.target.value)} className="px-3 py-2 border rounded-lg">
              <option value="all">Tutti gli ISO</option>
              {isometrics.map(iso => <option key={iso.id} value={iso.iso_number}>{iso.iso_number}</option>)}
            </select>
            {activeTab === 'spools' && (
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg">
                <option value="all">Tutti gli stati</option>
                <option value="in_production">In Produzione</option>
                <option value="shipped">Spedito</option>
                <option value="ir_issued">IR Emesso</option>
                <option value="at_laydown">Laydown</option>
                <option value="at_site">Al Sito</option>
                <option value="erected_ongoing">In Erezione</option>
                <option value="erected">Eretto</option>
              </select>
            )}
            <button
              onClick={() => openAddModal(activeTab === 'spools' ? 'spool' : activeTab === 'supports' ? 'support' : activeTab === 'flanges' ? 'flange' : 'weld')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium"
            >
              ➕ Aggiungi
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'spools' && <SpoolsTable spools={filteredSpools} formatDate={formatDate} onEdit={(item) => { setEditingItem(item); setEditingType('spool'); }} onDelete={(id) => handleDelete('spool', id)} />}
          {activeTab === 'supports' && <SupportsTable supports={filteredSupports} formatDate={formatDate} onEdit={(item) => { setEditingItem(item); setEditingType('support'); }} onDelete={(id) => handleDelete('support', id)} />}
          {activeTab === 'flanges' && <FlangesTable flanges={filteredFlanges} formatDate={formatDate} onEdit={(item) => { setEditingItem(item); setEditingType('flange'); }} onDelete={(id) => handleDelete('flange', id)} />}
          {activeTab === 'welds' && <WeldsTable welds={filteredWelds} spools={spools} formatDate={formatDate} onEdit={(item) => { setEditingItem(item); setEditingType('weld'); }} onDelete={(id) => handleDelete('weld', id)} />}
          {activeTab === 'summary' && <MaterialsSummary supportSummary={supportSummary} flangeMaterialsSummary={flangeMaterialsSummary} onUpdateInventory={handleUpdateInventory} />}
        </div>
      </div>

      {/* Modals */}
      {showImportModal && <ImportModal importFiles={importFiles} onFileSelect={handleFileSelect} onAnalyze={analyzeImport} onClose={() => setShowImportModal(false)} importing={importing} />}
      {showDiffModal && <DiffModal diffs={importDiffs} selectedDiffs={selectedDiffs} setSelectedDiffs={setSelectedDiffs} onApply={applySelectedDiffs} onClose={() => setShowDiffModal(false)} importing={importing} />}
      {showAddModal && <AddModal type={addingType} spools={spools} isometrics={isometrics} onSave={addingType === 'spool' ? handleAddSpool : addingType === 'support' ? handleAddSupport : addingType === 'flange' ? handleAddFlange : handleAddWeld} onClose={() => setShowAddModal(false)} />}
      {editingItem && <EditModal item={editingItem} type={editingType} onSave={(updates) => {
        if (editingType === 'spool') handleUpdateSpool(editingItem.id, updates);
        else if (editingType === 'support') handleUpdateSupport(editingItem.id, updates);
        else if (editingType === 'flange') handleUpdateFlange(editingItem.id, updates);
        else if (editingType === 'weld') handleUpdateWeld(editingItem.id, updates);
      }} onClose={() => setEditingItem(null)} />}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Compact mini stat for MTO totals
const MiniStat = ({ icon, value, label, sub, color }) => {
  const colors = {
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    gray: 'bg-gray-50 border-gray-200',
    amber: 'bg-amber-50 border-amber-200',
    orange: 'bg-orange-50 border-orange-200'
  };
  return (
    <div className={`${colors[color] || colors.gray} rounded-lg p-2 border text-center`}>
      <div className="text-lg">{icon}</div>
      <div className="text-xl font-bold text-gray-700">{value}</div>
      <div className="text-[10px] text-gray-500 truncate">{label}</div>
      {sub && <div className="text-[10px] text-green-600">{sub}</div>}
    </div>
  );
};

// Coverage stat showing MTO vs WP
const CoverageStat = ({ icon, total, covered, label }) => {
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
  const uncovered = total - covered;
  const bgColor = pct === 100 ? 'bg-green-50 border-green-300' : pct > 50 ? 'bg-yellow-50 border-yellow-300' : 'bg-red-50 border-red-300';
  const textColor = pct === 100 ? 'text-green-700' : pct > 50 ? 'text-yellow-700' : 'text-red-700';
  
  return (
    <div className={`${bgColor} rounded-lg p-2 border text-center`}>
      <div className="flex items-center justify-center gap-1">
        <span className="text-sm">{icon}</span>
        <span className={`text-xs font-bold ${textColor}`}>{pct}%</span>
      </div>
      <div className="text-lg font-bold text-gray-700">{covered}<span className="text-gray-400 text-xs">/{total}</span></div>
      <div className="text-[10px] text-gray-500 truncate">{label}</div>
      {uncovered > 0 && <div className="text-[10px] text-red-500">-{uncovered} senza WP</div>}
    </div>
  );
};

const SpoolStatusBadge = ({ status }) => {
  const configs = {
    in_production: { label: 'In Produzione', color: 'bg-gray-100 text-gray-600' },
    shipped: { label: 'Spedito', color: 'bg-purple-100 text-purple-700' },
    ir_issued: { label: 'IR Emesso', color: 'bg-amber-100 text-amber-700' },
    at_laydown: { label: 'Laydown', color: 'bg-cyan-100 text-cyan-700' },
    at_site: { label: 'Al Sito', color: 'bg-blue-100 text-blue-700' },
    erected_ongoing: { label: 'In Erezione', color: 'bg-lime-100 text-lime-700' },
    erected: { label: 'Eretto', color: 'bg-emerald-100 text-emerald-700' }
  };
  const config = configs[status] || configs.in_production;
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>{config.label}</span>;
};

// Spools Table - with date display
const SpoolsTable = ({ spools, formatDate, onEdit, onDelete }) => (
  <div className="overflow-x-auto border rounded-lg">
    <table className="w-full text-sm">
      <thead className="bg-gray-100">
        <tr>
          <th className="text-left p-3 font-medium">Spool</th>
          <th className="text-left p-3 font-medium">ISO</th>
          <th className="text-center p-3 font-medium">Ø</th>
          <th className="text-center p-3 font-medium">Spess.</th>
          <th className="text-center p-3 font-medium">Mat.</th>
          <th className="text-center p-3 font-medium">Peso</th>
          <th className="text-center p-3 font-medium">Stato</th>
          <th className="text-center p-3 font-medium">Shipment</th>
          <th className="text-center p-3 font-medium">Laydown</th>
          <th className="text-center p-3 font-medium">To Site</th>
          <th className="text-center p-3 font-medium">Erected</th>
          <th className="text-center p-3 font-medium">Azioni</th>
        </tr>
      </thead>
      <tbody>
        {spools.length === 0 ? (
          <tr><td colSpan={12} className="p-8 text-center text-gray-400">Nessuno spool trovato</td></tr>
        ) : spools.map(spool => (
          <tr key={spool.id} className="border-t hover:bg-gray-50">
            <td className="p-3">
              <div className="font-mono font-medium text-blue-600">{spool.spool_no}</div>
              <div className="text-xs text-gray-400 truncate max-w-[150px]">{spool.full_spool_no}</div>
            </td>
            <td className="p-3 text-xs text-gray-600">{spool.iso_number}</td>
            <td className="p-3 text-center">{spool.diameter_inch}"</td>
            <td className="p-3 text-center text-xs">{spool.thickness_mm || '—'}</td>
            <td className="p-3 text-center text-xs font-mono">{spool.material_code || '—'}</td>
            <td className="p-3 text-center">{spool.weight_kg?.toFixed(1)} kg</td>
            <td className="p-3 text-center"><SpoolStatusBadge status={spool.site_status} /></td>
            <td className="p-3 text-center text-xs">{formatDate(spool.shipment_date)}</td>
            <td className="p-3 text-center text-xs">{formatDate(spool.laydown_arrival)}</td>
            <td className="p-3 text-center text-xs">{formatDate(spool.to_site)}</td>
            <td className="p-3 text-center text-xs">
              {spool.erected_ongoing && !spool.erected ? (
                <span className="text-lime-600" title={`In corso: ${formatDate(spool.erected_ongoing)}`}>🔄 {formatDate(spool.erected_ongoing)}</span>
              ) : (
                formatDate(spool.erected)
              )}
            </td>
            <td className="p-3 text-center">
              <button onClick={() => onEdit(spool)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600">✏️</button>
              <button onClick={() => onDelete(spool.id)} className="p-1.5 hover:bg-red-100 rounded text-red-600 ml-1">🗑️</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Supports Table - with date display
const SupportsTable = ({ supports, formatDate, onEdit, onDelete }) => (
  <div className="overflow-x-auto border rounded-lg">
    <table className="w-full text-sm">
      <thead className="bg-gray-100">
        <tr>
          <th className="text-left p-3 font-medium">Tag</th>
          <th className="text-left p-3 font-medium">Support Mark</th>
          <th className="text-left p-3 font-medium">ISO</th>
          <th className="text-center p-3 font-medium">Spool</th>
          <th className="text-center p-3 font-medium">Peso</th>
          <th className="text-center p-3 font-medium">IR</th>
          <th className="text-center p-3 font-medium">Delivered</th>
          <th className="text-center p-3 font-medium">Assembly</th>
          <th className="text-center p-3 font-medium">Azioni</th>
        </tr>
      </thead>
      <tbody>
        {supports.length === 0 ? (
          <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nessun support trovato</td></tr>
        ) : supports.map(sup => (
          <tr key={sup.id} className="border-t hover:bg-gray-50">
            <td className="p-3 font-mono text-xs">{sup.support_tag_no}</td>
            <td className="p-3"><span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">{sup.support_mark}</span></td>
            <td className="p-3 text-xs text-gray-600">{sup.iso_number}</td>
            <td className="p-3 text-center text-xs text-blue-600 font-mono">{sup.full_spool_no?.split('-').pop()}</td>
            <td className="p-3 text-center">{sup.weight_kg?.toFixed(2)} kg</td>
            <td className="p-3 text-center text-xs">{sup.ir_number || '—'}</td>
            <td className="p-3 text-center text-xs">{formatDate(sup.delivered_to_site)}</td>
            <td className="p-3 text-center text-xs">{formatDate(sup.assembly_date)}</td>
            <td className="p-3 text-center">
              <button onClick={() => onEdit(sup)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600">✏️</button>
              <button onClick={() => onDelete(sup.id)} className="p-1.5 hover:bg-red-100 rounded text-red-600 ml-1">🗑️</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Flanges Table - with date display and ident codes
const FlangesTable = ({ flanges, formatDate, onEdit, onDelete }) => (
  <div className="overflow-x-auto border rounded-lg">
    <table className="w-full text-sm">
      <thead className="bg-gray-100">
        <tr>
          <th className="text-left p-3 font-medium">Tag</th>
          <th className="text-left p-3 font-medium">ISO</th>
          <th className="text-center p-3 font-medium">Type</th>
          <th className="text-center p-3 font-medium">Ø / Rating</th>
          <th className="text-center p-3 font-medium">Gasket</th>
          <th className="text-center p-3 font-medium">Bolts</th>
          <th className="text-center p-3 font-medium">Ident</th>
          <th className="text-center p-3 font-medium">Delivered</th>
          <th className="text-center p-3 font-medium">Assembly</th>
          <th className="text-center p-3 font-medium">Azioni</th>
        </tr>
      </thead>
      <tbody>
        {flanges.length === 0 ? (
          <tr><td colSpan={10} className="p-8 text-center text-gray-400">Nessuna flange trovata</td></tr>
        ) : flanges.map(fl => (
          <tr key={fl.id} className="border-t hover:bg-gray-50">
            <td className="p-3 font-mono text-xs font-medium text-amber-700">{fl.flange_tag}</td>
            <td className="p-3 text-xs text-gray-600">{fl.iso_number}</td>
            <td className="p-3 text-center"><span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">{fl.flange_type}</span></td>
            <td className="p-3 text-center text-xs">{fl.diameter_inch}" / {fl.pressure_rating}</td>
            <td className="p-3 text-center text-xs font-mono">{fl.gasket_code}</td>
            <td className="p-3 text-center text-xs"><span className="font-mono">{fl.bolt_code}</span> <span className="text-gray-400">×{fl.bolt_qty}</span></td>
            <td className="p-3 text-center text-xs">
              {(fl.ident_code_1 || fl.ident_code_2) ? (
                <div className="flex flex-col gap-0.5">
                  {fl.ident_code_1 && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px]">{fl.ident_code_1} ×{fl.ident_qty_1 || 1}</span>}
                  {fl.ident_code_2 && <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px]">{fl.ident_code_2} ×{fl.ident_qty_2 || 1}</span>}
                </div>
              ) : '—'}
            </td>
            <td className="p-3 text-center text-xs">{formatDate(fl.delivered_to_site)}</td>
            <td className="p-3 text-center text-xs">{formatDate(fl.assembly_date)}</td>
            <td className="p-3 text-center">
              <button onClick={() => onEdit(fl)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600">✏️</button>
              <button onClick={() => onDelete(fl.id)} className="p-1.5 hover:bg-red-100 rounded text-red-600 ml-1">🗑️</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Welds Table with Detail Modal
const WeldsTable = ({ welds, spools, formatDate, onEdit, onDelete }) => {
  const [viewingWeld, setViewingWeld] = useState(null);
  
  const getSpoolDetails = (fullSpoolNo) => {
    return spools?.find(s => s.full_spool_no === fullSpoolNo);
  };
  
  const getSpoolStatusBadge = (status) => {
    const configs = {
      in_production: { label: 'In Produzione', color: 'bg-gray-100 text-gray-600' },
      shipped: { label: 'Spedito', color: 'bg-yellow-100 text-yellow-700' },
      at_laydown: { label: 'Laydown', color: 'bg-blue-100 text-blue-700' },
      ir_issued: { label: 'IR Emesso', color: 'bg-orange-100 text-orange-700' },
      at_site: { label: 'Al Sito', color: 'bg-purple-100 text-purple-700' },
      erected_ongoing: { label: 'In Erezione', color: 'bg-lime-100 text-lime-700' },
      erected: { label: 'Eretto', color: 'bg-green-100 text-green-700' }
    };
    const config = configs[status] || configs.in_production;
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>{config.label}</span>;
  };
  
  return (
    <>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-3 font-medium">Weld No</th>
              <th className="text-left p-3 font-medium">ISO</th>
              <th className="text-center p-3 font-medium">Spool 1 ↔ Spool 2</th>
              <th className="text-center p-3 font-medium">Type</th>
              <th className="text-center p-3 font-medium">Ø</th>
              <th className="text-center p-3 font-medium">Thick</th>
              <th className="text-center p-3 font-medium">Dissimilar</th>
              <th className="text-center p-3 font-medium">Fitup</th>
              <th className="text-center p-3 font-medium">Weld Date</th>
              <th className="text-center p-3 font-medium">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {welds.length === 0 ? (
              <tr><td colSpan={10} className="p-8 text-center text-gray-400">Nessuna weld trovata</td></tr>
            ) : welds.map(w => (
              <tr key={w.id} className={`border-t hover:bg-gray-50 ${w.is_dissimilar ? 'bg-yellow-50' : ''}`}>
                <td className="p-3 font-mono font-medium text-orange-600">{w.weld_no}</td>
                <td className="p-3 text-xs text-gray-600">{w.iso_number}</td>
                <td className="p-3 text-center">
                  <span className="text-blue-600 font-mono text-xs">{w.full_first_spool?.split('-').pop()}</span>
                  <span className="text-gray-400 mx-2">↔</span>
                  <span className="text-blue-600 font-mono text-xs">{w.full_second_spool?.split('-').pop()}</span>
                </td>
                <td className="p-3 text-center"><span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">{w.weld_type}</span></td>
                <td className="p-3 text-center text-xs">{w.diameter_inch}"</td>
                <td className="p-3 text-center text-xs">{w.thickness_mm}mm</td>
                <td className="p-3 text-center">
                  {w.is_dissimilar ? (
                    <button 
                      onClick={() => setViewingWeld(w)}
                      className="px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded text-xs font-medium hover:bg-yellow-300 inline-flex items-center gap-1"
                      title="Clicca per vedere i dettagli"
                    >
                      ⚠️ SI 🔍
                    </button>
                  ) : (
                    <button 
                      onClick={() => setViewingWeld(w)}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                      title="Vedi dettagli"
                    >
                      🔍
                    </button>
                  )}
                </td>
                <td className="p-3 text-center text-xs">{formatDate(w.fitup_date)}</td>
                <td className="p-3 text-center text-xs">{formatDate(w.weld_date)}</td>
                <td className="p-3 text-center">
                  <button onClick={() => onEdit(w)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600">✏️</button>
                  <button onClick={() => onDelete(w.id)} className="p-1.5 hover:bg-red-100 rounded text-red-600 ml-1">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Weld Detail Modal */}
      {viewingWeld && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b bg-gradient-to-r from-orange-50 to-yellow-50">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    🔥 Dettagli Saldatura: {viewingWeld.weld_no}
                    {viewingWeld.is_dissimilar && <span className="text-yellow-600 text-sm bg-yellow-100 px-2 py-0.5 rounded">⚠️ DISSIMILARE</span>}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">{viewingWeld.full_weld_no}</p>
                </div>
                <button onClick={() => setViewingWeld(null)} className="p-2 hover:bg-white/50 rounded-lg text-gray-500">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Weld Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">ISO</div>
                  <div className="font-mono font-medium">{viewingWeld.iso_number}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Tipo</div>
                  <div className="font-medium">{viewingWeld.weld_type} ({viewingWeld.weld_category || '-'})</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Diametro</div>
                  <div className="font-medium">{viewingWeld.diameter_inch}"</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Spessore</div>
                  <div className="font-medium">{viewingWeld.thickness_mm} mm</div>
                </div>
              </div>
              
              {/* Materials */}
              {viewingWeld.is_dissimilar && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">⚠️ Materiali Dissimili</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded p-3 border">
                      <div className="text-xs text-gray-500 mb-1">Materiale Spool 1</div>
                      <div className="font-mono font-bold text-lg">{viewingWeld.first_material_code || '-'}</div>
                    </div>
                    <div className="bg-white rounded p-3 border">
                      <div className="text-xs text-gray-500 mb-1">Materiale Spool 2</div>
                      <div className="font-mono font-bold text-lg">{viewingWeld.second_material_code || '-'}</div>
                    </div>
                  </div>
                  <p className="text-sm text-yellow-700 mt-3">⚠️ WPS speciale richiesta per questa saldatura</p>
                </div>
              )}
              
              {/* Spool 1 Details */}
              {(() => {
                const spool1 = getSpoolDetails(viewingWeld.full_first_spool);
                return spool1 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-blue-50 px-4 py-2 border-b">
                      <h4 className="font-semibold text-blue-800">📦 Spool 1: {spool1.spool_no || spool1.full_spool_no?.split('-').pop()}</h4>
                    </div>
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div><span className="text-gray-500">Full No:</span><br/><span className="font-mono text-xs">{spool1.full_spool_no}</span></div>
                      <div><span className="text-gray-500">Stato:</span><br/>{getSpoolStatusBadge(spool1.site_status)}</div>
                      <div><span className="text-gray-500">Diametro:</span><br/><span className="font-medium">{spool1.diameter_inch}"</span></div>
                      <div><span className="text-gray-500">Peso:</span><br/><span className="font-medium">{spool1.weight_kg?.toFixed(1)} kg</span></div>
                      <div><span className="text-gray-500">Service Class:</span><br/><span className="font-medium">{spool1.service_class || '-'}</span></div>
                      <div><span className="text-gray-500">Shipment:</span><br/><span className="font-medium">{formatDate(spool1.shipment_date)}</span></div>
                      <div><span className="text-gray-500">IR:</span><br/><span className="font-medium">{spool1.ir_number || '-'}</span></div>
                      <div><span className="text-gray-500">Erected:</span><br/><span className="font-medium">{formatDate(spool1.erected)}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 bg-gray-50 text-gray-500">
                    📦 Spool 1: {viewingWeld.full_first_spool || '-'} (dettagli non disponibili)
                  </div>
                );
              })()}
              
              {/* Spool 2 Details */}
              {(() => {
                const spool2 = getSpoolDetails(viewingWeld.full_second_spool);
                return spool2 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-purple-50 px-4 py-2 border-b">
                      <h4 className="font-semibold text-purple-800">📦 Spool 2: {spool2.spool_no || spool2.full_spool_no?.split('-').pop()}</h4>
                    </div>
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div><span className="text-gray-500">Full No:</span><br/><span className="font-mono text-xs">{spool2.full_spool_no}</span></div>
                      <div><span className="text-gray-500">Stato:</span><br/>{getSpoolStatusBadge(spool2.site_status)}</div>
                      <div><span className="text-gray-500">Diametro:</span><br/><span className="font-medium">{spool2.diameter_inch}"</span></div>
                      <div><span className="text-gray-500">Peso:</span><br/><span className="font-medium">{spool2.weight_kg?.toFixed(1)} kg</span></div>
                      <div><span className="text-gray-500">Service Class:</span><br/><span className="font-medium">{spool2.service_class || '-'}</span></div>
                      <div><span className="text-gray-500">Shipment:</span><br/><span className="font-medium">{formatDate(spool2.shipment_date)}</span></div>
                      <div><span className="text-gray-500">IR:</span><br/><span className="font-medium">{spool2.ir_number || '-'}</span></div>
                      <div><span className="text-gray-500">Erected:</span><br/><span className="font-medium">{formatDate(spool2.erected)}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 bg-gray-50 text-gray-500">
                    📦 Spool 2: {viewingWeld.full_second_spool || '-'} (dettagli non disponibili)
                  </div>
                );
              })()}
              
              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-lg p-4 border ${viewingWeld.fitup_date ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                  <div className="text-sm text-gray-500">Fitup Date</div>
                  <div className="font-medium text-lg">{formatDate(viewingWeld.fitup_date) !== '—' ? formatDate(viewingWeld.fitup_date) : 'Non eseguito'}</div>
                </div>
                <div className={`rounded-lg p-4 border ${viewingWeld.weld_date ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                  <div className="text-sm text-gray-500">Weld Date</div>
                  <div className="font-medium text-lg">{formatDate(viewingWeld.weld_date) !== '—' ? formatDate(viewingWeld.weld_date) : 'Non eseguito'}</div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button onClick={() => setViewingWeld(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Materials Summary - Restructured with 5 columns
const MaterialsSummary = ({ supportSummary, flangeMaterialsSummary, onUpdateInventory }) => (
  <div className="space-y-6">
    <div className="bg-gray-50 rounded-xl p-5 border">
      <h4 className="font-semibold text-gray-700 mb-4">🔩 Riepilogo Supports per Mark</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white">
            <tr>
              <th className="text-left p-3 font-medium border">Support Mark</th>
              <th className="text-center p-3 font-medium border bg-blue-50">Qty di Progetto</th>
              <th className="text-center p-3 font-medium border bg-amber-50">Qty Consegnate</th>
              <th className="text-center p-3 font-medium border bg-purple-50">Qty Necessarie</th>
              <th className="text-center p-3 font-medium border bg-green-50">Qty Magazzino</th>
              <th className="text-center p-3 font-medium border">Disponibilità</th>
            </tr>
          </thead>
          <tbody>
            {supportSummary.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-gray-400">Nessun dato</td></tr>
            ) : supportSummary.map((item, idx) => {
              const qtyProgetto = item.qty_necessary || 0;
              const qtyConsegnate = item.qty_delivered || 0;
              const qtyNecessarie = qtyProgetto - qtyConsegnate;
              const qtyMagazzino = item.qty_warehouse || 0;
              const disponibilita = qtyMagazzino - qtyNecessarie;
              const isOk = disponibilita >= 0;
              return (
                <tr key={idx} className="border-t">
                  <td className="p-3 border font-mono font-medium">{item.support_mark}</td>
                  <td className="p-3 border text-center font-bold text-blue-700">{qtyProgetto}</td>
                  <td className="p-3 border text-center text-amber-700">{qtyConsegnate}</td>
                  <td className="p-3 border text-center font-bold text-purple-700">{qtyNecessarie}</td>
                  <td className="p-3 border text-center">
                    <input type="number" defaultValue={qtyMagazzino} onBlur={(e) => onUpdateInventory('support', item.support_mark, e.target.value)} className="w-20 text-center border rounded px-2 py-1" />
                  </td>
                  <td className="p-3 border text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${isOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {isOk ? `✓ +${disponibilita}` : `⚠️ ${disponibilita}`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
      <h4 className="font-semibold text-gray-700 mb-4">⚙️ Riepilogo Materiali Flange</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white">
            <tr>
              <th className="text-left p-3 font-medium border">Codice</th>
              <th className="text-center p-3 font-medium border">Tipo</th>
              <th className="text-center p-3 font-medium border bg-blue-50">Qty di Progetto</th>
              <th className="text-center p-3 font-medium border bg-amber-50">Qty Consegnate</th>
              <th className="text-center p-3 font-medium border bg-purple-50">Qty Necessarie</th>
              <th className="text-center p-3 font-medium border bg-green-50">Qty Magazzino</th>
              <th className="text-center p-3 font-medium border">Disponibilità</th>
            </tr>
          </thead>
          <tbody>
            {flangeMaterialsSummary.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-gray-400">Nessun dato</td></tr>
            ) : flangeMaterialsSummary.map((item, idx) => {
              const qtyProgetto = item.qty_necessary || 0;
              const qtyConsegnate = item.qty_delivered || 0;
              const qtyNecessarie = qtyProgetto - qtyConsegnate;
              const qtyMagazzino = item.qty_warehouse || 0;
              const disponibilita = qtyMagazzino - qtyNecessarie;
              const isOk = disponibilita >= 0;
              const typeColor = item.material_type === 'gasket' ? 'bg-purple-100 text-purple-700' : item.material_type === 'bolt' ? 'bg-gray-100 text-gray-700' : 'bg-cyan-100 text-cyan-700';
              return (
                <tr key={idx} className="border-t">
                  <td className="p-3 border font-mono font-medium">{item.material_code}</td>
                  <td className="p-3 border text-center"><span className={`px-2 py-0.5 rounded text-xs ${typeColor}`}>{item.material_type === 'gasket' ? 'Gasket' : item.material_type === 'bolt' ? 'Bolt' : 'Insulation'}</span></td>
                  <td className="p-3 border text-center font-bold text-blue-700">{qtyProgetto}</td>
                  <td className="p-3 border text-center text-amber-700">{qtyConsegnate}</td>
                  <td className="p-3 border text-center font-bold text-purple-700">{qtyNecessarie}</td>
                  <td className="p-3 border text-center">
                    <input type="number" defaultValue={qtyMagazzino} onBlur={(e) => onUpdateInventory('flange', { code: item.material_code, type: item.material_type }, e.target.value)} className="w-20 text-center border rounded px-2 py-1" />
                  </td>
                  <td className="p-3 border text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${isOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {isOk ? `✓ +${disponibilita}` : `⚠️ ${disponibilita}`}
                    </span>
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

// Import Modal
const ImportModal = ({ importFiles, onFileSelect, onAnalyze, onClose, importing }) => {
  const fileTypes = [
    { key: 'spools', label: 'Spools', icon: '📦' },
    { key: 'supports', label: 'Supports', icon: '🔩' },
    { key: 'flanges', label: 'Flanged Joints', icon: '⚙️' },
    { key: 'welds', label: 'Welds', icon: '🔥' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">📥 Importa Dati Excel</h2>
          <p className="text-sm text-gray-500 mt-1">Seleziona i file da importare</p>
        </div>
        <div className="p-6 space-y-4">
          {fileTypes.map(({ key, label, icon }) => (
            <div key={key} className={`flex items-center gap-4 p-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${importFiles[key] ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl">{icon}</div>
              <div className="flex-1">
                <p className="font-medium text-gray-700">{label}</p>
                <p className="text-xs text-gray-400">{importFiles[key] ? importFiles[key].name : 'Clicca per selezionare'}</p>
              </div>
              <label className="cursor-pointer">
                {importFiles[key] ? <span className="text-green-600 text-xl">✓</span> : <span className="text-gray-300 text-xl">🔎</span>}
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files[0] && onFileSelect(key, e.target.files[0])} />
              </label>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={onAnalyze} disabled={Object.keys(importFiles).length === 0 || importing} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {importing ? 'Analisi...' : 'Analizza File →'}
          </button>
        </div>
      </div>
    </div>
  );
};

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
                    <span className="text-sm font-medium text-gray-700 capitalize">{diff.entity}</span>
                    <span className="font-mono text-sm text-blue-600">{diff.key}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{diff.details}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between p-4 border-t bg-gray-50">
        <button onClick={() => { const all = {}; diffs.forEach((_, idx) => all[idx] = true); setSelectedDiffs(all); }} className="text-sm text-blue-600 hover:text-blue-800">✓ Seleziona Tutti</button>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={onApply} disabled={Object.values(selectedDiffs).filter(Boolean).length === 0 || importing} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {importing ? 'Applicazione...' : `✓ Applica (${Object.values(selectedDiffs).filter(Boolean).length})`}
          </button>
        </div>
      </div>
    </div>
  </div>
);

// Add Modal (Inserimento Manuale) - with autocomplete
const AddModal = ({ type, spools, isometrics, onSave, onClose }) => {
  const [formData, setFormData] = useState({});
  const [isoSearch, setIsoSearch] = useState('');
  const [showIsoDropdown, setShowIsoDropdown] = useState(false);
  // Support spool selection (single dropdown)
  const [spoolSearch, setSpoolSearch] = useState('');
  const [showSpoolDropdown, setShowSpoolDropdown] = useState(false);
  // Weld spool selection (separate dropdowns for Spool 1 and Spool 2)
  const [spool1Search, setSpool1Search] = useState('');
  const [spool2Search, setSpool2Search] = useState('');
  const [showSpool1Dropdown, setShowSpool1Dropdown] = useState(false);
  const [showSpool2Dropdown, setShowSpool2Dropdown] = useState(false);
  
  // Filtered lists for autocomplete
  const filteredIsos = useMemo(() => {
    if (!isoSearch) return isometrics.slice(0, 10);
    const search = isoSearch.toLowerCase();
    return isometrics.filter(iso => iso.iso_number.toLowerCase().includes(search)).slice(0, 10);
  }, [isometrics, isoSearch]);
  
  // For Support spool selection
  const filteredSpools = useMemo(() => {
    if (!spoolSearch) return spools.slice(0, 10);
    const search = spoolSearch.toLowerCase();
    return spools.filter(s => s.full_spool_no.toLowerCase().includes(search)).slice(0, 10);
  }, [spools, spoolSearch]);
  
  // For Weld Spool 1 selection
  const filteredSpools1 = useMemo(() => {
    if (!spool1Search) return spools.slice(0, 10);
    const search = spool1Search.toLowerCase();
    return spools.filter(s => s.full_spool_no.toLowerCase().includes(search)).slice(0, 10);
  }, [spools, spool1Search]);
  
  // For Weld Spool 2 selection
  const filteredSpools2 = useMemo(() => {
    if (!spool2Search) return spools.slice(0, 10);
    const search = spool2Search.toLowerCase();
    return spools.filter(s => s.full_spool_no.toLowerCase().includes(search)).slice(0, 10);
  }, [spools, spool2Search]);
  
  // Auto-populate weld fields from spools
  const autoPopulateWeldFromSpools = (spool1FullNo, spool2FullNo) => {
    const spool1 = spools.find(s => s.full_spool_no === spool1FullNo);
    const spool2 = spools.find(s => s.full_spool_no === spool2FullNo);
    
    const updates = {};
    
    // ISO Number - prefer spool1
    if (spool1?.iso_number) updates.iso_number = spool1.iso_number;
    else if (spool2?.iso_number) updates.iso_number = spool2.iso_number;
    
    // Diameter - smaller of the two if different
    if (spool1?.diameter_inch && spool2?.diameter_inch) {
      updates.diameter_inch = Math.min(spool1.diameter_inch, spool2.diameter_inch);
    } else {
      updates.diameter_inch = spool1?.diameter_inch || spool2?.diameter_inch;
    }
    
    // Thickness - prefer spool1
    if (spool1?.thickness_mm) updates.thickness_mm = spool1.thickness_mm;
    else if (spool2?.thickness_mm) updates.thickness_mm = spool2.thickness_mm;
    
    // Materials
    updates.first_material_code = spool1?.material_code || '';
    updates.second_material_code = spool2?.material_code || '';
    
    // Detect dissimilar
    if (updates.first_material_code && updates.second_material_code && 
        updates.first_material_code !== updates.second_material_code) {
      updates.is_dissimilar = true;
    }
    
    return updates;
  };

  const handleSubmit = () => {
    if (type === 'spool') {
      if (!formData.full_spool_no || !formData.iso_number || !formData.spool_no) {
        alert('Compila i campi obbligatori: Full Spool No, ISO Number, Spool No');
        return;
      }
    } else if (type === 'support') {
      if (!formData.support_tag_no || !formData.support_mark) {
        alert('Compila i campi obbligatori: Support Tag No, Support Mark');
        return;
      }
    } else if (type === 'flange') {
      if (!formData.flange_tag) {
        alert('Compila il campo obbligatorio: Flange Tag');
        return;
      }
    } else if (type === 'weld') {
      if (!formData.full_weld_no || !formData.weld_no) {
        alert('Compila i campi obbligatori: Full Weld No, Weld No');
        return;
      }
    }
    onSave(formData);
  };

  const titles = { spool: '📦 Nuovo Spool', support: '🔩 Nuovo Support', flange: '⚙️ Nuova Flange', weld: '🔥 Nuova Weld' };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-800">{titles[type]}</h2>
        </div>
        <div className="p-6 space-y-4">
          {type === 'spool' && (
            <>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Spool No *</label><input type="text" value={formData.full_spool_no || ''} onChange={e => setFormData({...formData, full_spool_no: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="PRJ-ISO001-SP001" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">ISO Number *</label>
                  <input 
                    type="text" 
                    value={formData.iso_number || ''} 
                    onChange={e => { setFormData({...formData, iso_number: e.target.value}); setIsoSearch(e.target.value); }}
                    onFocus={() => setShowIsoDropdown(true)}
                    onBlur={() => setTimeout(() => setShowIsoDropdown(false), 200)}
                    className="w-full px-3 py-2 border rounded-lg" 
                  />
                  {showIsoDropdown && filteredIsos.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredIsos.map(iso => (
                        <div key={iso.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm" onClick={() => { setFormData({...formData, iso_number: iso.iso_number}); setShowIsoDropdown(false); }}>
                          {iso.iso_number}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Spool No *</label><input type="text" value={formData.spool_no || ''} onChange={e => setFormData({...formData, spool_no: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="SP001" /></div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Ø (")</label><input type="number" step="0.5" value={formData.diameter_inch || ''} onChange={e => setFormData({...formData, diameter_inch: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Spess. (mm)</label><input type="number" step="0.01" value={formData.thickness_mm || ''} onChange={e => setFormData({...formData, thickness_mm: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label><input type="number" step="0.01" value={formData.weight_kg || ''} onChange={e => setFormData({...formData, weight_kg: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Lung. (m)</label><input type="number" step="0.01" value={formData.length_m || ''} onChange={e => setFormData({...formData, length_m: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Material Code</label><input type="text" value={formData.material_code || ''} onChange={e => setFormData({...formData, material_code: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="A106-B" /></div>
            </>
          )}
          {type === 'support' && (
            <>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Support Tag No *</label><input type="text" value={formData.support_tag_no || ''} onChange={e => setFormData({...formData, support_tag_no: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Support Mark *</label><input type="text" value={formData.support_mark || ''} onChange={e => setFormData({...formData, support_mark: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="MG02-B" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label><input type="number" step="0.01" value={formData.weight_kg || ''} onChange={e => setFormData({...formData, weight_kg: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">ISO Number</label>
                <input 
                  type="text" 
                  value={formData.iso_number || ''} 
                  onChange={e => { setFormData({...formData, iso_number: e.target.value}); setIsoSearch(e.target.value); }}
                  onFocus={() => setShowIsoDropdown(true)}
                  onBlur={() => setTimeout(() => setShowIsoDropdown(false), 200)}
                  className="w-full px-3 py-2 border rounded-lg" 
                />
                {showIsoDropdown && filteredIsos.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredIsos.map(iso => (
                      <div key={iso.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm" onClick={() => { setFormData({...formData, iso_number: iso.iso_number}); setShowIsoDropdown(false); }}>
                        {iso.iso_number}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Spool No (collegamento)</label>
                <input 
                  type="text" 
                  value={formData.full_spool_no || ''} 
                  onChange={e => { setFormData({...formData, full_spool_no: e.target.value}); setSpoolSearch(e.target.value); }}
                  onFocus={() => setShowSpoolDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSpoolDropdown(false), 200)}
                  placeholder="Cerca spool..."
                  className="w-full px-3 py-2 border rounded-lg" 
                />
                {showSpoolDropdown && filteredSpools.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredSpools.map(s => (
                      <div key={s.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm font-mono" onClick={() => { setFormData({...formData, full_spool_no: s.full_spool_no}); setShowSpoolDropdown(false); }}>
                        {s.full_spool_no}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          {type === 'flange' && (
            <>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Flange Tag *</label><input type="text" value={formData.flange_tag || ''} onChange={e => setFormData({...formData, flange_tag: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="HF100001" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">ISO Number</label>
                  <input 
                    type="text" 
                    value={formData.iso_number || ''} 
                    onChange={e => { setFormData({...formData, iso_number: e.target.value}); setIsoSearch(e.target.value); }}
                    onFocus={() => setShowIsoDropdown(true)}
                    onBlur={() => setTimeout(() => setShowIsoDropdown(false), 200)}
                    className="w-full px-3 py-2 border rounded-lg" 
                  />
                  {showIsoDropdown && filteredIsos.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredIsos.map(iso => (
                        <div key={iso.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm" onClick={() => { setFormData({...formData, iso_number: iso.iso_number}); setShowIsoDropdown(false); }}>
                          {iso.iso_number}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={formData.flange_type || ''} onChange={e => setFormData({...formData, flange_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="">--</option><option value="SP">SP</option><option value="SM">SM</option><option value="SE">SE</option><option value="SV">SV</option><option value="SI">SI</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Diametro (")</label><input type="number" step="0.5" value={formData.diameter_inch || ''} onChange={e => setFormData({...formData, diameter_inch: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Rating</label><input type="text" value={formData.pressure_rating || ''} onChange={e => setFormData({...formData, pressure_rating: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="150#" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Gasket Code</label><input type="text" value={formData.gasket_code || ''} onChange={e => setFormData({...formData, gasket_code: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Bolt Code</label><input type="text" value={formData.bolt_code || ''} onChange={e => setFormData({...formData, bolt_code: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Bolt Qty</label><input type="number" value={formData.bolt_qty || ''} onChange={e => setFormData({...formData, bolt_qty: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" /></div>
              <div className="border-t pt-4 mt-2">
                <p className="text-sm font-medium text-gray-700 mb-2">Ident Codes (opzionali)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs text-gray-500 mb-1">Ident Code 1</label><input type="text" value={formData.ident_code_1 || ''} onChange={e => setFormData({...formData, ident_code_1: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Qty 1</label><input type="number" value={formData.ident_qty_1 || ''} onChange={e => setFormData({...formData, ident_qty_1: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="block text-xs text-gray-500 mb-1">Ident Code 2</label><input type="text" value={formData.ident_code_2 || ''} onChange={e => setFormData({...formData, ident_code_2: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Qty 2</label><input type="number" value={formData.ident_qty_2 || ''} onChange={e => setFormData({...formData, ident_qty_2: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
              </div>
            </>
          )}
          {type === 'weld' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Weld No *</label><input type="text" value={formData.full_weld_no || ''} onChange={e => setFormData({...formData, full_weld_no: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="PRJ-ISO001-W001" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Weld No *</label><input type="text" value={formData.weld_no || ''} onChange={e => setFormData({...formData, weld_no: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="W001" /></div>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">ISO Number</label>
                <input 
                  type="text" 
                  value={formData.iso_number || ''} 
                  onChange={e => { setFormData({...formData, iso_number: e.target.value}); setIsoSearch(e.target.value); }}
                  onFocus={() => setShowIsoDropdown(true)}
                  onBlur={() => setTimeout(() => setShowIsoDropdown(false), 200)}
                  className="w-full px-3 py-2 border rounded-lg" 
                />
                {showIsoDropdown && filteredIsos.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredIsos.map(iso => (
                      <div key={iso.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm" onClick={() => { setFormData({...formData, iso_number: iso.iso_number}); setShowIsoDropdown(false); }}>
                        {iso.iso_number}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spool 1</label>
                  <input 
                    type="text" 
                    value={formData.full_first_spool || ''} 
                    onChange={e => { 
                      const newVal = e.target.value;
                      setFormData({...formData, full_first_spool: newVal}); 
                      setSpool1Search(newVal); 
                    }}
                    onFocus={() => setShowSpool1Dropdown(true)}
                    onBlur={() => setTimeout(() => {
                      setShowSpool1Dropdown(false);
                      // Auto-populate when both spools selected
                      if (formData.full_first_spool && formData.full_second_spool) {
                        const updates = autoPopulateWeldFromSpools(formData.full_first_spool, formData.full_second_spool);
                        setFormData(prev => ({...prev, ...updates}));
                      }
                    }, 200)}
                    placeholder="Cerca spool..."
                    className="w-full px-3 py-2 border rounded-lg" 
                  />
                  {showSpool1Dropdown && filteredSpools1.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredSpools1.map(s => (
                        <div key={s.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-xs font-mono" onClick={() => { 
                          const newData = {...formData, full_first_spool: s.full_spool_no};
                          if (newData.full_second_spool) {
                            const updates = autoPopulateWeldFromSpools(s.full_spool_no, newData.full_second_spool);
                            setFormData({...newData, ...updates});
                          } else {
                            setFormData(newData);
                          }
                          setShowSpool1Dropdown(false); 
                        }}>
                          {s.full_spool_no}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spool 2</label>
                  <input 
                    type="text" 
                    value={formData.full_second_spool || ''} 
                    onChange={e => { 
                      const newVal = e.target.value;
                      setFormData({...formData, full_second_spool: newVal}); 
                      setSpool2Search(newVal); 
                    }}
                    onFocus={() => setShowSpool2Dropdown(true)}
                    onBlur={() => setTimeout(() => {
                      setShowSpool2Dropdown(false);
                      // Auto-populate when both spools selected
                      if (formData.full_first_spool && formData.full_second_spool) {
                        const updates = autoPopulateWeldFromSpools(formData.full_first_spool, formData.full_second_spool);
                        setFormData(prev => ({...prev, ...updates}));
                      }
                    }, 200)}
                    placeholder="Cerca spool..."
                    className="w-full px-3 py-2 border rounded-lg" 
                  />
                  {showSpool2Dropdown && filteredSpools2.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredSpools2.map(s => (
                        <div key={s.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-xs font-mono" onClick={() => { 
                          const newData = {...formData, full_second_spool: s.full_spool_no};
                          if (newData.full_first_spool) {
                            const updates = autoPopulateWeldFromSpools(newData.full_first_spool, s.full_spool_no);
                            setFormData({...newData, ...updates});
                          } else {
                            setFormData(newData);
                          }
                          setShowSpool2Dropdown(false); 
                        }}>
                          {s.full_spool_no}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={formData.weld_type || ''} onChange={e => setFormData({...formData, weld_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="">--</option><option value="BW">BW</option><option value="SW">SW</option><option value="FW">FW</option>
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Ø (")</label><input type="number" step="0.5" value={formData.diameter_inch || ''} onChange={e => setFormData({...formData, diameter_inch: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Thick (mm)</label><input type="number" step="0.01" value={formData.thickness_mm || ''} onChange={e => setFormData({...formData, thickness_mm: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Mat. Spool 1</label><input type="text" value={formData.first_material_code || ''} onChange={e => setFormData({...formData, first_material_code: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Mat. Spool 2</label><input type="text" value={formData.second_material_code || ''} onChange={e => setFormData({...formData, second_material_code: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
              </div>
              <div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={formData.is_dissimilar || false} onChange={e => setFormData({...formData, is_dissimilar: e.target.checked})} className="w-4 h-4" /><span className="text-sm text-gray-700">Saldatura Dissimile</span></label></div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">✓ Salva</button>
        </div>
      </div>
    </div>
  );
};

// Edit Modal - FULL EDIT (tutti i campi modificabili)
const EditModal = ({ item, type, onSave, onClose }) => {
  const [formData, setFormData] = useState({ ...item });

  const handleSave = () => {
    const updates = {};
    if (type === 'spool') {
      // Dati base
      updates.spool_no = formData.spool_no || null;
      updates.iso_number = formData.iso_number || null;
      updates.service_class = formData.service_class || null;
      updates.service_category = formData.service_category || null;
      updates.diameter_inch = formData.diameter_inch ? parseFloat(formData.diameter_inch) : null;
      updates.thickness_mm = formData.thickness_mm ? parseFloat(formData.thickness_mm) : null;
      updates.material_code = formData.material_code || null;
      updates.weight_kg = formData.weight_kg ? parseFloat(formData.weight_kg) : null;
      updates.length_m = formData.length_m ? parseFloat(formData.length_m) : null;
      // Tracking
      updates.shipment_date = formData.shipment_date || null;
      updates.ir_number = formData.ir_number || null;
      updates.ir_date = formData.ir_date || null;
      updates.laydown_arrival = formData.laydown_arrival || null;
      updates.to_site = formData.to_site || null;
      updates.erected_ongoing = formData.erected_ongoing || null;
      updates.erected = formData.erected || null;
      updates.week_plan = formData.week_plan || null;
    } else if (type === 'support') {
      // Dati base
      updates.support_tag_no = formData.support_tag_no || null;
      updates.iso_number = formData.iso_number || null;
      updates.support_name = formData.support_name || null;
      updates.support_mark = formData.support_mark || null;
      updates.full_spool_no = formData.full_spool_no || null;
      updates.weight_kg = formData.weight_kg ? parseFloat(formData.weight_kg) : null;
      // Tracking
      updates.ir_number = formData.ir_number || null;
      updates.ir_date = formData.ir_date || null;
      updates.delivered_to_site = formData.delivered_to_site || null;
      updates.delivered_to = formData.delivered_to || null;
      updates.assembly_date = formData.assembly_date || null;
      updates.week_plan = formData.week_plan || null;
    } else if (type === 'flange') {
      // Dati base
      updates.flange_tag = formData.flange_tag || null;
      updates.iso_number = formData.iso_number || null;
      updates.flange_type = formData.flange_type || null;
      updates.first_part_code = formData.first_part_code || null;
      updates.second_part_code = formData.second_part_code || null;
      updates.diameter_inch = formData.diameter_inch ? parseFloat(formData.diameter_inch) : null;
      updates.pressure_rating = formData.pressure_rating || null;
      updates.is_critical = formData.is_critical || false;
      updates.critical_class = formData.critical_class || null;
      // Materiali
      updates.gasket_code = formData.gasket_code || null;
      updates.gasket_qty = formData.gasket_qty ? parseInt(formData.gasket_qty) : 1;
      updates.bolt_code = formData.bolt_code || null;
      updates.bolt_qty = formData.bolt_qty ? parseInt(formData.bolt_qty) : 0;
      updates.insulation_code = formData.insulation_code || null;
      updates.insulation_qty = formData.insulation_qty ? parseFloat(formData.insulation_qty) : null;
      // Ident
      updates.ident_code_1 = formData.ident_code_1 || null;
      updates.ident_qty_1 = formData.ident_qty_1 ? parseInt(formData.ident_qty_1) : null;
      updates.ident_code_2 = formData.ident_code_2 || null;
      updates.ident_qty_2 = formData.ident_qty_2 ? parseInt(formData.ident_qty_2) : null;
      // Tracking
      updates.ir_number = formData.ir_number || null;
      updates.ir_date = formData.ir_date || null;
      updates.delivered_to_site = formData.delivered_to_site || null;
      updates.delivered_to = formData.delivered_to || null;
      updates.assembly_date = formData.assembly_date || null;
      updates.week_plan = formData.week_plan || null;
    } else if (type === 'weld') {
      // Dati base
      updates.weld_no = formData.weld_no || null;
      updates.iso_number = formData.iso_number || null;
      updates.full_first_spool = formData.full_first_spool || null;
      updates.full_second_spool = formData.full_second_spool || null;
      updates.first_material_code = formData.first_material_code || null;
      updates.second_material_code = formData.second_material_code || null;
      updates.weld_type = formData.weld_type || null;
      updates.weld_category = formData.weld_category || null;
      updates.diameter_inch = formData.diameter_inch ? parseFloat(formData.diameter_inch) : null;
      updates.thickness_mm = formData.thickness_mm ? parseFloat(formData.thickness_mm) : null;
      updates.is_dissimilar = formData.is_dissimilar || false;
      // Tracking
      updates.fitup_date = formData.fitup_date || null;
      updates.weld_date = formData.weld_date || null;
      updates.week_plan = formData.week_plan || null;
    }
    onSave(updates);
  };

  const titles = { 
    spool: `📦 Modifica: ${item.spool_no}`, 
    support: `🔩 Modifica: ${item.support_tag_no}`, 
    flange: `⚙️ Modifica: ${item.flange_tag}`, 
    weld: `🔥 Modifica: ${item.weld_no}` 
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-800">{titles[type]}</h2>
          <p className="text-xs text-gray-500 mt-1">Modifica tutti i campi necessari</p>
        </div>
        <div className="p-6 space-y-4">
          {type === 'spool' && (
            <>
              <div className="bg-blue-50 p-3 rounded-lg mb-4">
                <p className="text-xs text-blue-600 font-medium">ID: {item.full_spool_no}</p>
              </div>
              <fieldset className="border rounded-lg p-4">
                <legend className="text-sm font-medium text-gray-700 px-2">📋 Dati Base</legend>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="block text-xs text-gray-500 mb-1">Spool No</label><input type="text" value={formData.spool_no || ''} onChange={e => setFormData({...formData, spool_no: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">ISO Number</label><input type="text" value={formData.iso_number || ''} onChange={e => setFormData({...formData, iso_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div><label className="block text-xs text-gray-500 mb-1">Diametro (")</label><input type="number" step="0.5" value={formData.diameter_inch || ''} onChange={e => setFormData({...formData, diameter_inch: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Spessore (mm)</label><input type="number" step="0.01" value={formData.thickness_mm || ''} onChange={e => setFormData({...formData, thickness_mm: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Material Code</label><input type="text" value={formData.material_code || ''} onChange={e => setFormData({...formData, material_code: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div><label className="block text-xs text-gray-500 mb-1">Peso (kg)</label><input type="number" step="0.01" value={formData.weight_kg || ''} onChange={e => setFormData({...formData, weight_kg: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Lunghezza (m)</label><input type="number" step="0.01" value={formData.length_m || ''} onChange={e => setFormData({...formData, length_m: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Service Class</label><input type="text" value={formData.service_class || ''} onChange={e => setFormData({...formData, service_class: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
              </fieldset>
              <fieldset className="border rounded-lg p-4">
                <legend className="text-sm font-medium text-gray-700 px-2">📅 Tracking</legend>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="block text-xs text-gray-500 mb-1">Shipment Date</label><input type="date" value={formData.shipment_date || ''} onChange={e => setFormData({...formData, shipment_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">IR Number</label><input type="text" value={formData.ir_number || ''} onChange={e => setFormData({...formData, ir_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div><label className="block text-xs text-gray-500 mb-1">Laydown Arrival</label><input type="date" value={formData.laydown_arrival || ''} onChange={e => setFormData({...formData, laydown_arrival: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">To Site</label><input type="date" value={formData.to_site || ''} onChange={e => setFormData({...formData, to_site: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div><label className="block text-xs text-gray-500 mb-1">In Erezione (ongoing)</label><input type="date" value={formData.erected_ongoing || ''} onChange={e => setFormData({...formData, erected_ongoing: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Erected</label><input type="date" value={formData.erected || ''} onChange={e => setFormData({...formData, erected: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
              </fieldset>
            </>
          )}
          {type === 'support' && (
            <>
              <div className="bg-gray-50 p-3 rounded-lg mb-4">
                <p className="text-xs text-gray-600 font-medium">ID: {item.support_tag_no}</p>
              </div>
              <fieldset className="border rounded-lg p-4">
                <legend className="text-sm font-medium text-gray-700 px-2">📋 Dati Base</legend>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="block text-xs text-gray-500 mb-1">Support Mark</label><input type="text" value={formData.support_mark || ''} onChange={e => setFormData({...formData, support_mark: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">ISO Number</label><input type="text" value={formData.iso_number || ''} onChange={e => setFormData({...formData, iso_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div><label className="block text-xs text-gray-500 mb-1">Support Name</label><input type="text" value={formData.support_name || ''} onChange={e => setFormData({...formData, support_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Peso (kg)</label><input type="number" step="0.01" value={formData.weight_kg || ''} onChange={e => setFormData({...formData, weight_kg: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-gray-500 mb-1">Full Spool No (collegamento)</label>
                  <input type="text" value={formData.full_spool_no || ''} onChange={e => setFormData({...formData, full_spool_no: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
                </div>
              </fieldset>
              <fieldset className="border rounded-lg p-4">
                <legend className="text-sm font-medium text-gray-700 px-2">📅 Tracking</legend>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="block text-xs text-gray-500 mb-1">IR Number</label><input type="text" value={formData.ir_number || ''} onChange={e => setFormData({...formData, ir_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Delivered To</label><input type="text" value={formData.delivered_to || ''} onChange={e => setFormData({...formData, delivered_to: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div><label className="block text-xs text-gray-500 mb-1">Delivered to Site</label><input type="date" value={formData.delivered_to_site || ''} onChange={e => setFormData({...formData, delivered_to_site: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Assembly Date</label><input type="date" value={formData.assembly_date || ''} onChange={e => setFormData({...formData, assembly_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
              </fieldset>
            </>
          )}
          {type === 'flange' && (
            <>
              <div className="bg-amber-50 p-3 rounded-lg mb-4">
                <p className="text-xs text-amber-700 font-medium">ID: {item.flange_tag}</p>
              </div>
              <fieldset className="border rounded-lg p-4">
                <legend className="text-sm font-medium text-gray-700 px-2">📋 Dati Base</legend>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div><label className="block text-xs text-gray-500 mb-1">ISO Number</label><input type="text" value={formData.iso_number || ''} onChange={e => setFormData({...formData, iso_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Type</label>
                    <select value={formData.flange_type || ''} onChange={e => setFormData({...formData, flange_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                      <option value="">--</option><option value="SP">SP</option><option value="SM">SM</option><option value="SE">SE</option><option value="SV">SV</option><option value="SI">SI</option>
                    </select>
                  </div>
                  <div><label className="block text-xs text-gray-500 mb-1">Critical</label>
                    <select value={formData.critical_class || ''} onChange={e => setFormData({...formData, critical_class: e.target.value, is_critical: e.target.value === 'L1' || e.target.value === 'L2'})} className="w-full px-3 py-2 border rounded-lg text-sm">
                      <option value="">No</option><option value="L1">L1</option><option value="L2">L2</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div><label className="block text-xs text-gray-500 mb-1">Diametro (")</label><input type="number" step="0.5" value={formData.diameter_inch || ''} onChange={e => setFormData({...formData, diameter_inch: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Pressure Rating</label><input type="text" value={formData.pressure_rating || ''} onChange={e => setFormData({...formData, pressure_rating: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="150#" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div><label className="block text-xs text-gray-500 mb-1">First Part Code</label><input type="text" value={formData.first_part_code || ''} onChange={e => setFormData({...formData, first_part_code: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Second Part Code</label><input type="text" value={formData.second_part_code || ''} onChange={e => setFormData({...formData, second_part_code: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
                </div>
              </fieldset>
              <fieldset className="border rounded-lg p-4">
                <legend className="text-sm font-medium text-gray-700 px-2">🔧 Materiali</legend>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="block text-xs text-gray-500 mb-1">Gasket Code</label><input type="text" value={formData.gasket_code || ''} onChange={e => setFormData({...formData, gasket_code: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Gasket Qty</label><input type="number" value={formData.gasket_qty || ''} onChange={e => setFormData({...formData, gasket_qty: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div><label className="block text-xs text-gray-500 mb-1">Bolt Code</label><input type="text" value={formData.bolt_code || ''} onChange={e => setFormData({...formData, bolt_code: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Bolt Qty</label><input type="number" value={formData.bolt_qty || ''} onChange={e => setFormData({...formData, bolt_qty: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div><label className="block text-xs text-gray-500 mb-1">Insulation Code</label><input type="text" value={formData.insulation_code || ''} onChange={e => setFormData({...formData, insulation_code: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Insulation Qty</label><input type="number" step="0.01" value={formData.insulation_qty || ''} onChange={e => setFormData({...formData, insulation_qty: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
              </fieldset>
              <fieldset className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/50">
                <legend className="text-sm font-medium text-indigo-700 px-2">🏷️ Ident Codes</legend>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="block text-xs text-gray-500 mb-1">Ident Code 1</label><input type="text" value={formData.ident_code_1 || ''} onChange={e => setFormData({...formData, ident_code_1: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Qty 1</label><input type="number" value={formData.ident_qty_1 || ''} onChange={e => setFormData({...formData, ident_qty_1: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="block text-xs text-gray-500 mb-1">Ident Code 2</label><input type="text" value={formData.ident_code_2 || ''} onChange={e => setFormData({...formData, ident_code_2: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Qty 2</label><input type="number" value={formData.ident_qty_2 || ''} onChange={e => setFormData({...formData, ident_qty_2: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
              </fieldset>
              <fieldset className="border rounded-lg p-4">
                <legend className="text-sm font-medium text-gray-700 px-2">📅 Tracking</legend>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="block text-xs text-gray-500 mb-1">IR Number</label><input type="text" value={formData.ir_number || ''} onChange={e => setFormData({...formData, ir_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Delivered To</label><input type="text" value={formData.delivered_to || ''} onChange={e => setFormData({...formData, delivered_to: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div><label className="block text-xs text-gray-500 mb-1">Delivered to Site</label><input type="date" value={formData.delivered_to_site || ''} onChange={e => setFormData({...formData, delivered_to_site: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Assembly Date</label><input type="date" value={formData.assembly_date || ''} onChange={e => setFormData({...formData, assembly_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
              </fieldset>
            </>
          )}
          {type === 'weld' && (
            <>
              <div className="bg-orange-50 p-3 rounded-lg mb-4">
                <p className="text-xs text-orange-700 font-medium">ID: {item.full_weld_no}</p>
              </div>
              <fieldset className="border rounded-lg p-4">
                <legend className="text-sm font-medium text-gray-700 px-2">📋 Dati Base</legend>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="block text-xs text-gray-500 mb-1">Weld No</label><input type="text" value={formData.weld_no || ''} onChange={e => setFormData({...formData, weld_no: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">ISO Number</label><input type="text" value={formData.iso_number || ''} onChange={e => setFormData({...formData, iso_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div><label className="block text-xs text-gray-500 mb-1">Type</label>
                    <select value={formData.weld_type || ''} onChange={e => setFormData({...formData, weld_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                      <option value="">--</option><option value="BW">BW</option><option value="SW">SW</option><option value="FW">FW</option>
                    </select>
                  </div>
                  <div><label className="block text-xs text-gray-500 mb-1">Diametro (")</label><input type="number" step="0.5" value={formData.diameter_inch || ''} onChange={e => setFormData({...formData, diameter_inch: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Spessore (mm)</label><input type="number" step="0.01" value={formData.thickness_mm || ''} onChange={e => setFormData({...formData, thickness_mm: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
              </fieldset>
              <fieldset className="border rounded-lg p-4">
                <legend className="text-sm font-medium text-gray-700 px-2">🔗 Collegamenti Spools</legend>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="block text-xs text-gray-500 mb-1">Full First Spool</label><input type="text" value={formData.full_first_spool || ''} onChange={e => setFormData({...formData, full_first_spool: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Full Second Spool</label><input type="text" value={formData.full_second_spool || ''} onChange={e => setFormData({...formData, full_second_spool: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div><label className="block text-xs text-gray-500 mb-1">First Material Code</label><input type="text" value={formData.first_material_code || ''} onChange={e => setFormData({...formData, first_material_code: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Second Material Code</label><input type="text" value={formData.second_material_code || ''} onChange={e => setFormData({...formData, second_material_code: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm font-mono" /></div>
                </div>
                <div className="mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.is_dissimilar || false} onChange={e => setFormData({...formData, is_dissimilar: e.target.checked})} className="w-4 h-4" />
                    <span className="text-sm text-gray-700">⚠️ Saldatura Dissimile</span>
                  </label>
                </div>
              </fieldset>
              <fieldset className="border rounded-lg p-4">
                <legend className="text-sm font-medium text-gray-700 px-2">📅 Tracking</legend>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="block text-xs text-gray-500 mb-1">Fitup Date</label><input type="date" value={formData.fitup_date || ''} onChange={e => setFormData({...formData, fitup_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Weld Date</label><input type="date" value={formData.weld_date || ''} onChange={e => setFormData({...formData, weld_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
                </div>
              </fieldset>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">✓ Salva Modifiche</button>
        </div>
      </div>
    </div>
  );
};
