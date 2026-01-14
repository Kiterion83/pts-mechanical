import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import { 
  Wrench, Plus, Search, Filter, X, Check, Edit, Trash2,
  ChevronDown, ChevronRight, Calendar, Users, Clock,
  AlertTriangle, CheckCircle2, Package, Truck, Hash,
  Play, Pause, BarChart3, MapPin, FileText, DollarSign,
  PlusCircle, MinusCircle, GanttChart, Download
} from 'lucide-react'
import WorkPackagesGantt from '../components/WorkPackagesGantt'
import * as XLSX from 'xlsx'

// ============================================================================
// CONFIGURAZIONE
// ============================================================================

const DISCIPLINES = {
  piping: { label: 'Piping', color: 'bg-blue-100 text-blue-800' },
  civil: { label: 'Civil', color: 'bg-amber-100 text-amber-800' },
  mechanical: { label: 'Mechanical', color: 'bg-green-100 text-green-800' },
  electrical: { label: 'Electrical', color: 'bg-yellow-100 text-yellow-800' },
  instrumentation: { label: 'Instrumentation', color: 'bg-purple-100 text-purple-800' },
  other: { label: 'Altro', color: 'bg-gray-100 text-gray-800' }
}

const STATUSES = {
  draft: { label: 'Bozza', color: 'bg-gray-100 text-gray-800', icon: FileText },
  assigned: { label: 'Assegnato', color: 'bg-blue-100 text-blue-800', icon: Users },
  in_progress: { label: 'In Corso', color: 'bg-green-100 text-green-800', icon: Play },
  completed: { label: 'Completato', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  on_hold: { label: 'Sospeso', color: 'bg-orange-100 text-orange-800', icon: Pause }
}

const UNITS_OF_MEASURE = [
  { value: 'nr', label: 'Nr (numero)' },
  { value: 'm', label: 'm (metri)' },
  { value: 'ml', label: 'ml (metri lineari)' },
  { value: 'm2', label: 'm² (metri quadri)' },
  { value: 'm3', label: 'm³ (metri cubi)' },
  { value: 'kg', label: 'kg (chilogrammi)' },
  { value: 'ton', label: 'ton (tonnellate)' },
  { value: 'pz', label: 'pz (pezzi)' },
  { value: 'lt', label: 'lt (litri)' }
]

const EQUIPMENT_TYPES_GENERIC = {
  crane: { label: 'Gru', labelEn: 'Crane' },
  truck: { label: 'Camion', labelEn: 'Truck' },
  forklift: { label: 'Muletto', labelEn: 'Forklift' },
  excavator: { label: 'Escavatore', labelEn: 'Excavator' },
  generator: { label: 'Generatore', labelEn: 'Generator' },
  welding_machine: { label: 'Saldatrice', labelEn: 'Welding Machine' },
  compressor: { label: 'Compressore', labelEn: 'Compressor' },
  aerial_platform: { label: 'Piattaforma Aerea', labelEn: 'Aerial Platform' },
  light_tower: { label: 'Torre Faro', labelEn: 'Light Tower' },
  other: { label: 'Altro', labelEn: 'Other' }
}

// ============================================================================
// COMPONENTI BADGE
// ============================================================================

function DisciplineBadge({ discipline }) {
  const config = DISCIPLINES[discipline] || DISCIPLINES.other
  return (
    <span className={`${config.color} px-2 py-1 text-xs rounded-full font-medium`}>
      {config.label}
    </span>
  )
}

function StatusBadge({ status }) {
  const config = STATUSES[status] || STATUSES.draft
  const Icon = config.icon
  return (
    <span className={`${config.color} px-2 py-1 text-xs rounded-full font-medium inline-flex items-center gap-1`}>
      <Icon size={12} />
      {config.label}
    </span>
  )
}

function AssignmentBadge({ hasSquad, hasDate }) {
  if (hasSquad && hasDate) {
    return (
      <span className="bg-green-100 text-green-800 px-2 py-1 text-xs rounded-full font-medium inline-flex items-center gap-1">
        <CheckCircle2 size={12} />
        Pronto
      </span>
    )
  }
  if (hasSquad) {
    return (
      <span className="bg-blue-100 text-blue-800 px-2 py-1 text-xs rounded-full font-medium inline-flex items-center gap-1">
        <Users size={12} />
        Solo Squadra
      </span>
    )
  }
  if (hasDate) {
    return (
      <span className="bg-amber-100 text-amber-800 px-2 py-1 text-xs rounded-full font-medium inline-flex items-center gap-1">
        <Calendar size={12} />
        Solo Date
      </span>
    )
  }
  return (
    <span className="bg-gray-100 text-gray-600 px-2 py-1 text-xs rounded-full font-medium inline-flex items-center gap-1">
      <Clock size={12} />
      Da Assegnare
    </span>
  )
}

// ============================================================================
// COMPONENTE PROGRESS BAR
// ============================================================================

function ProgressBar({ percent, size = 'normal' }) {
  const height = size === 'small' ? 'h-1.5' : 'h-2'
  const color = percent >= 100 ? 'bg-emerald-500' : percent >= 50 ? 'bg-green-500' : 'bg-blue-500'
  
  return (
    <div className={`w-full bg-gray-200 rounded-full ${height}`}>
      <div 
        className={`${color} ${height} rounded-full transition-all duration-300`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  )
}

// ============================================================================
// COMPONENTE PRINCIPALE
// ============================================================================

export default function WorkPackages() {
  const { t } = useTranslation()
  const { activeProject } = useProject()
  
  // State principale
  const [workPackages, setWorkPackages] = useState([])
  const [squads, setSquads] = useState([])
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  
  // UI State
  const [showModal, setShowModal] = useState(false)
  const [editingWP, setEditingWP] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [expandedWP, setExpandedWP] = useState(null)
  const [activeTab, setActiveTab] = useState('list')
  
  // Filtri
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDiscipline, setFilterDiscipline] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAssignment, setFilterAssignment] = useState('')
  
  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    area: '',
    discipline: 'piping',
    budgetHours: '',
    hourlyRate: '',
    squadId: '',
    plannedStart: '',
    plannedEnd: '',
    notes: ''
  })
  
  // Quantità
  const [quantities, setQuantities] = useState([])
  const [newQty, setNewQty] = useState({
    description: '',
    unitOfMeasure: 'nr',
    plannedQty: ''
  })
  
  // Equipment stime
  const [equipmentEstimates, setEquipmentEstimates] = useState([])
  const [newEquipment, setNewEquipment] = useState({
    mode: 'generic',
    equipmentType: '',
    equipmentId: '',
    estimatedHours: ''
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
      
      const { data: wpData } = await supabase
        .from('work_packages')
        .select(`
          *,
          squad:squads(id, squad_number, name),
          work_package_quantities(*),
          work_package_equipment(*, equipment:equipment(id, type, description, plate_number))
        `)
        .eq('project_id', activeProject.id)
        .order('code')
      
      const wpWithProgress = (wpData || []).map(wp => {
        const totalPlanned = wp.work_package_quantities?.reduce((sum, q) => sum + (q.planned_qty || 0), 0) || 0
        const totalCompleted = wp.work_package_quantities?.reduce((sum, q) => sum + (q.completed_qty || 0), 0) || 0
        const progress = totalPlanned > 0 ? (totalCompleted / totalPlanned) * 100 : 0
        const hasGenericEquipment = wp.work_package_equipment?.some(e => !e.equipment_id) || false
        
        return { ...wp, progress, hasGenericEquipment }
      })
      
      setWorkPackages(wpWithProgress)
      
      const { data: squadsData } = await supabase
        .from('squads')
        .select(`*, squad_members(id, status)`)
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
        .order('squad_number')
      
      const squadsWithCount = (squadsData || []).map(s => ({
        ...s,
        memberCount: s.squad_members?.filter(m => m.status === 'active').length || 0
      }))
      setSquads(squadsWithCount)
      
      const { data: eqData } = await supabase
        .from('equipment')
        .select('*')
        .eq('project_id', activeProject.id)
        .neq('status', 'inactive')
        .order('type')
      setEquipment(eqData || [])
      
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // CALCOLI DASHBOARD
  // ============================================================================
  
  const readyCount = workPackages.filter(wp => wp.squad_id && wp.planned_start).length
  const squadOnlyCount = workPackages.filter(wp => wp.squad_id && !wp.planned_start).length
  const dateOnlyCount = workPackages.filter(wp => !wp.squad_id && wp.planned_start).length
  const unassignedCount = workPackages.filter(wp => !wp.squad_id && !wp.planned_start).length
  
  const globalProgress = workPackages.length > 0
    ? workPackages.reduce((sum, wp) => sum + wp.progress, 0) / workPackages.length
    : 0

  // ============================================================================
  // FILTRI
  // ============================================================================
  
  const filteredWPs = workPackages.filter(wp => {
    const matchesSearch = searchTerm === '' ||
      wp.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wp.area?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesDiscipline = !filterDiscipline || wp.discipline === filterDiscipline
    const matchesStatus = !filterStatus || wp.status === filterStatus
    
    let matchesAssignment = true
    if (filterAssignment === 'ready') matchesAssignment = wp.squad_id && wp.planned_start
    else if (filterAssignment === 'squad_only') matchesAssignment = wp.squad_id && !wp.planned_start
    else if (filterAssignment === 'date_only') matchesAssignment = !wp.squad_id && wp.planned_start
    else if (filterAssignment === 'unassigned') matchesAssignment = !wp.squad_id && !wp.planned_start
    
    return matchesSearch && matchesDiscipline && matchesStatus && matchesAssignment
  })

  // ============================================================================
  // EXPORT EXCEL
  // ============================================================================
  
  const handleExport = () => {
    const data = workPackages.map(wp => ({
      'Codice': wp.code,
      'Nome': wp.name,
      'Disciplina': DISCIPLINES[wp.discipline]?.label || wp.discipline,
      'Area': wp.area || '',
      'Stato': STATUSES[wp.status]?.label || wp.status,
      'Squadra': wp.squad ? `Sq. ${wp.squad.squad_number}` : '',
      'Data Inizio': wp.planned_start || '',
      'Data Fine': wp.planned_end || '',
      'Avanzamento %': wp.progress?.toFixed(1) || '0',
      'Monte Ore': wp.budget_hours || '',
      'Tariffa €/h': wp.hourly_rate || ''
    }))
    
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Work Packages')
    XLSX.writeFile(wb, `WorkPackages_${activeProject.code}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================
  
  const openCreateModal = async () => {
    let nextCode = `WP-${String(workPackages.length + 1).padStart(3, '0')}`
    
    try {
      const { data } = await supabase.rpc('generate_wp_code', { p_project_id: activeProject.id })
      if (data) nextCode = data
    } catch (e) {
      console.log('Using fallback code generation')
    }
    
    setFormData({
      code: nextCode,
      name: '',
      description: '',
      area: '',
      discipline: 'piping',
      budgetHours: '',
      hourlyRate: '',
      squadId: '',
      plannedStart: '',
      plannedEnd: '',
      notes: ''
    })
    setQuantities([])
    setEquipmentEstimates([])
    setEditingWP(null)
    setShowModal(true)
  }

  const openEditModal = (wp) => {
    setFormData({
      code: wp.code,
      name: wp.name || '',
      description: wp.description || '',
      area: wp.area || '',
      discipline: wp.discipline || 'piping',
      budgetHours: wp.budget_hours || '',
      hourlyRate: wp.hourly_rate || '',
      squadId: wp.squad_id || '',
      plannedStart: wp.planned_start || '',
      plannedEnd: wp.planned_end || '',
      notes: wp.notes || ''
    })
    setQuantities(wp.work_package_quantities || [])
    setEquipmentEstimates(wp.work_package_equipment || [])
    setEditingWP(wp)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Inserisci il nome del Work Package')
      return
    }
    
    try {
      const wpData = {
        project_id: activeProject.id,
        code: formData.code,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        area: formData.area.trim() || null,
        discipline: formData.discipline,
        budget_hours: formData.budgetHours ? parseFloat(formData.budgetHours) : null,
        hourly_rate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
        squad_id: formData.squadId || null,
        planned_start: formData.plannedStart || null,
        planned_end: formData.plannedEnd || null,
        notes: formData.notes.trim() || null
      }
      
      let wpId
      
      if (editingWP) {
        const { error } = await supabase
          .from('work_packages')
          .update(wpData)
          .eq('id', editingWP.id)
        
        if (error) throw error
        wpId = editingWP.id
        
        await supabase.from('work_package_quantities').delete().eq('work_package_id', wpId)
        await supabase.from('work_package_equipment').delete().eq('work_package_id', wpId)
      } else {
        const { data, error } = await supabase
          .from('work_packages')
          .insert([wpData])
          .select()
          .single()
        
        if (error) throw error
        wpId = data.id
      }
      
      if (quantities.length > 0) {
        const qtyData = quantities.map((q, idx) => ({
          work_package_id: wpId,
          description: q.description,
          unit_of_measure: q.unit_of_measure || q.unitOfMeasure,
          planned_qty: parseFloat(q.planned_qty || q.plannedQty) || 0,
          completed_qty: parseFloat(q.completed_qty) || 0,
          sort_order: idx
        }))
        
        await supabase.from('work_package_quantities').insert(qtyData)
      }
      
      if (equipmentEstimates.length > 0) {
        const eqData = equipmentEstimates.map(e => ({
          work_package_id: wpId,
          equipment_id: e.equipment_id || e.equipmentId || null,
          equipment_type: e.equipment_type || e.equipmentType || null,
          estimated_hours: parseFloat(e.estimated_hours || e.estimatedHours) || 0,
          notes: e.notes || null
        }))
        
        await supabase.from('work_package_equipment').insert(eqData)
      }
      
      setShowModal(false)
      loadData()
      
    } catch (err) {
      console.error('Error saving:', err)
      alert('Errore: ' + err.message)
    }
  }

  const handleDelete = async (wp) => {
    try {
      const { error } = await supabase
        .from('work_packages')
        .delete()
        .eq('id', wp.id)
      
      if (error) throw error
      
      setShowDeleteConfirm(null)
      loadData()
    } catch (err) {
      console.error('Error deleting:', err)
      alert('Errore: ' + err.message)
    }
  }

  // ============================================================================
  // GESTIONE QUANTITÀ
  // ============================================================================
  
  const addQuantity = () => {
    if (!newQty.description.trim() || !newQty.plannedQty) {
      alert('Inserisci descrizione e quantità')
      return
    }
    
    setQuantities([...quantities, {
      description: newQty.description,
      unit_of_measure: newQty.unitOfMeasure,
      planned_qty: parseFloat(newQty.plannedQty),
      completed_qty: 0
    }])
    
    setNewQty({ description: '', unitOfMeasure: 'nr', plannedQty: '' })
  }

  const removeQuantity = (index) => {
    setQuantities(quantities.filter((_, i) => i !== index))
  }

  // ============================================================================
  // GESTIONE EQUIPMENT ESTIMATES
  // ============================================================================
  
  const addEquipmentEstimate = () => {
    if (!newEquipment.estimatedHours) {
      alert('Inserisci le ore stimate')
      return
    }
    
    if (newEquipment.mode === 'generic' && !newEquipment.equipmentType) {
      alert('Seleziona il tipo di equipment')
      return
    }
    
    if (newEquipment.mode === 'specific' && !newEquipment.equipmentId) {
      alert('Seleziona l\'equipment specifico')
      return
    }
    
    const newEst = {
      equipment_id: newEquipment.mode === 'specific' ? newEquipment.equipmentId : null,
      equipment_type: newEquipment.mode === 'generic' ? newEquipment.equipmentType : null,
      estimated_hours: parseFloat(newEquipment.estimatedHours),
      equipment: newEquipment.mode === 'specific' 
        ? equipment.find(e => e.id === newEquipment.equipmentId)
        : null
    }
    
    setEquipmentEstimates([...equipmentEstimates, newEst])
    setNewEquipment({ mode: 'generic', equipmentType: '', equipmentId: '', estimatedHours: '' })
  }

  const removeEquipmentEstimate = (index) => {
    setEquipmentEstimates(equipmentEstimates.filter((_, i) => i !== index))
  }

  // ============================================================================
  // RENDER
  // ============================================================================
  
  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Wrench size={64} className="text-gray-300 mb-4" />
        <p className="text-gray-500">Seleziona un progetto</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Wrench className="text-primary" />
            Work Packages
          </h1>
          <p className="text-gray-500 mt-1">
            {activeProject.name} • {workPackages.length} WP totali
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'list' ? 'bg-white shadow text-primary' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setActiveTab('gantt')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'gantt' ? 'bg-white shadow text-primary' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <GanttChart size={16} />
              Gantt
            </button>
          </div>
          
          <button
            onClick={handleExport}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Download size={18} />
            Export
          </button>
          
          <button
            onClick={openCreateModal}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            Nuovo WP
          </button>
        </div>
      </div>

      {/* ============ DASHBOARD ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div 
          onClick={() => setFilterAssignment(filterAssignment === 'ready' ? '' : 'ready')}
          className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
            filterAssignment === 'ready' ? 'ring-2 ring-green-500' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{readyCount}</p>
              <p className="text-xs text-gray-500">Pronti</p>
            </div>
          </div>
        </div>
        
        <div 
          onClick={() => setFilterAssignment(filterAssignment === 'squad_only' ? '' : 'squad_only')}
          className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
            filterAssignment === 'squad_only' ? 'ring-2 ring-blue-500' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{squadOnlyCount}</p>
              <p className="text-xs text-gray-500">Solo Squadra</p>
            </div>
          </div>
        </div>
        
        <div 
          onClick={() => setFilterAssignment(filterAssignment === 'date_only' ? '' : 'date_only')}
          className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
            filterAssignment === 'date_only' ? 'ring-2 ring-amber-500' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Calendar className="text-amber-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{dateOnlyCount}</p>
              <p className="text-xs text-gray-500">Solo Date</p>
            </div>
          </div>
        </div>
        
        <div 
          onClick={() => setFilterAssignment(filterAssignment === 'unassigned' ? '' : 'unassigned')}
          className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
            filterAssignment === 'unassigned' ? 'ring-2 ring-gray-500' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Clock className="text-gray-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{unassignedCount}</p>
              <p className="text-xs text-gray-500">Da Assegnare</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="text-primary" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{globalProgress.toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Avanzamento</p>
            </div>
          </div>
          <ProgressBar percent={globalProgress} />
        </div>
      </div>

      {/* ============ FILTRI ============ */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Cerca codice, nome, area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <select
            value={filterDiscipline}
            onChange={(e) => setFilterDiscipline(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tutte le discipline</option>
            {Object.entries(DISCIPLINES).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tutti gli stati</option>
            {Object.entries(STATUSES).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          
          {(searchTerm || filterDiscipline || filterStatus || filterAssignment) && (
            <button
              onClick={() => {
                setSearchTerm('')
                setFilterDiscipline('')
                setFilterStatus('')
                setFilterAssignment('')
              }}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
            >
              <X size={16} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ============ CONTENT ============ */}
      {activeTab === 'list' ? (
        <div className="space-y-4">
          {filteredWPs.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm">
              <Wrench size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Nessun Work Package trovato</p>
              <button onClick={openCreateModal} className="mt-4 text-primary hover:underline">
                Crea il primo WP
              </button>
            </div>
          ) : (
            filteredWPs.map(wp => {
              const isExpanded = expandedWP === wp.id
              
              return (
                <div key={wp.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedWP(isExpanded ? null : wp.id)}
                  >
                    <div className="flex items-start gap-4">
                      <button className="mt-1 text-gray-400">
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {wp.code}
                          </span>
                          <h3 className="font-semibold text-gray-800">{wp.name}</h3>
                          
                          {wp.hasGenericEquipment && (
                            <span className="text-amber-500" title="Equipment generico">
                              <AlertTriangle size={18} />
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                          {wp.area && (
                            <span className="flex items-center gap-1">
                              <MapPin size={14} />
                              {wp.area}
                            </span>
                          )}
                          <DisciplineBadge discipline={wp.discipline} />
                          <StatusBadge status={wp.status} />
                          <AssignmentBadge hasSquad={!!wp.squad_id} hasDate={!!wp.planned_start} />
                        </div>
                        
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex-1 max-w-xs">
                            <ProgressBar percent={wp.progress} size="small" />
                          </div>
                          <span className="text-sm font-medium text-gray-600">
                            {wp.progress.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {wp.squad ? (
                          <div className="text-sm">
                            <span className="font-medium text-gray-800">Sq. {wp.squad.squad_number}</span>
                            <p className="text-gray-500 text-xs">{wp.squad.name}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">--</span>
                        )}
                      </div>
                      
                      <div className="text-right text-sm">
                        {wp.planned_start ? (
                          <>
                            <p className="text-gray-600">
                              {new Date(wp.planned_start).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                            </p>
                            <p className="text-gray-400 text-xs">
                              → {wp.planned_end ? new Date(wp.planned_end).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '--'}
                            </p>
                          </>
                        ) : (
                          <span className="text-gray-400">No date</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEditModal(wp)}
                          className="p-2 hover:bg-blue-100 rounded-lg text-blue-600"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(wp)}
                          className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <Package size={16} />
                            Quantità ({wp.work_package_quantities?.length || 0})
                          </h4>
                          {(wp.work_package_quantities?.length || 0) === 0 ? (
                            <p className="text-sm text-gray-500">Nessuna quantità definita</p>
                          ) : (
                            <div className="space-y-2">
                              {wp.work_package_quantities.map(q => {
                                const qtyProgress = q.planned_qty > 0 ? (q.completed_qty / q.planned_qty) * 100 : 0
                                return (
                                  <div key={q.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm font-medium">{q.description}</span>
                                      <span className="text-xs text-gray-500">
                                        {q.completed_qty} / {q.planned_qty} {q.unit_of_measure}
                                      </span>
                                    </div>
                                    <ProgressBar percent={qtyProgress} size="small" />
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <Truck size={16} />
                            Stime Mezzi & Budget
                          </h4>
                          
                          {(wp.budget_hours || wp.hourly_rate) && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200 mb-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Monte ore:</span>
                                <span className="font-medium">{wp.budget_hours || '--'} h</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Tariffa media:</span>
                                <span className="font-medium">€ {wp.hourly_rate || '--'}/h</span>
                              </div>
                              {wp.budget_hours && wp.hourly_rate && (
                                <div className="flex items-center justify-between text-sm border-t mt-2 pt-2">
                                  <span className="text-gray-600">Costo stimato:</span>
                                  <span className="font-bold text-primary">
                                    € {(wp.budget_hours * wp.hourly_rate).toLocaleString('it-IT')}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {(wp.work_package_equipment?.length || 0) === 0 ? (
                            <p className="text-sm text-gray-500">Nessun mezzo assegnato</p>
                          ) : (
                            <div className="space-y-2">
                              {wp.work_package_equipment.map(e => (
                                <div key={e.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {!e.equipment_id && <AlertTriangle size={16} className="text-amber-500" />}
                                    <span className="text-sm">
                                      {e.equipment 
                                        ? `${e.equipment.type} ${e.equipment.description || e.equipment.plate_number || ''}`
                                        : EQUIPMENT_TYPES_GENERIC[e.equipment_type]?.label || e.equipment_type
                                      }
                                    </span>
                                    {!e.equipment_id && <span className="text-xs text-amber-600">(generico)</span>}
                                  </div>
                                  <span className="text-sm font-medium">{e.estimated_hours} h</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {wp.notes && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-600">{wp.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      ) : (
        <WorkPackagesGantt
          workPackages={workPackages}
          squads={squads}
          projectHoursPerDay={8}
          onWPClick={(wp) => openEditModal(wp)}
        />
      )}

      {/* ============ MODAL CREA/MODIFICA ============ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                {editingWP ? `Modifica ${editingWP.code}` : 'Nuovo Work Package'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Codice</label>
                    <input
                      type="text"
                      value={formData.code}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Disciplina</label>
                    <select
                      value={formData.discipline}
                      onChange={(e) => setFormData({ ...formData, discipline: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      {Object.entries(DISCIPLINES).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Es: Saldature linea DN150, Montaggio supporti..."
                  />
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Area/Zona</label>
                    <input
                      type="text"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Es: Zona Nord, Area Compressori..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Squadra</label>
                    <select
                      value={formData.squadId}
                      onChange={(e) => setFormData({ ...formData, squadId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">-- Non assegnata --</option>
                      {squads.map(s => (
                        <option key={s.id} value={s.id}>
                          Sq. {s.squad_number} - {s.name} ({s.memberCount} pers.)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                    <input
                      type="date"
                      value={formData.plannedStart}
                      onChange={(e) => setFormData({ ...formData, plannedStart: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Fine</label>
                    <input
                      type="date"
                      value={formData.plannedEnd}
                      onChange={(e) => setFormData({ ...formData, plannedEnd: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monte Ore</label>
                    <input
                      type="number"
                      value={formData.budgetHours}
                      onChange={(e) => setFormData({ ...formData, budgetHours: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Ore totali previste"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tariffa Media (€/h)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.hourlyRate}
                      onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="€ per ora"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                
                {/* QUANTITÀ */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Package size={18} />
                    Linee Quantità
                  </h3>
                  
                  {quantities.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {quantities.map((q, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                          <div className="flex-1">
                            <span className="font-medium">{q.description}</span>
                            <span className="text-gray-500 ml-2">
                              {q.planned_qty || q.plannedQty} {q.unit_of_measure || q.unitOfMeasure}
                            </span>
                          </div>
                          <button onClick={() => removeQuantity(idx)} className="p-1.5 hover:bg-red-100 rounded text-red-500">
                            <MinusCircle size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={newQty.description}
                        onChange={(e) => setNewQty({ ...newQty, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Descrizione (es: Saldature Ø2)"
                      />
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        value={newQty.plannedQty}
                        onChange={(e) => setNewQty({ ...newQty, plannedQty: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Qtà"
                      />
                    </div>
                    <div className="w-32">
                      <select
                        value={newQty.unitOfMeasure}
                        onChange={(e) => setNewQty({ ...newQty, unitOfMeasure: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        {UNITS_OF_MEASURE.map(u => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                    </div>
                    <button onClick={addQuantity} className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                      <PlusCircle size={20} />
                    </button>
                  </div>
                </div>
                
                {/* EQUIPMENT STIME */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Truck size={18} />
                    Stime Utilizzo Mezzi
                  </h3>
                  
                  {equipmentEstimates.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {equipmentEstimates.map((e, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                          <div className="flex-1 flex items-center gap-2">
                            {!e.equipment_id && !e.equipmentId && <AlertTriangle size={16} className="text-amber-500" />}
                            <span className="font-medium">
                              {e.equipment 
                                ? `${e.equipment.type} - ${e.equipment.description || e.equipment.plate_number}`
                                : EQUIPMENT_TYPES_GENERIC[e.equipment_type || e.equipmentType]?.label || e.equipment_type || e.equipmentType
                              }
                            </span>
                            {(!e.equipment_id && !e.equipmentId) && <span className="text-xs text-amber-600">(generico)</span>}
                          </div>
                          <span className="text-sm font-medium">{e.estimated_hours || e.estimatedHours} h</span>
                          <button onClick={() => removeEquipmentEstimate(idx)} className="p-1.5 hover:bg-red-100 rounded text-red-500">
                            <MinusCircle size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={newEquipment.mode === 'generic'}
                          onChange={() => setNewEquipment({ ...newEquipment, mode: 'generic', equipmentId: '' })}
                        />
                        <span className="text-sm">Tipo Generico</span>
                        <AlertTriangle size={14} className="text-amber-500" />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={newEquipment.mode === 'specific'}
                          onChange={() => setNewEquipment({ ...newEquipment, mode: 'specific', equipmentType: '' })}
                        />
                        <span className="text-sm">Equipment Specifico</span>
                        <CheckCircle2 size={14} className="text-green-500" />
                      </label>
                    </div>
                    
                    <div className="flex gap-2 items-end">
                      {newEquipment.mode === 'generic' ? (
                        <div className="flex-1">
                          <select
                            value={newEquipment.equipmentType}
                            onChange={(e) => setNewEquipment({ ...newEquipment, equipmentType: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="">-- Seleziona tipo --</option>
                            {Object.entries(EQUIPMENT_TYPES_GENERIC).map(([key, config]) => (
                              <option key={key} value={key}>{config.label}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <select
                            value={newEquipment.equipmentId}
                            onChange={(e) => setNewEquipment({ ...newEquipment, equipmentId: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="">-- Seleziona equipment --</option>
                            {equipment.map(eq => (
                              <option key={eq.id} value={eq.id}>
                                {eq.type} - {eq.description || eq.plate_number || eq.serial_number}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="w-24">
                        <input
                          type="number"
                          value={newEquipment.estimatedHours}
                          onChange={(e) => setNewEquipment({ ...newEquipment, estimatedHours: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Ore"
                        />
                      </div>
                      <button onClick={addEquipmentEstimate} className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                        <PlusCircle size={20} />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                Annulla
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-2">
                <Check size={18} />
                {editingWP ? 'Salva Modifiche' : 'Crea WP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL CONFERMA ELIMINAZIONE ============ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Conferma Eliminazione</h3>
            <p className="text-gray-600 mb-6">
              Sei sicuro di voler eliminare <strong>{showDeleteConfirm.code} - {showDeleteConfirm.name}</strong>?
              <br />
              <span className="text-sm text-red-600">Questa azione è irreversibile.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                Annulla
              </button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
