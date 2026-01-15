import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import * as XLSX from 'xlsx';

// ============================================================================
// MTO PAGE - Material Take Off
// Gestione completa Spools, Supports, Flanges, Welds con Import Excel
// ============================================================================

export default function MTO() {
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
  
  // UI state
  const [activeTab, setActiveTab] = useState('spools');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIso, setFilterIso] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingType, setEditingType] = useState(null);
  
  // Import state
  const [importFiles, setImportFiles] = useState({});
  const [importDiffs, setImportDiffs] = useState([]);
  const [selectedDiffs, setSelectedDiffs] = useState({});
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
        fetchIsometrics(),
        fetchSpools(),
        fetchSupports(),
        fetchFlanges(),
        fetchWelds(),
        fetchSupportSummary(),
        fetchFlangeMaterialsSummary()
      ]);
    } catch (error) {
      console.error('MTO: Error fetching data:', error);
    } finally {
      setLoading(false);
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
    weldsCompleted: welds.filter(w => w.weld_date).length
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
        if (!s.full_spool_no.toLowerCase().includes(search) &&
            !s.spool_no.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [spools, filterIso, filterStatus, searchTerm]);

  const filteredSupports = useMemo(() => {
    return supports.filter(s => {
      if (filterIso !== 'all' && s.iso_number !== filterIso) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!s.support_tag_no.toLowerCase().includes(search) &&
            !s.support_mark.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [supports, filterIso, searchTerm]);

  const filteredFlanges = useMemo(() => {
    return flanges.filter(f => {
      if (filterIso !== 'all' && f.iso_number !== filterIso) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!f.flange_tag.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [flanges, filterIso, searchTerm]);

  const filteredWelds = useMemo(() => {
    return welds.filter(w => {
      if (filterIso !== 'all' && w.iso_number !== filterIso) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!w.full_weld_no.toLowerCase().includes(search) &&
            !w.weld_no.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [welds, filterIso, searchTerm]);

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
      // Analyze Spools
      if (importFiles.spools) {
        const newData = await parseExcelFile(importFiles.spools);
        const spoolDiffs = compareData('spools', spools, newData, 'full_spool_no', 'Full_Spool_No');
        diffs.push(...spoolDiffs);
      }
      
      // Analyze Supports
      if (importFiles.supports) {
        const newData = await parseExcelFile(importFiles.supports);
        const supportDiffs = compareData('supports', supports, newData, 'support_tag_no', 'Support_Tag_No');
        diffs.push(...supportDiffs);
      }
      
      // Analyze Flanges
      if (importFiles.flanges) {
        const newData = await parseExcelFile(importFiles.flanges);
        const flangeDiffs = compareData('flanges', flanges, newData, 'flange_tag', 'Flange_Tag');
        diffs.push(...flangeDiffs);
      }
      
      // Analyze Welds
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
    
    // Find new and modified records
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
        // Check for modifications
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
    
    // Find deleted records
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
      
      // Normalize values for comparison
      const oldNorm = normalizeValue(oldVal);
      const newNorm = normalizeValue(newVal);
      
      if (oldNorm !== newNorm) {
        changes.push({
          field: dbField,
          old: oldVal ?? '(vuoto)',
          new: newVal ?? '(vuoto)'
        });
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
          { dbField: 'diameter_inch', excelField: 'Spool_diameter' }
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
          { dbField: 'bolt_qty', excelField: 'Bolt_Qty' }
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
      
      // Log import
      await logImport(selectedList);
      
      // Refresh data
      await fetchAllData();
      
      setShowDiffModal(false);
      setImportDiffs([]);
      setImportFiles({});
      alert(`Import completato! ${selectedList.length} modifiche applicate.`);
    } catch (error) {
      console.error('Apply diffs error:', error);
      alert('Errore applicazione modifiche: ' + error.message);
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
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  };

  const getTableName = (entity) => {
    const tables = {
      spools: 'mto_spools',
      supports: 'mto_supports',
      flanges: 'mto_flanged_joints',
      welds: 'mto_welds'
    };
    return tables[entity];
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
          weight_kg: parseFloat(data.Spool_Weight) || null,
          length_m: parseFloat(data.Spool_Length) || null,
          shipment_date: parseExcelDate(data.SHIPMENT_DATE),
          ir_number: data.IR_Number,
          ir_date: parseExcelDate(data.IR_Number_Date),
          laydown_arrival: parseExcelDate(data.LAYDOWN_ARRIVAL),
          to_site: parseExcelDate(data.TO_SITE),
          erected: parseExcelDate(data.ERECTED),
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
          insulation_code: data.Insulation_Code,
          insulation_qty: parseFloat(data.Insulation_Qty) || null,
          insulation_alt_code: data.Insulation_Alt_Code,
          insulation_alt_qty: parseFloat(data.Insulation_Alt_Qty) || null,
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

  const parseExcelDate = (value) => {
    if (!value) return null;
    if (typeof value === 'number') {
      // Excel serial date
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date)) return date.toISOString().split('T')[0];
    }
    return null;
  };

  const logImport = async (appliedDiffs) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const stats = {
      spools: { new: 0, updated: 0, deleted: 0 },
      supports: { new: 0, updated: 0, deleted: 0 },
      flanges: { new: 0, updated: 0, deleted: 0 },
      welds: { new: 0, updated: 0, deleted: 0 }
    };
    
    appliedDiffs.forEach(diff => {
      if (diff.type === 'new') stats[diff.entity].new++;
      if (diff.type === 'modified') stats[diff.entity].updated++;
      if (diff.type === 'deleted') stats[diff.entity].deleted++;
    });
    
    for (const [type, s] of Object.entries(stats)) {
      if (s.new > 0 || s.updated > 0 || s.deleted > 0) {
        await supabase.from('mto_import_log').insert({
          project_id: activeProject.id,
          import_type: type,
          file_name: importFiles[type]?.name,
          records_new: s.new,
          records_updated: s.updated,
          records_deleted: s.deleted,
          imported_by: user?.id,
          imported_by_name: user?.email
        });
      }
    }
  };

  // ============================================================================
  // EXPORT TEMPLATE
  // ============================================================================

  const exportTemplate = (type) => {
    const templates = {
      spools: {
        columns: ['Spool_ID', 'Full_Spool_No', 'ISO_Number', 'Iso_Rev_No', 'Spool_No', 'Service_class', 'Service_Cat', 'Spool_diameter', 'Spool_Weight', 'Spool_Length', 'SHIPMENT_DATE', 'IR_Number', 'IR_Number_Date', 'LAYDOWN_ARRIVAL', 'TO_SITE', 'ERECTED', 'Week_Plan'],
        example: { Spool_ID: 1, Full_Spool_No: 'PRJ-ISO001-SP001', ISO_Number: 'PRJ-ISO001', Spool_No: 'SP001', Spool_diameter: 4, Spool_Weight: 25.5, Spool_Length: 2.5 }
      },
      supports: {
        columns: ['Support_ID', 'Support_Tag_No', 'ISO_Number', 'FullTagNo', 'Support_Name', 'Support_Mark', 'Full_Spool_No', 'Weight', 'IR_Number', 'IR_Number_Date', 'Delivered to Site', 'Delivered to', 'Assembly_Date', 'Week_Plan'],
        example: { Support_ID: 1, Support_Tag_No: 'SUP-001', ISO_Number: 'PRJ-ISO001', Support_Mark: 'MG02-B', Full_Spool_No: 'PRJ-ISO001-SP001', Weight: 5.5 }
      },
      flanges: {
        columns: ['Flange_ID', 'Flange_Tag', 'ISO_Number', 'Flange_Type', 'First_Part_Code', 'Second_Part_Code', 'Flange_Diameter', 'Pressure_Rating', 'Critical_Flange', 'Gasket_Code', 'Gasket_Qty', 'Bolt_Code', 'Bolt_Qty', 'Insulation_Code', 'Insulation_Qty', 'Insulation_Alt_Code', 'Insulation_Alt_Qty', 'IR_Number', 'IR_Number_Date', 'Delivered to Site', 'Delivered to', 'Assembly_Date', 'Week_Plan'],
        example: { Flange_ID: 1, Flange_Tag: 'HF100001', ISO_Number: 'PRJ-ISO001', Flange_Type: 'SP', First_Part_Code: 'PRJ-ISO001-SP001', Second_Part_Code: 'PRJ-ISO001-SP002', Flange_Diameter: 4, Pressure_Rating: '150#', Gasket_Code: 'GSK001', Gasket_Qty: 1, Bolt_Code: 'BLT001', Bolt_Qty: 8 }
      },
      welds: {
        columns: ['Full_Weld_No', 'Weld_No', 'ISO_Number', 'First_Material_Code', 'Second_Material_Code', 'Full_First_Spool', 'Full_Second_Spool', 'Weld_Type', 'Weld_Cat', 'Dia_Inch', 'Thickness', 'Dissimilar Joint', 'Fitup_Date', 'Weld_Date', 'Week_Plan'],
        example: { Full_Weld_No: 'PRJ-ISO001-W001', Weld_No: 'W001', ISO_Number: 'PRJ-ISO001', First_Material_Code: 'LTCS', Second_Material_Code: 'LTCS', Full_First_Spool: 'PRJ-ISO001-SP001', Full_Second_Spool: 'PRJ-ISO001-SP002', Weld_Type: 'BW', Dia_Inch: 4, Thickness: 6.02 }
      }
    };
    
    const template = templates[type];
    if (!template) return;
    
    const ws = XLSX.utils.json_to_sheet([template.example], { header: template.columns });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type.charAt(0).toUpperCase() + type.slice(1));
    XLSX.writeFile(wb, `MTO_Template_${type}.xlsx`);
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
      alert('Errore aggiornamento: ' + error.message);
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
      alert('Errore aggiornamento: ' + error.message);
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
      alert('Errore aggiornamento: ' + error.message);
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
      alert('Errore aggiornamento: ' + error.message);
    } else {
      fetchWelds();
      setEditingItem(null);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              📋 MTO - Material Take Off
            </h1>
            <p className="text-gray-500 mt-1">
              {activeProject?.name} • Database materiali e tracking
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
            >
              📥 Importa Excel
            </button>
            <div className="relative group">
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium">
                📤 Esporta Template ▼
              </button>
              <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg hidden group-hover:block z-10">
                <button onClick={() => exportTemplate('spools')} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">📦 Spools Template</button>
                <button onClick={() => exportTemplate('supports')} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">🔩 Supports Template</button>
                <button onClick={() => exportTemplate('flanges')} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">⚙️ Flanges Template</button>
                <button onClick={() => exportTemplate('welds')} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">🔥 Welds Template</button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <StatCard icon="📐" bg="bg-blue-50" border="border-blue-200" value={stats.isometrics} label="Isometrici" />
          <StatCard icon="📦" bg="bg-purple-50" border="border-purple-200" value={stats.spools} label="Spools" sub={`${stats.spoolsErected} eretti`} />
          <StatCard icon="🔩" bg="bg-gray-50" border="border-gray-200" value={stats.supports} label="Supports" />
          <StatCard icon="⚙️" bg="bg-amber-50" border="border-amber-200" value={stats.flanges} label="Flanges" />
          <StatCard icon="🔥" bg="bg-orange-50" border="border-orange-200" value={stats.welds} label="Welds" sub={`${stats.weldsCompleted} completati`} />
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
                activeTab === tab.id 
                  ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 px-2 py-0.5 bg-gray-200 rounded-full text-xs">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        {activeTab !== 'summary' && (
          <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select 
              value={filterIso} 
              onChange={(e) => setFilterIso(e.target.value)} 
              className="px-3 py-2 border rounded-lg"
            >
              <option value="all">Tutti gli ISO</option>
              {isometrics.map(iso => (
                <option key={iso.id} value={iso.iso_number}>{iso.iso_number}</option>
              ))}
            </select>
            {activeTab === 'spools' && (
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)} 
                className="px-3 py-2 border rounded-lg"
              >
                <option value="all">Tutti gli stati</option>
                <option value="in_production">In Produzione</option>
                <option value="shipped">Spedito</option>
                <option value="ir_issued">IR Emesso</option>
                <option value="at_laydown">Laydown</option>
                <option value="at_site">Al Sito</option>
                <option value="erected">Eretto</option>
              </select>
            )}
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'spools' && (
            <SpoolsTable 
              spools={filteredSpools} 
              onEdit={(item) => { setEditingItem(item); setEditingType('spool'); }}
            />
          )}
          {activeTab === 'supports' && (
            <SupportsTable 
              supports={filteredSupports}
              onEdit={(item) => { setEditingItem(item); setEditingType('support'); }}
            />
          )}
          {activeTab === 'flanges' && (
            <FlangesTable 
              flanges={filteredFlanges}
              onEdit={(item) => { setEditingItem(item); setEditingType('flange'); }}
            />
          )}
          {activeTab === 'welds' && (
            <WeldsTable 
              welds={filteredWelds}
              onEdit={(item) => { setEditingItem(item); setEditingType('weld'); }}
            />
          )}
          {activeTab === 'summary' && (
            <MaterialsSummary 
              supportSummary={supportSummary}
              flangeMaterialsSummary={flangeMaterialsSummary}
              onUpdateInventory={handleUpdateInventory}
            />
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          importFiles={importFiles}
          onFileSelect={handleFileSelect}
          onAnalyze={analyzeImport}
          onClose={() => setShowImportModal(false)}
          importing={importing}
        />
      )}

      {/* Diff Modal */}
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

      {/* Edit Modal */}
      {editingItem && (
        <EditModal
          item={editingItem}
          type={editingType}
          onSave={(updates) => {
            if (editingType === 'spool') handleUpdateSpool(editingItem.id, updates);
            else if (editingType === 'support') handleUpdateSupport(editingItem.id, updates);
            else if (editingType === 'flange') handleUpdateFlange(editingItem.id, updates);
            else if (editingType === 'weld') handleUpdateWeld(editingItem.id, updates);
          }}
          onClose={() => setEditingItem(null)}
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

const SpoolStatusBadge = ({ status }) => {
  const configs = {
    in_production: { label: 'In Produzione', color: 'bg-gray-100 text-gray-600' },
    shipped: { label: 'Spedito', color: 'bg-purple-100 text-purple-700' },
    ir_issued: { label: 'IR Emesso', color: 'bg-amber-100 text-amber-700' },
    at_laydown: { label: 'Laydown', color: 'bg-cyan-100 text-cyan-700' },
    at_site: { label: 'Al Sito', color: 'bg-blue-100 text-blue-700' },
    erected: { label: 'Eretto', color: 'bg-emerald-100 text-emerald-700' }
  };
  const config = configs[status] || configs.in_production;
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>{config.label}</span>;
};

// Spools Table
const SpoolsTable = ({ spools, onEdit }) => (
  <div className="overflow-x-auto border rounded-lg">
    <table className="w-full text-sm">
      <thead className="bg-gray-100">
        <tr>
          <th className="text-left p-3 font-medium">Spool</th>
          <th className="text-left p-3 font-medium">ISO</th>
          <th className="text-center p-3 font-medium">Ø</th>
          <th className="text-center p-3 font-medium">Peso</th>
          <th className="text-center p-3 font-medium">Stato</th>
          <th className="text-center p-3 font-medium">Shipment</th>
          <th className="text-center p-3 font-medium">IR</th>
          <th className="text-center p-3 font-medium">Laydown</th>
          <th className="text-center p-3 font-medium">To Site</th>
          <th className="text-center p-3 font-medium">Erected</th>
          <th className="text-center p-3 font-medium">Azioni</th>
        </tr>
      </thead>
      <tbody>
        {spools.length === 0 ? (
          <tr><td colSpan={11} className="p-8 text-center text-gray-400">Nessuno spool trovato</td></tr>
        ) : spools.map(spool => (
          <tr key={spool.id} className="border-t hover:bg-gray-50">
            <td className="p-3">
              <div className="font-mono font-medium text-blue-600">{spool.spool_no}</div>
              <div className="text-xs text-gray-400 truncate max-w-[150px]">{spool.full_spool_no}</div>
            </td>
            <td className="p-3 text-xs text-gray-600">{spool.iso_number}</td>
            <td className="p-3 text-center">{spool.diameter_inch}"</td>
            <td className="p-3 text-center">{spool.weight_kg?.toFixed(1)} kg</td>
            <td className="p-3 text-center"><SpoolStatusBadge status={spool.site_status} /></td>
            <td className="p-3 text-center text-xs">{spool.shipment_date ? <span className="text-green-600">✓</span> : '—'}</td>
            <td className="p-3 text-center text-xs">{spool.ir_number ? <span className="text-green-600">✓</span> : '—'}</td>
            <td className="p-3 text-center text-xs">{spool.laydown_arrival ? <span className="text-green-600">✓</span> : '—'}</td>
            <td className="p-3 text-center text-xs">{spool.to_site ? <span className="text-green-600">✓</span> : '—'}</td>
            <td className="p-3 text-center text-xs">{spool.erected ? <span className="text-green-600">✓</span> : '—'}</td>
            <td className="p-3 text-center">
              <button onClick={() => onEdit(spool)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600">✏️</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Supports Table
const SupportsTable = ({ supports, onEdit }) => (
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
            <td className="p-3 text-center text-xs">{sup.ir_number ? <span className="text-green-600">✓</span> : '—'}</td>
            <td className="p-3 text-center text-xs">{sup.delivered_to_site ? <span className="text-green-600">✓</span> : '—'}</td>
            <td className="p-3 text-center text-xs">{sup.assembly_date ? <span className="text-green-600">✓</span> : '—'}</td>
            <td className="p-3 text-center">
              <button onClick={() => onEdit(sup)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600">✏️</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Flanges Table
const FlangesTable = ({ flanges, onEdit }) => (
  <div className="overflow-x-auto border rounded-lg">
    <table className="w-full text-sm">
      <thead className="bg-gray-100">
        <tr>
          <th className="text-left p-3 font-medium">Tag</th>
          <th className="text-left p-3 font-medium">ISO</th>
          <th className="text-center p-3 font-medium">Type</th>
          <th className="text-center p-3 font-medium">Parts</th>
          <th className="text-center p-3 font-medium">Ø / Rating</th>
          <th className="text-center p-3 font-medium">Gasket</th>
          <th className="text-center p-3 font-medium">Bolts</th>
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
            <td className="p-3 text-center text-xs">
              <span className="text-blue-600">{fl.first_part_code?.split('-').pop()}</span>
              <span className="text-gray-400 mx-1">↔</span>
              <span className="text-blue-600">{fl.second_part_code?.split('-').pop()}</span>
            </td>
            <td className="p-3 text-center text-xs">{fl.diameter_inch}" / {fl.pressure_rating}</td>
            <td className="p-3 text-center text-xs font-mono">{fl.gasket_code}</td>
            <td className="p-3 text-center text-xs"><span className="font-mono">{fl.bolt_code}</span> <span className="text-gray-400">×{fl.bolt_qty}</span></td>
            <td className="p-3 text-center text-xs">{fl.delivered_to_site ? <span className="text-green-600">✓</span> : '—'}</td>
            <td className="p-3 text-center text-xs">{fl.assembly_date ? <span className="text-green-600">✓</span> : '—'}</td>
            <td className="p-3 text-center">
              <button onClick={() => onEdit(fl)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600">✏️</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Welds Table
const WeldsTable = ({ welds, onEdit }) => (
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
                <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded text-xs font-medium">⚠️ SI</span>
              ) : '—'}
            </td>
            <td className="p-3 text-center text-xs">{w.fitup_date ? <span className="text-green-600">✓</span> : '—'}</td>
            <td className="p-3 text-center text-xs">{w.weld_date ? <span className="text-green-600">✓</span> : '—'}</td>
            <td className="p-3 text-center">
              <button onClick={() => onEdit(w)} className="p-1.5 hover:bg-blue-100 rounded text-blue-600">✏️</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Materials Summary
const MaterialsSummary = ({ supportSummary, flangeMaterialsSummary, onUpdateInventory }) => (
  <div className="space-y-6">
    {/* Support Summary */}
    <div className="bg-gray-50 rounded-xl p-5 border">
      <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
        🔩 Riepilogo Supports per Mark
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white">
            <tr>
              <th className="text-left p-3 font-medium border">Support Mark</th>
              <th className="text-center p-3 font-medium border bg-blue-50">Qty Necessaria</th>
              <th className="text-center p-3 font-medium border bg-green-50">Qty Magazzino</th>
              <th className="text-center p-3 font-medium border bg-amber-50">Qty Consegnate</th>
              <th className="text-center p-3 font-medium border">Disponibilità</th>
            </tr>
          </thead>
          <tbody>
            {supportSummary.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-gray-400">Nessun dato</td></tr>
            ) : supportSummary.map((item, idx) => {
              const available = item.qty_warehouse - item.qty_delivered;
              const remaining = item.qty_necessary - item.qty_delivered;
              const isOk = available >= remaining;
              return (
                <tr key={idx} className="border-t">
                  <td className="p-3 border font-mono font-medium">{item.support_mark}</td>
                  <td className="p-3 border text-center font-bold text-blue-700">{item.qty_necessary}</td>
                  <td className="p-3 border text-center">
                    <input
                      type="number"
                      defaultValue={item.qty_warehouse}
                      onBlur={(e) => onUpdateInventory('support', item.support_mark, e.target.value)}
                      className="w-20 text-center border rounded px-2 py-1"
                    />
                  </td>
                  <td className="p-3 border text-center text-amber-700">{item.qty_delivered}</td>
                  <td className="p-3 border text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${isOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {isOk ? `✓ OK` : `⚠️ -${remaining - available}`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {/* Flange Materials Summary */}
    <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
      <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
        ⚙️ Riepilogo Materiali Flange
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white">
            <tr>
              <th className="text-left p-3 font-medium border">Codice</th>
              <th className="text-center p-3 font-medium border">Tipo</th>
              <th className="text-center p-3 font-medium border bg-blue-50">Qty Necessaria</th>
              <th className="text-center p-3 font-medium border bg-green-50">Qty Magazzino</th>
              <th className="text-center p-3 font-medium border bg-amber-50">Qty Consegnate</th>
              <th className="text-center p-3 font-medium border">Disponibilità</th>
            </tr>
          </thead>
          <tbody>
            {flangeMaterialsSummary.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-gray-400">Nessun dato</td></tr>
            ) : flangeMaterialsSummary.map((item, idx) => {
              const available = item.qty_warehouse - item.qty_delivered;
              const remaining = item.qty_necessary - item.qty_delivered;
              const isOk = available >= remaining;
              const typeColor = item.material_type === 'gasket' ? 'bg-purple-100 text-purple-700' :
                               item.material_type === 'bolt' ? 'bg-gray-100 text-gray-700' : 'bg-cyan-100 text-cyan-700';
              return (
                <tr key={idx} className="border-t">
                  <td className="p-3 border font-mono font-medium">{item.material_code}</td>
                  <td className="p-3 border text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${typeColor}`}>
                      {item.material_type === 'gasket' ? 'Gasket' : item.material_type === 'bolt' ? 'Bolt' : 'Insulation'}
                    </span>
                  </td>
                  <td className="p-3 border text-center font-bold text-blue-700">{item.qty_necessary}</td>
                  <td className="p-3 border text-center">
                    <input
                      type="number"
                      defaultValue={item.qty_warehouse}
                      onBlur={(e) => onUpdateInventory('flange', { code: item.material_code, type: item.material_type }, e.target.value)}
                      className="w-20 text-center border rounded px-2 py-1"
                    />
                  </td>
                  <td className="p-3 border text-center text-amber-700">{item.qty_delivered}</td>
                  <td className="p-3 border text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${isOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {isOk ? '✓ OK' : `⚠️ -${remaining - available}`}
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
          <p className="text-sm text-gray-500 mt-1">Seleziona i file da importare (4 file separati)</p>
        </div>
        <div className="p-6 space-y-4">
          {fileTypes.map(({ key, label, icon }) => (
            <div 
              key={key}
              className={`flex items-center gap-4 p-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                importFiles[key] ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl">{icon}</div>
              <div className="flex-1">
                <p className="font-medium text-gray-700">{label}</p>
                <p className="text-xs text-gray-400">
                  {importFiles[key] ? importFiles[key].name : 'Clicca per selezionare'}
                </p>
              </div>
              <label className="cursor-pointer">
                {importFiles[key] ? (
                  <span className="text-green-600 text-xl">✓</span>
                ) : (
                  <span className="text-gray-300 text-xl">📎</span>
                )}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => e.target.files[0] && onFileSelect(key, e.target.files[0])}
                />
              </label>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button
            onClick={onAnalyze}
            disabled={Object.keys(importFiles).length === 0 || importing}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
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
          <p className="text-center text-gray-500 py-8">Nessuna differenza rilevata. I dati sono già aggiornati.</p>
        ) : (
          <div className="space-y-3">
            {diffs.map((diff, idx) => (
              <label
                key={idx}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  selectedDiffs[idx] ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDiffs[idx] || false}
                  onChange={(e) => setSelectedDiffs({ ...selectedDiffs, [idx]: e.target.checked })}
                  className="mt-1 w-5 h-5 text-blue-600 rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      diff.type === 'new' ? 'bg-green-100 text-green-700' :
                      diff.type === 'modified' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
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
        <button
          onClick={() => {
            const all = {};
            diffs.forEach((_, idx) => all[idx] = true);
            setSelectedDiffs(all);
          }}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ✓ Seleziona Tutti
        </button>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button
            onClick={onApply}
            disabled={Object.values(selectedDiffs).filter(Boolean).length === 0 || importing}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {importing ? 'Applicazione...' : `✓ Applica (${Object.values(selectedDiffs).filter(Boolean).length})`}
          </button>
        </div>
      </div>
    </div>
  </div>
);

// Edit Modal (simplified - would need expansion for each type)
const EditModal = ({ item, type, onSave, onClose }) => {
  const [formData, setFormData] = useState({ ...item });

  const handleSave = () => {
    const updates = {};
    
    if (type === 'spool') {
      updates.shipment_date = formData.shipment_date || null;
      updates.ir_number = formData.ir_number || null;
      updates.ir_date = formData.ir_date || null;
      updates.laydown_arrival = formData.laydown_arrival || null;
      updates.to_site = formData.to_site || null;
      updates.erected = formData.erected || null;
    } else if (type === 'support') {
      updates.ir_number = formData.ir_number || null;
      updates.ir_date = formData.ir_date || null;
      updates.delivered_to_site = formData.delivered_to_site || null;
      updates.delivered_to = formData.delivered_to || null;
      updates.assembly_date = formData.assembly_date || null;
    } else if (type === 'flange') {
      updates.ir_number = formData.ir_number || null;
      updates.delivered_to_site = formData.delivered_to_site || null;
      updates.assembly_date = formData.assembly_date || null;
    } else if (type === 'weld') {
      updates.fitup_date = formData.fitup_date || null;
      updates.weld_date = formData.weld_date || null;
    }
    
    onSave(updates);
  };

  const titles = {
    spool: `📦 Modifica Spool: ${item.spool_no}`,
    support: `🔩 Modifica Support: ${item.support_tag_no}`,
    flange: `⚙️ Modifica Flange: ${item.flange_tag}`,
    weld: `🔥 Modifica Weld: ${item.weld_no}`
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-800">{titles[type]}</h2>
        </div>
        <div className="p-6 space-y-4">
          {type === 'spool' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shipment Date</label>
                  <input type="date" value={formData.shipment_date || ''} onChange={e => setFormData({...formData, shipment_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IR Number</label>
                  <input type="text" value={formData.ir_number || ''} onChange={e => setFormData({...formData, ir_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Laydown Arrival</label>
                  <input type="date" value={formData.laydown_arrival || ''} onChange={e => setFormData({...formData, laydown_arrival: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Site</label>
                  <input type="date" value={formData.to_site || ''} onChange={e => setFormData({...formData, to_site: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Erected</label>
                <input type="date" value={formData.erected || ''} onChange={e => setFormData({...formData, erected: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </>
          )}
          {type === 'support' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IR Number</label>
                  <input type="text" value={formData.ir_number || ''} onChange={e => setFormData({...formData, ir_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivered to Site</label>
                  <input type="date" value={formData.delivered_to_site || ''} onChange={e => setFormData({...formData, delivered_to_site: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assembly Date</label>
                <input type="date" value={formData.assembly_date || ''} onChange={e => setFormData({...formData, assembly_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </>
          )}
          {type === 'flange' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IR Number</label>
                  <input type="text" value={formData.ir_number || ''} onChange={e => setFormData({...formData, ir_number: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivered to Site</label>
                  <input type="date" value={formData.delivered_to_site || ''} onChange={e => setFormData({...formData, delivered_to_site: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assembly Date</label>
                <input type="date" value={formData.assembly_date || ''} onChange={e => setFormData({...formData, assembly_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </>
          )}
          {type === 'weld' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fitup Date</label>
                <input type="date" value={formData.fitup_date || ''} onChange={e => setFormData({...formData, fitup_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weld Date</label>
                <input type="date" value={formData.weld_date || ''} onChange={e => setFormData({...formData, weld_date: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">✓ Salva</button>
        </div>
      </div>
    </div>
  );
};
