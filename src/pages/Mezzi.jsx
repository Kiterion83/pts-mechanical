import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import { 
  Truck, Plus, Search, X, Check, Edit, Trash2,
  Building2, Calendar, DollarSign, AlertTriangle, Wrench, 
  Settings, Star, Hash, Package, PlusCircle, Users, 
  Clock, CalendarClock, Download, History,
  Bell, CheckCircle, XCircle, RotateCcw, ChevronDown, ChevronUp
} from 'lucide-react'
import * as XLSX from 'xlsx'

// ============================================================================
// CONFIGURAZIONE CATEGORIE
// ============================================================================

const CATEGORIES = {
  vehicle: { 
    label: 'Mezzo', 
    labelEn: 'Vehicle', 
    icon: Truck, 
    color: 'bg-blue-100 text-blue-800',
    iconColor: 'text-blue-600'
  },
  equipment: { 
    label: 'Equipment', 
    labelEn: 'Equipment', 
    icon: Package, 
    color: 'bg-green-100 text-green-800',
    iconColor: 'text-green-600'
  },
  tool: { 
    label: 'Attrezzo', 
    labelEn: 'Tool', 
    icon: Wrench, 
    color: 'bg-orange-100 text-orange-800',
    iconColor: 'text-orange-600'
  }
}

// ============================================================================
// TIPI PREDEFINITI
// ============================================================================

const DEFAULT_EQUIPMENT_TYPES = {
  // VEHICLES (Mezzi)
  crane_mobile: { label: 'Gru Mobile', category: 'vehicle' },
  crane_tower: { label: 'Gru a Torre', category: 'vehicle' },
  crane_crawler: { label: 'Gru Cingolata', category: 'vehicle' },
  crane_truck: { label: 'Autogrù', category: 'vehicle' },
  truck: { label: 'Camion', category: 'vehicle' },
  truck_flatbed: { label: 'Camion Pianale', category: 'vehicle' },
  truck_dump: { label: 'Camion Ribaltabile', category: 'vehicle' },
  lorry: { label: 'Autocarro', category: 'vehicle' },
  van: { label: 'Furgone', category: 'vehicle' },
  pickup: { label: 'Pickup', category: 'vehicle' },
  trailer: { label: 'Rimorchio', category: 'vehicle' },
  lowboy: { label: 'Carrellone', category: 'vehicle' },
  excavator: { label: 'Escavatore', category: 'vehicle' },
  excavator_mini: { label: 'Mini Escavatore', category: 'vehicle' },
  wheel_loader: { label: 'Pala Gommata', category: 'vehicle' },
  backhoe_loader: { label: 'Terna', category: 'vehicle' },
  bulldozer: { label: 'Bulldozer', category: 'vehicle' },
  skid_steer: { label: 'Skid Steer', category: 'vehicle' },
  forklift: { label: 'Muletto', category: 'vehicle' },
  forklift_telehandler: { label: 'Telehandler', category: 'vehicle' },
  aerial_platform: { label: 'Piattaforma Aerea', category: 'vehicle' },
  boom_lift: { label: 'Piattaforma Articolata', category: 'vehicle' },
  scissor_lift: { label: 'Piattaforma a Forbice', category: 'vehicle' },
  concrete_pump: { label: 'Pompa Calcestruzzo', category: 'vehicle' },
  
  // EQUIPMENT
  generator: { label: 'Generatore', category: 'equipment' },
  generator_large: { label: 'Gruppo Elettrogeno', category: 'equipment' },
  light_tower: { label: 'Torre Faro', category: 'equipment' },
  air_compressor: { label: 'Compressore Aria', category: 'equipment' },
  welding_machine: { label: 'Saldatrice', category: 'equipment' },
  welding_machine_mig: { label: 'Saldatrice MIG/MAG', category: 'equipment' },
  welding_machine_tig: { label: 'Saldatrice TIG', category: 'equipment' },
  plasma_cutter: { label: 'Taglio Plasma', category: 'equipment' },
  pump_water: { label: 'Pompa Acqua', category: 'equipment' },
  pump_hydraulic: { label: 'Centralina Idraulica', category: 'equipment' },
  concrete_mixer: { label: 'Betoniera', category: 'equipment' },
  scaffolding: { label: 'Ponteggio', category: 'equipment' },
  container_office: { label: 'Container Ufficio', category: 'equipment' },
  container_storage: { label: 'Container Magazzino', category: 'equipment' },
  chain_hoist: { label: 'Paranco a Catena', category: 'equipment' },
  hydraulic_jack: { label: 'Martinetto Idraulico', category: 'equipment' },
  
  // TOOLS (Attrezzi)
  grinder_angle: { label: 'Smerigliatrice', category: 'tool' },
  cut_off_saw: { label: 'Troncatrice', category: 'tool' },
  circular_saw: { label: 'Sega Circolare', category: 'tool' },
  drill_hammer: { label: 'Trapano a Percussione', category: 'tool' },
  drill_magnetic: { label: 'Trapano Magnetico', category: 'tool' },
  screwdriver_impact: { label: 'Avvitatore a Impulsi', category: 'tool' },
  wrench_torque: { label: 'Chiave Dinamometrica', category: 'tool' },
  wrench_hydraulic: { label: 'Chiave Idraulica', category: 'tool' },
  beveling_machine: { label: 'Smussatrice', category: 'tool' },
  demolition_hammer: { label: 'Martello Demolitore', category: 'tool' },
  laser_level: { label: 'Livella Laser', category: 'tool' },
  heat_gun: { label: 'Pistola Termica', category: 'tool' }
}

const RATE_TYPES = {
  hourly: { label: 'Orario' },
  daily: { label: 'Giornaliero' },
  weekly: { label: 'Settimanale' },
  monthly: { label: 'Mensile' },
  lump_sum: { label: 'Forfettario' }
}

const OWNERSHIP_TYPES = {
  owned: { label: 'Proprietà', color: 'bg-emerald-100 text-emerald-800' },
  rented: { label: 'Noleggio', color: 'bg-amber-100 text-amber-800' }
}

const MAINTENANCE_TYPES = [
  { value: 'tagliando', label: 'Tagliando' },
  { value: 'revisione', label: 'Revisione' },
  { value: 'riparazione', label: 'Riparazione' },
  { value: 'certificazione', label: 'Certificazione' },
  { value: 'ispezione', label: 'Ispezione' },
  { value: 'altro', label: 'Altro' }
]

const STATUS_CONFIG = {
  active: { label: 'Disponibile', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  maintenance_scheduled: { label: 'Manutenzione Prevista', color: 'bg-amber-100 text-amber-800', icon: CalendarClock },
  out_of_site: { label: 'Fuori Cantiere', color: 'bg-red-100 text-red-800', icon: XCircle },
  inactive: { label: 'Disattivato', color: 'bg-gray-100 text-gray-800', icon: XCircle }
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function CategoryBadge({ category, size = 'normal' }) {
  const config = CATEGORIES[category] || { label: category, color: 'bg-gray-100 text-gray-800', icon: Package }
  const sizeClass = size === 'small' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
  const Icon = config.icon
  return (
    <span className={`${config.color} ${sizeClass} rounded-full font-medium whitespace-nowrap inline-flex items-center gap-1`}>
      <Icon size={size === 'small' ? 10 : 12} />
      {config.label}
    </span>
  )
}

function OwnershipBadge({ ownership }) {
  const config = OWNERSHIP_TYPES[ownership] || { label: ownership, color: 'bg-gray-100 text-gray-800' }
  return <span className={`${config.color} px-2 py-0.5 text-xs rounded-full font-medium`}>{config.label}</span>
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active
  const Icon = config.icon
  return (
    <span className={`${config.color} px-2 py-1 text-xs rounded-full font-medium inline-flex items-center gap-1`}>
      <Icon size={12} />
      {config.label}
    </span>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Mezzi() {
  const { t } = useTranslation()
  const { activeProject } = useProject()
  
  // Data state
  const [equipment, setEquipment] = useState([])
  const [companies, setCompanies] = useState([])
  const [squads, setSquads] = useState([])
  const [assignments, setAssignments] = useState({})
  const [maintenances, setMaintenances] = useState({})
  const [customTypes, setCustomTypes] = useState([])
  const [loading, setLoading] = useState(true)
  
  // UI State
  const [showModal, setShowModal] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showNewTypeModal, setShowNewTypeModal] = useState(false)
  const [showMaintenanceHistory, setShowMaintenanceHistory] = useState(null)
  const [showReturnModal, setShowReturnModal] = useState(null)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterOwnership, setFilterOwnership] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  
  // Form state
  const [formData, setFormData] = useState({
    category: 'vehicle',
    type: '',
    description: '',
    ownership: 'owned',
    ownerCompanyId: '',
    serialNumber: '',
    plateNumber: '',
    notes: ''
  })
  
  // Nuovo tipo form
  const [newTypeForm, setNewTypeForm] = useState({ labelIt: '', category: 'vehicle' })
  
  // Rates form
  const [rates, setRates] = useState([])
  const [newRate, setNewRate] = useState({
    rateType: 'daily',
    amount: '',
    validFrom: new Date().toISOString().split('T')[0],
    validTo: '',
    appliesWeekdays: true,
    appliesWeekends: true
  })
  
  // Maintenance form
  const [maintenanceList, setMaintenanceList] = useState([])
  const [newMaintenance, setNewMaintenance] = useState({
    description: '',
    maintenanceType: 'tagliando',
    scheduledDate: '',
    durationDays: 1
  })
  
  // Return modal
  const [returnData, setReturnData] = useState({
    reassignToSquad: false,
    squadId: '',
    notes: ''
  })

  // ============================================================================
  // MERGED TYPES
  // ============================================================================
  
  const EQUIPMENT_TYPES = useMemo(() => ({
    ...DEFAULT_EQUIPMENT_TYPES,
    ...Object.fromEntries(
      customTypes.map(ct => [ct.type_key, { label: ct.label_it, category: ct.category, isCustom: true }])
    )
  }), [customTypes])

  // ============================================================================
  // DATA LOADING
  // ============================================================================
  
  useEffect(() => {
    if (activeProject) loadData()
  }, [activeProject])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Companies
      const { data: companiesData } = await supabase
        .from('companies')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
        .order('is_main', { ascending: false })
      setCompanies(companiesData || [])
      
      // Squads
      const { data: squadsData } = await supabase
        .from('squads')
        .select('id, name, squad_number')
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
        .order('squad_number')
      setSquads(squadsData || [])
      
      // Custom types
      const { data: typesData } = await supabase
        .from('equipment_types')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('is_active', true)
      setCustomTypes(typesData || [])
      
      // Equipment (escludi solo inactive)
      const { data: equipmentData } = await supabase
        .from('equipment')
        .select(`*, owner_company:companies(id, company_name, is_main), equipment_rates(*)`)
        .eq('project_id', activeProject.id)
        .neq('status', 'inactive')
        .order('asset_code')
      setEquipment(equipmentData || [])
      
      // Assignments
      const { data: assignmentsData } = await supabase
        .from('equipment_assignments')
        .select(`*, squad:squads(id, name, squad_number)`)
        .eq('status', 'active')
      const assignMap = {}
      ;(assignmentsData || []).forEach(a => { assignMap[a.equipment_id] = a.squad })
      setAssignments(assignMap)
      
      // Maintenances
      const equipIds = (equipmentData || []).map(e => e.id)
      if (equipIds.length > 0) {
        const { data: maintData } = await supabase
          .from('equipment_maintenance')
          .select('*')
          .in('equipment_id', equipIds)
          .order('scheduled_date', { ascending: false })
        
        const maintMap = {}
        ;(maintData || []).forEach(m => {
          if (!maintMap[m.equipment_id]) maintMap[m.equipment_id] = []
          maintMap[m.equipment_id].push(m)
        })
        setMaintenances(maintMap)
      }
      
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // STATS & KPI
  // ============================================================================
  
  const stats = useMemo(() => {
    const maintenanceDueEquipment = equipment.filter(e => {
      const maints = maintenances[e.id] || []
      return maints.some(m => {
        if (m.status !== 'scheduled' && m.status !== 'notified') return false
        const daysUntil = Math.ceil((new Date(m.scheduled_date) - new Date()) / (1000 * 60 * 60 * 24))
        return daysUntil <= 7 && daysUntil >= 0
      })
    })
    
    return {
      total: equipment.length,
      available: equipment.filter(e => e.status === 'active' && !assignments[e.id]).length,
      assigned: equipment.filter(e => e.status === 'active' && assignments[e.id]).length,
      maintenanceDue: maintenanceDueEquipment.length,
      outOfSite: equipment.filter(e => e.status === 'out_of_site').length,
      owned: equipment.filter(e => e.ownership === 'owned').length,
      rented: equipment.filter(e => e.ownership === 'rented').length
    }
  }, [equipment, maintenances, assignments])

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const resetForm = () => {
    setFormData({
      category: 'vehicle', type: '', description: '', ownership: 'owned',
      ownerCompanyId: '', serialNumber: '', plateNumber: '', notes: ''
    })
    setRates([])
    setMaintenanceList([])
    setNewRate({ rateType: 'daily', amount: '', validFrom: new Date().toISOString().split('T')[0], validTo: '', appliesWeekdays: true, appliesWeekends: true })
    setNewMaintenance({ description: '', maintenanceType: 'tagliando', scheduledDate: '', durationDays: 1 })
  }

  const openAddModal = () => {
    setEditingEquipment(null)
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (eq) => {
    setFormData({
      category: eq.category || 'vehicle',
      type: eq.type || '',
      description: eq.description || '',
      ownership: eq.ownership || 'owned',
      ownerCompanyId: eq.owner_company_id || '',
      serialNumber: eq.serial_number || '',
      plateNumber: eq.plate_number || '',
      notes: eq.notes || ''
    })
    
    // Rates
    setRates((eq.equipment_rates || []).map(r => ({
      id: r.id, rateType: r.rate_type, amount: r.amount,
      validFrom: r.valid_from, validTo: r.valid_to || '',
      appliesWeekdays: r.applies_weekdays, appliesWeekends: r.applies_weekends
    })))
    
    // Manutenzioni programmate (solo scheduled/notified)
    const eqMaints = (maintenances[eq.id] || []).filter(m => m.status === 'scheduled' || m.status === 'notified')
    setMaintenanceList(eqMaints.map(m => ({
      id: m.id, description: m.description, maintenanceType: m.maintenance_type,
      scheduledDate: m.scheduled_date, durationDays: m.duration_days
    })))
    
    setEditingEquipment(eq)
    setShowModal(true)
  }

  // ============================================================================
  // RATES HANDLERS
  // ============================================================================

  const addRate = () => {
    if (!newRate.amount || parseFloat(newRate.amount) <= 0) {
      alert('Inserisci un importo valido')
      return
    }
    setRates([...rates, { id: `new_${Date.now()}`, ...newRate, amount: parseFloat(newRate.amount) }])
    setNewRate({ rateType: 'daily', amount: '', validFrom: new Date().toISOString().split('T')[0], validTo: '', appliesWeekdays: true, appliesWeekends: true })
  }

  const removeRate = (rateId) => setRates(rates.filter(r => r.id !== rateId))

  // ============================================================================
  // MAINTENANCE HANDLERS
  // ============================================================================

  const addMaintenance = () => {
    if (!newMaintenance.description || !newMaintenance.scheduledDate) {
      alert('Inserisci descrizione e data')
      return
    }
    setMaintenanceList([...maintenanceList, { id: `new_${Date.now()}`, ...newMaintenance }])
    setNewMaintenance({ description: '', maintenanceType: 'tagliando', scheduledDate: '', durationDays: 1 })
  }

  const removeMaintenance = (id) => setMaintenanceList(maintenanceList.filter(m => m.id !== id))

  // ============================================================================
  // SAVE HANDLER
  // ============================================================================

  const handleSave = async () => {
    if (!formData.type) {
      alert('Seleziona un tipo')
      return
    }
    if (formData.ownership === 'rented' && !formData.ownerCompanyId) {
      alert('Seleziona l\'azienda di noleggio')
      return
    }
    
    try {
      const mainCompany = companies.find(c => c.is_main)
      
      const equipmentDataToSave = {
        project_id: activeProject.id,
        category: formData.category,
        type: formData.type,
        description: formData.description.trim() || null,
        ownership: formData.ownership,
        owner_company_id: formData.ownership === 'owned' ? mainCompany?.id : formData.ownerCompanyId || null,
        serial_number: formData.serialNumber.trim() || null,
        plate_number: formData.plateNumber.trim() || null,
        notes: formData.notes.trim() || null
      }
      
      let equipmentId
      
      if (editingEquipment) {
        const { error } = await supabase.from('equipment').update(equipmentDataToSave).eq('id', editingEquipment.id)
        if (error) throw error
        equipmentId = editingEquipment.id
        
        // Delete old rates
        await supabase.from('equipment_rates').delete().eq('equipment_id', equipmentId)
        
        // Delete removed maintenances
        const existingMaintIds = maintenanceList.filter(m => !String(m.id).startsWith('new_')).map(m => m.id)
        await supabase.from('equipment_maintenance')
          .delete()
          .eq('equipment_id', equipmentId)
          .in('status', ['scheduled', 'notified'])
          .not('id', 'in', `(${existingMaintIds.length > 0 ? existingMaintIds.join(',') : "''"})`)
        
      } else {
        const { data, error } = await supabase.from('equipment').insert([equipmentDataToSave]).select().single()
        if (error) throw error
        equipmentId = data.id
      }
      
      // Insert rates
      if (rates.length > 0) {
        const ratesData = rates.map(r => ({
          equipment_id: equipmentId,
          rate_type: r.rateType,
          amount: parseFloat(r.amount),
          valid_from: r.validFrom,
          valid_to: r.validTo || null,
          applies_weekdays: r.appliesWeekdays,
          applies_weekends: r.appliesWeekends
        }))
        await supabase.from('equipment_rates').insert(ratesData)
      }
      
      // Insert/Update maintenances
      for (const m of maintenanceList) {
        if (String(m.id).startsWith('new_')) {
          await supabase.from('equipment_maintenance').insert({
            equipment_id: equipmentId,
            description: m.description,
            maintenance_type: m.maintenanceType,
            scheduled_date: m.scheduledDate,
            duration_days: m.durationDays
          })
        } else {
          await supabase.from('equipment_maintenance').update({
            description: m.description,
            maintenance_type: m.maintenanceType,
            scheduled_date: m.scheduledDate,
            duration_days: m.durationDays
          }).eq('id', m.id)
        }
      }
      
      setShowModal(false)
      resetForm()
      loadData()
    } catch (err) {
      console.error('Error saving:', err)
      alert('Errore: ' + err.message)
    }
  }

  // ============================================================================
  // DELETE HANDLER
  // ============================================================================
  
  const handleDelete = async (eq) => {
    try {
      // Remove assignments
      await supabase.from('equipment_assignments').update({ status: 'inactive' }).eq('equipment_id', eq.id)
      
      // Soft delete
      const { error } = await supabase.from('equipment').update({ status: 'inactive' }).eq('id', eq.id)
      if (error) throw error
      
      setShowDeleteConfirm(null)
      loadData()
    } catch (err) {
      console.error('Error deleting:', err)
      alert('Errore: ' + err.message)
    }
  }

  // ============================================================================
  // RETURN FROM MAINTENANCE
  // ============================================================================

  const handleReturn = async () => {
    const eq = showReturnModal
    if (!eq) return
    
    try {
      // Find in-progress maintenance
      const maintInProgress = (maintenances[eq.id] || []).find(m => m.status === 'in_progress')
      
      if (maintInProgress) {
        // Complete maintenance
        await supabase.from('equipment_maintenance').update({
          status: 'completed',
          actual_end_date: new Date().toISOString().split('T')[0],
          completion_notes: returnData.notes,
          completed_at: new Date().toISOString()
        }).eq('id', maintInProgress.id)
      }
      
      // Set equipment available
      await supabase.from('equipment').update({ 
        status: 'active',
        last_squad_id: null
      }).eq('id', eq.id)
      
      // Reassign if requested
      if (returnData.reassignToSquad && returnData.squadId) {
        await supabase.from('equipment_assignments').insert({
          equipment_id: eq.id,
          squad_id: returnData.squadId,
          status: 'active',
          notes: 'Riassegnato dopo manutenzione'
        })
      }
      
      setShowReturnModal(null)
      setReturnData({ reassignToSquad: false, squadId: '', notes: '' })
      loadData()
    } catch (err) {
      console.error('Error returning equipment:', err)
      alert('Errore: ' + err.message)
    }
  }

  // ============================================================================
  // NEW TYPE HANDLER
  // ============================================================================
  
  const handleSaveNewType = async () => {
    if (!newTypeForm.labelIt.trim()) {
      alert('Inserisci il nome')
      return
    }
    const typeKey = newTypeForm.labelIt.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (EQUIPMENT_TYPES[typeKey]) {
      alert('Questo tipo esiste già!')
      return
    }
    try {
      await supabase.from('equipment_types').insert([{
        project_id: activeProject.id,
        type_key: typeKey,
        label_it: newTypeForm.labelIt.trim(),
        category: newTypeForm.category
      }])
      setShowNewTypeModal(false)
      setNewTypeForm({ labelIt: '', category: formData.category })
      loadData()
      setTimeout(() => setFormData(prev => ({ ...prev, type: typeKey })), 500)
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  // ============================================================================
  // EXPORT MAINTENANCE HISTORY
  // ============================================================================

  const exportMaintenanceHistory = (eq) => {
    const data = (maintenances[eq.id] || []).map(m => ({
      'Codice Asset': eq.asset_code,
      'Tipo': EQUIPMENT_TYPES[eq.type]?.label || eq.type,
      'Descrizione Manutenzione': m.description,
      'Tipo Manutenzione': MAINTENANCE_TYPES.find(t => t.value === m.maintenance_type)?.label || m.maintenance_type,
      'Data Programmata': m.scheduled_date,
      'Durata (giorni)': m.duration_days,
      'Stato': m.status === 'completed' ? 'Completata' : m.status === 'in_progress' ? 'In Corso' : m.status === 'cancelled' ? 'Annullata' : 'Programmata',
      'Data Fine Effettiva': m.actual_end_date || '',
      'Note Completamento': m.completion_notes || ''
    }))
    
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Storico Manutenzioni')
    XLSX.writeFile(wb, `Manutenzioni_${eq.asset_code}.xlsx`)
  }

  // ============================================================================
  // FILTERS
  // ============================================================================
  
  const filteredEquipment = useMemo(() => {
    return equipment.filter(eq => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        const typeLabel = EQUIPMENT_TYPES[eq.type]?.label || eq.type
        if (!eq.asset_code?.toLowerCase().includes(search) &&
            !typeLabel.toLowerCase().includes(search) &&
            !eq.description?.toLowerCase().includes(search) &&
            !eq.plate_number?.toLowerCase().includes(search)) return false
      }
      if (filterCategory && eq.category !== filterCategory) return false
      if (filterOwnership && eq.ownership !== filterOwnership) return false
      if (filterStatus && eq.status !== filterStatus) return false
      return true
    })
  }, [equipment, searchTerm, filterCategory, filterOwnership, filterStatus, EQUIPMENT_TYPES])

  const typesForCategory = useMemo(() => {
    return Object.entries(EQUIPMENT_TYPES)
      .filter(([_, config]) => config.category === formData.category)
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
  }, [EQUIPMENT_TYPES, formData.category])

  // ============================================================================
  // RENDER - NO PROJECT
  // ============================================================================
  
  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Truck size={64} className="text-gray-300 mb-4" />
        <p className="text-gray-500">Seleziona un progetto</p>
      </div>
    )
  }

  // ============================================================================
  // RENDER - LOADING
  // ============================================================================
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="space-y-4 md:space-y-6 pb-20">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Truck className="text-primary" size={24} />
            Mezzi / Asset
          </h1>
          <p className="text-sm text-gray-500 mt-1">{activeProject.name}</p>
        </div>
        <button onClick={openAddModal} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto py-3 sm:py-2">
          <Plus size={20} />
          Nuovo Asset
        </button>
      </div>

      {/* KPI DASHBOARD */}
      <div className="bg-white rounded-xl border p-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
          <Settings size={16} />
          Riepilogo
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-blue-700">{stats.total}</div>
            <div className="text-xs text-blue-600">Totale</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-green-700">{stats.available}</div>
            <div className="text-xs text-green-600">Disponibili</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-purple-700">{stats.assigned}</div>
            <div className="text-xs text-purple-600">Assegnati</div>
          </div>
          <div className={`rounded-lg p-3 text-center ${stats.maintenanceDue > 0 ? 'bg-amber-100 ring-2 ring-amber-400' : 'bg-amber-50'}`}>
            <div className={`text-xl sm:text-2xl font-bold flex items-center justify-center gap-1 ${stats.maintenanceDue > 0 ? 'text-amber-700' : 'text-amber-600'}`}>
              {stats.maintenanceDue > 0 && <Bell size={16} className="animate-bounce" />}
              {stats.maintenanceDue}
            </div>
            <div className="text-xs text-amber-600">Manutenzione</div>
          </div>
          <div className={`rounded-lg p-3 text-center ${stats.outOfSite > 0 ? 'bg-red-100' : 'bg-red-50'}`}>
            <div className={`text-xl sm:text-2xl font-bold ${stats.outOfSite > 0 ? 'text-red-700' : 'text-red-400'}`}>
              {stats.outOfSite}
            </div>
            <div className="text-xs text-red-600">Fuori Cantiere</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-emerald-700">{stats.owned}</div>
            <div className="text-xs text-emerald-600">Proprietà</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-orange-700">{stats.rented}</div>
            <div className="text-xs text-orange-600">Noleggio</div>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white rounded-xl border p-3">
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca per codice, tipo, targa..."
              className="w-full pl-10 pr-4 py-3 border rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">Categoria</option>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">Stato</option>
              <option value="active">Disponibile</option>
              <option value="maintenance_scheduled">Manutenzione</option>
              <option value="out_of_site">Fuori Cantiere</option>
            </select>
            <select value={filterOwnership} onChange={(e) => setFilterOwnership(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">Proprietà</option>
              {Object.entries(OWNERSHIP_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* EQUIPMENT LIST */}
      <div className="bg-white rounded-xl border">
        {filteredEquipment.length === 0 ? (
          <div className="p-8 text-center">
            <Truck size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">{equipment.length === 0 ? 'Nessun asset registrato' : 'Nessun risultato'}</p>
            {equipment.length === 0 && (
              <button onClick={openAddModal} className="btn-primary"><Plus size={18} className="mr-2" />Aggiungi</button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filteredEquipment.map(eq => {
              const typeConfig = EQUIPMENT_TYPES[eq.type] || { label: eq.type }
              const squad = assignments[eq.id]
              const eqMaints = maintenances[eq.id] || []
              const nextMaint = eqMaints.find(m => m.status === 'scheduled' || m.status === 'notified')
              const daysUntilMaint = nextMaint ? Math.ceil((new Date(nextMaint.scheduled_date) - new Date()) / (1000 * 60 * 60 * 24)) : null
              
              return (
                <div key={eq.id} className="p-3 md:p-4 hover:bg-gray-50">
                  <div className="flex flex-col gap-3">
                    {/* Main info row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-primary text-sm">{eq.asset_code}</span>
                          <CategoryBadge category={eq.category} size="small" />
                          <StatusBadge status={eq.status} />
                        </div>
                        <div className="mt-1">
                          <span className="font-medium text-gray-800">{typeConfig.label}</span>
                          {eq.description && <span className="text-gray-500 text-sm ml-2">- {eq.description}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                          {eq.plate_number && <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{eq.plate_number}</span>}
                          <OwnershipBadge ownership={eq.ownership} />
                          {squad && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                              <Users size={10} />
                              {squad.name || `Sq. ${squad.squad_number}`}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions - Vertical on mobile */}
                      <div className="flex flex-col sm:flex-row gap-1">
                        {eq.status === 'out_of_site' && (
                          <button
                            onClick={() => {
                              setReturnData({ reassignToSquad: !!eq.last_squad_id, squadId: eq.last_squad_id || '', notes: '' })
                              setShowReturnModal(eq)
                            }}
                            className="p-2.5 bg-green-100 hover:bg-green-200 rounded-lg text-green-700"
                            title="Riporta disponibile"
                          >
                            <RotateCcw size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => setShowMaintenanceHistory(eq)}
                          className="p-2.5 hover:bg-gray-100 rounded-lg text-gray-600"
                          title="Storico manutenzioni"
                        >
                          <History size={18} />
                        </button>
                        <button onClick={() => openEditModal(eq)} className="p-2.5 hover:bg-blue-100 rounded-lg text-blue-600" title="Modifica">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => setShowDeleteConfirm(eq)} className="p-2.5 hover:bg-red-100 rounded-lg text-red-600" title="Elimina">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Maintenance alert */}
                    {nextMaint && daysUntilMaint !== null && daysUntilMaint <= 7 && (
                      <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
                        daysUntilMaint <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        <CalendarClock size={14} />
                        <span className="font-medium">
                          {daysUntilMaint <= 0 ? 'Manutenzione oggi!' : `Manutenzione tra ${daysUntilMaint} giorn${daysUntilMaint === 1 ? 'o' : 'i'}`}
                        </span>
                        <span className="text-gray-600">- {nextMaint.description}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ============ MODAL NUOVO/MODIFICA ============ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-xl sm:m-4 sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-xl">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-800">
                {editingEquipment ? 'Modifica Asset' : 'Nuovo Asset'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Asset Code */}
              {editingEquipment ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="text-xs font-medium text-blue-700">Codice Asset</label>
                  <div className="font-mono text-lg font-bold text-blue-800">{editingEquipment.asset_code}</div>
                </div>
              ) : (
                <div className="bg-gray-50 border rounded-lg p-3 text-sm text-gray-600">
                  <Hash size={14} className="inline mr-1" />
                  Il codice asset verrà generato automaticamente
                </div>
              )}
              
              {/* Category & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value, type: '' })}
                    className="w-full px-3 py-3 border rounded-lg"
                  >
                    {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="flex-1 px-3 py-3 border rounded-lg"
                    >
                      <option value="">-- Seleziona --</option>
                      {typesForCategory.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setNewTypeForm({ labelIt: '', category: formData.category }); setShowNewTypeModal(true) }}
                      className="px-4 py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                    >
                      <PlusCircle size={20} />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-3 border rounded-lg"
                  placeholder="Es: Gru 50 ton marca..."
                />
              </div>
              
              {/* Ownership */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proprietà</label>
                  <select
                    value={formData.ownership}
                    onChange={(e) => setFormData({ ...formData, ownership: e.target.value, ownerCompanyId: '' })}
                    className="w-full px-3 py-3 border rounded-lg"
                  >
                    <option value="owned">Proprietà (Aziendale)</option>
                    <option value="rented">Noleggio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.ownership === 'owned' ? 'Azienda' : 'Azienda Noleggio *'}
                  </label>
                  {formData.ownership === 'owned' ? (
                    <div className="px-3 py-3 border rounded-lg bg-gray-50 text-gray-600 flex items-center gap-2">
                      <Star size={14} className="text-yellow-500" />
                      {companies.find(c => c.is_main)?.company_name || 'Principale'}
                    </div>
                  ) : (
                    <select
                      value={formData.ownerCompanyId}
                      onChange={(e) => setFormData({ ...formData, ownerCompanyId: e.target.value })}
                      className="w-full px-3 py-3 border rounded-lg"
                    >
                      <option value="">-- Seleziona --</option>
                      {companies.filter(c => !c.is_main).map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                    </select>
                  )}
                </div>
              </div>
              
              {/* Plate & Serial */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Targa</label>
                  <input
                    type="text"
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-3 border rounded-lg font-mono"
                    placeholder="AB123CD"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seriale</label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full px-3 py-3 border rounded-lg font-mono"
                  />
                </div>
              </div>
              
              {/* RATES SECTION */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <DollarSign size={18} />
                  Tariffe
                </h3>
                
                {rates.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {rates.map(rate => (
                      <div key={rate.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div>
                          <span className="font-medium text-sm">{RATE_TYPES[rate.rateType]?.label}</span>
                          <span className="text-green-600 font-bold ml-2">€{parseFloat(rate.amount).toFixed(2)}</span>
                        </div>
                        <button onClick={() => removeRate(rate.id)} className="p-2 hover:bg-red-100 rounded text-red-600">
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select value={newRate.rateType} onChange={(e) => setNewRate({ ...newRate, rateType: e.target.value })} className="px-3 py-2 border rounded text-sm">
                      {Object.entries(RATE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={newRate.amount}
                      onChange={(e) => setNewRate({ ...newRate, amount: e.target.value })}
                      className="px-3 py-2 border rounded text-sm"
                      placeholder="€ Importo"
                    />
                  </div>
                  <button onClick={addRate} className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium flex items-center justify-center gap-1">
                    <Plus size={16} />
                    Aggiungi Tariffa
                  </button>
                </div>
              </div>
              
              {/* MAINTENANCE SECTION */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <CalendarClock size={18} />
                  Manutenzioni Programmate
                </h3>
                
                {maintenanceList.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {maintenanceList.map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-amber-50 rounded-lg p-3">
                        <div>
                          <span className="font-medium text-sm">{m.description}</span>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {new Date(m.scheduledDate).toLocaleDateString('it-IT')} • {m.durationDays} giorn{m.durationDays === 1 ? 'o' : 'i'}
                          </div>
                        </div>
                        <button onClick={() => removeMaintenance(m.id)} className="p-2 hover:bg-red-100 rounded text-red-600">
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="bg-amber-50 rounded-lg p-3 space-y-2">
                  <input
                    type="text"
                    value={newMaintenance.description}
                    onChange={(e) => setNewMaintenance({ ...newMaintenance, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded text-sm"
                    placeholder="Descrizione (es: Tagliando annuale)"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={newMaintenance.maintenanceType}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, maintenanceType: e.target.value })}
                      className="px-2 py-2 border rounded text-sm"
                    >
                      {MAINTENANCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <input
                      type="date"
                      value={newMaintenance.scheduledDate}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, scheduledDate: e.target.value })}
                      className="px-2 py-2 border rounded text-sm"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        value={newMaintenance.durationDays}
                        onChange={(e) => setNewMaintenance({ ...newMaintenance, durationDays: parseInt(e.target.value) || 1 })}
                        className="w-14 px-2 py-2 border rounded text-sm"
                      />
                      <span className="text-xs text-gray-600">gg</span>
                    </div>
                  </div>
                  <button onClick={addMaintenance} className="w-full py-2 bg-amber-600 text-white rounded text-sm font-medium flex items-center justify-center gap-1">
                    <Plus size={16} />
                    Aggiungi Manutenzione
                  </button>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t p-4 flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">
                Annulla
              </button>
              <button onClick={handleSave} className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium flex items-center justify-center gap-2">
                <Check size={18} />
                {editingEquipment ? 'Salva' : 'Crea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUOVO TIPO */}
      {showNewTypeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <PlusCircle className="text-green-600" size={20} />
              Nuovo Tipo
            </h2>
            <div className="space-y-3">
              <select
                value={newTypeForm.category}
                onChange={(e) => setNewTypeForm({ ...newTypeForm, category: e.target.value })}
                className="w-full px-3 py-3 border rounded-lg"
              >
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input
                type="text"
                value={newTypeForm.labelIt}
                onChange={(e) => setNewTypeForm({ ...newTypeForm, labelIt: e.target.value })}
                className="w-full px-3 py-3 border rounded-lg"
                placeholder="Nome tipo"
                autoFocus
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNewTypeModal(false)} className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg">Annulla</button>
              <button onClick={handleSaveNewType} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg">Salva</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL STORICO MANUTENZIONI */}
      {showMaintenanceHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-xl sm:m-4 sm:max-w-2xl max-h-[85vh] flex flex-col rounded-t-xl">
            <div className="border-b p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <History size={20} />
                  Storico Manutenzioni
                </h2>
                <p className="text-sm text-gray-500">{showMaintenanceHistory.asset_code} - {EQUIPMENT_TYPES[showMaintenanceHistory.type]?.label}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => exportMaintenanceHistory(showMaintenanceHistory)}
                  className="p-2.5 bg-green-100 hover:bg-green-200 rounded-lg text-green-700"
                  title="Esporta Excel"
                >
                  <Download size={20} />
                </button>
                <button onClick={() => setShowMaintenanceHistory(null)} className="p-2.5 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {(maintenances[showMaintenanceHistory.id] || []).length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nessuna manutenzione registrata</p>
              ) : (
                <div className="space-y-3">
                  {(maintenances[showMaintenanceHistory.id] || []).map(m => (
                    <div key={m.id} className={`p-4 rounded-lg border ${
                      m.status === 'completed' ? 'bg-green-50 border-green-200' :
                      m.status === 'in_progress' ? 'bg-amber-50 border-amber-200' :
                      m.status === 'cancelled' ? 'bg-gray-50 border-gray-200' :
                      'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-start justify-between">
                        <span className="font-medium">{m.description}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          m.status === 'completed' ? 'bg-green-200 text-green-800' :
                          m.status === 'in_progress' ? 'bg-amber-200 text-amber-800' :
                          m.status === 'cancelled' ? 'bg-gray-200 text-gray-800' :
                          'bg-blue-200 text-blue-800'
                        }`}>
                          {m.status === 'completed' ? 'Completata' : m.status === 'in_progress' ? 'In Corso' : m.status === 'cancelled' ? 'Annullata' : 'Programmata'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-2 flex items-center gap-2">
                        <Calendar size={14} />
                        {new Date(m.scheduled_date).toLocaleDateString('it-IT')} • {m.duration_days} giorn{m.duration_days === 1 ? 'o' : 'i'}
                        {m.maintenance_type && (
                          <span className="bg-white px-2 py-0.5 rounded text-xs">
                            {MAINTENANCE_TYPES.find(t => t.value === m.maintenance_type)?.label}
                          </span>
                        )}
                      </div>
                      {m.actual_end_date && (
                        <div className="text-xs text-gray-500 mt-2">
                          ✓ Completata il {new Date(m.actual_end_date).toLocaleDateString('it-IT')}
                          {m.completion_notes && <span className="block mt-1">Note: {m.completion_notes}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="border-t p-4">
              <button onClick={() => setShowMaintenanceHistory(null)} className="w-full py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium">
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RITORNO MEZZO */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
              <RotateCcw className="text-green-600" size={20} />
              Riporta Disponibile
            </h2>
            <p className="text-gray-600 mb-4">
              Asset: <strong>{showReturnModal.asset_code}</strong>
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={returnData.reassignToSquad}
                    onChange={(e) => setReturnData({ ...returnData, reassignToSquad: e.target.checked })}
                    className="w-5 h-5 rounded"
                  />
                  <span className="font-medium text-gray-700">Riassegna a squadra</span>
                </label>
                
                {returnData.reassignToSquad && (
                  <select
                    value={returnData.squadId}
                    onChange={(e) => setReturnData({ ...returnData, squadId: e.target.value })}
                    className="w-full mt-2 px-3 py-3 border rounded-lg"
                  >
                    <option value="">-- Seleziona squadra --</option>
                    {squads.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name || `Squadra ${s.squad_number}`}
                        {s.id === showReturnModal.last_squad_id && ' ★ (precedente)'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (opzionale)</label>
                <textarea
                  value={returnData.notes}
                  onChange={(e) => setReturnData({ ...returnData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Note sul completamento manutenzione..."
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowReturnModal(null)} className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg font-medium">
                Annulla
              </button>
              <button onClick={handleReturn} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                <Check size={18} />
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFERMA ELIMINAZIONE */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Elimina Asset</h3>
                <p className="text-sm text-gray-500">{showDeleteConfirm.asset_code}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-4">Sei sicuro? L'asset verrà disattivato e rimosso dalle squadre.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg font-medium">Annulla</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                <Trash2 size={18} />
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
