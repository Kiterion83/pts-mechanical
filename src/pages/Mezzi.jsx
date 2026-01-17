import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import { 
  Truck, Plus, Search, Filter, X, Check, Edit, Trash2,
  ChevronDown, ChevronRight, Building2, Calendar, DollarSign,
  AlertTriangle, Wrench, Hammer, Settings, Star, Info, Hash,
  Package, PlusCircle, Users
} from 'lucide-react'

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
// TIPI PREDEFINITI (BUILT-IN) - ESPANSI
// ============================================================================

const DEFAULT_EQUIPMENT_TYPES = {
  // ===================== VEHICLES (Mezzi) =====================
  // Gru
  crane_mobile: { label: 'Gru Mobile', labelEn: 'Mobile Crane', category: 'vehicle' },
  crane_tower: { label: 'Gru a Torre', labelEn: 'Tower Crane', category: 'vehicle' },
  crane_crawler: { label: 'Gru Cingolata', labelEn: 'Crawler Crane', category: 'vehicle' },
  crane_truck: { label: 'Autogrù', labelEn: 'Truck Crane', category: 'vehicle' },
  crane_telescopic: { label: 'Gru Telescopica', labelEn: 'Telescopic Crane', category: 'vehicle' },
  
  // Camion e Trasporto
  truck: { label: 'Camion', labelEn: 'Truck', category: 'vehicle' },
  truck_flatbed: { label: 'Camion Pianale', labelEn: 'Flatbed Truck', category: 'vehicle' },
  truck_dump: { label: 'Camion Ribaltabile', labelEn: 'Dump Truck', category: 'vehicle' },
  truck_tanker: { label: 'Camion Cisterna', labelEn: 'Tanker Truck', category: 'vehicle' },
  truck_concrete_mixer: { label: 'Autobetoniera', labelEn: 'Concrete Mixer Truck', category: 'vehicle' },
  truck_crane: { label: 'Camion Gru', labelEn: 'Crane Truck', category: 'vehicle' },
  lorry: { label: 'Autocarro', labelEn: 'Lorry', category: 'vehicle' },
  van: { label: 'Furgone', labelEn: 'Van', category: 'vehicle' },
  pickup: { label: 'Pickup', labelEn: 'Pickup', category: 'vehicle' },
  trailer: { label: 'Rimorchio', labelEn: 'Trailer', category: 'vehicle' },
  semi_trailer: { label: 'Semirimorchio', labelEn: 'Semi-trailer', category: 'vehicle' },
  lowboy: { label: 'Carrellone', labelEn: 'Lowboy Trailer', category: 'vehicle' },
  
  // Movimento Terra
  excavator: { label: 'Escavatore', labelEn: 'Excavator', category: 'vehicle' },
  excavator_mini: { label: 'Mini Escavatore', labelEn: 'Mini Excavator', category: 'vehicle' },
  wheel_loader: { label: 'Pala Gommata', labelEn: 'Wheel Loader', category: 'vehicle' },
  backhoe_loader: { label: 'Terna', labelEn: 'Backhoe Loader', category: 'vehicle' },
  bulldozer: { label: 'Bulldozer', labelEn: 'Bulldozer', category: 'vehicle' },
  skid_steer: { label: 'Skid Steer (Bobcat)', labelEn: 'Skid Steer Loader', category: 'vehicle' },
  grader: { label: 'Grader (Livellatrice)', labelEn: 'Motor Grader', category: 'vehicle' },
  roller_compactor: { label: 'Rullo Compattatore', labelEn: 'Roller Compactor', category: 'vehicle' },
  dumper: { label: 'Dumper', labelEn: 'Dumper', category: 'vehicle' },
  
  // Carrelli e Sollevamento
  forklift: { label: 'Muletto', labelEn: 'Forklift', category: 'vehicle' },
  forklift_telehandler: { label: 'Telehandler', labelEn: 'Telehandler', category: 'vehicle' },
  forklift_reach: { label: 'Carrello Retrattile', labelEn: 'Reach Truck', category: 'vehicle' },
  pallet_truck: { label: 'Transpallet', labelEn: 'Pallet Truck', category: 'vehicle' },
  
  // Piattaforme Aeree
  aerial_platform: { label: 'Piattaforma Aerea', labelEn: 'Aerial Platform', category: 'vehicle' },
  boom_lift: { label: 'Piattaforma Articolata', labelEn: 'Boom Lift', category: 'vehicle' },
  scissor_lift: { label: 'Piattaforma a Forbice', labelEn: 'Scissor Lift', category: 'vehicle' },
  cherry_picker: { label: 'Cestello', labelEn: 'Cherry Picker', category: 'vehicle' },
  spider_lift: { label: 'Piattaforma Ragno', labelEn: 'Spider Lift', category: 'vehicle' },
  
  // Veicoli Speciali
  concrete_pump: { label: 'Pompa Calcestruzzo', labelEn: 'Concrete Pump', category: 'vehicle' },
  vacuum_truck: { label: 'Autospurgo', labelEn: 'Vacuum Truck', category: 'vehicle' },
  water_truck: { label: 'Autobotte', labelEn: 'Water Truck', category: 'vehicle' },
  
  // ===================== EQUIPMENT =====================
  // Generatori e Energia
  generator: { label: 'Generatore', labelEn: 'Generator', category: 'equipment' },
  generator_large: { label: 'Gruppo Elettrogeno', labelEn: 'Power Generator', category: 'equipment' },
  light_tower: { label: 'Torre Faro', labelEn: 'Light Tower', category: 'equipment' },
  transformer: { label: 'Trasformatore', labelEn: 'Transformer', category: 'equipment' },
  distribution_board: { label: 'Quadro Elettrico', labelEn: 'Distribution Board', category: 'equipment' },
  
  // Compressori e Aria
  air_compressor: { label: 'Compressore Aria', labelEn: 'Air Compressor', category: 'equipment' },
  air_compressor_portable: { label: 'Compressore Portatile', labelEn: 'Portable Compressor', category: 'equipment' },
  air_dryer: { label: 'Essiccatore Aria', labelEn: 'Air Dryer', category: 'equipment' },
  
  // Saldatura
  welding_machine: { label: 'Saldatrice', labelEn: 'Welding Machine', category: 'equipment' },
  welding_machine_mig: { label: 'Saldatrice MIG/MAG', labelEn: 'MIG/MAG Welder', category: 'equipment' },
  welding_machine_tig: { label: 'Saldatrice TIG', labelEn: 'TIG Welder', category: 'equipment' },
  welding_machine_stick: { label: 'Saldatrice Elettrodo', labelEn: 'Stick Welder', category: 'equipment' },
  welding_machine_orbital: { label: 'Saldatrice Orbitale', labelEn: 'Orbital Welder', category: 'equipment' },
  plasma_cutter: { label: 'Taglio Plasma', labelEn: 'Plasma Cutter', category: 'equipment' },
  
  // Pompe
  pump_water: { label: 'Pompa Acqua', labelEn: 'Water Pump', category: 'equipment' },
  pump_submersible: { label: 'Pompa Sommergibile', labelEn: 'Submersible Pump', category: 'equipment' },
  pump_mud: { label: 'Pompa Fango', labelEn: 'Mud Pump', category: 'equipment' },
  pump_hydraulic: { label: 'Centralina Idraulica', labelEn: 'Hydraulic Power Unit', category: 'equipment' },
  
  // Piping
  pipe_coupler: { label: 'Accoppiatore Tubi', labelEn: 'Pipe Coupler', category: 'equipment' },
  pipe_bender: { label: 'Curvatubi', labelEn: 'Pipe Bender', category: 'equipment' },
  pipe_threading: { label: 'Filettatrice', labelEn: 'Pipe Threading Machine', category: 'equipment' },
  hydro_test_pump: { label: 'Pompa Collaudo', labelEn: 'Hydro Test Pump', category: 'equipment' },
  
  // Betonaggio
  concrete_mixer: { label: 'Betoniera', labelEn: 'Concrete Mixer', category: 'equipment' },
  concrete_vibrator: { label: 'Vibratore Calcestruzzo', labelEn: 'Concrete Vibrator', category: 'equipment' },
  power_trowel: { label: 'Elicottero (Frattazzo)', labelEn: 'Power Trowel', category: 'equipment' },
  
  // Compattazione
  plate_compactor: { label: 'Piastra Vibrante', labelEn: 'Plate Compactor', category: 'equipment' },
  rammer: { label: 'Costipatore', labelEn: 'Rammer', category: 'equipment' },
  
  // Strutture
  scaffolding: { label: 'Ponteggio', labelEn: 'Scaffolding', category: 'equipment' },
  container_office: { label: 'Container Ufficio', labelEn: 'Office Container', category: 'equipment' },
  container_storage: { label: 'Container Magazzino', labelEn: 'Storage Container', category: 'equipment' },
  container_sanitary: { label: 'Container Servizi', labelEn: 'Sanitary Container', category: 'equipment' },
  
  // Sollevamento
  chain_hoist: { label: 'Paranco a Catena', labelEn: 'Chain Hoist', category: 'equipment' },
  lever_hoist: { label: 'Tirfor', labelEn: 'Lever Hoist', category: 'equipment' },
  winch: { label: 'Verricello', labelEn: 'Winch', category: 'equipment' },
  hydraulic_jack: { label: 'Martinetto Idraulico', labelEn: 'Hydraulic Jack', category: 'equipment' },
  
  // ===================== TOOLS (Attrezzi) =====================
  // Taglio e Molatura
  grinder_angle: { label: 'Smerigliatrice Angolare', labelEn: 'Angle Grinder', category: 'tool' },
  grinder_straight: { label: 'Smerigliatrice Dritta', labelEn: 'Straight Grinder', category: 'tool' },
  cut_off_saw: { label: 'Troncatrice', labelEn: 'Cut-off Saw', category: 'tool' },
  circular_saw: { label: 'Sega Circolare', labelEn: 'Circular Saw', category: 'tool' },
  reciprocating_saw: { label: 'Sega a Gattuccio', labelEn: 'Reciprocating Saw', category: 'tool' },
  band_saw: { label: 'Segatrice a Nastro', labelEn: 'Band Saw', category: 'tool' },
  pipe_cutter: { label: 'Tagliatubi', labelEn: 'Pipe Cutter', category: 'tool' },
  
  // Foratura
  drill_hammer: { label: 'Trapano a Percussione', labelEn: 'Hammer Drill', category: 'tool' },
  drill_magnetic: { label: 'Trapano Magnetico', labelEn: 'Magnetic Drill', category: 'tool' },
  drill_core: { label: 'Carotatrice', labelEn: 'Core Drill', category: 'tool' },
  
  // Avvitatura e Serraggio
  screwdriver_impact: { label: 'Avvitatore a Impulsi', labelEn: 'Impact Driver', category: 'tool' },
  wrench_impact: { label: 'Avvitatore a Massa', labelEn: 'Impact Wrench', category: 'tool' },
  wrench_torque: { label: 'Chiave Dinamometrica', labelEn: 'Torque Wrench', category: 'tool' },
  wrench_hydraulic: { label: 'Chiave Idraulica', labelEn: 'Hydraulic Torque Wrench', category: 'tool' },
  bolt_tensioner: { label: 'Tensionatore Bulloni', labelEn: 'Bolt Tensioner', category: 'tool' },
  
  // Preparazione Tubi
  beveling_machine: { label: 'Smussatrice', labelEn: 'Beveling Machine', category: 'tool' },
  pipe_facing: { label: 'Intestatrice', labelEn: 'Pipe Facing Machine', category: 'tool' },
  flange_facer: { label: 'Tornitrice Flange', labelEn: 'Flange Facer', category: 'tool' },
  
  // Saldatura Manuali
  torch_oxy: { label: 'Cannello Ossiacetilenico', labelEn: 'Oxy-fuel Torch', category: 'tool' },
  
  // Demolizione
  demolition_hammer: { label: 'Martello Demolitore', labelEn: 'Demolition Hammer', category: 'tool' },
  jackhammer: { label: 'Martello Pneumatico', labelEn: 'Jackhammer', category: 'tool' },
  
  // Misurazione
  laser_level: { label: 'Livella Laser', labelEn: 'Laser Level', category: 'tool' },
  total_station: { label: 'Stazione Totale', labelEn: 'Total Station', category: 'tool' },
  
  // Altro
  heat_gun: { label: 'Pistola Termica', labelEn: 'Heat Gun', category: 'tool' },
  rivet_gun: { label: 'Rivettatrice', labelEn: 'Rivet Gun', category: 'tool' },
  crimping_tool: { label: 'Pressatrice', labelEn: 'Crimping Tool', category: 'tool' }
}

const RATE_TYPES = {
  hourly: { label: 'Orario', labelEn: 'Hourly' },
  daily: { label: 'Giornaliero', labelEn: 'Daily' },
  weekly: { label: 'Settimanale', labelEn: 'Weekly' },
  monthly: { label: 'Mensile', labelEn: 'Monthly' },
  lump_sum: { label: 'Forfettario', labelEn: 'Lump Sum' }
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
function EquipmentListPopup({ equipment, equipmentTypes, title, isVisible, onClose, type }) {
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
                  <span className="font-mono text-sm text-primary font-bold w-20">{eq.asset_code || '—'}</span>
                  <CategoryBadge category={eq.category} size="small" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800">
                      {equipmentTypes[eq.type]?.label || eq.type}
                    </span>
                    {eq.description && (
                      <span className="text-gray-500 text-sm ml-2">- {eq.description}</span>
                    )}
                  </div>
                  <OwnershipBadge ownership={eq.ownership} />
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

export default function Mezzi() {
  const { t } = useTranslation()
  const { activeProject } = useProject()
  
  // State principale
  const [equipment, setEquipment] = useState([])
  const [companies, setCompanies] = useState([])
  const [assignments, setAssignments] = useState({}) // { equipmentId: squadInfo }
  const [customTypes, setCustomTypes] = useState([]) // Tipi personalizzati dal DB
  const [loading, setLoading] = useState(true)
  
  // UI State
  const [showModal, setShowModal] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [expandedDetail, setExpandedDetail] = useState(null)
  const [showNewTypeModal, setShowNewTypeModal] = useState(false)
  
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
  
  // Form nuovo tipo
  const [newTypeForm, setNewTypeForm] = useState({
    labelIt: '',
    labelEn: '',
    category: 'vehicle'
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
  // MERGE TIPI (default + custom)
  // ============================================================================
  
  const EQUIPMENT_TYPES = {
    ...DEFAULT_EQUIPMENT_TYPES,
    ...Object.fromEntries(
      customTypes.map(ct => [
        ct.type_key,
        { label: ct.label_it, labelEn: ct.label_en || ct.label_it, category: ct.category, isCustom: true }
      ])
    )
  }

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
      
      // Carica tipi personalizzati
      const { data: typesData } = await supabase
        .from('equipment_types')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('is_active', true)
        .order('label_it')
      setCustomTypes(typesData || [])
      
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
        .order('asset_code')
      setEquipment(equipmentData || [])
      
      // Carica assegnazioni attive
      const { data: assignmentsData } = await supabase
        .from('equipment_assignments')
        .select(`
          *,
          squad:squads(id, name, squad_number)
        `)
        .eq('status', 'active')
      
      // Mappa assegnazioni per equipment_id
      const assignMap = {}
      ;(assignmentsData || []).forEach(a => {
        assignMap[a.equipment_id] = a.squad
      })
      setAssignments(assignMap)
      
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const resetForm = () => {
    setFormData({
      category: 'vehicle',
      type: '',
      description: '',
      ownership: 'owned',
      ownerCompanyId: '',
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
    setEditingEquipment(null)
    resetForm()
    setShowModal(true)
  }

  const openEditModal = async (eq) => {
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
    
    // Carica tariffe esistenti
    const formRates = (eq.equipment_rates || []).map(r => ({
      id: r.id,
      rateType: r.rate_type,
      amount: r.amount,
      validFrom: r.valid_from,
      validTo: r.valid_to || '',
      appliesWeekdays: r.applies_weekdays,
      appliesWeekends: r.applies_weekends,
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
    if (!newRate.amount || parseFloat(newRate.amount) <= 0) {
      alert('Inserisci un importo valido')
      return
    }
    
    setRates([...rates, { 
      id: `new_${Date.now()}`,
      ...newRate,
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
        // Update - NON modificare asset_code
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
        // Insert - asset_code generato automaticamente dal trigger
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
  // GESTIONE NUOVO TIPO
  // ============================================================================
  
  const handleSaveNewType = async () => {
    if (!newTypeForm.labelIt.trim()) {
      alert('Inserisci il nome italiano')
      return
    }
    
    // Genera type_key dal nome italiano
    const typeKey = newTypeForm.labelIt
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    
    // Verifica se esiste già
    if (EQUIPMENT_TYPES[typeKey] || DEFAULT_EQUIPMENT_TYPES[typeKey]) {
      alert('Questo tipo esiste già!')
      return
    }
    
    try {
      const { error } = await supabase
        .from('equipment_types')
        .insert([{
          project_id: activeProject.id,
          type_key: typeKey,
          label_it: newTypeForm.labelIt.trim(),
          label_en: newTypeForm.labelEn.trim() || null,
          category: newTypeForm.category
        }])
      
      if (error) throw error
      
      // Chiudi modal e ricarica
      setShowNewTypeModal(false)
      setNewTypeForm({ labelIt: '', labelEn: '', category: formData.category })
      
      // Ricarica tipi
      loadData()
      
      // Seleziona il nuovo tipo nel form
      setTimeout(() => {
        setFormData(prev => ({ ...prev, type: typeKey }))
      }, 500)
      
    } catch (err) {
      console.error('Error saving type:', err)
      alert('Errore: ' + err.message)
    }
  }

  // ============================================================================
  // TIPI FILTRATI PER CATEGORIA
  // ============================================================================
  
  const typesForCategory = Object.entries(EQUIPMENT_TYPES)
    .filter(([_, config]) => config.category === formData.category)
    .sort((a, b) => a[1].label.localeCompare(b[1].label))

  // ============================================================================
  // FILTRI E STATISTICHE
  // ============================================================================
  
  const filteredEquipment = equipment.filter(eq => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const typeLabel = EQUIPMENT_TYPES[eq.type]?.label || eq.type
      if (
        !eq.asset_code?.toLowerCase().includes(search) &&
        !typeLabel.toLowerCase().includes(search) &&
        !eq.description?.toLowerCase().includes(search) &&
        !eq.plate_number?.toLowerCase().includes(search) &&
        !eq.serial_number?.toLowerCase().includes(search)
      ) return false
    }
    if (filterCategory && eq.category !== filterCategory) return false
    if (filterOwnership && eq.ownership !== filterOwnership) return false
    if (filterCompany && eq.owner_company_id !== filterCompany) return false
    return true
  })

  // Statistiche per categoria
  const categoryStats = Object.entries(CATEGORIES).map(([key, config]) => {
    const items = equipment.filter(eq => eq.category === key)
    const assignedItems = items.filter(eq => assignments[eq.id])
    const unassignedItems = items.filter(eq => !assignments[eq.id])
    return {
      category: key,
      label: config.label,
      icon: config.icon,
      color: config.color,
      total: items.length,
      assigned: assignedItems.length,
      unassigned: unassignedItems.length,
      percentage: items.length > 0 ? Math.round((assignedItems.length / items.length) * 100) : 0,
      assignedItems,
      unassignedItems
    }
  })

  // Totali
  const totalEquipment = equipment.length
  const totalAssigned = equipment.filter(eq => assignments[eq.id]).length
  const totalUnassigned = totalEquipment - totalAssigned

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
            Mezzi / Asset
          </h1>
          <p className="text-gray-500 mt-1">
            {activeProject.name} • {equipment.length} asset totali
          </p>
        </div>
        
        <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Nuovo Asset
        </button>
      </div>

      {/* ============ DASHBOARD ============ */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Settings size={20} />
          Riepilogo
        </h2>
        
        {/* Totali */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-700">{totalEquipment}</div>
            <div className="text-sm text-blue-600">Totale Asset</div>
          </div>
          <div 
            className="bg-green-50 rounded-lg p-4 text-center cursor-pointer hover:bg-green-100 transition-colors"
            onClick={() => setPopupData({
              type: 'assigned',
              equipment: equipment.filter(eq => assignments[eq.id]),
              title: 'Asset Assegnati'
            })}
          >
            <div className="text-3xl font-bold text-green-700">{totalAssigned}</div>
            <div className="text-sm text-green-600">Assegnati</div>
          </div>
          <div 
            className="bg-amber-50 rounded-lg p-4 text-center cursor-pointer hover:bg-amber-100 transition-colors"
            onClick={() => setPopupData({
              type: 'unassigned',
              equipment: equipment.filter(eq => !assignments[eq.id]),
              title: 'Asset Disponibili'
            })}
          >
            <div className="text-3xl font-bold text-amber-700">{totalUnassigned}</div>
            <div className="text-sm text-amber-600">Disponibili</div>
          </div>
        </div>
        
        {/* Per categoria */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              placeholder="Cerca per codice, tipo, descrizione, targa..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Tutte le categorie</option>
            {Object.entries(CATEGORIES).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          
          <select
            value={filterOwnership}
            onChange={(e) => setFilterOwnership(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Proprietà/Noleggio</option>
            {Object.entries(OWNERSHIP_TYPES).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Tutte le aziende</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>
                {c.company_name} {c.is_main ? '⭐' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ============ LISTA EQUIPMENT ============ */}
      <div className="bg-white rounded-xl border border-gray-200">
        {filteredEquipment.length === 0 ? (
          <div className="p-12 text-center">
            <Truck size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">
              {equipment.length === 0 
                ? 'Nessun asset registrato' 
                : 'Nessun risultato per i filtri selezionati'}
            </p>
            {equipment.length === 0 && (
              <button onClick={openAddModal} className="btn-primary">
                <Plus size={18} className="mr-2" />
                Aggiungi il primo asset
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Codice</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Categoria</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Descrizione</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Targa/Serial</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Proprietà</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Squadra</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Tariffe</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-600">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEquipment.map(eq => {
                  const typeConfig = EQUIPMENT_TYPES[eq.type] || { label: eq.type }
                  const squad = assignments[eq.id]
                  const hasRates = eq.equipment_rates && eq.equipment_rates.length > 0
                  
                  return (
                    <tr key={eq.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-primary">{eq.asset_code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={eq.category} size="small" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{typeConfig.label}</span>
                        {typeConfig.isCustom && <Star size={10} className="inline ml-1 text-yellow-500" />}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm max-w-[200px] truncate">
                        {eq.description || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-600">
                        {eq.plate_number || eq.serial_number || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <OwnershipBadge ownership={eq.ownership} />
                          <span className="text-xs text-gray-500 truncate max-w-[120px]">
                            {eq.owner_company?.company_name}
                            {eq.owner_company?.is_main && <Star size={8} className="inline ml-1 text-yellow-500" />}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {squad ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <Users size={12} />
                            {squad.name || `Squadra ${squad.squad_number}`}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">Non assegnato</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {hasRates ? (
                          <div className="text-xs text-gray-600">
                            {eq.equipment_rates.slice(0, 2).map((r, i) => (
                              <div key={i}>
                                {RATE_TYPES[r.rate_type]?.label}: €{parseFloat(r.amount).toFixed(2)}
                              </div>
                            ))}
                            {eq.equipment_rates.length > 2 && (
                              <span className="text-gray-400">+{eq.equipment_rates.length - 2} altre</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Nessuna</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(eq)}
                            className="p-2 hover:bg-blue-100 rounded-lg text-blue-600"
                            title="Modifica"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(eq)}
                            className="p-2 hover:bg-red-100 rounded-lg text-red-600"
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

      {/* ============ POPUP LISTA ============ */}
      <EquipmentListPopup
        equipment={popupData?.equipment || []}
        equipmentTypes={EQUIPMENT_TYPES}
        title={popupData?.title || ''}
        isVisible={popupData !== null}
        onClose={() => setPopupData(null)}
        type={popupData?.type}
      />

      {/* ============ MODAL NUOVO/MODIFICA ============ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-800">
                {editingEquipment ? 'Modifica Asset' : 'Nuovo Asset'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Asset Code (solo visualizzazione per edit) */}
              {editingEquipment && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Codice Asset
                  </label>
                  <div className="font-mono text-lg font-bold text-blue-800">
                    {editingEquipment.asset_code}
                  </div>
                  <p className="text-xs text-blue-600 mt-1">Il codice viene generato automaticamente</p>
                </div>
              )}
              
              {!editingEquipment && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-600">
                    <Hash size={14} className="inline mr-1" />
                    Il codice asset (es. <span className="font-mono font-bold">ASSET-001</span>) verrà generato automaticamente
                  </p>
                </div>
              )}
              
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
                  <div className="flex gap-2">
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">-- Seleziona --</option>
                      {typesForCategory.map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.label} / {config.labelEn}
                          {config.isCustom && ' ★'}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setNewTypeForm({ labelIt: '', labelEn: '', category: formData.category })
                        setShowNewTypeModal(true)
                      }}
                      className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center gap-1"
                      title="Aggiungi nuovo tipo"
                    >
                      <PlusCircle size={18} />
                    </button>
                  </div>
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
                      <option value="">-- Seleziona azienda --</option>
                      {companies.filter(c => !c.is_main).map(c => (
                        <option key={c.id} value={c.id}>{c.company_name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              
              {/* Targa e Serial */}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numero Seriale</label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    placeholder="SN-12345678"
                  />
                </div>
              </div>
              
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
              
              {/* ============ SEZIONE TARIFFE ============ */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <DollarSign size={18} />
                  Tariffe
                </h3>
                
                {/* Tariffe esistenti */}
                {rates.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {rates.map(rate => (
                      <div key={rate.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                        <span className="font-medium text-gray-700">
                          {RATE_TYPES[rate.rateType]?.label}
                        </span>
                        <span className="font-bold text-green-600">
                          €{parseFloat(rate.amount).toFixed(2)}
                        </span>
                        <span className="text-sm text-gray-500">
                          Dal {new Date(rate.validFrom).toLocaleDateString('it-IT')}
                          {rate.validTo && ` al ${new Date(rate.validTo).toLocaleDateString('it-IT')}`}
                        </span>
                        <div className="flex-1 flex gap-2 justify-end">
                          {rate.appliesWeekdays && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Feriali</span>
                          )}
                          {rate.appliesWeekends && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Weekend</span>
                          )}
                        </div>
                        <button
                          onClick={() => removeRate(rate.id)}
                          className="p-1 hover:bg-red-100 rounded text-red-600"
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
                          <option key={key} value={key}>{config.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Importo €</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newRate.amount}
                        onChange={(e) => setNewRate({ ...newRate, amount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Valido dal</label>
                      <input
                        type="date"
                        value={newRate.validFrom}
                        onChange={(e) => setNewRate({ ...newRate, validFrom: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Valido fino al (opz.)</label>
                      <input
                        type="date"
                        value={newRate.validTo}
                        onChange={(e) => setNewRate({ ...newRate, validTo: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newRate.appliesWeekdays}
                        onChange={(e) => setNewRate({ ...newRate, appliesWeekdays: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">Giorni feriali</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newRate.appliesWeekends}
                        onChange={(e) => setNewRate({ ...newRate, appliesWeekends: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">Weekend</span>
                    </label>
                  </div>
                  
                  <button
                    onClick={addRate}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    <Plus size={16} className="inline mr-1" />
                    Aggiungi Tariffa
                  </button>
                </div>
              </div>
            </div>
            
            {/* Footer Modal */}
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
              >
                <Check size={18} className="inline mr-2" />
                {editingEquipment ? 'Salva Modifiche' : 'Crea Asset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL NUOVO TIPO ============ */}
      {showNewTypeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <PlusCircle className="text-green-600" size={20} />
                Nuovo Tipo di Asset
              </h2>
              <button onClick={() => setShowNewTypeModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria
                </label>
                <select
                  value={newTypeForm.category}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {Object.entries(CATEGORIES).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Italiano <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTypeForm.labelIt}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, labelIt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Es: Piattaforma Semovente"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Inglese (opzionale)
                </label>
                <input
                  type="text"
                  value={newTypeForm.labelEn}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, labelEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Es: Self-propelled Platform"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowNewTypeModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveNewType}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Check size={18} className="inline mr-2" />
                Salva Tipo
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
                <h3 className="font-bold text-gray-800">Elimina Asset</h3>
                <p className="text-sm text-gray-500">
                  {showDeleteConfirm.asset_code} - {EQUIPMENT_TYPES[showDeleteConfirm.type]?.label || showDeleteConfirm.type}
                </p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              Sei sicuro di voler eliminare questo asset? 
              L'asset verrà disattivato e non sarà più visibile nelle liste.
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
                <Trash2 size={18} className="inline mr-2" />
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
