import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import { 
  Users, Search, Upload, Download, Plus, Filter, ChevronRight,
  Edit, Trash2, X, Check, Save, Mail, Phone, Building2,
  User, AlertTriangle, FileSpreadsheet, CheckCircle2, AlertCircle,
  MinusCircle, Star, ChevronDown, Info
} from 'lucide-react'

// ============================================================================
// CONFIGURAZIONE RUOLI (allineata con database constraint)
// ============================================================================
const ROLE_CONFIG = {
  pm: { label: 'Project Manager', color: 'bg-blue-100 text-blue-800', order: 1 },
  site_manager: { label: 'Site Manager', color: 'bg-indigo-100 text-indigo-800', order: 2 },
  cm: { label: 'Construction Manager', color: 'bg-cyan-100 text-cyan-800', order: 3 },
  pem: { label: 'Project Eng. Manager', color: 'bg-teal-100 text-teal-800', order: 4 },
  engineer: { label: 'Engineer', color: 'bg-emerald-100 text-emerald-800', order: 5 },
  planner: { label: 'Planner', color: 'bg-orange-100 text-orange-800', order: 6 },
  superintendent: { label: 'Superintendent', color: 'bg-purple-100 text-purple-800', order: 7 },
  supervisor: { label: 'Supervisor', color: 'bg-green-100 text-green-800', order: 8 },
  sub_supervisor: { label: 'Sub Supervisor', color: 'bg-lime-100 text-lime-800', order: 9 },
  foreman: { label: 'Foreman', color: 'bg-yellow-100 text-yellow-800', order: 10 },
  operator: { label: 'Operatore', color: 'bg-gray-100 text-gray-800', order: 11 },
  helper: { label: 'Aiutante', color: 'bg-slate-100 text-slate-700', order: 12 },
  storekeeper: { label: 'Magazziniere', color: 'bg-stone-100 text-stone-800', order: 13 },
}

// Ruoli che richiedono badge obbligatorio per subcontractor
const ROLES_REQUIRING_BADGE_SUBCONTRACTOR = ['foreman', 'superintendent', 'supervisor', 'sub_supervisor', 'helper', 'operator', 'storekeeper']

// ============================================================================
// COMPONENTE BADGE RUOLO
// ============================================================================
function RoleBadge({ role, size = 'normal' }) {
  const config = ROLE_CONFIG[role] || { label: role, color: 'bg-gray-100 text-gray-800' }
  const sizeClass = size === 'small' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
  
  return (
    <span className={`${config.color} ${sizeClass} rounded-full font-medium whitespace-nowrap`}>
      {config.label}
    </span>
  )
}

// ============================================================================
// COMPONENTE PRINCIPALE
// ============================================================================
export default function Personnel() {
  const { t } = useTranslation()
  const { activeProject } = useProject()
  
  // State principale
  const [personnel, setPersonnel] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Filtri e ricerca
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
  // Modali
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showDiffModal, setShowDiffModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  
  // Import
  const [dragOver, setDragOver] = useState(false)
  const [differences, setDifferences] = useState([])
  const [importing, setImporting] = useState(false)
  const [showRemoved, setShowRemoved] = useState(false) // Nasconde i "removed" di default
  
  // Form per nuovo/edit persona
  const [formData, setFormData] = useState({
    idNumber: '',
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    role: 'operator',
    companyId: '',
    badge: '',
    notes: ''
  })

  // ============================================================================
  // CARICAMENTO DATI
  // ============================================================================
  useEffect(() => {
    if (activeProject) {
      loadData()
    }
  }, [activeProject])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Carica aziende prima
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
        .order('is_main', { ascending: false })
        .order('company_name')
      
      if (companiesError) throw companiesError
      setCompanies(companiesData || [])
      
      // Carica personale direttamente dalla tabella personnel
      const { data: personnelData, error: personnelError } = await supabase
        .from('personnel')
        .select(`
          *,
          company:companies(id, company_name, is_main)
        `)
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
        .order('last_name')
      
      if (personnelError) throw personnelError
      
      // Normalizza i dati
      const normalizedData = (personnelData || []).map(p => ({
        assignment_id: p.id,
        personnel_id: p.id,
        project_id: p.project_id,
        id_number: p.id_number,
        badge_number: p.badge_number,
        username: p.username,
        role: p.position,
        first_name: p.first_name,
        last_name: p.last_name,
        full_name: `${p.first_name} ${p.last_name}`,
        email: p.email,
        phone: p.phone,
        company_id: p.company_id,
        company_name: p.company?.company_name,
        is_main_company: p.company?.is_main
      }))
      
      setPersonnel(normalizedData)
      
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // FILTRI
  // ============================================================================
  const filteredPersonnel = personnel.filter(p => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = 
      p.first_name?.toLowerCase().includes(searchLower) ||
      p.last_name?.toLowerCase().includes(searchLower) ||
      p.full_name?.toLowerCase().includes(searchLower) ||
      p.company_name?.toLowerCase().includes(searchLower) ||
      p.badge_number?.toLowerCase().includes(searchLower) ||
      p.username?.toLowerCase().includes(searchLower) ||
      String(p.id_number || '').includes(searchLower)
    const matchesRole = !filterRole || p.role === filterRole
    const matchesCompany = !filterCompany || p.company_id === filterCompany
    return matchesSearch && matchesRole && matchesCompany
  }).sort((a, b) => {
    // Ordina per ID Number, poi cognome
    if (a.id_number && b.id_number) {
      return a.id_number - b.id_number
    }
    if (a.id_number) return -1
    if (b.id_number) return 1
    return (a.last_name || '').localeCompare(b.last_name || '')
  })

  // ============================================================================
  // STATISTICHE
  // ============================================================================
  const companyStats = companies.map(c => ({
    ...c,
    count: personnel.filter(p => p.company_id === c.id).length,
    percentage: personnel.length > 0 
      ? Math.round((personnel.filter(p => p.company_id === c.id).length / personnel.length) * 100) 
      : 0
  }))

  const roleStats = Object.entries(ROLE_CONFIG)
    .map(([key, config]) => ({
      role: key,
      ...config,
      count: personnel.filter(p => p.role === key).length
    }))
    .filter(r => r.count > 0)
    .sort((a, b) => a.order - b.order)

  // ============================================================================
  // GESTIONE FORM
  // ============================================================================
  const resetForm = () => {
    setFormData({
      idNumber: '',
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      phone: '',
      role: 'operator',
      companyId: companies.find(c => c.is_main)?.id || '',
      badge: '',
      notes: ''
    })
  }

  const openAddModal = () => {
    setSelectedPerson(null) // Reset per evitare conflitti
    resetForm()
    setShowAddModal(true)
  }

  const openEditModal = (person) => {
    setFormData({
      idNumber: person.id_number || '',
      firstName: person.first_name || '',
      lastName: person.last_name || '',
      username: person.username || '',
      email: person.email || '',
      phone: person.phone || '',
      role: person.role || 'operator',
      companyId: person.company_id || '',
      badge: person.badge_number || '',
      notes: person.notes || ''
    })
    setSelectedPerson(person)
    setIsEditing(true)
  }

  // ============================================================================
  // VALIDAZIONE BADGE (solo warning, non blocca il salvataggio)
  // ============================================================================
  const validateBadge = () => {
    return { valid: true }
  }

  // State per popup conferma badge
  const [showBadgeConfirm, setShowBadgeConfirm] = useState(false)

  // ============================================================================
  // SALVATAGGIO
  // ============================================================================
  const handleSave = async () => {
    console.log('handleSave chiamato')
    console.log('formData:', formData)
    
    // Validazione base - mostra alert ma non blocca il popup
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      alert('Nome e Cognome sono obbligatori')
      return
    }
    
    // Mostra popup conferma (anche se azienda vuota)
    console.log('Mostro popup conferma badge')
    setShowBadgeConfirm(true)
  }
  
  // Esegue il salvataggio effettivo
  const doSave = async () => {
    console.log('doSave chiamato')
    
    // Validazione azienda solo qui
    if (!formData.companyId) {
      alert('Seleziona un\'azienda prima di salvare')
      setShowBadgeConfirm(false)
      return
    }
    
    try {
      if (selectedPerson) {
        // Update esistente
        console.log('=== DEBUG UPDATE ===')
        console.log('selectedPerson:', selectedPerson)
        console.log('selectedPerson.personnel_id:', selectedPerson.personnel_id)
        console.log('selectedPerson.id:', selectedPerson.id)
        
        // Usa l'ID corretto - prova entrambi
        const personId = selectedPerson.personnel_id || selectedPerson.id
        console.log('ID usato per update:', personId)
        
        const updateData = {
          id_number: formData.idNumber ? parseInt(formData.idNumber) : null,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          username: formData.username.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          company_id: formData.companyId,
          badge_number: formData.badge.trim() || null,
          position: formData.role,
        }
        
        console.log('Update data:', updateData)
        console.log('company_id che sto salvando:', formData.companyId)
        
        const { data, error: personnelError, count } = await supabase
          .from('personnel')
          .update(updateData)
          .eq('id', personId)
          .select()
        
        console.log('Risultato update:', { data, error: personnelError, count })
        
        if (personnelError) {
          console.error('Update error:', personnelError)
          throw personnelError
        }
        
        if (!data || data.length === 0) {
          console.error('ATTENZIONE: Nessun record aggiornato!')
          alert('Errore: nessun record trovato con ID ' + personId)
          return
        }
        
        console.log('Update OK - record aggiornato:', data[0])
      } else {
        // Inserimento nuovo
        let username = formData.username.trim()
        if (!username && formData.firstName && formData.lastName) {
          username = (formData.firstName.charAt(0) + '.' + formData.lastName).toLowerCase().replace(/\s/g, '').replace(/'/g, '')
        }
        
        const insertData = {
          project_id: activeProject.id,
          id_number: formData.idNumber ? parseInt(formData.idNumber) : null,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          username: username || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          company_id: formData.companyId,
          badge_number: formData.badge.trim() || null,
          position: formData.role,
          status: 'active'
        }
        
        console.log('Insert data:', insertData)
        
        const { error: personnelError } = await supabase
          .from('personnel')
          .insert([insertData])
        
        if (personnelError) {
          console.error('Insert error:', personnelError)
          throw personnelError
        }
        
        console.log('Insert OK')
      }
      
      // Chiudi tutto e ricarica
      setSelectedPerson(null)
      setShowAddModal(false)
      setIsEditing(false)
      setShowBadgeConfirm(false)
      loadData()
    } catch (err) {
      console.error('Error saving:', err)
      alert('Errore nel salvataggio: ' + (err.message || JSON.stringify(err)))
    }
  }
  
  // Conferma salvataggio
  const confirmSaveWithBadge = () => {
    doSave()
  }
  
  // Annulla e torna al form per modificare
  const cancelBadgeConfirm = () => {
    setShowBadgeConfirm(false)
  }

  // ============================================================================
  // ELIMINAZIONE
  // ============================================================================
  const handleDelete = async (person) => {
    try {
      // Disattiva il record in personnel
      const { error } = await supabase
        .from('personnel')
        .update({ status: 'inactive' })
        .eq('id', person.personnel_id)
      
      if (error) throw error
      
      setShowDeleteConfirm(null)
      setSelectedPerson(null)
      loadData()
    } catch (err) {
      console.error('Error deleting:', err)
      alert('Errore: ' + err.message)
    }
  }

  // ============================================================================
  // IMPORT EXCEL
  // ============================================================================
  const handleFileDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    
    const file = e.dataTransfer?.files[0] || e.target?.files[0]
    if (!file) return
    
    processExcelFile(file)
  }, [personnel, companies])

  const processExcelFile = (file) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        // Analizza differenze
        const diffs = analyzeImportDifferences(jsonData)
        setDifferences(diffs)
        setShowImportModal(false)
        setShowDiffModal(true)
      } catch (err) {
        console.error('Error processing Excel:', err)
        alert('Errore nella lettura del file Excel')
      }
    }
    
    reader.readAsArrayBuffer(file)
  }

  const analyzeImportDifferences = (importData) => {
    const diffs = []
    const processedNames = new Set()
    
    // Mappa per lookup veloce (Nome + Cognome)
    const existingMap = new Map()
    personnel.forEach(p => {
      const key = `${p.first_name?.toLowerCase()}_${p.last_name?.toLowerCase()}`
      existingMap.set(key, p)
    })
    
    // Analizza ogni riga importata
    importData.forEach(row => {
      const firstName = (row.Nome || row.nome || '').toString().trim()
      const lastName = (row.Cognome || row.cognome || '').toString().trim()
      
      if (!firstName || !lastName) return
      
      const key = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`
      processedNames.add(key)
      
      const existing = existingMap.get(key)
      
      if (!existing) {
        // Nuova persona
        diffs.push({
          type: 'new',
          selected: true,
          person: {
            firstName,
            lastName,
            email: (row.Email || row.email || '').toString(),
            phone: (row.Telefono || row.telefono || '').toString(),
            role: mapRoleFromImport(row.Ruolo || row.ruolo),
            companyName: row.Azienda || row.azienda || '',
            badge: (row.Badge || row.badge || '').toString(),
            notes: row.Note || row.note || ''
          }
        })
      } else {
        // Confronta campi
        const changes = []
        const importEmail = (row.Email || row.email || '').toString().trim()
        const importPhone = (row.Telefono || row.telefono || '').toString().trim()
        const importRole = mapRoleFromImport(row.Ruolo || row.ruolo)
        const importCompany = (row.Azienda || row.azienda || '').toString().trim()
        const importBadge = (row.Badge || row.badge || '').toString().trim()
        const importNotes = (row.Note || row.note || '').toString().trim()
        
        if (importEmail && importEmail !== (existing.email || '')) {
          changes.push({ field: 'Email', old: existing.email || '—', new: importEmail })
        }
        if (importPhone && importPhone !== (existing.phone || '')) {
          changes.push({ field: 'Telefono', old: existing.phone || '—', new: importPhone })
        }
        if (importRole && importRole !== existing.role) {
          changes.push({ 
            field: 'Ruolo', 
            old: ROLE_CONFIG[existing.role]?.label || existing.role, 
            new: ROLE_CONFIG[importRole]?.label || importRole
          })
        }
        if (importCompany && importCompany !== (existing.company_name || '')) {
          changes.push({ 
            field: 'Azienda', 
            old: existing.company_name || '—', 
            new: importCompany 
          })
        }
        if (importBadge && importBadge !== (existing.badge_number || '')) {
          changes.push({ field: 'Badge', old: existing.badge_number || '—', new: importBadge })
        }
        
        if (changes.length > 0) {
          diffs.push({
            type: 'modified',
            selected: true,
            person: {
              id: existing.personnel_id,
              assignmentId: existing.assignment_id,
              firstName,
              lastName,
              role: existing.role
            },
            changes,
            importData: {
              email: importEmail,
              phone: importPhone,
              role: importRole,
              company: importCompany,
              badge: importBadge,
              notes: importNotes
            }
          })
        }
      }
    })
    
    // Trova persone rimosse (nel DB ma non nel file)
    personnel.forEach(p => {
      const key = `${p.first_name?.toLowerCase()}_${p.last_name?.toLowerCase()}`
      if (!processedNames.has(key)) {
        diffs.push({
          type: 'removed',
          selected: false, // Default non selezionato per rimozioni
          person: {
            id: p.personnel_id,
            assignmentId: p.assignment_id,
            firstName: p.first_name,
            lastName: p.last_name,
            role: p.role,
            badge: p.badge_number,
            companyName: p.company_name
          }
        })
      }
    })
    
    return diffs
  }

  const mapRoleFromImport = (roleStr) => {
    if (!roleStr) return 'operator'
    const lower = roleStr.toString().toLowerCase().trim()
    
    const mapping = {
      'project manager': 'pm', 'pm': 'pm',
      'site manager': 'site_manager', 'site_manager': 'site_manager',
      'construction manager': 'cm', 'cm': 'cm',
      'project eng. manager': 'pem', 'pem': 'pem', 'project engineering manager': 'pem',
      'engineer': 'engineer', 'ingegnere': 'engineer',
      'planner': 'planner', 'pianificatore': 'planner',
      'supervisor': 'supervisor', 'supervisore': 'supervisor',
      'foreman': 'foreman', 'caposquadra': 'foreman',
      'sub foreman': 'sub_foreman', 'sub_foreman': 'sub_foreman',
      'magazziniere': 'storekeeper', 'storekeeper': 'storekeeper',
      'operatore': 'operator', 'operator': 'operator',
      'aiutante': 'helper', 'helper': 'helper',
    }
    
    return mapping[lower] || 'operator'
  }

  const toggleDiffSelection = (index) => {
    setDifferences(prev => prev.map((d, i) => 
      i === index ? { ...d, selected: !d.selected } : d
    ))
  }

  const selectAllDiffs = () => {
    setDifferences(prev => prev.map(d => ({ ...d, selected: true })))
  }

  const deselectAllDiffs = () => {
    setDifferences(prev => prev.map(d => ({ ...d, selected: false })))
  }

  const applySelectedDiffs = async () => {
    setImporting(true)
    
    try {
      const selected = differences.filter(d => d.selected)
      let successCount = 0
      let errorCount = 0
      
      for (const diff of selected) {
        try {
          if (diff.type === 'new') {
            // Trova company_id
            const company = companies.find(c => 
              c.company_name.toLowerCase() === diff.person.companyName.toLowerCase()
            )
            
            // Inserisci in personnel
            const { error: personnelError } = await supabase
              .from('personnel')
              .insert([{
                project_id: activeProject.id,
                first_name: diff.person.firstName,
                last_name: diff.person.lastName,
                email: diff.person.email || null,
                phone: diff.person.phone || null,
                company_id: company?.id || null,
                badge_number: diff.person.badge || null,
                position: diff.person.role,
                status: 'active'
              }])
            
            if (personnelError) throw personnelError
            
            successCount++
          } else if (diff.type === 'modified') {
            const updates = {}
            const personnelUpdates = {}
            
            diff.changes.forEach(change => {
              switch (change.field) {
                case 'Email': 
                  personnelUpdates.email = diff.importData.email
                  break
                case 'Telefono': 
                  personnelUpdates.phone = diff.importData.phone
                  break
                case 'Ruolo': 
                  updates.role = diff.importData.role
                  break
                case 'Azienda': 
                  const company = companies.find(c => 
                    c.company_name.toLowerCase() === diff.importData.company.toLowerCase()
                  )
                  if (company) updates.company_id = company.id
                  break
                case 'Badge': 
                  updates.badge_number = diff.importData.badge
                  break
              }
            })
            
            if (Object.keys(personnelUpdates).length > 0) {
              await supabase
                .from('personnel')
                .update(personnelUpdates)
                .eq('id', diff.person.id)
            }
            
            if (Object.keys(updates).length > 0 && diff.person.assignmentId) {
              await supabase
                .from('personnel_project_assignments')
                .update(updates)
                .eq('id', diff.person.assignmentId)
            }
            
            successCount++
          } else if (diff.type === 'removed') {
            if (diff.person.assignmentId) {
              await supabase
                .from('personnel_project_assignments')
                .update({ 
                  status: 'terminated', 
                  end_date: new Date().toISOString().split('T')[0] 
                })
                .eq('id', diff.person.assignmentId)
            } else {
              await supabase
                .from('personnel')
                .update({ status: 'inactive' })
                .eq('id', diff.person.id)
            }
            
            successCount++
          }
        } catch (err) {
          console.error('Error processing diff:', diff, err)
          errorCount++
        }
      }
      
      setShowDiffModal(false)
      setDifferences([])
      loadData()
      
      if (errorCount > 0) {
        alert(`Importazione completata: ${successCount} successi, ${errorCount} errori`)
      }
    } catch (err) {
      console.error('Error applying changes:', err)
      alert('Errore nell\'applicazione delle modifiche: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  // ============================================================================
  // EXPORT EXCEL
  // ============================================================================
  const handleExport = () => {
    const exportData = personnel.map(p => ({
      'ID': p.id_number || '',
      'Badge': p.badge_number || '',
      'Cognome': p.last_name,
      'Nome': p.first_name,
      'Username': p.username || '',
      'Ruolo': p.role,
      'Azienda': p.company_name || '',
      'Email': p.email || '',
      'Telefono': p.phone || ''
    }))
    
    const ws = XLSX.utils.json_to_sheet(exportData)
    
    // Imposta larghezza colonne
    ws['!cols'] = [
      { wch: 6 }, { wch: 10 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 18 }, { wch: 25 }, { wch: 30 }, { wch: 15 }
    ]
    
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Personale')
    XLSX.writeFile(wb, `Personale_${activeProject.project_code || 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ============================================================================
  // RENDER
  // ============================================================================
  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Users size={64} className="text-gray-300 mb-4" />
        <p className="text-gray-500">Seleziona un progetto</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const selectedDiffCount = differences.filter(d => d.selected).length
  const newCount = differences.filter(d => d.type === 'new').length
  const modifiedCount = differences.filter(d => d.type === 'modified').length
  const removedCount = differences.filter(d => d.type === 'removed').length
  
  // Differenze visibili (filtra i removed se nascosti)
  const visibleDifferences = showRemoved 
    ? differences 
    : differences.filter(d => d.type !== 'removed')

  return (
    <div className="space-y-6">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-primary" />
            Personale
          </h1>
          <p className="text-gray-500 mt-1">
            {activeProject.name} • {personnel.length} risorse attive
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Cerca nome, cognome, badge..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          
          {/* Filter Button */}
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              (showFilters || filterRole || filterCompany) 
                ? 'bg-blue-100 text-blue-700 border-blue-300' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter size={20} />
            Filtri
            {(filterRole || filterCompany) && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {(filterRole ? 1 : 0) + (filterCompany ? 1 : 0)}
              </span>
            )}
          </button>
          
          {/* Actions */}
          <button 
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            <Upload size={20} />
            Importa
          </button>
          
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            <Download size={20} />
            Esporta
          </button>
          
          <button 
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark"
          >
            <Plus size={20} />
            Nuova Risorsa
          </button>
        </div>
      </div>

      {/* ============ FILTRI ESPANSI ============ */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Tutti i ruoli</option>
                {Object.entries(ROLE_CONFIG)
                  .sort((a, b) => a[1].order - b[1].order)
                  .map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
              </select>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Azienda</label>
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Tutte le aziende</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.is_main && '★ '}{c.company_name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <button 
                onClick={() => { setFilterRole(''); setFilterCompany('') }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Resetta filtri
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ STATISTICHE AZIENDE ============ */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          {companyStats.map(company => (
            <button
              key={company.id}
              onClick={() => setFilterCompany(filterCompany === company.id ? '' : company.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                filterCompany === company.id
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {company.is_main && <Star size={14} className="text-yellow-500 fill-yellow-500" />}
              <span className="font-medium">{company.company_name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                company.is_main ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-200 text-gray-600'
              }`}>
                {company.count} ({company.percentage}%)
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ============ TABELLA PERSONALE ============ */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Badge</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome Completo</th>
                <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">Username</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ruolo</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Azienda</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Contatti</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPersonnel.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                    {searchTerm || filterRole || filterCompany 
                      ? 'Nessun risultato trovato con i filtri applicati'
                      : 'Nessun personale registrato'}
                  </td>
                </tr>
              ) : (
                filteredPersonnel.map((person) => (
                  <tr 
                    key={person.assignment_id || person.personnel_id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedPerson(person)}
                  >
                    <td className="px-3 py-3">
                      <span className="font-mono text-sm text-gray-600">
                        {person.id_number || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {person.badge_number || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {person.last_name} {person.first_name}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-sm text-blue-600">
                        {person.username || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={person.role} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {person.is_main_company && (
                          <Star size={14} className="text-yellow-500 fill-yellow-500" />
                        )}
                        <span className="text-sm text-gray-700">{person.company_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {person.email && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Mail size={12} />
                            <span className="truncate max-w-[180px]">{person.email}</span>
                          </div>
                        )}
                        {person.phone && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Phone size={12} />
                            <span>{person.phone}</span>
                          </div>
                        )}
                        {!person.email && !person.phone && (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(person) }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Modifica"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(person) }}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Elimina"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer con totale */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
          Visualizzati {filteredPersonnel.length} di {personnel.length} risorse
        </div>
      </div>

      {/* ============ MODAL DETTAGLIO PERSONA ============ */}
      {selectedPerson && !isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="text-primary" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {selectedPerson.first_name} {selectedPerson.last_name}
                  </h2>
                  <RoleBadge role={selectedPerson.role} />
                </div>
              </div>
              <button onClick={() => setSelectedPerson(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-500">ID Number</label>
                  <p className="font-medium text-gray-900">
                    {selectedPerson.id_number || '—'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Badge</label>
                  <p className="font-mono bg-gray-100 px-2 py-1 rounded inline-block">
                    {selectedPerson.badge_number || '—'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Username</label>
                  <p className="font-mono text-blue-600">
                    {selectedPerson.username || '—'}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-500">Azienda</label>
                <p className="flex items-center gap-1">
                  {selectedPerson.is_main_company && (
                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  )}
                  {selectedPerson.company_name}
                </p>
              </div>
              
              {selectedPerson.email && (
                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <p className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-400" />
                    <a href={`mailto:${selectedPerson.email}`} className="text-blue-600 hover:underline">
                      {selectedPerson.email}
                    </a>
                  </p>
                </div>
              )}
              
              {selectedPerson.phone && (
                <div>
                  <label className="text-sm text-gray-500">Telefono</label>
                  <p className="flex items-center gap-2">
                    <Phone size={16} className="text-gray-400" />
                    <a href={`tel:${selectedPerson.phone}`} className="text-blue-600 hover:underline">
                      {selectedPerson.phone}
                    </a>
                  </p>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="flex justify-between p-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowDeleteConfirm(selectedPerson)}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 size={18} />
                Elimina
              </button>
              <button
                onClick={() => openEditModal(selectedPerson)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
              >
                <Edit size={18} />
                Modifica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL NUOVO / MODIFICA ============ */}
      {(showAddModal || isEditing) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-800">
                {isEditing ? 'Modifica Risorsa' : 'Nuova Risorsa'}
              </h2>
              <button 
                onClick={() => { setShowAddModal(false); setIsEditing(false); setSelectedPerson(null) }} 
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Form */}
            <div className="p-4 space-y-4">
              {/* ID Number e Username */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Number
                  </label>
                  <input
                    type="number"
                    value={formData.idNumber}
                    onChange={(e) => setFormData({...formData, idNumber: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username (login)
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value.toLowerCase()})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    placeholder="g.pasquale"
                  />
                  <p className="text-xs text-gray-500 mt-1">Se vuoto, sarà generato automaticamente</p>
                </div>
              </div>
              
              {/* Nome e Cognome */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Mario"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cognome <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Rossi"
                  />
                </div>
              </div>
              
              {/* Email e Telefono */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="mario.rossi@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="+39 333 1234567"
                  />
                </div>
              </div>
              
              {/* Azienda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Azienda <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.companyId}
                  onChange={(e) => setFormData({...formData, companyId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Seleziona azienda...</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.is_main && '★ '}{c.company_name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Ruolo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ruolo <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(ROLE_CONFIG)
                    .sort((a, b) => a[1].order - b[1].order)
                    .map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                </select>
              </div>
              
              {/* Badge */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Badge 
                  {(() => {
                    const company = companies.find(c => c.id === formData.companyId)
                    const isRequired = company?.is_main || ROLES_REQUIRING_BADGE_SUBCONTRACTOR.includes(formData.role)
                    return isRequired ? <span className="text-red-500"> *</span> : null
                  })()}
                </label>
                <input
                  type="text"
                  value={formData.badge}
                  onChange={(e) => setFormData({...formData, badge: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  placeholder="CR-001"
                />
                {(() => {
                  const company = companies.find(c => c.id === formData.companyId)
                  if (company?.is_main) {
                    return (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <Info size={12} />
                        Badge obbligatorio per azienda principale
                      </p>
                    )
                  }
                  if (ROLES_REQUIRING_BADGE_SUBCONTRACTOR.includes(formData.role)) {
                    return (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <Info size={12} />
                        Badge obbligatorio per questo ruolo
                      </p>
                    )
                  }
                  return null
                })()}
              </div>
              
              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Note aggiuntive..."
                />
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
              <button
                onClick={() => { setShowAddModal(false); setIsEditing(false); setSelectedPerson(null) }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
              >
                <Save size={18} />
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL IMPORT ============ */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Upload className="text-primary" />
                Importa da Excel
              </h2>
              <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragOver 
                    ? 'border-primary bg-primary/5' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <FileSpreadsheet size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">
                  Trascina qui il file Excel oppure
                </p>
                <label className="cursor-pointer">
                  <span className="text-primary hover:underline">clicca per selezionare</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileDrop}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-400 mt-4">
                  Formati supportati: .xlsx, .xls, .csv
                </p>
              </div>
              
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-700 mb-2">Formato richiesto:</h3>
                <p className="text-sm text-gray-600">
                  Colonne: Nome | Cognome | Data Nascita | Email | Telefono | Ruolo | Azienda | Badge | Note
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL DIFFERENZE ============ */}
      {showDiffModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Differenze Rilevate</h2>
                <p className="text-sm text-gray-500">
                  {visibleDifferences.length} visibili • {selectedDiffCount} selezionate
                </p>
              </div>
              <button onClick={() => setShowDiffModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            {/* Legenda */}
            <div className="flex flex-wrap gap-4 px-4 py-3 bg-gray-50 border-b items-center">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-green-600" size={18} />
                <span className="text-sm">Nuovi ({newCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="text-yellow-600" size={18} />
                <span className="text-sm">Modificati ({modifiedCount})</span>
              </div>
              
              {/* Toggle per mostrare/nascondere rimossi */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRemoved}
                  onChange={(e) => setShowRemoved(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded border-gray-300"
                />
                <MinusCircle className="text-red-600" size={18} />
                <span className="text-sm">Rimossi ({removedCount})</span>
              </label>
              
              <div className="ml-auto flex gap-2">
                <button onClick={selectAllDiffs} className="text-sm text-blue-600 hover:underline">
                  Seleziona tutto
                </button>
                <span className="text-gray-300">|</span>
                <button onClick={deselectAllDiffs} className="text-sm text-blue-600 hover:underline">
                  Deseleziona tutto
                </button>
              </div>
            </div>
            
            {/* Lista differenze */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {visibleDifferences.map((diff, index) => {
                // Trova l'indice reale nel array differences per toggleSelection
                const realIndex = differences.findIndex(d => d === diff)
                return (
                <div
                  key={realIndex}
                  onClick={() => toggleDiffSelection(realIndex)}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    diff.selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  } ${
                    diff.type === 'new' ? 'border-l-4 border-l-green-500' :
                    diff.type === 'modified' ? 'border-l-4 border-l-yellow-500' :
                    'border-l-4 border-l-red-500'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={diff.selected}
                      onChange={() => {}}
                      className="mt-1 w-4 h-4 text-blue-600 rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {diff.type === 'new' && <CheckCircle2 className="text-green-600" size={18} />}
                        {diff.type === 'modified' && <AlertCircle className="text-yellow-600" size={18} />}
                        {diff.type === 'removed' && <MinusCircle className="text-red-600" size={18} />}
                        <span className="font-medium">
                          {diff.person.firstName} {diff.person.lastName}
                        </span>
                        <RoleBadge role={diff.person.role} size="small" />
                      </div>
                      
                      {diff.type === 'new' && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="text-green-600 font-medium">Nuova risorsa</span>
                          {diff.person.companyName && ` • ${diff.person.companyName}`}
                          {diff.person.badge && ` • Badge: ${diff.person.badge}`}
                        </div>
                      )}
                      
                      {diff.type === 'modified' && diff.changes && (
                        <div className="mt-2 space-y-1">
                          {diff.changes.map((change, i) => (
                            <div key={i} className="text-sm">
                              <span className="text-gray-500">{change.field}:</span>
                              <span className="text-red-600 line-through mx-2">{change.old}</span>
                              <span className="text-green-600">→ {change.new}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {diff.type === 'removed' && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="text-red-600 font-medium">Da rimuovere</span>
                          {diff.person.companyName && ` • ${diff.person.companyName}`}
                          {diff.person.badge && ` • Badge: ${diff.person.badge}`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )})}
            </div>
            
            {/* Footer */}
            <div className="flex justify-between items-center p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Annulla
              </button>
              <button
                onClick={applySelectedDiffs}
                disabled={selectedDiffCount === 0 || importing}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  selectedDiffCount === 0 || importing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary-dark'
                }`}
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Applicando...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Applica {selectedDiffCount} Modifiche
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL CONFERMA ELIMINAZIONE ============ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 mx-auto flex items-center justify-center mb-4">
                <AlertTriangle className="text-red-600" size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Conferma Eliminazione</h2>
              <p className="text-gray-600 mb-6">
                Sei sicuro di voler eliminare <strong>{showDeleteConfirm.first_name} {showDeleteConfirm.last_name}</strong>?
                <br />
                <span className="text-sm text-gray-500">Questa azione può essere annullata solo da un amministratore.</span>
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Annulla
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Elimina
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL CONFERMA BADGE ============ */}
      {showBadgeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 mx-auto flex items-center justify-center mb-4">
                <Info className="text-blue-600" size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">Conferma Badge</h2>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Badge attuale</p>
                  <p className="text-2xl font-mono font-bold text-gray-800">
                    {formData.badge || '(nessuno)'}
                  </p>
                </div>
              </div>
              
              <p className="text-gray-600 mb-6 text-center">
                Vuoi mantenere questo badge number?
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmSaveWithBadge}
                  className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium flex items-center justify-center gap-2"
                >
                  <Check size={20} />
                  Sì, mantieni e salva
                </button>
                <button
                  onClick={cancelBadgeConfirm}
                  className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium flex items-center justify-center gap-2"
                >
                  <Edit size={20} />
                  No, voglio modificarlo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
