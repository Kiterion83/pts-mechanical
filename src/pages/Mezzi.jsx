import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import { 
  Truck, Plus, Search, X, Check, Edit, Trash2, ChevronDown, ChevronRight,
  Building2, Calendar, DollarSign, AlertTriangle, Wrench, Settings, 
  Package, PlusCircle, FileText, Upload, Download, Image, Clock, Bell,
  Users, FileCheck, Paperclip, Eye, ExternalLink
} from 'lucide-react'

// ============================================================================
// CONFIGURAZIONE
// ============================================================================

const CATEGORIES = {
  vehicle: { 
    label: 'Mezzo', labelEn: 'Vehicle', 
    icon: Truck, color: 'bg-blue-100 text-blue-800', iconColor: 'text-blue-600'
  },
  equipment: { 
    label: 'Equipment', labelEn: 'Equipment', 
    icon: Package, color: 'bg-green-100 text-green-800', iconColor: 'text-green-600'
  },
  tool: { 
    label: 'Attrezzo', labelEn: 'Tool', 
    icon: Wrench, color: 'bg-orange-100 text-orange-800', iconColor: 'text-orange-600'
  }
}

const STATUSES = {
  available: { label: 'Da Assegnare', labelEn: 'To Assign', color: 'bg-amber-100 text-amber-700', icon: '🟡' },
  assigned: { label: 'Assegnato', labelEn: 'Assigned', color: 'bg-green-100 text-green-700', icon: '🟢' },
  maintenance: { label: 'Manutenzione', labelEn: 'Maintenance', color: 'bg-blue-100 text-blue-700', icon: '🔵' },
  unavailable: { label: 'Non Disponibile', labelEn: 'Unavailable', color: 'bg-red-100 text-red-700', icon: '🔴' }
}

const RATE_TYPES = {
  lump_sum: { label: 'Forfettario', labelEn: 'Lump Sum' },
  hourly: { label: 'Orario', labelEn: 'Hourly' },
  daily: { label: 'Giornaliero', labelEn: 'Daily' },
  weekly: { label: 'Settimanale', labelEn: 'Weekly' },
  monthly: { label: 'Mensile', labelEn: 'Monthly' }
}

const DOCUMENT_TYPES = {
  certificate: { label: 'Certificato', labelEn: 'Certificate', icon: FileCheck },
  manual: { label: 'Manuale', labelEn: 'Manual', icon: FileText },
  insurance: { label: 'Assicurazione', labelEn: 'Insurance', icon: FileText },
  maintenance: { label: 'Report Manutenzione', labelEn: 'Maintenance Report', icon: Wrench },
  photo: { label: 'Foto', labelEn: 'Photo', icon: Image },
  invoice: { label: 'Fattura', labelEn: 'Invoice', icon: FileText },
  other: { label: 'Altro', labelEn: 'Other', icon: Paperclip }
}

const MAINTENANCE_TYPES = {
  scheduled: { label: 'Programmata', labelEn: 'Scheduled' },
  inspection: { label: 'Ispezione', labelEn: 'Inspection' },
  repair: { label: 'Riparazione', labelEn: 'Repair' },
  certification: { label: 'Certificazione', labelEn: 'Certification' }
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

function StatusBadge({ status }) {
  const config = STATUSES[status] || { label: status, color: 'bg-gray-100 text-gray-800', icon: '⚪' }
  return (
    <span className={`${config.color} px-2 py-1 text-xs rounded-full font-medium inline-flex items-center gap-1`}>
      <span>{config.icon}</span>
      {config.label}
    </span>
  )
}

function OwnershipBadge({ isOwned }) {
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
      isOwned ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
    }`}>
      {isOwned ? 'Proprietà' : 'Noleggio'}
    </span>
  )
}

// Stat Card for Dashboard
function StatCard({ icon: Icon, value, label, color, bgColor, onClick, clickable }) {
  return (
    <div 
      onClick={onClick}
      className={`${bgColor} rounded-xl p-4 border ${clickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={20} />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-800">{value}</div>
          <div className="text-sm text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Equipment() {
  const { t, i18n } = useTranslation()
  const { activeProject } = useProject()
  const isItalian = i18n.language === 'it'
  
  // Data state
  const [assets, setAssets] = useState([])
  const [assetTypes, setAssetTypes] = useState([])
  const [companies, setCompanies] = useState([])
  const [squads, setSquads] = useState([])
  const [maintenancesDue, setMaintenancesDue] = useState([])
  const [loading, setLoading] = useState(true)
  
  // UI State
  const [activeTab, setActiveTab] = useState('list')
  const [showModal, setShowModal] = useState(false)
  const [editingAsset, setEditingAsset] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showNewTypeModal, setShowNewTypeModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(null)
  const [showDocumentModal, setShowDocumentModal] = useState(null)
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(null)
  const [showAssignModal, setShowAssignModal] = useState(null)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterOwnership, setFilterOwnership] = useState('')
  
  // Form state
  const initialFormData = {
    description: '',
    assetTypeId: '',
    category: 'vehicle',
    plateNumber: '',
    serialNumber: '',
    brand: '',
    model: '',
    capacity: '',
    yearOfManufacture: '',
    ownerCompanyId: '',
    purchasePrice: '',
    depreciationYears: '',
    rentalRateType: 'daily',
    rentalRateAmount: '',
    rentalStartDate: '',
    rentalEndDate: '',
    notes: ''
  }
  const [formData, setFormData] = useState(initialFormData)
  
  // New type form
  const [newTypeForm, setNewTypeForm] = useState({
    labelIt: '',
    labelEn: '',
    category: 'vehicle',
    icon: '🔧'
  })
  
  // Document form
  const [documentForm, setDocumentForm] = useState({
    documentName: '',
    documentType: 'certificate',
    file: null,
    expiryDate: '',
    notes: ''
  })
  
  // Maintenance form
  const [maintenanceForm, setMaintenanceForm] = useState({
    scheduledDate: '',
    description: '',
    maintenanceType: 'scheduled'
  })
  const [maintenances, setMaintenances] = useState([])
  
  // File input ref
  const fileInputRef = useRef(null)

  // ============================================================================
  // DATA LOADING
  // ============================================================================
  
  useEffect(() => {
    if (activeProject) loadData()
  }, [activeProject])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load asset types (system + project-specific)
      const { data: typesData } = await supabase
        .from('asset_types')
        .select('*')
        .or(`project_id.is.null,project_id.eq.${activeProject.id}`)
        .eq('is_active', true)
        .order('sort_order')
      setAssetTypes(typesData || [])
      
      // Load companies
      const { data: companiesData } = await supabase
        .from('companies')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
        .order('is_main', { ascending: false })
      setCompanies(companiesData || [])
      
      // Load squads
      const { data: squadsData } = await supabase
        .from('squads')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
        .order('squad_number')
      setSquads(squadsData || [])
      
      // Load assets with full view
      const { data: assetsData } = await supabase
        .from('v_assets_full')
        .select('*')
        .eq('project_id', activeProject.id)
      setAssets(assetsData || [])
      
      // Load maintenances due in next 7 days
      const { data: maintData } = await supabase
        .from('v_assets_maintenance_due')
        .select('*')
        .eq('project_id', activeProject.id)
        .in('maintenance_urgency', ['overdue', 'today', 'due_soon'])
      setMaintenancesDue(maintData || [])
      
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  
  const stats = useMemo(() => {
    const total = assets.filter(a => a.status !== 'inactive').length
    const daAssegnare = assets.filter(a => a.status === 'available').length
    const assegnati = assets.filter(a => a.status === 'assigned').length
    const inManutenzione = assets.filter(a => a.status === 'maintenance').length
    const nonDisponibili = assets.filter(a => a.status === 'unavailable').length
    const prossimiManutenzione = maintenancesDue.length
    
    return { total, daAssegnare, assegnati, inManutenzione, nonDisponibili, prossimiManutenzione }
  }, [assets, maintenancesDue])

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      if (a.status === 'inactive') return false
      
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm || 
        a.asset_code?.toLowerCase().includes(searchLower) ||
        a.description?.toLowerCase().includes(searchLower) ||
        a.type_label_it?.toLowerCase().includes(searchLower) ||
        a.plate_number?.toLowerCase().includes(searchLower) ||
        a.serial_number?.toLowerCase().includes(searchLower) ||
        a.brand?.toLowerCase().includes(searchLower) ||
        a.model?.toLowerCase().includes(searchLower)
      
      const matchesCategory = !filterCategory || a.category === filterCategory
      const matchesStatus = !filterStatus || a.status === filterStatus
      const matchesOwnership = !filterOwnership || 
        (filterOwnership === 'owned' && a.is_owned) ||
        (filterOwnership === 'rented' && !a.is_owned)
      
      return matchesSearch && matchesCategory && matchesStatus && matchesOwnership
    })
  }, [assets, searchTerm, filterCategory, filterStatus, filterOwnership])

  const typesForCategory = useMemo(() => {
    return assetTypes.filter(t => t.category === formData.category)
  }, [assetTypes, formData.category])

  const mainCompany = companies.find(c => c.is_main)

  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const resetForm = () => {
    setFormData({
      ...initialFormData,
      ownerCompanyId: mainCompany?.id || ''
    })
    setMaintenances([])
  }
  
  const openAddModal = () => {
    resetForm()
    setEditingAsset(null)
    setShowModal(true)
  }
  
  const openEditModal = async (asset) => {
    setFormData({
      description: asset.description || '',
      assetTypeId: asset.asset_type_id || '',
      category: asset.category || 'vehicle',
      plateNumber: asset.plate_number || '',
      serialNumber: asset.serial_number || '',
      brand: asset.brand || '',
      model: asset.model || '',
      capacity: asset.capacity || '',
      yearOfManufacture: asset.year_of_manufacture || '',
      ownerCompanyId: asset.owner_company_id || '',
      purchasePrice: asset.purchase_price || '',
      depreciationYears: asset.depreciation_years || '',
      rentalRateType: asset.rental_rate_type || 'daily',
      rentalRateAmount: asset.rental_rate_amount || '',
      rentalStartDate: asset.rental_start_date || '',
      rentalEndDate: asset.rental_end_date || '',
      notes: asset.notes || ''
    })
    
    // Load maintenances
    const { data: maintData } = await supabase
      .from('asset_maintenances')
      .select('*')
      .eq('asset_id', asset.id)
      .eq('status', 'pending')
      .order('scheduled_date')
    setMaintenances(maintData || [])
    
    setEditingAsset(asset)
    setShowModal(true)
  }
  
  const handleSave = async () => {
    if (!formData.assetTypeId) {
      alert('Seleziona un tipo')
      return
    }
    if (!formData.ownerCompanyId) {
      alert('Seleziona un\'azienda')
      return
    }
    
    try {
      const selectedType = assetTypes.find(t => t.id === formData.assetTypeId)
      const selectedCompany = companies.find(c => c.id === formData.ownerCompanyId)
      const isOwned = selectedCompany?.is_main || false
      
      const dataToSave = {
        project_id: activeProject.id,
        description: formData.description.trim() || null,
        asset_type_id: formData.assetTypeId,
        category: selectedType?.category || formData.category,
        plate_number: formData.plateNumber.trim() || null,
        serial_number: formData.serialNumber.trim() || null,
        brand: formData.brand.trim() || null,
        model: formData.model.trim() || null,
        capacity: formData.capacity.trim() || null,
        year_of_manufacture: formData.yearOfManufacture ? parseInt(formData.yearOfManufacture) : null,
        owner_company_id: formData.ownerCompanyId,
        is_owned: isOwned,
        purchase_price: isOwned && formData.purchasePrice ? parseFloat(formData.purchasePrice) : null,
        depreciation_years: isOwned && formData.depreciationYears ? parseInt(formData.depreciationYears) : null,
        rental_rate_type: !isOwned ? formData.rentalRateType : null,
        rental_rate_amount: !isOwned && formData.rentalRateAmount ? parseFloat(formData.rentalRateAmount) : null,
        rental_start_date: !isOwned ? formData.rentalStartDate || null : null,
        rental_end_date: !isOwned ? formData.rentalEndDate || null : null,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString()
      }
      
      let assetId
      
      if (editingAsset) {
        const { error } = await supabase
          .from('assets')
          .update(dataToSave)
          .eq('id', editingAsset.id)
        if (error) throw error
        assetId = editingAsset.id
      } else {
        const { data, error } = await supabase
          .from('assets')
          .insert([dataToSave])
          .select()
          .single()
        if (error) throw error
        assetId = data.id
      }
      
      // Save maintenances
      if (maintenances.length > 0) {
        // Delete existing pending maintenances if editing
        if (editingAsset) {
          await supabase
            .from('asset_maintenances')
            .delete()
            .eq('asset_id', editingAsset.id)
            .eq('status', 'pending')
        }
        
        // Insert new maintenances
        const maintData = maintenances.map(m => ({
          asset_id: assetId,
          scheduled_date: m.scheduledDate || m.scheduled_date,
          description: m.description,
          maintenance_type: m.maintenanceType || m.maintenance_type || 'scheduled',
          status: 'pending'
        }))
        
        const { error: maintError } = await supabase
          .from('asset_maintenances')
          .insert(maintData)
        if (maintError) throw maintError
      }
      
      setShowModal(false)
      resetForm()
      loadData()
    } catch (err) {
      console.error('Error saving:', err)
      alert('Errore: ' + err.message)
    }
  }
  
  const handleDelete = async (asset) => {
    try {
      const { error } = await supabase
        .from('assets')
        .update({ status: 'inactive', deleted_at: new Date().toISOString() })
        .eq('id', asset.id)
      if (error) throw error
      setShowDeleteConfirm(null)
      loadData()
    } catch (err) {
      console.error('Error deleting:', err)
      alert('Errore: ' + err.message)
    }
  }
  
  // Add maintenance to form
  const addMaintenance = () => {
    if (!maintenanceForm.scheduledDate || !maintenanceForm.description) {
      alert('Inserisci data e descrizione')
      return
    }
    setMaintenances([...maintenances, { ...maintenanceForm, id: `temp-${Date.now()}` }])
    setMaintenanceForm({ scheduledDate: '', description: '', maintenanceType: 'scheduled' })
  }
  
  const removeMaintenance = (id) => {
    setMaintenances(maintenances.filter(m => m.id !== id))
  }
  
  // New Type
  const handleSaveNewType = async () => {
    if (!newTypeForm.labelIt.trim()) {
      alert('Inserisci il nome italiano')
      return
    }
    
    const typeCode = newTypeForm.labelIt.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    
    try {
      const { data, error } = await supabase
        .from('asset_types')
        .insert([{
          project_id: activeProject.id,
          type_code: typeCode,
          label_it: newTypeForm.labelIt.trim(),
          label_en: newTypeForm.labelEn.trim() || null,
          category: newTypeForm.category,
          icon: newTypeForm.icon
        }])
        .select()
        .single()
      
      if (error) throw error
      
      setShowNewTypeModal(false)
      setNewTypeForm({ labelIt: '', labelEn: '', category: 'vehicle', icon: '🔧' })
      loadData()
      
      // Select the new type
      setTimeout(() => {
        setFormData(prev => ({ ...prev, assetTypeId: data.id }))
      }, 300)
    } catch (err) {
      console.error('Error saving type:', err)
      alert('Errore: ' + err.message)
    }
  }
  
  // Assign to squad
  const handleAssign = async (squadId) => {
    if (!showAssignModal) return
    
    try {
      // Release any existing assignment
      await supabase
        .from('asset_assignments')
        .update({ status: 'released', released_at: new Date().toISOString() })
        .eq('asset_id', showAssignModal.id)
        .eq('status', 'active')
      
      if (squadId) {
        // Create new assignment
        const { error } = await supabase
          .from('asset_assignments')
          .insert([{
            asset_id: showAssignModal.id,
            squad_id: squadId,
            status: 'active'
          }])
        if (error) throw error
      } else {
        // Just release (set to available)
        await supabase
          .from('assets')
          .update({ status: 'available', assigned_squad_id: null })
          .eq('id', showAssignModal.id)
      }
      
      setShowAssignModal(null)
      loadData()
    } catch (err) {
      console.error('Error assigning:', err)
      alert('Errore: ' + err.message)
    }
  }
  
  // Export to Excel
  const handleExport = () => {
    const exportData = filteredAssets.map(a => ({
      'Codice': a.asset_code,
      'Descrizione': a.description || '',
      'Tipo': a.type_label_it || '',
      'Categoria': CATEGORIES[a.category]?.label || a.category,
      'Stato': STATUSES[a.status]?.label || a.status,
      'Proprietà': a.is_owned ? 'Proprietà' : 'Noleggio',
      'Azienda': a.owner_company_name || '',
      'Targa': a.plate_number || '',
      'N. Serie': a.serial_number || '',
      'Marca': a.brand || '',
      'Modello': a.model || '',
      'Capacità': a.capacity || '',
      'Anno': a.year_of_manufacture || '',
      'Squadra Assegnata': a.assigned_squad_name || '',
      'Prossima Manutenzione': a.next_maintenance_date || '',
      'Documenti': a.documents_count || 0,
      'Note': a.notes || ''
    }))
    
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mezzi')
    XLSX.writeFile(wb, `Mezzi_${activeProject.code || 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

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
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Truck className="text-primary" />
              {t('equipment.title', 'Mezzi di Cantiere')}
            </h1>
            <p className="text-gray-500 mt-1">
              {activeProject.name} • Gestione mezzi e attrezzature
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
            >
              <Download size={18} />
              Esporta Excel
            </button>
            <button 
              onClick={openAddModal}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-2 text-sm font-medium"
            >
              <Plus size={18} />
              Nuovo Mezzo
            </button>
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
          <StatCard 
            icon={Truck} 
            value={stats.total} 
            label="Totale"
            color="bg-gray-600 text-white"
            bgColor="bg-gray-50 border-gray-200"
          />
          <StatCard 
            icon={Clock} 
            value={stats.daAssegnare} 
            label="Da Assegnare"
            color="bg-amber-500 text-white"
            bgColor="bg-amber-50 border-amber-200"
            clickable
            onClick={() => setFilterStatus('available')}
          />
          <StatCard 
            icon={Users} 
            value={stats.assegnati} 
            label="Assegnati"
            color="bg-green-500 text-white"
            bgColor="bg-green-50 border-green-200"
            clickable
            onClick={() => setFilterStatus('assigned')}
          />
          <StatCard 
            icon={Bell} 
            value={stats.prossimiManutenzione} 
            label={isItalian ? 'Pross. Manut.' : 'Maint. Due'}
            color="bg-blue-500 text-white"
            bgColor="bg-blue-50 border-blue-200"
            clickable
            onClick={() => setActiveTab('maintenance')}
          />
          <StatCard 
            icon={AlertTriangle} 
            value={stats.nonDisponibili} 
            label="Non Disponibili"
            color="bg-red-500 text-white"
            bgColor="bg-red-50 border-red-200"
            clickable
            onClick={() => setFilterStatus('unavailable')}
          />
          <StatCard 
            icon={Wrench} 
            value={stats.inManutenzione} 
            label="In Manutenzione"
            color="bg-purple-500 text-white"
            bgColor="bg-purple-50 border-purple-200"
            clickable
            onClick={() => setFilterStatus('maintenance')}
          />
        </div>
      </div>

      {/* ============ TABS ============ */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => { setActiveTab('list'); setFilterStatus(''); }}
            className={`px-6 py-4 text-sm font-medium ${
              activeTab === 'list' ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📋 Lista Mezzi
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`px-6 py-4 text-sm font-medium ${
              activeTab === 'maintenance' ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🔧 Manutenzioni Programmate
            {stats.prossimiManutenzione > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">
                {stats.prossimiManutenzione}
              </span>
            )}
          </button>
        </div>

        {/* ============ LIST TAB ============ */}
        {activeTab === 'list' && (
          <>
            {/* Filters */}
            <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cerca..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                />
              </div>
              <select 
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="">Tutte le categorie</option>
                {Object.entries(CATEGORIES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="">Tutti gli stati</option>
                {Object.entries(STATUSES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <select 
                value={filterOwnership} 
                onChange={(e) => setFilterOwnership(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="">Proprietà/Noleggio</option>
                <option value="owned">Proprietà</option>
                <option value="rented">Noleggio</option>
              </select>
              {(filterCategory || filterStatus || filterOwnership || searchTerm) && (
                <button
                  onClick={() => { setFilterCategory(''); setFilterStatus(''); setFilterOwnership(''); setSearchTerm(''); }}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-200 rounded-lg flex items-center gap-1"
                >
                  <X size={16} /> Reset
                </button>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-3 font-medium">Codice</th>
                    <th className="text-left p-3 font-medium">Tipo / Descrizione</th>
                    <th className="text-center p-3 font-medium">Categoria</th>
                    <th className="text-center p-3 font-medium">Stato</th>
                    <th className="text-center p-3 font-medium">Proprietà</th>
                    <th className="text-left p-3 font-medium">Azienda</th>
                    <th className="text-left p-3 font-medium">Squadra</th>
                    <th className="text-center p-3 font-medium">Doc</th>
                    <th className="text-center p-3 font-medium">Manut.</th>
                    <th className="text-center p-3 font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-gray-400">
                        Nessun mezzo trovato
                      </td>
                    </tr>
                  ) : filteredAssets.map(asset => (
                    <tr key={asset.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">
                        <span className="font-mono font-bold text-primary">{asset.asset_code}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{asset.type_icon}</span>
                          <div>
                            <div className="font-medium">{asset.type_label_it || 'N/D'}</div>
                            {asset.description && (
                              <div className="text-xs text-gray-500">{asset.description}</div>
                            )}
                            {(asset.brand || asset.model) && (
                              <div className="text-xs text-gray-400">{asset.brand} {asset.model}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <CategoryBadge category={asset.category} size="small" />
                      </td>
                      <td className="p-3 text-center">
                        <StatusBadge status={asset.status} />
                      </td>
                      <td className="p-3 text-center">
                        <OwnershipBadge isOwned={asset.is_owned} />
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {asset.owner_company_name || '—'}
                      </td>
                      <td className="p-3">
                        {asset.assigned_squad_name ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            {asset.assigned_squad_name}
                          </span>
                        ) : (
                          <button
                            onClick={() => setShowAssignModal(asset)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Assegna
                          </button>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          asset.documents_count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          📎 {asset.documents_count || 0}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {asset.next_maintenance_date ? (
                          <span className={`px-2 py-1 rounded text-xs ${
                            new Date(asset.next_maintenance_date) <= new Date() 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            🔧 {new Date(asset.next_maintenance_date).toLocaleDateString('it-IT')}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setShowDetailModal(asset)}
                            className="p-1.5 hover:bg-gray-200 rounded text-gray-600"
                            title="Dettagli"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openEditModal(asset)}
                            className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                            title="Modifica"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(asset)}
                            className="p-1.5 hover:bg-red-100 rounded text-red-600"
                            title="Elimina"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ============ MAINTENANCE TAB ============ */}
        {activeTab === 'maintenance' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bell className="text-amber-500" />
              Manutenzioni in Scadenza (prossimi 30 giorni)
            </h3>
            
            {maintenancesDue.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Wrench size={48} className="mx-auto mb-4 text-gray-300" />
                <p>Nessuna manutenzione programmata</p>
              </div>
            ) : (
              <div className="space-y-3">
                {maintenancesDue.map(m => (
                  <div 
                    key={m.maintenance_id} 
                    className={`p-4 rounded-lg border-2 ${
                      m.maintenance_urgency === 'overdue' ? 'bg-red-50 border-red-300' :
                      m.maintenance_urgency === 'today' ? 'bg-orange-50 border-orange-300' :
                      'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{m.type_icon}</span>
                        <div>
                          <div className="font-bold text-gray-800">
                            {m.asset_code} - {m.type_label_it}
                          </div>
                          {m.description && (
                            <div className="text-sm text-gray-600">{m.description}</div>
                          )}
                          <div className="text-sm text-gray-500 mt-1">
                            {m.maintenance_description}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          m.maintenance_urgency === 'overdue' ? 'text-red-600' :
                          m.maintenance_urgency === 'today' ? 'text-orange-600' :
                          'text-amber-600'
                        }`}>
                          {m.maintenance_urgency === 'overdue' ? 
                            `⚠️ Scaduta da ${Math.abs(m.days_until)} giorni` :
                          m.maintenance_urgency === 'today' ?
                            '📅 OGGI' :
                            `🔔 Tra ${m.days_until} giorni`
                          }
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(m.scheduled_date).toLocaleDateString('it-IT', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long'
                          })}
                        </div>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                          MAINTENANCE_TYPES[m.maintenance_type]?.label ? 'bg-gray-200' : ''
                        }`}>
                          {MAINTENANCE_TYPES[m.maintenance_type]?.label || m.maintenance_type}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============ ADD/EDIT MODAL ============ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {editingAsset ? `Modifica ${editingAsset.asset_code}` : 'Nuovo Mezzo'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Categoria e Tipo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value, assetTypeId: '' })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  >
                    {Object.entries(CATEGORIES).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.assetTypeId}
                      onChange={(e) => setFormData({ ...formData, assetTypeId: e.target.value })}
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                    >
                      <option value="">-- Seleziona --</option>
                      {typesForCategory.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.icon} {t.label_it}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowNewTypeModal(true)}
                      className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                      title="Nuovo tipo"
                    >
                      <PlusCircle size={20} />
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                  placeholder="es. Autogrù 50 tonnellate"
                />
              </div>
              
              {/* Dati tecnici */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Targa</label>
                  <input
                    type="text"
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="AB123CD"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">N. Seriale</label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modello</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacità</label>
                  <input
                    type="text"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="es. 50t, 20m, 200A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anno</label>
                  <input
                    type="number"
                    value={formData.yearOfManufacture}
                    onChange={(e) => setFormData({ ...formData, yearOfManufacture: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="2020"
                  />
                </div>
              </div>
              
              {/* Proprietà / Noleggio */}
              <div className="bg-gray-50 rounded-lg p-4 border">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Azienda <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">
                    (Azienda principale = Proprietà, altre = Noleggio)
                  </span>
                </label>
                <select
                  value={formData.ownerCompanyId}
                  onChange={(e) => setFormData({ ...formData, ownerCompanyId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Seleziona --</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.is_main ? '⭐ ' : ''}{c.company_name} {c.is_main ? '(Proprietà)' : '(Noleggio)'}
                    </option>
                  ))}
                </select>
                
                {/* Se Proprietà: Ammortamento */}
                {companies.find(c => c.id === formData.ownerCompanyId)?.is_main && (
                  <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <h4 className="text-sm font-medium text-emerald-800 mb-2">💰 Dati Ammortamento</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Prezzo Acquisto (€)</label>
                        <input
                          type="number"
                          value={formData.purchasePrice}
                          onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="50000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Anni Ammortamento</label>
                        <input
                          type="number"
                          value={formData.depreciationYears}
                          onChange={(e) => setFormData({ ...formData, depreciationYears: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="5"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Se Noleggio: Tariffa */}
                {formData.ownerCompanyId && !companies.find(c => c.id === formData.ownerCompanyId)?.is_main && (
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <h4 className="text-sm font-medium text-amber-800 mb-2">📅 Dati Noleggio</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Tipo Tariffa</label>
                        <select
                          value={formData.rentalRateType}
                          onChange={(e) => setFormData({ ...formData, rentalRateType: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        >
                          {Object.entries(RATE_TYPES).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Importo (€)</label>
                        <input
                          type="number"
                          value={formData.rentalRateAmount}
                          onChange={(e) => setFormData({ ...formData, rentalRateAmount: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="250"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Data Inizio</label>
                        <input
                          type="date"
                          value={formData.rentalStartDate}
                          onChange={(e) => setFormData({ ...formData, rentalStartDate: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Data Fine</label>
                        <input
                          type="date"
                          value={formData.rentalEndDate}
                          onChange={(e) => setFormData({ ...formData, rentalEndDate: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Manutenzioni Programmate */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                  <Wrench size={16} />
                  Manutenzioni Programmate
                </h4>
                
                {/* Lista manutenzioni esistenti */}
                {maintenances.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {maintenances.map((m, idx) => (
                      <div key={m.id || idx} className="flex items-center justify-between p-2 bg-white rounded border">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-blue-600">
                            {new Date(m.scheduledDate || m.scheduled_date).toLocaleDateString('it-IT')}
                          </span>
                          <span className="text-sm text-gray-600">{m.description}</span>
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {MAINTENANCE_TYPES[m.maintenanceType || m.maintenance_type]?.label}
                          </span>
                        </div>
                        <button
                          onClick={() => removeMaintenance(m.id)}
                          className="p-1 hover:bg-red-100 rounded text-red-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Form nuova manutenzione */}
                <div className="grid grid-cols-4 gap-2">
                  <input
                    type="date"
                    value={maintenanceForm.scheduledDate}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, scheduledDate: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={maintenanceForm.description}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                    className="col-span-2 px-3 py-2 border rounded-lg text-sm"
                    placeholder="Descrizione manutenzione"
                  />
                  <button
                    onClick={addMaintenance}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    + Aggiungi
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  ℹ️ Le notifiche verranno inviate 1 settimana prima a CM, Site Manager, Logistics Coordinator e ai responsabili della squadra assegnata.
                </p>
              </div>
              
              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                Annulla
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-2">
                <Check size={18} />
                {editingAsset ? 'Salva Modifiche' : 'Crea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ DELETE CONFIRM MODAL ============ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Elimina Mezzo</h3>
                <p className="text-sm text-gray-500">{showDeleteConfirm.asset_code}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Sei sicuro di voler eliminare questo mezzo? L'operazione può essere annullata solo da un amministratore.
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

      {/* ============ NEW TYPE MODAL ============ */}
      {showNewTypeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <PlusCircle className="text-green-600" size={20} />
                Nuovo Tipo
              </h2>
              <button onClick={() => setShowNewTypeModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={newTypeForm.category}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {Object.entries(CATEGORIES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Italiano *</label>
                <input
                  type="text"
                  value={newTypeForm.labelIt}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, labelIt: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="es. Essiccatore"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Inglese</label>
                <input
                  type="text"
                  value={newTypeForm.labelEn}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, labelEn: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="es. Dryer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icona</label>
                <input
                  type="text"
                  value={newTypeForm.icon}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, icon: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="🔧"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button onClick={() => setShowNewTypeModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                Annulla
              </button>
              <button onClick={handleSaveNewType} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                <Check size={18} />
                Crea Tipo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ DETAIL MODAL ============ */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{showDetailModal.type_icon}</span>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{showDetailModal.asset_code}</h2>
                  <p className="text-sm text-gray-500">{showDetailModal.type_label_it}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(null)} className="p-2 hover:bg-gray-200 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Info principali */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Descrizione</p>
                  <p className="font-medium">{showDetailModal.description || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Stato</p>
                  <StatusBadge status={showDetailModal.status} />
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Categoria</p>
                  <CategoryBadge category={showDetailModal.category} />
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Proprietà</p>
                  <OwnershipBadge isOwned={showDetailModal.is_owned} />
                </div>
              </div>
              
              {/* Dati tecnici */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="text-sm font-medium text-blue-800 mb-3">📋 Dati Tecnici</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-gray-500">Targa:</span> {showDetailModal.plate_number || '—'}</div>
                  <div><span className="text-gray-500">Seriale:</span> {showDetailModal.serial_number || '—'}</div>
                  <div><span className="text-gray-500">Marca:</span> {showDetailModal.brand || '—'}</div>
                  <div><span className="text-gray-500">Modello:</span> {showDetailModal.model || '—'}</div>
                  <div><span className="text-gray-500">Capacità:</span> {showDetailModal.capacity || '—'}</div>
                  <div><span className="text-gray-500">Anno:</span> {showDetailModal.year_of_manufacture || '—'}</div>
                </div>
              </div>
              
              {/* Azienda e costi */}
              <div className={`rounded-lg p-4 border ${showDetailModal.is_owned ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <h4 className={`text-sm font-medium mb-3 ${showDetailModal.is_owned ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {showDetailModal.is_owned ? '💰 Proprietà' : '📅 Noleggio'}
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Azienda:</span> {showDetailModal.owner_company_name || '—'}</div>
                  {showDetailModal.is_owned ? (
                    <>
                      <div><span className="text-gray-500">Prezzo:</span> {showDetailModal.purchase_price ? `€ ${showDetailModal.purchase_price.toLocaleString()}` : '—'}</div>
                      <div><span className="text-gray-500">Ammortamento:</span> {showDetailModal.depreciation_years ? `${showDetailModal.depreciation_years} anni` : '—'}</div>
                    </>
                  ) : (
                    <>
                      <div><span className="text-gray-500">Tariffa:</span> {showDetailModal.rental_rate_amount ? `€ ${showDetailModal.rental_rate_amount}/${RATE_TYPES[showDetailModal.rental_rate_type]?.label || ''}` : '—'}</div>
                      <div><span className="text-gray-500">Periodo:</span> {showDetailModal.rental_start_date || '—'} - {showDetailModal.rental_end_date || '—'}</div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Squadra assegnata */}
              {showDetailModal.assigned_squad_name && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h4 className="text-sm font-medium text-green-800 mb-2">👥 Squadra Assegnata</h4>
                  <p className="font-medium">{showDetailModal.assigned_squad_name}</p>
                </div>
              )}
              
              {/* Prossima manutenzione */}
              {showDetailModal.next_maintenance_date && (
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <h4 className="text-sm font-medium text-amber-800 mb-2">🔧 Prossima Manutenzione</h4>
                  <p className="font-medium">{new Date(showDetailModal.next_maintenance_date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              )}
              
              {/* Note */}
              {showDetailModal.notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">📝 Note</h4>
                  <p className="text-sm text-gray-600">{showDetailModal.notes}</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button onClick={() => setShowDetailModal(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
                Chiudi
              </button>
              <button 
                onClick={() => { setShowDetailModal(null); openEditModal(showDetailModal); }} 
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-2"
              >
                <Edit size={18} />
                Modifica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ ASSIGN MODAL ============ */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                Assegna {showAssignModal.asset_code}
              </h2>
              <button onClick={() => setShowAssignModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {showAssignModal.assigned_squad_id && (
                <button
                  onClick={() => handleAssign(null)}
                  className="w-full p-3 text-left rounded-lg border-2 border-amber-300 bg-amber-50 hover:bg-amber-100"
                >
                  <span className="font-medium text-amber-700">🔓 Rilascia (rendi disponibile)</span>
                </button>
              )}
              {squads.map(squad => (
                <button
                  key={squad.id}
                  onClick={() => handleAssign(squad.id)}
                  className={`w-full p-3 text-left rounded-lg border-2 hover:bg-gray-50 ${
                    squad.id === showAssignModal.assigned_squad_id 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200'
                  }`}
                >
                  <span className="font-medium">{squad.name}</span>
                  {squad.id === showAssignModal.assigned_squad_id && (
                    <span className="ml-2 text-green-600 text-sm">✓ Attuale</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-end p-4 border-t bg-gray-50">
              <button onClick={() => setShowAssignModal(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
