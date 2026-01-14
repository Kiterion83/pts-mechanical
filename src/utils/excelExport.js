import * as XLSX from 'xlsx';

// ============================================================================
// EXCEL EXPORT UTILITIES
// ============================================================================

/**
 * Utility per creare e scaricare file Excel
 */
const downloadExcel = (workbook, filename) => {
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Formatta data per Excel
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT');
};

// ============================================================================
// EXPORT SQUADRE
// ============================================================================

/**
 * Esporta squadre con membri e equipment in Excel multi-sheet
 * @param {Array} squads - Lista squadre
 * @param {Array} members - Lista membri squadre
 * @param {Array} equipment - Lista equipment assegnati
 * @param {Array} personnel - Lista personale
 */
export const exportSquadsToExcel = (squads, members = [], equipment = [], personnel = []) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Riepilogo Squadre
  const squadSummary = squads.map(sq => {
    const sqMembers = members.filter(m => m.squad_id === sq.id);
    const sqEquipment = equipment.filter(e => e.squad_id === sq.id);
    
    // Conta per ruolo
    const supervisors = sqMembers.filter(m => {
      const p = personnel.find(p => p.id === m.personnel_id);
      return p?.role === 'supervisor';
    }).length;
    const foremen = sqMembers.filter(m => {
      const p = personnel.find(p => p.id === m.personnel_id);
      return p?.role === 'foreman';
    }).length;
    const operators = sqMembers.filter(m => {
      const p = personnel.find(p => p.id === m.personnel_id);
      return p?.role === 'operator';
    }).length;
    const helpers = sqMembers.filter(m => {
      const p = personnel.find(p => p.id === m.personnel_id);
      return p?.role === 'helper';
    }).length;

    return {
      'Squadra N°': sq.squad_number,
      'Nome': sq.name,
      'Tipo': sq.squad_type === 'direct' ? 'Diretta' : 'Indiretta',
      'Specializzazione': sq.specialization || '-',
      'Stato': sq.is_active ? 'Attiva' : 'Inattiva',
      'Totale Membri': sqMembers.length,
      'Supervisors': supervisors,
      'Foremen': foremen,
      'Operatori': operators,
      'Helpers': helpers,
      'Equipment': sqEquipment.length,
      'Note': sq.notes || ''
    };
  });

  const ws1 = XLSX.utils.json_to_sheet(squadSummary);
  XLSX.utils.book_append_sheet(wb, ws1, 'Riepilogo Squadre');

  // Sheet 2: Dettaglio Membri
  const memberDetails = [];
  squads.forEach(sq => {
    const sqMembers = members.filter(m => m.squad_id === sq.id);
    sqMembers.forEach(m => {
      const p = personnel.find(p => p.id === m.personnel_id);
      memberDetails.push({
        'Squadra': `Sq. ${sq.squad_number} - ${sq.name}`,
        'Matricola': p?.badge_number || '-',
        'Nome': p?.first_name || '-',
        'Cognome': p?.last_name || '-',
        'Ruolo': m.role_in_squad || p?.role || '-',
        'È Leader': m.is_squad_leader ? 'Sì' : 'No',
        'Azienda': p?.company || '-',
        'Data Inizio': formatDate(m.start_date),
        'Data Fine': formatDate(m.end_date)
      });
    });
  });

  if (memberDetails.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(memberDetails);
    XLSX.utils.book_append_sheet(wb, ws2, 'Membri');
  }

  // Sheet 3: Equipment Assegnati
  const equipmentDetails = [];
  squads.forEach(sq => {
    const sqEquipment = equipment.filter(e => e.squad_id === sq.id);
    sqEquipment.forEach(e => {
      equipmentDetails.push({
        'Squadra': `Sq. ${sq.squad_number} - ${sq.name}`,
        'Codice': e.code || '-',
        'Tipo': e.equipment_type || '-',
        'Descrizione': e.description || '-',
        'Ore Stimate': e.estimated_hours || '-',
        'Data Inizio': formatDate(e.start_date),
        'Data Fine': formatDate(e.end_date)
      });
    });
  });

  if (equipmentDetails.length > 0) {
    const ws3 = XLSX.utils.json_to_sheet(equipmentDetails);
    XLSX.utils.book_append_sheet(wb, ws3, 'Equipment');
  }

  // Download
  const today = new Date().toISOString().split('T')[0];
  downloadExcel(wb, `Squadre_${today}.xlsx`);
};

// ============================================================================
// EXPORT EQUIPMENT
// ============================================================================

/**
 * Esporta equipment in Excel
 * @param {Array} equipment - Lista equipment
 * @param {Array} types - Tipi equipment
 * @param {Array} assignments - Assegnazioni
 */
export const exportEquipmentToExcel = (equipment, types = [], assignments = []) => {
  const wb = XLSX.utils.book_new();

  const data = equipment.map(eq => {
    const type = types.find(t => t.id === eq.type_id);
    const eqAssignments = assignments.filter(a => a.equipment_id === eq.id);
    
    return {
      'Codice': eq.code,
      'Tipo': type?.name || eq.equipment_type || '-',
      'Descrizione': eq.description || '-',
      'Seriale': eq.serial_number || '-',
      'Stato': eq.status || '-',
      'Condizione': eq.condition || '-',
      'Assegnazioni': eqAssignments.length,
      'Data Acquisto': formatDate(eq.purchase_date),
      'Scadenza Certificato': formatDate(eq.certification_expiry),
      'Note': eq.notes || ''
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Equipment');

  const today = new Date().toISOString().split('T')[0];
  downloadExcel(wb, `Equipment_${today}.xlsx`);
};

// ============================================================================
// EXPORT WORK PACKAGES
// ============================================================================

/**
 * Esporta Work Packages in Excel
 * @param {Array} workPackages - Lista WP
 * @param {Array} squads - Lista squadre
 * @param {Function} calculateProgress - Funzione calcolo progress
 */
export const exportWorkPackagesToExcel = (workPackages, squads = [], calculateProgress = () => 0) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Riepilogo WP
  const wpSummary = workPackages.map(wp => {
    const squad = squads.find(s => s.id === wp.squad_id);
    const progress = calculateProgress(wp);
    
    return {
      'Codice': wp.code,
      'Tipo': wp.wp_type === 'piping' ? 'Piping' : 'Action',
      'Descrizione': wp.description,
      'Area': wp.area || '-',
      'Squadra': squad ? `Sq. ${squad.squad_number} - ${squad.name}` : 'Non assegnato',
      'Stato': wp.status,
      'Progress %': progress.toFixed(1),
      'Inizio Pianificato': formatDate(wp.planned_start),
      'Fine Pianificata': formatDate(wp.planned_end),
      'Inizio Effettivo': formatDate(wp.actual_start),
      'Fine Effettiva': formatDate(wp.actual_end),
      'Note': wp.notes || ''
    };
  });

  const ws1 = XLSX.utils.json_to_sheet(wpSummary);
  XLSX.utils.book_append_sheet(wb, ws1, 'Work Packages');

  // Sheet 2: WP Piping con dettaglio
  const wpPiping = workPackages.filter(wp => wp.wp_type === 'piping');
  if (wpPiping.length > 0) {
    const pipingDetails = wpPiping.map(wp => {
      const activities = wp.activities || [];
      const welding = activities.filter(a => a.category === 'welding');
      const support = activities.filter(a => a.category === 'support');
      const flange = activities.filter(a => a.category === 'flange');
      
      return {
        'Codice': wp.code,
        'Descrizione': wp.description,
        'Spool Totali': wp.wp_spools?.length || 0,
        'Saldature Totali': welding.reduce((s, a) => s + Number(a.quantity_total || 0), 0),
        'Saldature Completate': welding.reduce((s, a) => s + Number(a.quantity_completed || 0), 0),
        'Supporti kg Totali': support.reduce((s, a) => s + Number(a.quantity_total || 0), 0).toFixed(1),
        'Supporti kg Completati': support.reduce((s, a) => s + Number(a.quantity_completed || 0), 0).toFixed(1),
        'Flange Totali': flange.reduce((s, a) => s + Number(a.quantity_total || 0), 0),
        'Flange Completate': flange.reduce((s, a) => s + Number(a.quantity_completed || 0), 0)
      };
    });

    const ws2 = XLSX.utils.json_to_sheet(pipingDetails);
    XLSX.utils.book_append_sheet(wb, ws2, 'WP Piping Dettaglio');
  }

  // Sheet 3: WP Action
  const wpAction = workPackages.filter(wp => wp.wp_type === 'action');
  if (wpAction.length > 0) {
    const actionDetails = wpAction.map(wp => ({
      'Codice': wp.code,
      'Descrizione': wp.description,
      'Progress Manuale %': wp.manual_progress || 0,
      'Note': wp.notes || ''
    }));

    const ws3 = XLSX.utils.json_to_sheet(actionDetails);
    XLSX.utils.book_append_sheet(wb, ws3, 'WP Action');
  }

  const today = new Date().toISOString().split('T')[0];
  downloadExcel(wb, `WorkPackages_${today}.xlsx`);
};

// ============================================================================
// EXPORT PERSONNEL
// ============================================================================

/**
 * Esporta personale in Excel
 * @param {Array} personnel - Lista personale
 */
export const exportPersonnelToExcel = (personnel) => {
  const wb = XLSX.utils.book_new();

  const data = personnel.map(p => ({
    'Matricola': p.badge_number || '-',
    'Nome': p.first_name,
    'Cognome': p.last_name,
    'Ruolo': p.role || '-',
    'Tipo': p.personnel_type === 'direct' ? 'Diretto' : 'Indiretto',
    'Azienda': p.company || '-',
    'Email': p.email || '-',
    'Telefono': p.phone || '-',
    'Stato': p.status || '-',
    'Data Nascita': formatDate(p.birth_date),
    'Nazionalità': p.nationality || '-',
    'Qualifiche': p.qualifications || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Personale');

  const today = new Date().toISOString().split('T')[0];
  downloadExcel(wb, `Personale_${today}.xlsx`);
};

// ============================================================================
// EXPORT MTO
// ============================================================================

/**
 * Esporta dati MTO in Excel multi-sheet
 */
export const exportMTOToExcel = (isometrics, spools, welds, supports, flanges) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Isometrics
  if (isometrics?.length > 0) {
    const isoData = isometrics.map(iso => ({
      'ISO Number': iso.iso_number,
      'Line Number': iso.line_number || '-',
      'Area': iso.area || '-',
      'Sheet': iso.sheet || '-',
      'Revision': iso.revision || '-',
      'Descrizione': iso.description || '-',
      'Stato': iso.status || '-'
    }));
    const ws1 = XLSX.utils.json_to_sheet(isoData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Isometrici');
  }

  // Sheet 2: Spools
  if (spools?.length > 0) {
    const spoolData = spools.map(sp => ({
      'Spool Number': sp.spool_number,
      'Short Name': sp.short_name || '-',
      'Stato Prefab': sp.prefab_status || '-',
      'Stato Cantiere': sp.site_status || '-',
      'Peso kg': sp.weight_kg || '-'
    }));
    const ws2 = XLSX.utils.json_to_sheet(spoolData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Spool');
  }

  // Sheet 3: Welds
  if (welds?.length > 0) {
    const weldData = welds.map(w => ({
      'Weld Number': w.combined_weld_number || w.weld_number,
      'Tipo': w.weld_type || '-',
      'Categoria': w.weld_category || '-',
      'Spool 1': w.spool_1_number || '-',
      'Spool 2': w.spool_2_number || '-',
      'Diametro inch': w.diameter_inch || '-',
      'Spessore mm': w.thickness_mm || '-',
      'Materiale 1': w.material_1 || '-',
      'Materiale 2': w.material_2 || '-',
      'Dissimile': w.is_dissimilar ? 'Sì' : 'No',
      'Stato': w.status || '-'
    }));
    const ws3 = XLSX.utils.json_to_sheet(weldData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Saldature');
  }

  // Sheet 4: Supports
  if (supports?.length > 0) {
    const suppData = supports.map(s => ({
      'Support Tag': s.support_tag,
      'Spool': s.spool_number || '-',
      'Support Mark': s.support_mark || '-',
      'Tipo': s.support_type || '-',
      'Quantità': s.quantity || 1,
      'Peso Unit. kg': s.weight_kg || '-',
      'Peso Tot. kg': s.total_weight_kg || '-',
      'Stato': s.status || '-'
    }));
    const ws4 = XLSX.utils.json_to_sheet(suppData);
    XLSX.utils.book_append_sheet(wb, ws4, 'Supporti');
  }

  // Sheet 5: Flanges
  if (flanges?.length > 0) {
    const flangeData = flanges.map(f => ({
      'Flange ID': f.flange_id,
      'Tipo': f.flange_type || '-',
      'Descrizione Tipo': f.flange_type_description || '-',
      'Part 1': f.part_1_number || '-',
      'Part 2': f.part_2_number || '-',
      'Gasket Code': f.gasket_code || '-',
      'Gasket Qty': f.gasket_qty || '-',
      'Bolt Code': f.bolt_code || '-',
      'Bolt Qty': f.bolt_qty || '-',
      'Valve Tag': f.valve_tag || '-',
      'Stato': f.status || '-'
    }));
    const ws5 = XLSX.utils.json_to_sheet(flangeData);
    XLSX.utils.book_append_sheet(wb, ws5, 'Flange');
  }

  const today = new Date().toISOString().split('T')[0];
  downloadExcel(wb, `MTO_${today}.xlsx`);
};
