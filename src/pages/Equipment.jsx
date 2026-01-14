import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import { 
  Truck, Plus, Search, Filter, X, Check, Edit, Trash2,
  ChevronDown, ChevronRight, Building2, Calendar, DollarSign,
  AlertTriangle, Wrench, Hammer, Settings, Star, Info, Hash,
  Package, Tool
} from 'lucide-react'

// ============================================================================
// CONFIGURAZIONE CATEGORIE E TIPI
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

const EQUIPMENT_TYPES = {
  // VEHICLES (Mezzi)
  crane: { label: 'Gru', labelEn: 'Crane', category: 'vehicle' },
  truck: { label: 'Camion', labelEn: 'Truck', category: 'vehicle' },
  tanker_truck: { label: 'Camion Cisterna', labelEn: 'Tanker Truck', category: 'vehicle' },
  forklift: { label: 'Muletto', labelEn: 'Forklift', category: 'vehicle' },
  excavator: { label: 'Escavatore', labelEn: 'Excavator', category: 'vehicle' },
  wheel_loader: { label: 'Pala Meccanica', labelEn: 'Wheel Loader', category: 'vehicle' },
  lorry: { label: 'Autocarro', labelEn: 'Lorry', category: 'vehicle' },
  aerial_platform: { label: 'Piattaforma Aerea', labelEn: 'Aerial Platform', category: 'vehicle' },
  compressor_vehicle: { label: 'Compressore', labelEn: 'Compressor', category: 'vehicle' },
  concrete_mixer: { label: 'Betoniera', labelEn: 'Concrete Mixer', category: 'vehicle' },
  
  // EQUIPMENT
  light_tower: { label: 'Torre Faro', labelEn: 'Light Tower', category: 'equipment' },
  generator: { label: 'Generatore', labelEn: 'Generator', category: 'equipment' },
  welding_machine: { label: 'Saldatrice', labelEn: 'Welding Machine', category: 'equipment' },
  pipe_coupler: { label: 'Accoppiatore Piping', labelEn: 'Pipe Coupler', category: 'equipment' },
  pump: { label: 'Pompa', labelEn: 'Pump', category: 'equipment' },
  compactor: { label: 'Compattatore', labelEn: 'Compactor', category: 'equipment' },
  air_compressor: { label: 'Compressore Aria', labelEn: 'Air Compressor', category: 'equipment' },
  scaffolding: { label: 'Ponteggio', labelEn: 'Scaffolding', category: 'equipment' },
  container: { label: 'Container', labelEn: 'Container', category: 'equipment' },
  
  // TOOLS (Attrezzi)
  grinder: { label: 'Smerigliatrice', labelEn: 'Grinder', category: 'tool' },
  drill: { label: 'Trapano', labelEn: 'Drill', category: 'tool' },
  screwdriver: { label: 'Avvitatore', labelEn: 'Screwdriver', category: 'tool' },
  torch: { label: 'Cannello', labelEn: 'Torch', category: 'tool' },
  torque_wrench: { label: 'Chiave Dinamometrica', labelEn: 'Torque Wrench', category: 'tool' },
  pipe_cutter: { label: 'Tagliatubi', labelEn: 'Pipe Cutter', category: 'tool' },
  beveling_machine: { label: 'Smussatrice', labelEn: 'Beveling Machine', category: 'tool' },
  hydraulic_jack: { label: 'Martinetto Idraulico', labelEn: 'Hydraulic Jack', category: 'tool' }
}

const RATE_TYPES = {
  lump_sum: { label: 'Forfettario', labelEn: 'Lump Sum' },
  hourly: { label: 'Orario', labelEn: 'Hourly' },
  daily: { label: 'Giornaliero', labelEn: 'Daily' },
  weekly: { label: 'Settimanale', labelEn: 'Weekly' },
  monthly: { label: 'Mensile', labelEn: 'Monthly' }
}

const OWNERSHIP_TYPES = {
  owned: { label: 'Proprietà', labelEn: 'Owned', color: 'bg-emerald-100 text-emerald-800' },
  rented: { label: 'Noleggio', labelEn: 'Rented', color: 'bg-amber-100 text-amber-800' }
}

// ============================================================================
// COMPONENTI HELPER
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
  return (
    <span className={`${config.color} px-2 py-0.5 text-xs rounded-full font-medium`}>
      {config.label}
    </span>
  )
}

// Popup lista equipment
function EquipmentListPopup({ equipment, title, isVisible, onClose, type }) {
  if (!isVisible) return null
  
  const bgColor = type === 'assigned' ? 'bg-green-600' : type === 'unassigned' ? 'bg-amber-500' : 'bg-primary'
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className={`${bgColor} px-4 py-3 rounded-t-xl flex items-center justify-between`}>
          <span className="font-semibold text-white text-lg">
            {title} ({equipment.length})
          </span>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg">
            <X size={20} className="text-white" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {equipment.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Nessun elemento</p>
          ) : (
            <div className="space-y-2">
              {equipment.map(eq => (
                <div key={eq.id} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg">
                  <CategoryBadge category={eq.category} size="small" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800">
                      {EQUIPMENT_TYPES[eq.type]?.label || eq.type}
                    </span>
                    {eq.description && (
                      <span className="text-gray-500 text-sm ml-2">- {eq.description}</span>
                    )}
                  </div>
                  <OwnershipBadge ownership={eq.ownership} />
                  <span className="text-sm text-gray-500 font-mono">
                    {eq.plate_number || eq.serial_number || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="border-t px-4 py-3 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// COMPONENTE PRINCIPALE
// ============================================================================

export default function Equipment() {
  const { t } = useTranslation()
  const { activeProject } = useProject()
  
  // State principale
  const [equipment, setEquipment] = useState([])
  const [companies, setCompanies] = useState([])
  const [assignments, setAssignments] = useState({}) // { equipmentId: squadInfo }
  const [loading, setLoading] = useState(true)
  
  // UI State
  const [showModal, setShowModal] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [expandedDetail, setExpandedDetail] = useState(null)
  
  // Filtri
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterOwnership, setFilterOwnership] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  
  // Popup dashboard
  const [popupData, setPopupData] = useState(null)
  
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
  
  // Rate form state
  const [rates, setRates] = useState([])
  const [newRate, setNewRate] = useState({
    rateType: 'daily',
    amount: '',
    validFrom: new Date().toISOString().split('T')[0],
    validTo: '',
    appliesWeekdays: true,
    appliesWeekends: true,
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
      
      // Carica companies
      const { data: companiesData } = await supabase
        .from('companies')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
        .order('is_main', { ascending: false })
      setCompanies(companiesData || [])
      
      // Carica equipment con tariffe
      const { data: equipmentData } = await supabase
        .from('equipment')
        .select(`
          *,
          owner_company:companies(id, company_name, is_main),
          equipment_rates(*)
        `)
        .eq('project_id', activeProject.id)
        .neq('status', 'inactive')
        .order('category')
        .order('type')
      setEquipment(equipmentData || [])
      
      // Carica assegnazioni attive
      const { data: assignmentsData } = await supabase
        .from('equipment_assignments')
        .select(`
          *,
          squad:squads(id, squad_number, name)
        `)
        .eq('status', 'active')
      
      const assignmentsMap = {}
      ;(assignmentsData || []).forEach(a => {
        assignmentsMap[a.equipment_id] = a
      })
      setAssignments(assignmentsMap)
      
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // CALCOLI DASHBOARD
  // ============================================================================
  
  // Equipment assegnati
  const assignedIds = new Set(Object.keys(assignments))
  const assignedEquipment = equipment.filter(eq => assignedIds.has(eq.id))
  const unassignedEquipment = equipment.filter(eq => !assignedIds.has(eq.id))
  
  // Stats per tipo
  const typeStats = Object.entries(EQUIPMENT_TYPES).map(([typeKey, typeConfig]) => {
    const items = equipment.filter(eq => eq.type === typeKey)
    const assigned = items.filter(eq => assignedIds.has(eq.id))
    return {
      type: typeKey,
      category: typeConfig.category,
      label: typeConfig.label,
      labelEn: typeConfig.labelEn,
      total: items.length,
      assigned: assigned.length,
      unassigned: items.length - assigned.length,
      items,
      assignedItems: assigned,
      unassignedItems: items.filter(eq => !assignedIds.has(eq.id))
    }
  }).filter(s => s.total > 0)
  
  // Stats per categoria
  const categoryStats = Object.entries(CATEGORIES).map(([catKey, catConfig]) => {
    const items = equipment.filter(eq => eq.category === catKey)
    const assigned = items.filter(eq => assignedIds.has(eq.id))
    return {
      category: catKey,
      label: catConfig.label,
      labelEn: catConfig.labelEn,
      icon: catConfig.icon,
      color: catConfig.color,
      iconColor: catConfig.iconColor,
      total: items.length,
      assigned: assigned.length,
      unassigned: items.length - assigned.length,
      percentage: items.length > 0 ? Math.round((assigned.length / items.length) * 100) : 0,
      items,
      assignedItems: assigned,
      unassignedItems: items.filter(eq => !assignedIds.has(eq.id))
    }
  })

  // ============================================================================
  // FILTRI
  // ============================================================================
  
  const filteredEquipment = equipment.filter(eq => {
    const searchLower = searchTerm.toLowerCase()
    const typeConfig = EQUIPMENT_TYPES[eq.type]
    const typeLabel = typeConfig?.label || eq.type
    const typeLabelEn = typeConfig?.labelEn || ''
    
    const matchesSearch = 
      typeLabel.toLowerCase().includes(searchLower) ||
      typeLabelEn.toLowerCase().includes(searchLower) ||
      eq.description?.toLowerCase().includes(searchLower) ||
      eq.serial_number?.toLowerCase().includes(searchLower) ||
      eq.plate_number?.toLowerCase().includes(searchLower) ||
      eq.owner_company?.company_name?.toLowerCase().includes(searchLower)
    
    const matchesCategory = !filterCategory || eq.category === filterCategory
    const matchesOwnership = !filterOwnership || eq.ownership === filterOwnership
    const matchesCompany = !filterCompany || eq.owner_company_id === filterCompany
    
    return matchesSearch && matchesCategory && matchesOwnership && matchesCompany
  })

  // ============================================================================
  // GESTIONE FORM
  // ============================================================================
  
  const resetForm = () => {
    const mainCompany = companies.find(c => c.is_main)
    setFormData({
      category: 'vehicle',
      type: '',
      description: '',
      ownership: 'owned',
      ownerCompanyId: mainCompany?.id || '',
      serialNumber: '',
      plateNumber: '',
      notes: ''
    })
    setRates([])
    setNewRate({
      rateType: 'daily',
      amount: '',
      validFrom: new Date().toISOString().split('T')[0],
      validTo: '',
      appliesWeekdays: true,
      appliesWeekends: true,
      notes: ''
    })
  }
  
  const openAddModal = () => {
    resetForm()
    setEditingEquipment(null)
    setShowModal(true)
  }
  
  const openEditModal = async (eq) => {
    setFormData({
      category: eq.category,
      type: eq.type,
      description: eq.description || '',
      ownership: eq.ownership,
      ownerCompanyId: eq.owner_company_id || '',
      serialNumber: eq.serial_number || '',
      plateNumber: eq.plate_number || '',
      notes: eq.notes || ''
    })
    
    // Converti le tariffe dal DB al formato del form
    const formRates = (eq.equipment_rates || []).map(r => ({
      id: r.id,
      rateType: r.rate_type,
      amount: r.amount,
      validFrom: r.valid_from,
      validTo: r.valid_to || '',
      appliesWeekdays: r.applies_weekdays !== false,
      appliesWeekends: r.applies_weekends !== false,
      notes: r.notes || ''
    }))
    setRates(formRates)
    setEditingEquipment(eq)
    setShowModal(true)
  }

  // ============================================================================
  // GESTIONE TARIFFE
  // ============================================================================
  
  const addRate = () => {
    if (!newRate.amount || !newRate.validFrom) {
      alert('Inserisci importo e data inizio')
      return
    }
    
    setRates([...rates, { 
      ...newRate, 
      id: `temp-${Date.now()}`,
      amount: parseFloat(newRate.amount)
    }])
    
    setNewRate({
      rateType: 'daily',
      amount: '',
      validFrom: new Date().toISOString().split('T')[0],
      validTo: '',
      appliesWeekdays: true,
      appliesWeekends: true,
      notes: ''
    })
  }
  
  const removeRate = (rateId) => {
    setRates(rates.filter(r => r.id !== rateId))
  }

  // ============================================================================
  // SALVATAGGIO
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
        owner_company_id: formData.ownership === 'owned' 
          ? mainCompany?.id 
          : formData.ownerCompanyId || null,
        serial_number: formData.serialNumber.trim() || null,
        plate_number: formData.plateNumber.trim() || null,
        notes: formData.notes.trim() || null
      }
      
      let equipmentId
      
      if (editingEquipment) {
        // Update
        const { error } = await supabase
          .from('equipment')
          .update(equipmentDataToSave)
          .eq('id', editingEquipment.id)
        
        if (error) throw error
        equipmentId = editingEquipment.id
        
        // Elimina vecchie tariffe
        await supabase
          .from('equipment_rates')
          .delete()
          .eq('equipment_id', equipmentId)
      } else {
        // Insert
        const { data, error } = await supabase
          .from('equipment')
          .insert([equipmentDataToSave])
          .select()
          .single()
        
        if (error) throw error
        equipmentId = data.id
      }
      
      // Inserisci tariffe
      if (rates.length > 0) {
        const ratesData = rates.map(r => ({
          equipment_id: equipmentId,
          rate_type: r.rateType,
          amount: parseFloat(r.amount),
          valid_from: r.validFrom,
          valid_to: r.validTo || null,
          applies_weekdays: r.appliesWeekdays,
          applies_weekends: r.appliesWeekends,
          notes: r.notes || null
        }))
        
        const { error: ratesError } = await supabase
          .from('equipment_rates')
          .insert(ratesData)
        
        if (ratesError) throw ratesError
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
  // ELIMINAZIONE
  // ============================================================================
  
  const handleDelete = async (eq) => {
    try {
      const { error } = await supabase
        .from('equipment')
        .update({ status: 'inactive' })
        .eq('id', eq.id)
      
      if (error) throw error
      
      setShowDeleteConfirm(null)
      loadData()
    } catch (err) {
      console.error('Error deleting:', err)
      alert('Errore: ' + err.message)
    }
  }

  // ============================================================================
  // TIPI FILTRATI PER CATEGORIA
  // ============================================================================
  
  const typesForCategory = Object.entries(EQUIPMENT_TYPES)
    .filter(([_, config]) => config.category === formData.category)

  // ============================================================================
  // RENDER
  // ============================================================================
  
  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Truck size={64} className="text-gray-300 mb-4" />
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

  return (
    <div className="space-y-6">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Truck className="text-primary" />
            Mezzi / Equipment / Tools
          </h1>
          <p className="text-gray-500 mt-1">
            {activeProject.name} • {equipment.length} elementi totali
          </p>
        </div>
        
        <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Nuovo
        </button>
      </div>

      {/* ============ DASHBOARD ============ */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Settings size={20} />
          Dashboard
        </h2>
        
        {/* Riepilogo per categoria */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {categoryStats.map(stat => {
            const Icon = stat.icon
            return (
              <div key={stat.category} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{stat.label}</h3>
                    <p className="text-sm text-gray-500">{stat.total} totali</p>
                  </div>
                </div>
                
                <div className="flex gap-4 text-sm">
                  <span 
                    className={`text-green-600 ${stat.assigned > 0 ? 'cursor-pointer hover:underline' : ''}`}
                    onClick={() => stat.assigned > 0 && setPopupData({
                      type: 'assigned',
                      equipment: stat.assignedItems,
                      title: `${stat.label} - Assegnati`
                    })}
                  >
                    {stat.assigned} assegnati
                  </span>
                  <span 
                    className={`text-amber-600 ${stat.unassigned > 0 ? 'cursor-pointer hover:underline' : ''}`}
                    onClick={() => stat.unassigned > 0 && setPopupData({
                      type: 'unassigned',
                      equipment: stat.unassignedItems,
                      title: `${stat.label} - Disponibili`
                    })}
                  >
                    {stat.unassigned} disponibili
                  </span>
                </div>
                
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${stat.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-8 text-right">{stat.percentage}%</span>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Dettaglio per tipo */}
        {typeStats.length > 0 && (
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-700 mb-3">Dettaglio per Tipo</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {typeStats.map(stat => (
                <div 
                  key={stat.type}
                  className="bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setPopupData({
                    type: 'all',
                    equipment: stat.items,
                    title: `${stat.label} (${stat.labelEn})`
                  })}
                >
                  <div className="text-2xl font-bold text-gray-800">{stat.total}</div>
                  <div className="text-xs text-gray-600 truncate" title={stat.label}>{stat.label}</div>
                  <div className="text-xs mt-1 flex gap-1">
                    <span className="text-green-600 font-medium">{stat.assigned}</span>
                    <span className="text-gray-400">/</span>
                    <span className="text-amber-600 font-medium">{stat.unassigned}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ============ FILTRI ============ */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca per tipo, descrizione, targa..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tutte le categorie</option>
            {Object.entries(CATEGORIES).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          
          <select
            value={filterOwnership}
            onChange={(e) => setFilterOwnership(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Proprietà/Noleggio</option>
            <option value="owned">Proprietà</option>
            <option value="rented">Noleggio</option>
          </select>
          
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tutte le aziende</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.is_main && '★ '}{c.company_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ============ LISTA EQUIPMENT ============ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredEquipment.length === 0 ? (
          <div className="p-12 text-center">
            <Truck size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">
              {equipment.length === 0 ? 'Nessun elemento inserito' : 'Nessun elemento trovato con i filtri attivi'}
            </p>
            {equipment.length === 0 && (
              <button onClick={openAddModal} className="mt-4 btn-primary">
                <Plus size={18} className="inline mr-1" />
                Aggiungi il primo
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Categoria</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Descrizione</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Proprietà</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Azienda</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Targa/Seriale</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Assegnato a</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEquipment.map(eq => {
                  const assignment = assignments[eq.id]
                  const typeConfig = EQUIPMENT_TYPES[eq.type]
                  return (
                    <tr key={eq.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <CategoryBadge category={eq.category} size="small" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">
                          {typeConfig?.label || eq.type}
                        </span>
                        <br />
                        <span className="text-xs text-gray-400">
                          {typeConfig?.labelEn || ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm max-w-[200px]">
                        <span className="truncate block" title={eq.description}>
                          {eq.description || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <OwnershipBadge ownership={eq.ownership} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1">
                          {eq.owner_company?.is_main && (
                            <Star size={12} className="text-yellow-500 fill-yellow-500" />
                          )}
                          <span className="truncate max-w-[120px]" title={eq.owner_company?.company_name}>
                            {eq.owner_company?.company_name || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-600">
                        {eq.plate_number || eq.serial_number || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {assignment ? (
                          <span className="text-green-600 text-sm font-medium">
                            Squadra {assignment.squad?.squad_number}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">Disponibile</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => openEditModal(eq)}
                            className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                            title="Modifica"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(eq)}
                            className="p-1.5 hover:bg-red-100 rounded text-red-600"
                            title="Elimina"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============ MODAL CREA/MODIFICA ============ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-800">
                {editingEquipment ? 'Modifica' : 'Nuovo'} Mezzo/Equipment/Tool
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Categoria e Tipo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value, type: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {Object.entries(CATEGORIES).map(([key, config]) => (
                      <option key={key} value={key}>{config.label} / {config.labelEn}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Seleziona --</option>
                    {typesForCategory.map(([key, config]) => (
                      <option key={key} value={key}>{config.label} / {config.labelEn}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Descrizione */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Es: Gru 50 ton, Generatore 100kW, Saldatrice MIG..."
                />
              </div>
              
              {/* Proprietà e Azienda */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proprietà</label>
                  <select
                    value={formData.ownership}
                    onChange={(e) => {
                      const newOwnership = e.target.value
                      setFormData({ 
                        ...formData, 
                        ownership: newOwnership,
                        ownerCompanyId: ''
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="owned">Proprietà (Aziendale)</option>
                    <option value="rented">Noleggio</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.ownership === 'owned' ? 'Azienda Proprietaria' : 'Azienda Noleggio'}
                    {formData.ownership === 'rented' && <span className="text-red-500"> *</span>}
                  </label>
                  {formData.ownership === 'owned' ? (
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
                      {companies.find(c => c.is_main)?.company_name || 'Azienda principale'}
                      <Star size={12} className="inline ml-1 text-yellow-500 fill-yellow-500" />
                    </div>
                  ) : (
                    <select
                      value={formData.ownerCompanyId}
                      onChange={(e) => setFormData({ ...formData, ownerCompanyId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">-- Seleziona Noleggiatore --</option>
                      {companies
                        .filter(c => !c.is_main)
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.company_name}</option>
                        ))
                      }
                    </select>
                  )}
                </div>
              </div>
              
              {/* Identificazione */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Targa</label>
                  <input
                    type="text"
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    placeholder="AB123CD"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numero di Serie</label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    placeholder="SN-123456"
                  />
                </div>
              </div>
              
              {/* Tariffe (solo per noleggio) */}
              {formData.ownership === 'rented' && (
                <div className="border-t pt-4">
                  <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <DollarSign size={18} />
                    Tariffe Noleggio
                  </h3>
                  
                  {/* Lista tariffe esistenti */}
                  {rates.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {rates.map(rate => (
                        <div key={rate.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                          <span className="font-medium text-sm">
                            {RATE_TYPES[rate.rateType]?.label}
                          </span>
                          <span className="text-lg font-bold text-primary">
                            €{parseFloat(rate.amount).toFixed(2)}
                          </span>
                          <span className="text-sm text-gray-500 flex-1">
                            Dal {new Date(rate.validFrom).toLocaleDateString('it-IT')}
                            {rate.validTo && ` al ${new Date(rate.validTo).toLocaleDateString('it-IT')}`}
                          </span>
                          <div className="flex gap-1 text-xs">
                            {rate.appliesWeekdays && (
                              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Lun-Ven</span>
                            )}
                            {rate.appliesWeekends && (
                              <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Sab-Dom</span>
                            )}
                          </div>
                          <button
                            onClick={() => removeRate(rate.id)}
                            className="p-1 hover:bg-red-100 rounded text-red-500"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Form nuova tariffa */}
                  <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tipo Tariffa</label>
                        <select
                          value={newRate.rateType}
                          onChange={(e) => setNewRate({ ...newRate, rateType: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          {Object.entries(RATE_TYPES).map(([key, config]) => (
                            <option key={key} value={key}>{config.label} / {config.labelEn}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Importo (€)</label>
                        <input
                          type="number"
                          value={newRate.amount}
                          onChange={(e) => setNewRate({ ...newRate, amount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Valido Dal</label>
                        <input
                          type="date"
                          value={newRate.validFrom}
                          onChange={(e) => setNewRate({ ...newRate, validFrom: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Valido Fino (opz.)</label>
                        <input
                          type="date"
                          value={newRate.validTo}
                          onChange={(e) => setNewRate({ ...newRate, validTo: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    
                    {/* Giorni applicabili */}
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newRate.appliesWeekdays}
                          onChange={(e) => setNewRate({ ...newRate, appliesWeekdays: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        Lun-Ven (Feriali)
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newRate.appliesWeekends}
                          onChange={(e) => setNewRate({ ...newRate, appliesWeekends: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        Sab-Dom (Weekend)
                      </label>
                    </div>
                    
                    <button
                      onClick={addRate}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      + Aggiungi Tariffa
                    </button>
                  </div>
                </div>
              )}
              
              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Note aggiuntive..."
                />
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
              <button 
                onClick={() => setShowModal(false)} 
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Annulla
              </button>
              <button 
                onClick={handleSave} 
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-2"
              >
                <Check size={18} />
                {editingEquipment ? 'Salva Modifiche' : 'Crea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL CONFERMA ELIMINAZIONE ============ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Elimina</h3>
                <p className="text-sm text-gray-500">
                  {EQUIPMENT_TYPES[showDeleteConfirm.type]?.label} 
                  {showDeleteConfirm.description && ` - ${showDeleteConfirm.description}`}
                </p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              Sei sicuro di voler eliminare questo elemento? L'operazione può essere annullata solo da un amministratore.
            </p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)} 
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ POPUP LISTA EQUIPMENT ============ */}
      <EquipmentListPopup
        equipment={popupData?.equipment || []}
        title={popupData?.title || ''}
        isVisible={popupData !== null}
        onClose={() => setPopupData(null)}
        type={popupData?.type || 'all'}
      />
    </div>
  )
}
