import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import { 
  Truck, Package, Wrench, Plus, Search, Filter, X, Edit, Trash2,
  ChevronDown, Building2, Calendar, DollarSign, FileText, AlertTriangle,
  CheckCircle2, Clock, Download, History, RotateCcw, Users
} from 'lucide-react'

// ============================================================================
// CONFIGURAZIONE TIPI MEZZI (90+ tipi predefiniti)
// ============================================================================

const EQUIPMENT_TYPES = {
  vehicle: {
    label: 'Mezzi',
    icon: Truck,
    color: 'bg-blue-100 text-blue-800',
    types: [
      'Autocarro', 'Autoarticolato', 'Furgone', 'Pick-up', 'Auto Aziendale',
      'Autobus/Minibus', 'Autogru', 'Camion con Gru', 'Bisarca', 'Betoniera',
      'Autopompa', 'Cisterna', 'Rimorchio', 'Semirimorchio', 'Carrello Appendice'
    ]
  },
  equipment: {
    label: 'Equipment',
    icon: Package,
    color: 'bg-green-100 text-green-800',
    types: [
      'Gru a Torre', 'Gru Mobile', 'Gru Cingolata', 'Autogru', 'Gru su Camion',
      'Carrello Elevatore', 'Sollevatore Telescopico', 'Piattaforma Aerea', 'Cestello',
      'Paranchi e Argani', 'Verricello', 'Ponte Gru',
      'Escavatore', 'Mini Escavatore', 'Escavatore Cingolato', 'Escavatore Gommato',
      'Pala Caricatrice', 'Pala Gommata', 'Pala Cingolata', 'Skid Loader', 'Terna',
      'Bulldozer', 'Apripista', 'Ruspa', 'Dumper', 'Motocarriola',
      'Rullo Compattatore', 'Rullo Vibrante', 'Piastra Vibrante', 'Compattatore',
      'Trivella', 'Perforatrice', 'Sonda', 'Martello Demolitore',
      'Generatore', 'Gruppo Elettrogeno', 'Compressore', 'Compressore Aria',
      'Motosaldatrice', 'Trasformatore', 'Quadro Elettrico Mobile',
      'Pompa Acqua', 'Pompa Sommersa', 'Motopompa', 'Idropulitrice', 'Betonpompa',
      'Container Ufficio', 'Container Magazzino', 'Container Spogliatoio',
      'Modulo Bagni', 'Modulo Mensa', 'Box Prefabbricato',
      'Torre Faro', 'Proiettore Mobile', 'Faro da Cantiere',
      'Serbatoio Carburante', 'Serbatoio Acqua', 'Silos', 'Tramoggia',
      'Nastro Trasportatore', 'Vibrovaglio', 'Frantoio Mobile', 'Betoniera Fissa'
    ]
  },
  tool: {
    label: 'Attrezzi',
    icon: Wrench,
    color: 'bg-orange-100 text-orange-800',
    types: [
      'Saldatrice MIG/MAG', 'Saldatrice TIG', 'Saldatrice Elettrodo', 'Saldatrice Inverter',
      'Saldatrice a Filo', 'Cannello Ossiacetilenico', 'Tagliatrice Plasma',
      'Smerigliatrice', 'Smerigliatrice Angolare', 'Flex', 'Flessibile',
      'Troncatrice', 'Seghetto Alternativo', 'Sega Circolare', 'Sega a Nastro',
      'Mola da Banco', 'Cesoia', 'Roditrice',
      'Trapano', 'Trapano a Colonna', 'Trapano Magnetico', 'Avvitatore',
      'Tassellatore', 'Martello Perforatore', 'Carotatrice',
      'Filettatrice', 'Maschiatore', 'Tagliatubi', 'Curvatubi', 'Svasatore',
      'Paranco a Catena', 'Tirfor', 'Martinetto Idraulico', 'Cric',
      'Transpallet', 'Carrello Porta Bombole',
      'Livella Laser', 'Stazione Totale', 'Teodolite', 'Metro Laser',
      'Spessimetro', 'Durometro', 'Cercafase', 'Multimetro',
      'Avvitatore Pneumatico', 'Chiave Pneumatica', 'Martello Pneumatico',
      'Scalpellatore Pneumatico', 'Pistola Soffiaggio',
      'Aspiratore Industriale', 'Ventilatore', 'Deumidificatore',
      'Riscaldatore', 'Stufa da Cantiere', 'Pistola Termica'
    ]
  }
}

const MAINTENANCE_TYPES = [
  { value: 'tagliando', label: 'Tagliando' },
  { value: 'revisione', label: 'Revisione' },
  { value: 'riparazione', label: 'Riparazione' },
  { value: 'certificazione', label: 'Certificazione' },
  { value: 'ispezione', label: 'Ispezione' },
  { value: 'altro', label: 'Altro' }
]

const RATE_TYPES = [
  { value: 'hourly', label: '/ora' },
  { value: 'daily', label: '/giorno' },
  { value: 'weekly', label: '/settimana' },
  { value: 'monthly', label: '/mese' },
  { value: 'lump_sum', label: 'Forfait' }
]

// ============================================================================
// COMPONENTI HELPER
// ============================================================================

const StatusBadge = ({ status }) => {
  const configs = {
    active: { label: 'Disponibile', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    maintenance_scheduled: { label: 'Manutenzione Prevista', color: 'bg-amber-100 text-amber-700', icon: Clock },
    out_of_site: { label: 'Fuori Cantiere', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
    inactive: { label: 'Disattivato', color: 'bg-gray-100 text-gray-500', icon: X }
  }
  const config = configs[status] || configs.active
  const Icon = config.icon
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon size={12} />
      {config.label}
    </span>
  )
}

const CategoryBadge = ({ category }) => {
  const config = EQUIPMENT_TYPES[category] || EQUIPMENT_TYPES.equipment
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon size={12} />
      {config.label}
    </span>
  )
}

// ============================================================================
// COMPONENTE PRINCIPALE
// ============================================================================

export default function Mezzi() {
  const { t } = useTranslation()
  const { activeProject, loading: projectLoading } = useProject()
  
  // Data state
  const [equipment, setEquipment] = useState([])
  const [companies, setCompanies] = useState([])
  const [squads, setSquads] = useState([])
  const [maintenances, setMaintenances] = useState({})
  const [assignments, setAssignments] = useState({})
  const [loading, setLoading] = useState(true)
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterOwnership, setFilterOwnership] = useState('')
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showHistoryModal, setShowHistoryModal] = useState(null)
  const [showReturnModal, setShowReturnModal] = useState(null)
  
  // Form state
  const [formData, setFormData] = useState({
    category: 'equipment',
    type: '',
    customType: '',
    description: '',
    plate_number: '',
    serial_number: '',
    ownership: 'owned',
    owner_company_id: '',
    rental_rate: '',
    rate_type: 'daily',
    arrival_date: '',
    notes: ''
  })
  
  // Maintenance form - OPZIONALE
  const [maintenanceEntries, setMaintenanceEntries] = useState([])

  // ============================================================================
  // DATA FETCHING
  // ============================================================================
  
  useEffect(() => {
    if (activeProject?.id) {
      loadData()
    }
  }, [activeProject?.id])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: eqData } = await supabase
        .from('equipment')
        .select('*, owner_company:companies(id, company_name, is_main)')
        .eq('project_id', activeProject.id)
        .neq('status', 'inactive')
        .order('created_at', { ascending: false })
      setEquipment(eqData || [])
      
      const { data: compData } = await supabase
        .from('companies')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
      setCompanies(compData || [])
      
      const { data: squadData } = await supabase
        .from('squads')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
      setSquads(squadData || [])
      
      // Maintenances per equipment (se tabella esiste)
      try {
        const { data: maintData } = await supabase
          .from('equipment_maintenance')
          .select('*')
          .in('equipment_id', (eqData || []).map(e => e.id))
          .order('scheduled_date', { ascending: true })
        
        const maintMap = {}
        ;(maintData || []).forEach(m => {
          if (!maintMap[m.equipment_id]) maintMap[m.equipment_id] = []
          maintMap[m.equipment_id].push(m)
        })
        setMaintenances(maintMap)
      } catch (e) {
        console.log('Maintenance table not available yet')
        setMaintenances({})
      }
      
      // Assignments
      const { data: assignData } = await supabase
        .from('equipment_assignments')
        .select('*, squad:squads(id, name, squad_number)')
        .in('equipment_id', (eqData || []).map(e => e.id))
        .eq('status', 'active')
      
      const assignMap = {}
      ;(assignData || []).forEach(a => {
        assignMap[a.equipment_id] = a
      })
      setAssignments(assignMap)
      
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // STATS / KPI
  // ============================================================================
  
  const stats = useMemo(() => {
    const total = equipment.length
    const active = equipment.filter(e => e.status === 'active').length
    const maintenanceDue = equipment.filter(e => e.status === 'maintenance_scheduled').length
    const outOfSite = equipment.filter(e => e.status === 'out_of_site').length
    const assigned = Object.keys(assignments).length
    const owned = equipment.filter(e => e.ownership === 'owned').length
    const rented = equipment.filter(e => e.ownership === 'rented').length
    
    return { total, active, maintenanceDue, outOfSite, assigned, owned, rented }
  }, [equipment, assignments])

  // ============================================================================
  // FILTERS
  // ============================================================================
  
  const filteredEquipment = useMemo(() => {
    return equipment.filter(eq => {
      if (filterCategory && eq.category !== filterCategory) return false
      if (filterStatus && eq.status !== filterStatus) return false
      if (filterOwnership && eq.ownership !== filterOwnership) return false
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        const matches = 
          eq.type?.toLowerCase().includes(search) ||
          eq.description?.toLowerCase().includes(search) ||
          eq.plate_number?.toLowerCase().includes(search) ||
          eq.serial_number?.toLowerCase().includes(search) ||
          eq.asset_code?.toLowerCase().includes(search)
        if (!matches) return false
      }
      return true
    })
  }, [equipment, filterCategory, filterStatus, filterOwnership, searchTerm])

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================
  
  const resetForm = () => {
    setFormData({
      category: 'equipment',
      type: '',
      customType: '',
      description: '',
      plate_number: '',
      serial_number: '',
      ownership: 'owned',
      owner_company_id: '',
      rental_rate: '',
      rate_type: 'daily',
      arrival_date: '',
      notes: ''
    })
    setMaintenanceEntries([])
    setEditingEquipment(null)
  }

  const openEditModal = (eq) => {
    setFormData({
      category: eq.category || 'equipment',
      type: eq.type || '',
      customType: '',
      description: eq.description || '',
      plate_number: eq.plate_number || '',
      serial_number: eq.serial_number || '',
      ownership: eq.ownership || 'owned',
      owner_company_id: eq.owner_company_id || '',
      rental_rate: eq.rental_rate || '',
      rate_type: eq.rate_type || 'daily',
      arrival_date: eq.arrival_date || '',
      notes: eq.notes || ''
    })
    setMaintenanceEntries([])
    setEditingEquipment(eq)
    setShowCreateModal(true)
  }

  const handleSave = async () => {
    const typeValue = formData.type === 'altro' ? formData.customType : formData.type
    
    if (!typeValue) {
      alert('Seleziona o inserisci un tipo di mezzo')
      return
    }
    
    try {
      const equipmentData = {
        project_id: activeProject.id,
        category: formData.category,
        type: typeValue,
        description: formData.description || null,
        plate_number: formData.plate_number || null,
        serial_number: formData.serial_number || null,
        ownership: formData.ownership,
        owner_company_id: formData.ownership === 'rented' && formData.owner_company_id ? formData.owner_company_id : null,
        rental_rate: formData.ownership === 'rented' && formData.rental_rate ? parseFloat(formData.rental_rate) : null,
        rate_type: formData.ownership === 'rented' ? formData.rate_type : null,
        arrival_date: formData.arrival_date || null,
        notes: formData.notes || null,
        status: 'active'
      }
      
      let equipmentId
      
      if (editingEquipment) {
        const { error } = await supabase
          .from('equipment')
          .update({ ...equipmentData, updated_at: new Date().toISOString() })
          .eq('id', editingEquipment.id)
        
        if (error) throw error
        equipmentId = editingEquipment.id
      } else {
        const { data: newEq, error } = await supabase
          .from('equipment')
          .insert(equipmentData)
          .select()
          .single()
        
        if (error) throw error
        equipmentId = newEq.id
      }
      
      // Salva manutenzioni se presenti (OPZIONALE)
      if (maintenanceEntries.length > 0 && equipmentId) {
        const maintInserts = maintenanceEntries
          .filter(m => m.description && m.scheduled_date)
          .map(m => ({
            equipment_id: equipmentId,
            description: m.description,
            maintenance_type: m.maintenance_type || 'altro',
            scheduled_date: m.scheduled_date,
            duration_days: m.duration_days || 1,
            status: 'scheduled'
          }))
        
        if (maintInserts.length > 0) {
          try {
            const { error: maintError } = await supabase
              .from('equipment_maintenance')
              .insert(maintInserts)
            
            if (maintError) console.error('Error saving maintenance:', maintError)
          } catch (e) {
            console.log('Maintenance table not available')
          }
        }
      }
      
      setShowCreateModal(false)
      resetForm()
      loadData()
    } catch (err) {
      console.error('Error saving equipment:', err)
      alert('Errore: ' + err.message)
    }
  }

  const handleDelete = async (eq) => {
    try {
      const { error } = await supabase
        .from('equipment')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', eq.id)
      
      if (error) throw error
      
      setShowDeleteConfirm(null)
      loadData()
    } catch (err) {
      console.error('Error deleting equipment:', err)
      alert('Errore: ' + err.message)
    }
  }

  // ============================================================================
  // MAINTENANCE HANDLERS
  // ============================================================================
  
  const addMaintenanceEntry = () => {
    setMaintenanceEntries(prev => [...prev, {
      description: '',
      maintenance_type: 'tagliando',
      scheduled_date: '',
      duration_days: 1
    }])
  }
  
  const updateMaintenanceEntry = (index, field, value) => {
    setMaintenanceEntries(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }
  
  const removeMaintenanceEntry = (index) => {
    setMaintenanceEntries(prev => prev.filter((_, i) => i !== index))
  }

  // ============================================================================
  // RETURN FROM MAINTENANCE
  // ============================================================================
  
  const [returnFormData, setReturnFormData] = useState({
    reassignToSquad: false,
    squadId: '',
    completionNotes: ''
  })
  
  const handleReturn = async () => {
    if (!showReturnModal) return
    
    try {
      const activeMaint = (maintenances[showReturnModal.id] || [])
        .find(m => m.status === 'in_progress')
      
      if (activeMaint) {
        await supabase
          .from('equipment_maintenance')
          .update({
            status: 'completed',
            actual_end_date: new Date().toISOString().split('T')[0],
            completion_notes: returnFormData.completionNotes || null,
            completed_at: new Date().toISOString()
          })
          .eq('id', activeMaint.id)
      }
      
      await supabase
        .from('equipment')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', showReturnModal.id)
      
      if (returnFormData.reassignToSquad && returnFormData.squadId) {
        await supabase
          .from('equipment_assignments')
          .insert({
            equipment_id: showReturnModal.id,
            squad_id: returnFormData.squadId,
            status: 'active'
          })
        
        await supabase
          .from('equipment')
          .update({ last_squad_id: null })
          .eq('id', showReturnModal.id)
      }
      
      setShowReturnModal(null)
      setReturnFormData({ reassignToSquad: false, squadId: '', completionNotes: '' })
      loadData()
    } catch (err) {
      console.error('Error returning equipment:', err)
      alert('Errore: ' + err.message)
    }
  }

  // ============================================================================
  // HISTORY EXPORT
  // ============================================================================
  
  const exportMaintenanceHistory = (eq) => {
    const history = maintenances[eq.id] || []
    
    if (history.length === 0) {
      alert('Nessuna manutenzione da esportare')
      return
    }
    
    const exportData = history.map(m => ({
      'Descrizione': m.description,
      'Tipo': MAINTENANCE_TYPES.find(t => t.value === m.maintenance_type)?.label || m.maintenance_type,
      'Data Programmata': m.scheduled_date,
      'Durata (giorni)': m.duration_days,
      'Stato': m.status === 'completed' ? 'Completata' : m.status === 'in_progress' ? 'In Corso' : m.status === 'cancelled' ? 'Annullata' : 'Programmata',
      'Data Completamento': m.actual_end_date || '',
      'Note': m.completion_notes || ''
    }))
    
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Manutenzioni')
    XLSX.writeFile(wb, `Manutenzioni_${eq.asset_code || eq.type}.xlsx`)
  }

  // ============================================================================
  // RENDER
  // ============================================================================
  
  if (projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Truck size={64} className="text-gray-300 mb-4" />
        <p className="text-gray-500">Seleziona un progetto</p>
      </div>
    )
  }

  const typesForCategory = EQUIPMENT_TYPES[formData.category]?.types || []

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Truck className="text-primary" />
            Mezzi / Equipment
          </h1>
          <p className="text-gray-500 mt-1">{activeProject.name} • {equipment.length} mezzi registrati</p>
        </div>
        
        <button
          onClick={() => { resetForm(); setShowCreateModal(true) }}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus size={20} />
          Nuovo Mezzo
        </button>
      </div>

      {/* KPI DASHBOARD */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          <KPICard value={stats.total} label="Totale" color="bg-gray-50" />
          <KPICard value={stats.active} label="Disponibili" color="bg-green-50" textColor="text-green-600" />
          <KPICard value={stats.assigned} label="Assegnati" color="bg-blue-50" textColor="text-blue-600" />
          <KPICard value={stats.maintenanceDue} label="Manutenzione" color="bg-amber-50" textColor="text-amber-600" highlight={stats.maintenanceDue > 0} />
          <KPICard value={stats.outOfSite} label="Fuori Cantiere" color="bg-red-50" textColor="text-red-600" highlight={stats.outOfSite > 0} />
          <KPICard value={stats.owned} label="Proprietà" color="bg-purple-50" textColor="text-purple-600" />
          <KPICard value={stats.rented} label="Noleggio" color="bg-cyan-50" textColor="text-cyan-600" />
        </div>
      </div>

      {/* FILTRI */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cerca per tipo, descrizione, targa, codice..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2.5 border rounded-lg">
            <option value="">Tutte le categorie</option>
            {Object.entries(EQUIPMENT_TYPES).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 border rounded-lg">
            <option value="">Tutti gli stati</option>
            <option value="active">Disponibile</option>
            <option value="maintenance_scheduled">Manutenzione Prevista</option>
            <option value="out_of_site">Fuori Cantiere</option>
          </select>
          
          <select value={filterOwnership} onChange={e => setFilterOwnership(e.target.value)} className="px-3 py-2.5 border rounded-lg">
            <option value="">Proprietà/Noleggio</option>
            <option value="owned">Proprietà</option>
            <option value="rented">Noleggio</option>
          </select>
        </div>
      </div>

      {/* LISTA MEZZI */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredEquipment.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Truck size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">{equipment.length === 0 ? 'Nessun mezzo registrato' : 'Nessun risultato'}</p>
            {equipment.length === 0 && (
              <button onClick={() => { resetForm(); setShowCreateModal(true) }} className="btn-primary">
                Aggiungi il primo mezzo
              </button>
            )}
          </div>
        ) : (
          filteredEquipment.map(eq => (
            <EquipmentCard
              key={eq.id}
              equipment={eq}
              maintenance={maintenances[eq.id]}
              assignment={assignments[eq.id]}
              onEdit={() => openEditModal(eq)}
              onDelete={() => setShowDeleteConfirm(eq)}
              onShowHistory={() => setShowHistoryModal(eq)}
              onReturn={() => setShowReturnModal(eq)}
            />
          ))
        )}
      </div>

      {/* CREATE/EDIT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl sm:max-h-[90vh] max-h-[85vh] flex flex-col rounded-t-xl">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-xl">
              <h2 className="text-lg font-semibold">{editingEquipment ? 'Modifica Mezzo' : 'Nuovo Mezzo'}</h2>
              <button onClick={() => { setShowCreateModal(false); resetForm() }} className="p-2 hover:bg-gray-200 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(EQUIPMENT_TYPES).map(([key, config]) => {
                    const Icon = config.icon
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, category: key, type: '' }))}
                        className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                          formData.category === key ? 'border-primary bg-primary/10' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon size={20} className={formData.category === key ? 'text-primary' : 'text-gray-500'} />
                        <span className="text-sm font-medium">{config.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              
              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2.5 border rounded-lg"
                >
                  <option value="">Seleziona tipo...</option>
                  {typesForCategory.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                  <option value="altro">Altro (specifica)</option>
                </select>
                
                {formData.type === 'altro' && (
                  <input
                    type="text"
                    value={formData.customType}
                    onChange={e => setFormData(prev => ({ ...prev, customType: e.target.value }))}
                    placeholder="Specifica il tipo..."
                    className="w-full mt-2 px-3 py-2.5 border rounded-lg"
                  />
                )}
              </div>
              
              {/* Descrizione */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione / Note identificative</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="es. Escavatore CAT 320, Muletto Toyota..."
                  className="w-full px-3 py-2.5 border rounded-lg"
                />
              </div>
              
              {/* Targa e Matricola */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Targa</label>
                  <input
                    type="text"
                    value={formData.plate_number}
                    onChange={e => setFormData(prev => ({ ...prev, plate_number: e.target.value.toUpperCase() }))}
                    placeholder="AA000BB"
                    className="w-full px-3 py-2.5 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Matricola / S/N</label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={e => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                    placeholder="Numero seriale"
                    className="w-full px-3 py-2.5 border rounded-lg"
                  />
                </div>
              </div>
              
              {/* Data Arrivo Cantiere */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Arrivo Cantiere / Inizio Noleggio</label>
                <input
                  type="date"
                  value={formData.arrival_date}
                  onChange={e => setFormData(prev => ({ ...prev, arrival_date: e.target.value }))}
                  className="w-full px-3 py-2.5 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Da quando è disponibile questo mezzo? (opzionale)</p>
              </div>
              
              {/* Proprietà */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proprietà</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, ownership: 'owned' }))}
                    className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                      formData.ownership === 'owned' ? 'border-primary bg-primary/10' : 'border-gray-200'
                    }`}
                  >
                    <Building2 size={18} />
                    <span>Proprietà</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, ownership: 'rented' }))}
                    className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                      formData.ownership === 'rented' ? 'border-primary bg-primary/10' : 'border-gray-200'
                    }`}
                  >
                    <DollarSign size={18} />
                    <span>Noleggio</span>
                  </button>
                </div>
              </div>
              
              {/* Campi Noleggio */}
              {formData.ownership === 'rented' && (
                <div className="p-4 bg-cyan-50 rounded-lg space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Azienda Noleggiante</label>
                    <select
                      value={formData.owner_company_id}
                      onChange={e => setFormData(prev => ({ ...prev, owner_company_id: e.target.value }))}
                      className="w-full px-3 py-2.5 border rounded-lg"
                    >
                      <option value="">Seleziona azienda...</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.company_name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tariffa (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.rental_rate}
                        onChange={e => setFormData(prev => ({ ...prev, rental_rate: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3 py-2.5 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Tariffa</label>
                      <select
                        value={formData.rate_type}
                        onChange={e => setFormData(prev => ({ ...prev, rate_type: e.target.value }))}
                        className="w-full px-3 py-2.5 border rounded-lg"
                      >
                        {RATE_TYPES.map(rt => (
                          <option key={rt.value} value={rt.value}>{rt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Note aggiuntive..."
                  className="w-full px-3 py-2.5 border rounded-lg resize-none"
                />
              </div>
              
              {/* MANUTENZIONI - OPZIONALE */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">Manutenzioni Programmate (opzionale)</label>
                  <button
                    type="button"
                    onClick={addMaintenanceEntry}
                    className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                  >
                    <Plus size={16} />
                    Aggiungi
                  </button>
                </div>
                
                {maintenanceEntries.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                    Nessuna manutenzione programmata. Puoi aggiungerla in seguito.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {maintenanceEntries.map((entry, idx) => (
                      <div key={idx} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-amber-700">Manutenzione #{idx + 1}</span>
                          <button type="button" onClick={() => removeMaintenanceEntry(idx)} className="p-1 hover:bg-amber-100 rounded text-amber-600">
                            <X size={16} />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              value={entry.description}
                              onChange={e => updateMaintenanceEntry(idx, 'description', e.target.value)}
                              placeholder="Descrizione"
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                          </div>
                          <select
                            value={entry.maintenance_type}
                            onChange={e => updateMaintenanceEntry(idx, 'maintenance_type', e.target.value)}
                            className="px-3 py-2 border rounded-lg text-sm"
                          >
                            {MAINTENANCE_TYPES.map(mt => (
                              <option key={mt.value} value={mt.value}>{mt.label}</option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={entry.scheduled_date}
                            onChange={e => updateMaintenanceEntry(idx, 'scheduled_date', e.target.value)}
                            className="px-3 py-2 border rounded-lg text-sm"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              value={entry.duration_days}
                              onChange={e => updateMaintenanceEntry(idx, 'duration_days', parseInt(e.target.value) || 1)}
                              className="w-20 px-3 py-2 border rounded-lg text-sm"
                            />
                            <span className="text-sm text-gray-600">giorni</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 p-4 border-t bg-gray-50">
              <button onClick={() => { setShowCreateModal(false); resetForm() }} className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-100">
                Annulla
              </button>
              <button onClick={handleSave} className="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90">
                {editingEquipment ? 'Salva Modifiche' : 'Crea Mezzo'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* DELETE CONFIRM */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Elimina Mezzo</h3>
              <p className="text-gray-600 mt-2">Sei sicuro di voler eliminare "{showDeleteConfirm.type}"?</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border rounded-lg hover:bg-gray-100">Annulla</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700">Elimina</button>
            </div>
          </div>
        </div>
      )}
      
      {/* HISTORY MODAL */}
      {showHistoryModal && (
        <HistoryModal
          equipment={showHistoryModal}
          maintenances={maintenances[showHistoryModal.id] || []}
          onExport={() => exportMaintenanceHistory(showHistoryModal)}
          onClose={() => setShowHistoryModal(null)}
        />
      )}
      
      {/* RETURN MODAL */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Riporta Disponibile</h3>
              <button onClick={() => setShowReturnModal(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-gray-600">Confermi il ritorno di <strong>{showReturnModal.type}</strong> dalla manutenzione?</p>
              
              {showReturnModal.last_squad_id && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={returnFormData.reassignToSquad}
                      onChange={e => setReturnFormData(prev => ({ 
                        ...prev, 
                        reassignToSquad: e.target.checked,
                        squadId: e.target.checked ? showReturnModal.last_squad_id : ''
                      }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Riassegna alla squadra precedente</span>
                  </label>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assegna a squadra (opzionale)</label>
                <select
                  value={returnFormData.squadId}
                  onChange={e => setReturnFormData(prev => ({ ...prev, squadId: e.target.value, reassignToSquad: !!e.target.value }))}
                  className="w-full px-3 py-2.5 border rounded-lg"
                >
                  <option value="">Nessuna assegnazione</option>
                  {squads.map(s => (
                    <option key={s.id} value={s.id}>{s.name || `Squadra ${s.squad_number}`}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note completamento</label>
                <textarea
                  value={returnFormData.completionNotes}
                  onChange={e => setReturnFormData(prev => ({ ...prev, completionNotes: e.target.value }))}
                  rows={2}
                  placeholder="Note sulla manutenzione completata..."
                  className="w-full px-3 py-2.5 border rounded-lg resize-none"
                />
              </div>
            </div>
            
            <div className="flex gap-3 p-4 border-t">
              <button onClick={() => setShowReturnModal(null)} className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-100">Annulla</button>
              <button onClick={handleReturn} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
                <RotateCcw size={18} />
                Conferma Ritorno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function KPICard({ value, label, color, textColor = 'text-gray-800', highlight = false }) {
  return (
    <div className={`${color} rounded-lg p-3 sm:p-4 text-center ${highlight ? 'ring-2 ring-offset-2 ring-amber-400' : ''}`}>
      <div className={`text-2xl sm:text-3xl font-bold ${textColor}`}>{value}</div>
      <div className="text-xs sm:text-sm text-gray-600">{label}</div>
    </div>
  )
}

function EquipmentCard({ equipment, maintenance = [], assignment, onEdit, onDelete, onShowHistory, onReturn }) {
  const [expanded, setExpanded] = useState(false)
  
  const nextMaint = maintenance
    .filter(m => m.status === 'scheduled' || m.status === 'notified')
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))[0]
  
  const daysUntilMaint = nextMaint 
    ? Math.ceil((new Date(nextMaint.scheduled_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null
  
  const showMaintAlert = daysUntilMaint !== null && daysUntilMaint <= 7
  
  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${
      equipment.status === 'out_of_site' ? 'border-red-300' : 
      equipment.status === 'maintenance_scheduled' ? 'border-amber-300' : 
      'border-gray-200'
    }`}>
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <ChevronDown size={20} className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            <CategoryBadge category={equipment.category} />
          </div>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{equipment.asset_code || 'N/A'}</span>
              <h3 className="font-semibold text-gray-800 truncate">{equipment.type}</h3>
            </div>
            {equipment.description && <p className="text-sm text-gray-500 truncate">{equipment.description}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <StatusBadge status={equipment.status} />
        </div>
      </div>
      
      {showMaintAlert && equipment.status !== 'out_of_site' && (
        <div className={`px-4 py-2 flex items-center gap-2 text-sm ${daysUntilMaint <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
          <AlertTriangle size={16} />
          {daysUntilMaint <= 0 ? 'Manutenzione in scadenza OGGI!' : `Manutenzione tra ${daysUntilMaint} giorni: ${nextMaint.description}`}
        </div>
      )}
      
      {expanded && (
        <div className="border-t p-4 bg-gray-50 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {equipment.plate_number && <div><span className="text-gray-500">Targa:</span><span className="ml-2 font-medium">{equipment.plate_number}</span></div>}
            {equipment.serial_number && <div><span className="text-gray-500">Matricola:</span><span className="ml-2 font-medium">{equipment.serial_number}</span></div>}
            {equipment.arrival_date && <div><span className="text-gray-500">Arrivo:</span><span className="ml-2 font-medium">{new Date(equipment.arrival_date).toLocaleDateString('it-IT')}</span></div>}
            <div><span className="text-gray-500">Proprietà:</span><span className={`ml-2 font-medium ${equipment.ownership === 'rented' ? 'text-cyan-600' : ''}`}>{equipment.ownership === 'rented' ? 'Noleggio' : 'Proprietà'}</span></div>
            {equipment.ownership === 'rented' && equipment.owner_company && (
              <div className="col-span-2">
                <span className="text-gray-500">Da:</span>
                <span className="ml-2 font-medium">{equipment.owner_company.company_name}</span>
                {equipment.rental_rate && <span className="ml-2 text-cyan-600">€{equipment.rental_rate} {RATE_TYPES.find(r => r.value === equipment.rate_type)?.label}</span>}
              </div>
            )}
          </div>
          
          {assignment && (
            <div className="flex items-center gap-2 text-sm">
              <Users size={16} className="text-blue-500" />
              <span className="text-gray-500">Assegnato a:</span>
              <span className="font-medium">{assignment.squad?.name || `Squadra ${assignment.squad?.squad_number}`}</span>
            </div>
          )}
          
          {maintenance.filter(m => m.status !== 'completed' && m.status !== 'cancelled').length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Prossime Manutenzioni</h4>
              <div className="space-y-1">
                {maintenance.filter(m => m.status !== 'completed' && m.status !== 'cancelled').slice(0, 3).map(m => (
                  <div key={m.id} className="flex items-center justify-between text-sm bg-white p-2 rounded">
                    <span>{m.description}</span>
                    <span className="text-gray-500">{new Date(m.scheduled_date).toLocaleDateString('it-IT')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <button onClick={(e) => { e.stopPropagation(); onEdit() }} className="flex items-center gap-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-100 rounded-lg">
              <Edit size={16} />Modifica
            </button>
            <button onClick={(e) => { e.stopPropagation(); onShowHistory() }} className="flex items-center gap-1 px-3 py-2 text-sm text-purple-600 hover:bg-purple-100 rounded-lg">
              <History size={16} />Storico
            </button>
            {equipment.status === 'out_of_site' && (
              <button onClick={(e) => { e.stopPropagation(); onReturn() }} className="flex items-center gap-1 px-3 py-2 text-sm text-green-600 hover:bg-green-100 rounded-lg">
                <RotateCcw size={16} />Riporta Disponibile
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-100 rounded-lg ml-auto">
              <Trash2 size={16} />Elimina
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryModal({ equipment, maintenances, onExport, onClose }) {
  const statusConfig = {
    scheduled: { label: 'Programmata', color: 'bg-blue-100 text-blue-700' },
    notified: { label: 'Notificata', color: 'bg-amber-100 text-amber-700' },
    in_progress: { label: 'In Corso', color: 'bg-orange-100 text-orange-700' },
    completed: { label: 'Completata', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Annullata', color: 'bg-gray-100 text-gray-500' }
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl rounded-t-xl max-h-[85vh] sm:max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Storico Manutenzioni</h3>
            <p className="text-sm text-gray-500">{equipment.type} - {equipment.asset_code}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onExport} className="p-2 hover:bg-green-100 rounded-lg text-green-600" title="Esporta Excel"><Download size={20} /></button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {maintenances.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Nessuna manutenzione registrata</p>
          ) : (
            <div className="space-y-3">
              {maintenances.map(m => {
                const config = statusConfig[m.status] || statusConfig.scheduled
                return (
                  <div key={m.id} className="p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium">{m.description}</h4>
                        <p className="text-sm text-gray-500">{MAINTENANCE_TYPES.find(t => t.value === m.maintenance_type)?.label || m.maintenance_type}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>{config.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                      <span>📅 Programmata: {new Date(m.scheduled_date).toLocaleDateString('it-IT')}</span>
                      <span>⏱ Durata: {m.duration_days} giorni</span>
                      {m.actual_end_date && <span>✓ Completata: {new Date(m.actual_end_date).toLocaleDateString('it-IT')}</span>}
                    </div>
                    {m.completion_notes && <p className="mt-2 text-sm text-gray-600 bg-white p-2 rounded">{m.completion_notes}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t">
          <button onClick={onClose} className="w-full py-2.5 border rounded-lg hover:bg-gray-100">Chiudi</button>
        </div>
      </div>
    </div>
  )
}
