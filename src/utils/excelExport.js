// ============================================================================
// UTILITÀ EXPORT EXCEL
// Usa SheetJS (xlsx) per generare file Excel
// ============================================================================

import * as XLSX from 'xlsx'

/**
 * Esporta dati in formato Excel
 */
export function exportToExcel(data, filename, sheetName = 'Dati', columns = null) {
  if (!columns && data.length > 0) {
    columns = Object.keys(data[0]).map(key => ({ key, header: key }))
  }
  
  const headers = columns.map(c => c.header)
  const rows = data.map(item => columns.map(c => {
    let value = item[c.key]
    if (value === null || value === undefined) return ''
    if (typeof value === 'boolean') return value ? 'Sì' : 'No'
    if (value instanceof Date) return value.toLocaleDateString('it-IT')
    return value
  }))
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  
  const colWidths = columns.map((c, idx) => {
    const maxLength = Math.max(
      c.header.length,
      ...rows.map(row => String(row[idx]).length)
    )
    return { wch: Math.min(maxLength + 2, 50) }
  })
  ws['!cols'] = colWidths
  
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * Esporta Equipment in Excel
 */
export function exportEquipmentToExcel(equipment, equipmentTypes, assignments) {
  const columns = [
    { key: 'category', header: 'Categoria' },
    { key: 'type', header: 'Tipo' },
    { key: 'typeLabel', header: 'Tipo (IT)' },
    { key: 'description', header: 'Descrizione' },
    { key: 'ownership', header: 'Proprietà' },
    { key: 'companyName', header: 'Azienda' },
    { key: 'plateNumber', header: 'Targa' },
    { key: 'serialNumber', header: 'N. Serie' },
    { key: 'status', header: 'Stato' },
    { key: 'squadAssigned', header: 'Squadra Assegnata' }
  ]
  
  const categoryLabels = { vehicle: 'Mezzo', equipment: 'Equipment', tool: 'Attrezzo' }
  const ownershipLabels = { owned: 'Proprietà', rented: 'Noleggio' }
  
  const data = equipment.map(eq => {
    const assignment = assignments ? assignments[eq.id] : null
    return {
      category: categoryLabels[eq.category] || eq.category,
      type: eq.type,
      typeLabel: equipmentTypes[eq.type]?.label || eq.type,
      description: eq.description || '',
      ownership: ownershipLabels[eq.ownership] || eq.ownership,
      companyName: eq.owner_company?.company_name || '',
      plateNumber: eq.plate_number || '',
      serialNumber: eq.serial_number || '',
      status: eq.status === 'assigned' ? 'Assegnato' : eq.status === 'available' ? 'Disponibile' : eq.status,
      squadAssigned: assignment?.squad ? `Sq. ${assignment.squad.squad_number} - ${assignment.squad.name}` : ''
    }
  })
  
  exportToExcel(data, `Equipment_${new Date().toISOString().split('T')[0]}`, 'Equipment', columns)
}

/**
 * Esporta Squadre in Excel
 */
export function exportSquadsToExcel(squads, squadMembers, squadEquipment) {
  const squadColumns = [
    { key: 'squadNumber', header: 'N. Squadra' },
    { key: 'name', header: 'Nome' },
    { key: 'supervisorName', header: 'Supervisor' },
    { key: 'foremanName', header: 'Foreman' },
    { key: 'memberCount', header: 'N. Membri' },
    { key: 'equipmentCount', header: 'N. Mezzi' },
    { key: 'status', header: 'Stato' }
  ]
  
  const squadData = squads.map(s => {
    const members = squadMembers ? squadMembers[s.id] || [] : []
    const equipment = squadEquipment ? squadEquipment[s.id] || [] : []
    return {
      squadNumber: s.squad_number,
      name: s.name || '',
      supervisorName: s.supervisor ? `${s.supervisor.last_name} ${s.supervisor.first_name}` : '',
      foremanName: s.foreman ? `${s.foreman.last_name} ${s.foreman.first_name}` : '',
      memberCount: members.length || s.memberCount || 0,
      equipmentCount: equipment.length || 0,
      status: s.status === 'active' ? 'Attiva' : s.status
    }
  })
  
  const memberColumns = [
    { key: 'squadNumber', header: 'N. Squadra' },
    { key: 'squadName', header: 'Squadra' },
    { key: 'lastName', header: 'Cognome' },
    { key: 'firstName', header: 'Nome' },
    { key: 'position', header: 'Ruolo' },
    { key: 'badgeNumber', header: 'Badge' },
    { key: 'companyName', header: 'Azienda' }
  ]
  
  const memberData = []
  squads.forEach(s => {
    const members = squadMembers ? squadMembers[s.id] || [] : []
    members.forEach(m => {
      memberData.push({
        squadNumber: s.squad_number,
        squadName: s.name || '',
        lastName: m.personnel?.last_name || '',
        firstName: m.personnel?.first_name || '',
        position: m.personnel?.position || '',
        badgeNumber: m.personnel?.badge_number || '',
        companyName: m.personnel?.company?.company_name || ''
      })
    })
  })
  
  const wb = XLSX.utils.book_new()
  
  const wsSquads = XLSX.utils.aoa_to_sheet([
    squadColumns.map(c => c.header),
    ...squadData.map(item => squadColumns.map(c => item[c.key]))
  ])
  XLSX.utils.book_append_sheet(wb, wsSquads, 'Squadre')
  
  if (memberData.length > 0) {
    const wsMembers = XLSX.utils.aoa_to_sheet([
      memberColumns.map(c => c.header),
      ...memberData.map(item => memberColumns.map(c => item[c.key]))
    ])
    XLSX.utils.book_append_sheet(wb, wsMembers, 'Membri')
  }
  
  XLSX.writeFile(wb, `Squadre_${new Date().toISOString().split('T')[0]}.xlsx`)
}

/**
 * Esporta Work Packages in Excel
 */
export function exportWorkPackagesToExcel(workPackages, squads) {
  const columns = [
    { key: 'code', header: 'Codice' },
    { key: 'name', header: 'Nome' },
    { key: 'discipline', header: 'Disciplina' },
    { key: 'area', header: 'Area' },
    { key: 'status', header: 'Stato' },
    { key: 'squadName', header: 'Squadra' },
    { key: 'plannedStart', header: 'Data Inizio' },
    { key: 'plannedEnd', header: 'Data Fine' },
    { key: 'progress', header: '% Avanzamento' },
    { key: 'budgetHours', header: 'Monte Ore' },
    { key: 'hourlyRate', header: 'Tariffa €/h' },
    { key: 'estimatedCost', header: 'Costo Stimato €' }
  ]
  
  const disciplineLabels = {
    piping: 'Piping', civil: 'Civil', mechanical: 'Mechanical',
    electrical: 'Electrical', instrumentation: 'Instrumentation', other: 'Altro'
  }
  
  const statusLabels = {
    draft: 'Bozza', assigned: 'Assegnato', in_progress: 'In Corso',
    completed: 'Completato', on_hold: 'Sospeso'
  }
  
  const data = workPackages.map(wp => {
    const squad = squads.find(s => s.id === wp.squad_id)
    return {
      code: wp.code,
      name: wp.name,
      discipline: disciplineLabels[wp.discipline] || wp.discipline,
      area: wp.area || '',
      status: statusLabels[wp.status] || wp.status,
      squadName: squad ? `Sq. ${squad.squad_number} - ${squad.name}` : '',
      plannedStart: wp.planned_start ? new Date(wp.planned_start).toLocaleDateString('it-IT') : '',
      plannedEnd: wp.planned_end ? new Date(wp.planned_end).toLocaleDateString('it-IT') : '',
      progress: wp.progress ? `${wp.progress.toFixed(1)}%` : '0%',
      budgetHours: wp.budget_hours || '',
      hourlyRate: wp.hourly_rate || '',
      estimatedCost: (wp.budget_hours && wp.hourly_rate) ? (wp.budget_hours * wp.hourly_rate).toFixed(2) : ''
    }
  })
  
  exportToExcel(data, `WorkPackages_${new Date().toISOString().split('T')[0]}`, 'Work Packages', columns)
}
