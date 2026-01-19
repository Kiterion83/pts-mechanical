import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import {
  UsersRound, Plus, Search, X, Check, Edit, Trash2,
  User, Users, AlertTriangle, ChevronDown, ChevronUp,
  Truck, Package, Wrench, Settings
} from 'lucide-react'

// ============================================================================
// CONFIGURAZIONE
// ============================================================================

const SQUAD_TYPES = {
  piping: { label: 'Piping', color: 'bg-blue-100 text-blue-800' },
  welding: { label: 'Saldatura', color: 'bg-orange-100 text-orange-800' },
  supports: { label: 'Supporti', color: 'bg-green-100 text-green-800' },
  mechanical: { label: 'Meccanica', color: 'bg-purple-100 text-purple-800' },
  electrical: { label: 'Elettrica', color: 'bg-yellow-100 text-yellow-800' },
  instrumentation: { label: 'Strumentazione', color: 'bg-cyan-100 text-cyan-800' }
}

// ============================================================================
// COMPONENTE PRINCIPALE
// ============================================================================

export default function Squads() {
  const { t } = useTranslation()
  const { activeProject } = useProject()
  
  // Data state
  const [squads, setSquads] = useState([])
  const [members, setMembers] = useState({}) // { squadId: [members] }
  const [equipment, setEquipment] = useState({}) // { squadId: [equipment] }
  const [personnel, setPersonnel] = useState([])
  const [availableEquipment, setAvailableEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  
  // UI state
  const [showModal, setShowModal] = useState(false)
  const [editingSquad, setEditingSquad] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [expandedSquad, setExpandedSquad] = useState(null)
  const [showAssignMemberModal, setShowAssignMemberModal] = useState(null)
  const [showAssignEquipmentModal, setShowAssignEquipmentModal] = useState(null)
  
  // Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('')
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    squadType: 'piping',
    notes: ''
  })

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (activeProject) loadData()
  }, [activeProject])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Squads
      const { data: squadsData } = await supabase
        .from('squads')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
        .order('squad_number')
      setSquads(squadsData || [])
      
      // Squad members
      const { data: membersData } = await supabase
        .from('squad_members')
        .select(`
          *,
          personnel:personnel_id(id, first_name, last_name, badge, role)
        `)
        .eq('status', 'active')
      
      const membersMap = {}
      ;(membersData || []).forEach(m => {
        if (!membersMap[m.squad_id]) membersMap[m.squad_id] = []
        membersMap[m.squad_id].push(m)
      })
      setMembers(membersMap)
      
      // Equipment assignments (ESCLUDI status='inactive')
      const { data: equipmentAssignments } = await supabase
        .from('equipment_assignments')
        .select(`
          *,
          equipment:equipment_id(id, asset_code, type, category, description, status)
        `)
        .eq('status', 'active')
      
      const equipmentMap = {}
      ;(equipmentAssignments || []).forEach(ea => {
        // IMPORTANTE: Escludi equipment con status='inactive'
        if (ea.equipment && ea.equipment.status !== 'inactive') {
          if (!equipmentMap[ea.squad_id]) equipmentMap[ea.squad_id] = []
          equipmentMap[ea.squad_id].push(ea)
        }
      })
      setEquipment(equipmentMap)
      
      // Available personnel (not in any squad)
      const { data: personnelData } = await supabase
        .from('personnel')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
      setPersonnel(personnelData || [])
      
      // Available equipment (not assigned, status='active')
      const { data: allEquipment } = await supabase
        .from('equipment')
        .select('*')
        .eq('project_id', activeProject.id)
        .eq('status', 'active')
      
      const assignedEquipmentIds = new Set(
        (equipmentAssignments || [])
          .filter(ea => ea.status === 'active')
          .map(ea => ea.equipment_id)
      )
      
      const available = (allEquipment || []).filter(e => !assignedEquipmentIds.has(e.id))
      setAvailableEquipment(available)
      
    } catch (err) {
      console.error('Error loading squads:', err)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // STATS
  // ============================================================================

  const stats = useMemo(() => ({
    total: squads.length,
    totalMembers: Object.values(members).flat().length,
    totalEquipment: Object.values(equipment).flat().length,
    avgSize: squads.length > 0 
      ? Math.round(Object.values(members).flat().length / squads.length * 10) / 10 
      : 0
  }), [squads, members, equipment])

  // ============================================================================
  // FILTER
  // ============================================================================

  const filteredSquads = useMemo(() => {
    return squads.filter(s => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        if (!s.name?.toLowerCase().includes(search) &&
            !s.squad_number?.toString().includes(search)) return false
      }
      if (filterType && s.squad_type !== filterType) return false
      return true
    })
  }, [squads, searchTerm, filterType])

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const resetForm = () => {
    setFormData({ name: '', squadType: 'piping', notes: '' })
  }

  const openAddModal = () => {
    setEditingSquad(null)
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (squad) => {
    setFormData({
      name: squad.name || '',
      squadType: squad.squad_type || 'piping',
      notes: squad.notes || ''
    })
    setEditingSquad(squad)
    setShowModal(true)
  }

  // ============================================================================
  // CRUD
  // ============================================================================

  const handleSave = async () => {
    try {
      const dataToSave = {
        project_id: activeProject.id,
        name: formData.name.trim() || null,
        squad_type: formData.squadType,
        notes: formData.notes.trim() || null
      }
      
      if (editingSquad) {
        const { error } = await supabase
          .from('squads')
          .update(dataToSave)
          .eq('id', editingSquad.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('squads')
          .insert([dataToSave])
        if (error) throw error
      }
      
      setShowModal(false)
      resetForm()
      loadData()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  const handleDelete = async (squad) => {
    try {
      // Rimuovi membri
      await supabase
        .from('squad_members')
        .update({ status: 'inactive' })
        .eq('squad_id', squad.id)
      
      // Rimuovi assegnazioni equipment
      await supabase
        .from('equipment_assignments')
        .update({ status: 'inactive' })
        .eq('squad_id', squad.id)
      
      // Soft delete squad
      const { error } = await supabase
        .from('squads')
        .update({ status: 'inactive' })
        .eq('id', squad.id)
      if (error) throw error
      
      setShowDeleteConfirm(null)
      loadData()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  // ============================================================================
  // MEMBER MANAGEMENT
  // ============================================================================

  const handleAddMember = async (squadId, personnelId) => {
    try {
      await supabase.from('squad_members').insert([{
        squad_id: squadId,
        personnel_id: personnelId,
        status: 'active'
      }])
      setShowAssignMemberModal(null)
      loadData()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  const handleRemoveMember = async (memberId) => {
    try {
      await supabase
        .from('squad_members')
        .update({ status: 'inactive' })
        .eq('id', memberId)
      loadData()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  // ============================================================================
  // EQUIPMENT MANAGEMENT
  // ============================================================================

  const handleAssignEquipment = async (squadId, equipmentId) => {
    try {
      await supabase.from('equipment_assignments').insert([{
        equipment_id: equipmentId,
        squad_id: squadId,
        status: 'active'
      }])
      setShowAssignEquipmentModal(null)
      loadData()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  const handleRemoveEquipment = async (assignmentId) => {
    try {
      await supabase
        .from('equipment_assignments')
        .update({ status: 'inactive' })
        .eq('id', assignmentId)
      loadData()
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getAvailablePersonnel = (squadId) => {
    const squadMemberIds = new Set((members[squadId] || []).map(m => m.personnel_id))
    const allSquadMemberIds = new Set(Object.values(members).flat().map(m => m.personnel_id))
    return personnel.filter(p => !allSquadMemberIds.has(p.id))
  }

  const getEquipmentIcon = (category) => {
    switch (category) {
      case 'vehicle': return Truck
      case 'equipment': return Package
      case 'tool': return Wrench
      default: return Package
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <UsersRound size={64} className="text-gray-300 mb-4" />
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
    <div className="space-y-4 md:space-y-6 pb-20">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UsersRound className="text-primary" size={24} />
            {t('squad.title')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{activeProject.name}</p>
        </div>
        <button onClick={openAddModal} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto py-3 sm:py-2">
          <Plus size={20} />
          {t('squad.newSquad')}
        </button>
      </div>

      {/* STATS */}
      <div className="bg-white rounded-xl border p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-blue-700">{stats.total}</div>
            <div className="text-xs text-blue-600">Squadre</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-green-700">{stats.totalMembers}</div>
            <div className="text-xs text-green-600">Membri Totali</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-purple-700">{stats.totalEquipment}</div>
            <div className="text-xs text-purple-600">Mezzi Assegnati</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <div className="text-xl sm:text-2xl font-bold text-amber-700">{stats.avgSize}</div>
            <div className="text-xs text-amber-600">Media Membri</div>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white rounded-xl border p-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca squadra..."
              className="w-full pl-10 pr-4 py-3 border rounded-lg text-sm"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-3 border rounded-lg text-sm min-w-[150px]"
          >
            <option value="">Tutti i tipi</option>
            {Object.entries(SQUAD_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* SQUADS LIST */}
      <div className="space-y-3">
        {filteredSquads.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <UsersRound size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">
              {squads.length === 0 ? t('squad.noSquads') : 'Nessun risultato'}
            </p>
            {squads.length === 0 && (
              <button onClick={openAddModal} className="btn-primary">
                <Plus size={18} className="mr-2" />
                {t('squad.newSquad')}
              </button>
            )}
          </div>
        ) : (
          filteredSquads.map(squad => {
            const squadMembers = members[squad.id] || []
            const squadEquipment = equipment[squad.id] || []
            const isExpanded = expandedSquad === squad.id
            const typeConfig = SQUAD_TYPES[squad.squad_type] || { label: squad.squad_type, color: 'bg-gray-100 text-gray-800' }
            
            return (
              <div key={squad.id} className="bg-white rounded-xl border overflow-hidden">
                {/* Squad Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedSquad(isExpanded ? null : squad.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg text-gray-800">
                          {squad.name || `Squadra ${squad.squad_number}`}
                        </span>
                        <span className={`${typeConfig.color} px-2 py-0.5 rounded-full text-xs font-medium`}>
                          {typeConfig.label}
                        </span>
                      </div>
                      {/* CONTATORE MEMBRI E MEZZI */}
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users size={14} />
                          {squadMembers.length} Membr{squadMembers.length === 1 ? 'o' : 'i'}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="flex items-center gap-1">
                          <Truck size={14} />
                          {squadEquipment.length} Mezz{squadEquipment.length === 1 ? 'o' : 'i'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(squad) }}
                        className="p-2 hover:bg-blue-100 rounded-lg text-blue-600"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(squad) }}
                        className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>
                
                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t">
                    {/* Members Section */}
                    <div className="p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-700 flex items-center gap-2">
                          <Users size={16} />
                          Membri ({squadMembers.length})
                        </h4>
                        <button
                          onClick={() => setShowAssignMemberModal(squad.id)}
                          className="text-sm px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-1"
                        >
                          <Plus size={14} />
                          Aggiungi
                        </button>
                      </div>
                      
                      {squadMembers.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">Nessun membro</p>
                      ) : (
                        <div className="space-y-2">
                          {squadMembers.map(m => (
                            <div key={m.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <User size={16} className="text-blue-600" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm">
                                    {m.personnel?.first_name} {m.personnel?.last_name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {m.personnel?.badge && `#${m.personnel.badge} • `}
                                    {m.personnel?.role}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveMember(m.id)}
                                className="p-1.5 hover:bg-red-100 rounded text-red-600"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Equipment Section */}
                    <div className="p-4 border-t">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-700 flex items-center gap-2">
                          <Truck size={16} />
                          Mezzi Assegnati ({squadEquipment.length})
                        </h4>
                        <button
                          onClick={() => setShowAssignEquipmentModal(squad.id)}
                          className="text-sm px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center gap-1"
                        >
                          <Plus size={14} />
                          Assegna
                        </button>
                      </div>
                      
                      {squadEquipment.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">Nessun mezzo assegnato</p>
                      ) : (
                        <div className="space-y-2">
                          {squadEquipment.map(ea => {
                            const Icon = getEquipmentIcon(ea.equipment?.category)
                            return (
                              <div key={ea.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                    <Icon size={16} className="text-purple-600" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm font-mono">
                                      {ea.equipment?.asset_code}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {ea.equipment?.type} {ea.equipment?.description && `- ${ea.equipment.description}`}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveEquipment(ea.id)}
                                  className="p-1.5 hover:bg-red-100 rounded text-red-600"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* MODAL NUOVA/MODIFICA SQUADRA */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-xl sm:m-4 sm:max-w-md rounded-t-xl">
            <div className="border-b p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">
                {editingSquad ? t('squad.editSquad') : t('squad.newSquad')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('squad.squadName')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-3 border rounded-lg"
                  placeholder="Es: Squadra Piping A"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('squad.squadType')}
                </label>
                <select
                  value={formData.squadType}
                  onChange={(e) => setFormData({ ...formData, squadType: e.target.value })}
                  className="w-full px-3 py-3 border rounded-lg"
                >
                  {Object.entries(SQUAD_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            
            <div className="border-t p-4 flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-3 bg-primary text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Check size={18} />
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ASSEGNA MEMBRO */}
      {showAssignMemberModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-xl sm:m-4 sm:max-w-md max-h-[70vh] flex flex-col rounded-t-xl">
            <div className="border-b p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Aggiungi Membro</h2>
              <button onClick={() => setShowAssignMemberModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {getAvailablePersonnel(showAssignMemberModal).length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nessun personale disponibile</p>
              ) : (
                <div className="space-y-2">
                  {getAvailablePersonnel(showAssignMemberModal).map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleAddMember(showAssignMemberModal, p.id)}
                      className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-blue-50 rounded-lg text-left"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium">{p.first_name} {p.last_name}</div>
                        <div className="text-xs text-gray-500">{p.badge && `#${p.badge} • `}{p.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="border-t p-4">
              <button
                onClick={() => setShowAssignMemberModal(null)}
                className="w-full py-3 bg-gray-200 rounded-lg font-medium"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ASSEGNA MEZZO */}
      {showAssignEquipmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:rounded-xl sm:m-4 sm:max-w-md max-h-[70vh] flex flex-col rounded-t-xl">
            <div className="border-b p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Assegna Mezzo</h2>
              <button onClick={() => setShowAssignEquipmentModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {availableEquipment.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nessun mezzo disponibile</p>
              ) : (
                <div className="space-y-2">
                  {availableEquipment.map(e => {
                    const Icon = getEquipmentIcon(e.category)
                    return (
                      <button
                        key={e.id}
                        onClick={() => handleAssignEquipment(showAssignEquipmentModal, e.id)}
                        className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-purple-50 rounded-lg text-left"
                      >
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <Icon size={20} className="text-purple-600" />
                        </div>
                        <div>
                          <div className="font-medium font-mono">{e.asset_code}</div>
                          <div className="text-xs text-gray-500">{e.type} {e.description && `- ${e.description}`}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            
            <div className="border-t p-4">
              <button
                onClick={() => setShowAssignEquipmentModal(null)}
                className="w-full py-3 bg-gray-200 rounded-lg font-medium"
              >
                Chiudi
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
                <h3 className="font-bold text-gray-800">Elimina Squadra</h3>
                <p className="text-sm text-gray-500">
                  {showDeleteConfirm.name || `Squadra ${showDeleteConfirm.squad_number}`}
                </p>
              </div>
            </div>
            <p className="text-gray-600 mb-4">
              Sei sicuro? I membri e i mezzi verranno scollegati dalla squadra.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg font-medium"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
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
