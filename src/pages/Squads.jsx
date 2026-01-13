import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import { 
  Users, Plus, Search, Filter, X, Check, Edit, Trash2,
  ChevronDown, ChevronRight, UserPlus, UserMinus, Star,
  Building2, Hash, User, AlertTriangle, CheckCircle2
} from 'lucide-react'

// ============================================================================
// CONFIGURAZIONE RUOLI
// ============================================================================

// Ruoli diretti (campo) - possono essere assegnati a squadre
const DIRECT_ROLES = ['superintendent', 'supervisor', 'foreman', 'sub_foreman', 'operator', 'helper', 'storekeeper']

// Ruoli indiretti (staff) - non assegnabili a squadre
const INDIRECT_ROLES = ['pm', 'site_manager', 'cm', 'pem', 'engineer', 'planner']

// Ruoli che possono guidare squadre
const FOREMAN_ROLES = ['foreman', 'sub_foreman']
const SUPERVISOR_ROLES = ['supervisor', 'superintendent']

// Configurazione colori ruoli
const ROLE_CONFIG = {
  pm: { label: 'Project Manager', color: 'bg-blue-100 text-blue-800' },
  site_manager: { label: 'Site Manager', color: 'bg-indigo-100 text-indigo-800' },
  cm: { label: 'Construction Manager', color: 'bg-cyan-100 text-cyan-800' },
  pem: { label: 'Project Eng. Manager', color: 'bg-teal-100 text-teal-800' },
  engineer: { label: 'Engineer', color: 'bg-emerald-100 text-emerald-800' },
  planner: { label: 'Planner', color: 'bg-orange-100 text-orange-800' },
  superintendent: { label: 'Superintendent', color: 'bg-purple-100 text-purple-800' },
  supervisor: { label: 'Supervisor', color: 'bg-green-100 text-green-800' },
  sub_supervisor: { label: 'Sub Supervisor', color: 'bg-lime-100 text-lime-800' },
  foreman: { label: 'Foreman', color: 'bg-yellow-100 text-yellow-800' },
  sub_foreman: { label: 'Sub Foreman', color: 'bg-amber-100 text-amber-800' },
  operator: { label: 'Operatore', color: 'bg-gray-100 text-gray-800' },
  helper: { label: 'Aiutante', color: 'bg-slate-100 text-slate-700' },
  storekeeper: { label: 'Magazziniere', color: 'bg-stone-100 text-stone-800' },
}

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
// COMPONENTE MODAL LISTA PERSONALE (per Assegnati e Da Assegnare)
// ============================================================================
function PersonnelListModal({ personnel, title, isOpen, onClose, type }) {
  if (!isOpen) return null
  
  const bgColor = type === 'assigned' ? 'bg-green-600' : 'bg-amber-500'
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className={`${bgColor} px-4 py-3 rounded-t-xl flex items-center justify-between`}>
          <span className="font-semibold text-white text-lg">
            {title} ({personnel.length})
          </span>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {personnel.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Nessun personale</p>
          ) : (
            <div className="space-y-2">
              {personnel.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg">
                  <span className="font-mono text-sm text-gray-600 w-10 text-center">{p.id_number || '—'}</span>
                  <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">{p.badge_number || '—'}</span>
                  <div className="flex-1">
                    <span className="font-medium text-gray-800">{p.last_name} {p.first_name}</span>
                  </div>
                  <RoleBadge role={p.position} size="small" />
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    {p.company?.is_main && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
                    <span className="max-w-32 truncate">{p.company?.company_name}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t px-4 py-3 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full btn-secondary"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// COMPONENTE SEARCHABLE SELECT (Combo ricerca + dropdown)
// ============================================================================
function SearchableSelect({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  label,
  required,
  companyFilter,
  onCompanyFilterChange,
  companies,
  showCompanyFilter
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const wrapperRef = useRef(null)
  
  // Chiudi dropdown quando clicco fuori
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Filtra opzioni
  const filteredOptions = options.filter(opt => {
    const matchesSearch = searchTerm === '' || 
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.badge && opt.badge.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCompany = !companyFilter || opt.company_id === companyFilter
    return matchesSearch && matchesCompany
  })
  
  // Trova opzione selezionata
  const selectedOption = options.find(opt => opt.value === value)
  
  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {/* Filtro azienda */}
      {showCompanyFilter && companies && (
        <div className="mb-2">
          <select
            value={companyFilter || ''}
            onChange={(e) => onCompanyFilterChange(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-gray-50"
          >
            <option value="">Tutte le aziende</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>
                {c.is_main && '★ '}{c.company_name}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Input con ricerca */}
      <div 
        className="relative cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        <input
          type="text"
          value={isOpen ? searchTerm : (selectedOption?.label || '')}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-10"
        />
        <ChevronDown 
          size={18} 
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>
      
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {/* Opzione vuota */}
          <div
            onClick={() => {
              onChange('')
              setIsOpen(false)
              setSearchTerm('')
            }}
            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-gray-500 border-b"
          >
            {placeholder}
          </div>
          
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-center text-gray-500 text-sm">
              Nessun risultato
            </div>
          ) : (
            filteredOptions.map(opt => (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                  setSearchTerm('')
                }}
                className={`px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2 ${
                  value === opt.value ? 'bg-primary/10' : ''
                }`}
              >
                {opt.badge && (
                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{opt.badge}</span>
                )}
                <span className="flex-1">{opt.label}</span>
                <RoleBadge role={opt.role} size="small" />
                {opt.company?.is_main && (
                  <Star size={12} className="text-yellow-500 fill-yellow-500" />
                )}
                {opt.assigned && (
                  <span className="text-xs text-amber-600">(assegnato)</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// COMPONENTE PRINCIPALE
// ============================================================================
export default function Squads() {
  const { t } = useTranslation()
  const { activeProject } = useProject()
  
  // State principale
  const [squads, setSquads] = useState([])
  const [personnel, setPersonnel] = useState([])
  const [companies, setCompanies] = useState([])
  const [squadMembers, setSquadMembers] = useState({}) // { squadId: [members] }
  const [loading, setLoading] = useState(true)
  
  // UI State
  const [expandedSquad, setExpandedSquad] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(null) // squad id
  const [editingSquad, setEditingSquad] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  
  // Popup state (click-based)
  const [popupData, setPopupData] = useState(null) // { type: 'assigned'|'unassigned', role?: string, personnel: [], title: string }
  
  // Form state per nuova squadra
  const [formData, setFormData] = useState({
    name: '',
    supervisorId: '',
    foremanId: '',
    notes: ''
  })
  
  // Filtri per form squadra
  const [supervisorCompanyFilter, setSupervisorCompanyFilter] = useState('')
  const [foremanCompanyFilter, setForemanCompanyFilter] = useState('')
  
  // Filtri per aggiunta membri
  const [memberSearch, setMemberSearch] = useState('')
  const [memberRoleFilter, setMemberRoleFilter] = useState('')
  const [memberCompanyFilter, setMemberCompanyFilter] = useState('')
  const [selectedMembers, setSelectedMembers] = useState([])

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
      setCompanies(companiesData || [])
      
      // Carica tutto il personale
      const { data: personnelData } = await supabase
        .from('personnel')
        .select(`*, company:companies(id, company_name, is_main)`)
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
        .order('last_name')
      setPersonnel(personnelData || [])
      
      // Carica squadre
      const { data: squadsData } = await supabase
        .from('squads')
        .select(`
          *,
          supervisor:personnel!squads_supervisor_id_fkey(id, first_name, last_name, position),
          foreman:personnel!squads_foreman_id_fkey(id, first_name, last_name, position)
        `)
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
        .order('squad_number')
      setSquads(squadsData || [])
      
      // Carica membri per ogni squadra
      const membersMap = {}
      for (const squad of (squadsData || [])) {
        const { data: members } = await supabase
          .from('squad_members')
          .select(`
            *,
            personnel:personnel(id, first_name, last_name, position, badge_number, company_id,
              company:companies(id, company_name, is_main))
          `)
          .eq('squad_id', squad.id)
          .eq('status', 'active')
        membersMap[squad.id] = members || []
      }
      setSquadMembers(membersMap)
      
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // CALCOLI DASHBOARD
  // ============================================================================
  
  // Personale diretto totale
  const directPersonnel = personnel.filter(p => DIRECT_ROLES.includes(p.position))
  
  // Set di ID già assegnati a squadre (membri + foreman)
  const assignedMemberIds = new Set()
  Object.values(squadMembers).forEach(members => {
    members.forEach(m => assignedMemberIds.add(m.personnel_id))
  })
  // Aggiungi anche foreman delle squadre
  squads.forEach(s => {
    if (s.foreman_id) assignedMemberIds.add(s.foreman_id)
  })
  
  // Supervisori/Superintendent assegnati (contati UNA SOLA VOLTA)
  const assignedSupervisorIds = new Set()
  squads.forEach(s => {
    if (s.supervisor_id) assignedSupervisorIds.add(s.supervisor_id)
  })
  
  // Combina tutti gli assegnati (membri + foreman + supervisori unici)
  const assignedIds = new Set([...assignedMemberIds, ...assignedSupervisorIds])
  
  // Personale assegnato vs da assegnare
  const assignedDirect = directPersonnel.filter(p => assignedIds.has(p.id))
  const unassignedDirect = directPersonnel.filter(p => !assignedIds.has(p.id))
  
  // Statistiche per ruolo (Supervisori contati una sola volta)
  const roleStats = DIRECT_ROLES.map(role => {
    const totalInRole = directPersonnel.filter(p => p.position === role)
    const total = totalInRole.length
    
    let assigned
    let assignedList
    if (SUPERVISOR_ROLES.includes(role)) {
      // Per supervisori, conta solo quelli nel set unico
      assignedList = totalInRole.filter(p => assignedSupervisorIds.has(p.id))
      assigned = assignedList.length
    } else {
      // Per altri ruoli, conta normalmente
      assignedList = totalInRole.filter(p => assignedMemberIds.has(p.id))
      assigned = assignedList.length
    }
    
    const percentage = total > 0 ? Math.round((assigned / total) * 100) : 0
    
    return {
      role,
      label: ROLE_CONFIG[role]?.label || role,
      total,
      assigned,
      unassigned: total - assigned,
      percentage,
      assignedList,
      unassignedList: totalInRole.filter(p => 
        SUPERVISOR_ROLES.includes(role) 
          ? !assignedSupervisorIds.has(p.id)
          : !assignedMemberIds.has(p.id)
      )
    }
  }).filter(r => r.total > 0)

  // ============================================================================
  // GESTIONE SQUADRE
  // ============================================================================
  
  const getNextSquadNumber = () => {
    if (squads.length === 0) return 1
    return Math.max(...squads.map(s => s.squad_number)) + 1
  }
  
  const resetForm = () => {
    setFormData({ name: '', supervisorId: '', foremanId: '', notes: '' })
    setSupervisorCompanyFilter('')
    setForemanCompanyFilter('')
  }
  
  const handleCreateSquad = async () => {
    if (!formData.foremanId) {
      alert('Seleziona un Foreman per la squadra')
      return
    }
    
    try {
      const squadNumber = getNextSquadNumber()
      
      const { data: newSquad, error } = await supabase
        .from('squads')
        .insert([{
          project_id: activeProject.id,
          squad_number: squadNumber,
          name: formData.name.trim() || `Squadra ${squadNumber}`,
          supervisor_id: formData.supervisorId || null,
          foreman_id: formData.foremanId,
          notes: formData.notes.trim() || null,
          status: 'active'
        }])
        .select()
        .single()
      
      if (error) throw error
      
      setShowCreateModal(false)
      resetForm()
      loadData()
    } catch (err) {
      console.error('Error creating squad:', err)
      alert('Errore: ' + err.message)
    }
  }
  
  const handleUpdateSquad = async () => {
    if (!editingSquad) return
    
    try {
      const { error } = await supabase
        .from('squads')
        .update({
          name: formData.name.trim() || `Squadra ${editingSquad.squad_number}`,
          supervisor_id: formData.supervisorId || null,
          foreman_id: formData.foremanId || editingSquad.foreman_id,
          notes: formData.notes.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSquad.id)
      
      if (error) throw error
      
      setEditingSquad(null)
      resetForm()
      loadData()
    } catch (err) {
      console.error('Error updating squad:', err)
      alert('Errore: ' + err.message)
    }
  }
  
  const handleDeleteSquad = async (squad) => {
    try {
      // Prima rimuovi i membri
      await supabase
        .from('squad_members')
        .delete()
        .eq('squad_id', squad.id)
      
      // Poi elimina la squadra
      const { error } = await supabase
        .from('squads')
        .delete()
        .eq('id', squad.id)
      
      if (error) throw error
      
      setShowDeleteConfirm(null)
      loadData()
    } catch (err) {
      console.error('Error deleting squad:', err)
      alert('Errore: ' + err.message)
    }
  }
  
  const openEditModal = (squad) => {
    setFormData({
      name: squad.name || '',
      supervisorId: squad.supervisor_id || '',
      foremanId: squad.foreman_id || '',
      notes: squad.notes || ''
    })
    setSupervisorCompanyFilter('')
    setForemanCompanyFilter('')
    setEditingSquad(squad)
  }

  // ============================================================================
  // GESTIONE MEMBRI
  // ============================================================================
  
  // Personale disponibile per aggiunta (diretti non ancora assegnati)
  const availableForAssignment = personnel.filter(p => 
    DIRECT_ROLES.includes(p.position) && 
    !assignedMemberIds.has(p.id) &&
    !SUPERVISOR_ROLES.includes(p.position) // Supervisori gestiti separatamente
  )
  
  // Filtro membri disponibili
  const filteredAvailable = availableForAssignment.filter(p => {
    const searchLower = memberSearch.toLowerCase()
    const matchesSearch = 
      p.first_name?.toLowerCase().includes(searchLower) ||
      p.last_name?.toLowerCase().includes(searchLower) ||
      p.badge_number?.toLowerCase().includes(searchLower)
    const matchesRole = !memberRoleFilter || p.position === memberRoleFilter
    const matchesCompany = !memberCompanyFilter || p.company_id === memberCompanyFilter
    return matchesSearch && matchesRole && matchesCompany
  })
  
  const handleAddMembers = async () => {
    if (!showAddMemberModal || selectedMembers.length === 0) return
    
    try {
      const inserts = selectedMembers.map(personnelId => ({
        squad_id: showAddMemberModal,
        personnel_id: personnelId,
        status: 'active'
      }))
      
      const { error } = await supabase
        .from('squad_members')
        .insert(inserts)
      
      if (error) throw error
      
      setShowAddMemberModal(null)
      setSelectedMembers([])
      setMemberSearch('')
      setMemberRoleFilter('')
      setMemberCompanyFilter('')
      loadData()
    } catch (err) {
      console.error('Error adding members:', err)
      alert('Errore: ' + err.message)
    }
  }
  
  const handleRemoveMember = async (squadId, memberId) => {
    try {
      const { error } = await supabase
        .from('squad_members')
        .update({ status: 'removed', removed_at: new Date().toISOString() })
        .eq('id', memberId)
      
      if (error) throw error
      
      loadData()
    } catch (err) {
      console.error('Error removing member:', err)
      alert('Errore: ' + err.message)
    }
  }
  
  const toggleMemberSelection = (personnelId) => {
    setSelectedMembers(prev => 
      prev.includes(personnelId) 
        ? prev.filter(id => id !== personnelId)
        : [...prev, personnelId]
    )
  }

  // ============================================================================
  // OPZIONI PER SEARCHABLE SELECT
  // ============================================================================
  
  // Opzioni supervisori
  const supervisorOptions = personnel
    .filter(p => SUPERVISOR_ROLES.includes(p.position))
    .map(p => ({
      value: p.id,
      label: `${p.last_name} ${p.first_name}`,
      badge: p.badge_number,
      role: p.position,
      company_id: p.company_id,
      company: p.company,
      assigned: assignedSupervisorIds.has(p.id) && p.id !== editingSquad?.supervisor_id
    }))
  
  // Opzioni foreman
  const foremanOptions = personnel
    .filter(p => FOREMAN_ROLES.includes(p.position))
    .filter(p => !assignedMemberIds.has(p.id) || p.id === editingSquad?.foreman_id)
    .map(p => ({
      value: p.id,
      label: `${p.last_name} ${p.first_name}`,
      badge: p.badge_number,
      role: p.position,
      company_id: p.company_id,
      company: p.company,
      assigned: assignedMemberIds.has(p.id)
    }))

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

  // Ruoli disponibili per filtro (solo quelli con personale non assegnato)
  const availableRolesForFilter = [...new Set(availableForAssignment.map(p => p.position))]

  return (
    <div className="space-y-6">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-primary" />
            Squadre
          </h1>
          <p className="text-gray-500 mt-1">
            {activeProject.name} • {squads.length} squadre attive
          </p>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Nuova Squadra
        </button>
      </div>

      {/* ============ DASHBOARD PERSONALE DIRETTO ============ */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Personale Diretto
        </h2>
        
        {/* Riepilogo totale */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-gray-800">{directPersonnel.length}</div>
            <div className="text-sm text-gray-500">Totale</div>
          </div>
          
          {/* Assegnati - Click per vedere lista */}
          <div 
            className="bg-green-50 rounded-lg p-4 text-center cursor-pointer hover:bg-green-100 transition-colors"
            onClick={() => setPopupData({
              type: 'assigned',
              personnel: assignedDirect,
              title: 'Personale Assegnato'
            })}
          >
            <div className="text-3xl font-bold text-green-600">{assignedDirect.length}</div>
            <div className="text-sm text-gray-500">Assegnati</div>
          </div>
          
          {/* Da Assegnare - Click per vedere lista */}
          <div 
            className="bg-amber-50 rounded-lg p-4 text-center cursor-pointer hover:bg-amber-100 transition-colors"
            onClick={() => setPopupData({
              type: 'unassigned',
              personnel: unassignedDirect,
              title: 'Personale Da Assegnare'
            })}
          >
            <div className="text-3xl font-bold text-amber-600">{unassignedDirect.length}</div>
            <div className="text-sm text-gray-500">Da Assegnare</div>
          </div>
        </div>
        
        {/* Dettaglio per ruolo */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600">Ruolo</th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">Totale</th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">Assegnati</th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">Da Assegnare</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {roleStats.map(stat => (
                <tr key={stat.role} className="border-b border-gray-100">
                  <td className="py-2 px-3">
                    <RoleBadge role={stat.role} />
                  </td>
                  <td className="py-2 px-3 text-center font-medium">{stat.total}</td>
                  
                  {/* Assegnati - Click */}
                  <td className="py-2 px-3 text-center">
                    <span 
                      className={`text-green-600 ${stat.assigned > 0 ? 'cursor-pointer hover:underline' : ''}`}
                      onClick={() => stat.assigned > 0 && setPopupData({
                        type: 'assigned',
                        personnel: stat.assignedList,
                        title: `${ROLE_CONFIG[stat.role]?.label || stat.role} Assegnati`
                      })}
                    >
                      {stat.assigned}
                    </span>
                  </td>
                  
                  {/* Da Assegnare - Click */}
                  <td className="py-2 px-3 text-center">
                    <span 
                      className={`text-amber-600 ${stat.unassigned > 0 ? 'cursor-pointer hover:underline' : ''}`}
                      onClick={() => stat.unassigned > 0 && setPopupData({
                        type: 'unassigned',
                        personnel: stat.unassignedList,
                        title: `${ROLE_CONFIG[stat.role]?.label || stat.role} Da Assegnare`
                      })}
                    >
                      {stat.unassigned}
                    </span>
                  </td>
                  
                  {/* Progresso con percentuale */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${stat.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 w-10 text-right">{stat.percentage}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ LISTA SQUADRE ============ */}
      <div className="space-y-4">
        {squads.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Users size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">Nessuna squadra creata</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              Crea la prima squadra
            </button>
          </div>
        ) : (
          squads.map(squad => {
            const members = squadMembers[squad.id] || []
            const isExpanded = expandedSquad === squad.id
            
            return (
              <div key={squad.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header squadra */}
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedSquad(isExpanded ? null : squad.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <span className="text-primary font-bold">{squad.squad_number}</span>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {squad.name || `Squadra ${squad.squad_number}`}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {squad.supervisor && (
                          <span className="flex items-center gap-1">
                            <Star size={12} className="text-yellow-500" />
                            Sup: {squad.supervisor.first_name} {squad.supervisor.last_name}
                          </span>
                        )}
                        {squad.foreman && (
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            Foreman: {squad.foreman.first_name} {squad.foreman.last_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-800">{members.length}</div>
                      <div className="text-xs text-gray-500">Membri</div>
                    </div>
                    
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setShowAddMemberModal(squad.id)}
                        className="p-2 hover:bg-green-100 rounded-lg text-green-600"
                        title="Aggiungi membri"
                      >
                        <UserPlus size={18} />
                      </button>
                      <button
                        onClick={() => openEditModal(squad)}
                        className="p-2 hover:bg-blue-100 rounded-lg text-blue-600"
                        title="Modifica"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(squad)}
                        className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                        title="Elimina"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Membri squadra (espanso) */}
                {isExpanded && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    {members.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        Nessun membro assegnato. 
                        <button 
                          onClick={() => setShowAddMemberModal(squad.id)}
                          className="text-primary hover:underline ml-2"
                        >
                          Aggiungi membri
                        </button>
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {members.map(member => (
                          <div 
                            key={member.id}
                            className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">
                                {member.personnel?.first_name?.charAt(0)}{member.personnel?.last_name?.charAt(0)}
                              </div>
                              <div>
                                <div className="font-medium text-sm">
                                  {member.personnel?.last_name} {member.personnel?.first_name}
                                </div>
                                <div className="flex items-center gap-2">
                                  <RoleBadge role={member.personnel?.position} size="small" />
                                  {member.personnel?.company?.is_main && (
                                    <Star size={10} className="text-yellow-500 fill-yellow-500" />
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveMember(squad.id, member.id)}
                              className="p-1.5 hover:bg-red-100 rounded text-red-500"
                              title="Rimuovi"
                            >
                              <UserMinus size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Bottone aggiungi in fondo */}
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => setShowAddMemberModal(squad.id)}
                        className="btn-secondary text-sm"
                      >
                        <UserPlus size={16} className="mr-2" />
                        Aggiungi membri
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ============ MODAL CREA/MODIFICA SQUADRA ============ */}
      {(showCreateModal || editingSquad) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-800">
                {editingSquad ? `Modifica Squadra ${editingSquad.squad_number}` : 'Nuova Squadra'}
              </h2>
              <button 
                onClick={() => { setShowCreateModal(false); setEditingSquad(null); resetForm(); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Squadra
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={`Squadra ${editingSquad?.squad_number || getNextSquadNumber()}`}
                />
              </div>
              
              {/* Supervisore con SearchableSelect */}
              <SearchableSelect
                value={formData.supervisorId}
                onChange={(val) => setFormData({...formData, supervisorId: val})}
                options={supervisorOptions}
                placeholder="-- Seleziona Supervisore --"
                label="Supervisore Responsabile"
                companyFilter={supervisorCompanyFilter}
                onCompanyFilterChange={setSupervisorCompanyFilter}
                companies={companies}
                showCompanyFilter={true}
              />
              
              {/* Foreman con SearchableSelect */}
              <SearchableSelect
                value={formData.foremanId}
                onChange={(val) => setFormData({...formData, foremanId: val})}
                options={foremanOptions}
                placeholder="-- Seleziona Foreman --"
                label="Foreman Caposquadra"
                required={true}
                companyFilter={foremanCompanyFilter}
                onCompanyFilterChange={setForemanCompanyFilter}
                companies={companies}
                showCompanyFilter={true}
              />
              
              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Note opzionali..."
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
              <button
                onClick={() => { setShowCreateModal(false); setEditingSquad(null); resetForm(); }}
                className="btn-secondary"
              >
                Annulla
              </button>
              <button
                onClick={editingSquad ? handleUpdateSquad : handleCreateSquad}
                className="btn-primary"
              >
                {editingSquad ? 'Salva Modifiche' : 'Crea Squadra'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL AGGIUNGI MEMBRI ============ */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-gray-800">
                Aggiungi Membri - {squads.find(s => s.id === showAddMemberModal)?.name || 'Squadra'}
              </h2>
              <button 
                onClick={() => { 
                  setShowAddMemberModal(null)
                  setSelectedMembers([])
                  setMemberSearch('')
                  setMemberRoleFilter('')
                  setMemberCompanyFilter('')
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Filtri */}
            <div className="p-4 border-b bg-gray-50 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Cerca nome, cognome, badge..."
                  />
                </div>
              </div>
              
              <div className="flex gap-3">
                <select
                  value={memberRoleFilter}
                  onChange={(e) => setMemberRoleFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Tutti i ruoli</option>
                  {availableRolesForFilter.map(role => (
                    <option key={role} value={role}>{ROLE_CONFIG[role]?.label || role}</option>
                  ))}
                </select>
                
                <select
                  value={memberCompanyFilter}
                  onChange={(e) => setMemberCompanyFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Tutte le aziende</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              
              {selectedMembers.length > 0 && (
                <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-primary">
                    {selectedMembers.length} selezionati
                  </span>
                  <button
                    onClick={() => setSelectedMembers([])}
                    className="text-sm text-primary hover:underline"
                  >
                    Deseleziona tutti
                  </button>
                </div>
              )}
            </div>
            
            {/* Lista personale disponibile */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredAvailable.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Nessun personale disponibile con i filtri selezionati
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredAvailable.map(person => (
                    <div 
                      key={person.id}
                      onClick={() => toggleMemberSelection(person.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedMembers.includes(person.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          selectedMembers.includes(person.id)
                            ? 'bg-primary border-primary'
                            : 'border-gray-300'
                        }`}>
                          {selectedMembers.includes(person.id) && (
                            <Check size={14} className="text-white" />
                          )}
                        </div>
                        
                        <div>
                          <div className="font-medium">
                            <span className="text-gray-500 font-mono text-sm mr-2">{person.badge_number}</span>
                            {person.last_name} {person.first_name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <RoleBadge role={person.position} size="small" />
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              {person.company?.is_main && <Star size={10} className="text-yellow-500 fill-yellow-500" />}
                              {person.company?.company_name}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="flex justify-between items-center p-4 border-t bg-gray-50">
              <span className="text-sm text-gray-500">
                {filteredAvailable.length} disponibili
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => { 
                    setShowAddMemberModal(null)
                    setSelectedMembers([])
                  }}
                  className="btn-secondary"
                >
                  Annulla
                </button>
                <button
                  onClick={handleAddMembers}
                  disabled={selectedMembers.length === 0}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus size={18} className="mr-2" />
                  Aggiungi {selectedMembers.length > 0 ? `(${selectedMembers.length})` : ''}
                </button>
              </div>
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
                <h3 className="font-bold text-gray-800">Elimina Squadra</h3>
                <p className="text-sm text-gray-500">
                  {showDeleteConfirm.name || `Squadra ${showDeleteConfirm.squad_number}`}
                </p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              Sei sicuro di voler eliminare questa squadra? 
              I membri verranno rimossi e torneranno disponibili per l'assegnazione.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDeleteSquad(showDeleteConfirm)}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ POPUP LISTA PERSONALE ============ */}
      <PersonnelListModal
        personnel={popupData?.personnel || []}
        title={popupData?.title || ''}
        isOpen={popupData !== null}
        onClose={() => setPopupData(null)}
        type={popupData?.type || 'unassigned'}
      />
    </div>
  )
}
