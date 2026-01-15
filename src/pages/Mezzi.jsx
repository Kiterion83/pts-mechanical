import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import { useTranslation } from 'react-i18next';

// ============================================================================
// MEZZI PAGE - Gestione Mezzi di Cantiere
// ============================================================================

const VEHICLE_STATUS = {
  available: { label: 'Disponibile', color: 'bg-green-100 text-green-700', icon: '🟢' },
  in_use: { label: 'In Uso', color: 'bg-blue-100 text-blue-700', icon: '🔵' },
  maintenance: { label: 'Manutenzione', color: 'bg-amber-100 text-amber-700', icon: '🟡' },
  off_site: { label: 'Fuori Cantiere', color: 'bg-gray-100 text-gray-600', icon: '⚪' }
};

export default function Mezzi() {
  const { t } = useTranslation();
  const { activeProject, loading: projectLoading } = useProject();
  
  // Data state
  const [vehicles, setVehicles] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [assigningVehicle, setAssigningVehicle] = useState(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    if (activeProject?.id) {
      fetchAllData();
    }
  }, [activeProject?.id]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchVehicles(),
        fetchVehicleTypes(),
        fetchCompanies(),
        fetchSquads()
      ]);
    } catch (error) {
      console.error('Mezzi: Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    const { data, error } = await supabase
      .from('v_site_vehicles_details')
      .select('*')
      .eq('project_id', activeProject.id)
      .order('vehicle_code');
    if (!error) setVehicles(data || []);
  };

  const fetchVehicleTypes = async () => {
    const { data } = await supabase
      .from('vehicle_types')
      .select('*')
      .order('type_name_it');
    setVehicleTypes(data || []);
  };

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('project_id', activeProject.id)
      .order('name');
    setCompanies(data || []);
  };

  const fetchSquads = async () => {
    const { data } = await supabase
      .from('squads')
      .select('*')
      .eq('project_id', activeProject.id)
      .eq('status', 'active')
      .order('name');
    setSquads(data || []);
  };

  // ============================================================================
  // STATS
  // ============================================================================

  const stats = useMemo(() => ({
    total: vehicles.length,
    available: vehicles.filter(v => v.status === 'available').length,
    inUse: vehicles.filter(v => v.status === 'in_use').length,
    maintenance: vehicles.filter(v => v.status === 'maintenance').length,
    offSite: vehicles.filter(v => v.status === 'off_site').length
  }), [vehicles]);

  // ============================================================================
  // FILTERS
  // ============================================================================

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (filterType !== 'all' && v.vehicle_type_code !== filterType) return false;
      if (filterStatus !== 'all' && v.status !== filterStatus) return false;
      if (filterCompany !== 'all' && v.company_id !== filterCompany) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!v.vehicle_code?.toLowerCase().includes(search) &&
            !v.brand?.toLowerCase().includes(search) &&
            !v.model?.toLowerCase().includes(search) &&
            !v.license_plate?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [vehicles, filterType, filterStatus, filterCompany, searchTerm]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleAddVehicle = async (data) => {
    const { error } = await supabase.from('site_vehicles').insert({
      project_id: activeProject.id,
      ...data
    });
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchVehicles();
      setShowAddModal(false);
    }
  };

  const handleUpdateVehicle = async (id, updates) => {
    const { error } = await supabase
      .from('site_vehicles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchVehicles();
      setEditingVehicle(null);
    }
  };

  const handleDeleteVehicle = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo mezzo?')) return;
    const { error } = await supabase
      .from('site_vehicles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchVehicles();
    }
  };

  const handleAssignVehicle = async (vehicleId, squadId, notes) => {
    const { error } = await supabase.from('squad_vehicles').insert({
      vehicle_id: vehicleId,
      squad_id: squadId,
      assigned_date: new Date().toISOString().split('T')[0],
      notes: notes
    });
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchVehicles();
      setShowAssignModal(false);
      setAssigningVehicle(null);
    }
  };

  const handleReturnVehicle = async (vehicleId) => {
    if (!confirm('Confermi la restituzione del mezzo?')) return;
    
    // Find current assignment
    const { data: assignments } = await supabase
      .from('squad_vehicles')
      .select('id')
      .eq('vehicle_id', vehicleId)
      .is('returned_date', null)
      .single();
    
    if (assignments) {
      const { error } = await supabase
        .from('squad_vehicles')
        .update({ returned_date: new Date().toISOString().split('T')[0] })
        .eq('id', assignments.id);
      
      if (!error) {
        fetchVehicles();
      }
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!projectLoading && !activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p className="text-lg">Nessun progetto selezionato</p>
      </div>
    );
  }

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              🚜 Mezzi di Cantiere
            </h1>
            <p className="text-gray-500 mt-1">{activeProject?.name} • Gestione mezzi e attrezzature</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm font-medium"
          >
            ➕ Nuovo Mezzo
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <StatCard icon="🚜" bg="bg-gray-50" border="border-gray-200" value={stats.total} label="Totale" />
          <StatCard icon="🟢" bg="bg-green-50" border="border-green-200" value={stats.available} label="Disponibili" />
          <StatCard icon="🔵" bg="bg-blue-50" border="border-blue-200" value={stats.inUse} label="In Uso" />
          <StatCard icon="🟡" bg="bg-amber-50" border="border-amber-200" value={stats.maintenance} label="Manutenzione" />
          <StatCard icon="⚪" bg="bg-gray-50" border="border-gray-200" value={stats.offSite} label="Fuori Cantiere" />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
              type="text" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              placeholder="Cerca codice, marca, modello, targa..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)} 
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">Tutti i tipi</option>
            {vehicleTypes.map(vt => (
              <option key={vt.type_code} value={vt.type_code}>{vt.icon} {vt.type_name_it}</option>
            ))}
          </select>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)} 
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">Tutti gli stati</option>
            {Object.entries(VEHICLE_STATUS).map(([key, val]) => (
              <option key={key} value={key}>{val.icon} {val.label}</option>
            ))}
          </select>
          <select 
            value={filterCompany} 
            onChange={(e) => setFilterCompany(e.target.value)} 
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">Tutte le aziende</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-3 font-medium">Codice</th>
                <th className="text-left p-3 font-medium">Tipo</th>
                <th className="text-left p-3 font-medium">Marca / Modello</th>
                <th className="text-center p-3 font-medium">Targa</th>
                <th className="text-center p-3 font-medium">Capacità</th>
                <th className="text-left p-3 font-medium">Azienda</th>
                <th className="text-center p-3 font-medium">Stato</th>
                <th className="text-left p-3 font-medium">Assegnato a</th>
                <th className="text-center p-3 font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-400">Nessun mezzo trovato</td></tr>
              ) : filteredVehicles.map(vehicle => (
                <tr key={vehicle.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">
                    <span className="font-mono font-medium text-blue-600">{vehicle.vehicle_code}</span>
                  </td>
                  <td className="p-3">
                    <span className="flex items-center gap-2">
                      <span>{vehicle.type_icon}</span>
                      <span className="text-gray-700">{vehicle.type_name_it}</span>
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="text-gray-800">{vehicle.brand || '—'}</div>
                    <div className="text-xs text-gray-500">{vehicle.model || ''}</div>
                  </td>
                  <td className="p-3 text-center font-mono text-sm">{vehicle.license_plate || '—'}</td>
                  <td className="p-3 text-center text-sm">{vehicle.capacity || '—'}</td>
                  <td className="p-3">
                    {vehicle.company_name ? (
                      <span className={`text-sm ${vehicle.company_is_main ? 'font-medium text-blue-700' : 'text-gray-600'}`}>
                        {vehicle.company_name}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${VEHICLE_STATUS[vehicle.status]?.color || ''}`}>
                      {VEHICLE_STATUS[vehicle.status]?.icon} {VEHICLE_STATUS[vehicle.status]?.label}
                    </span>
                  </td>
                  <td className="p-3">
                    {vehicle.current_squad_name ? (
                      <span className="text-sm text-emerald-700 font-medium">
                        👷 {vehicle.current_squad_name}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">Non assegnato</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {vehicle.status === 'available' && !vehicle.current_squad_id && (
                        <button 
                          onClick={() => { setAssigningVehicle(vehicle); setShowAssignModal(true); }}
                          className="p-1.5 hover:bg-emerald-100 rounded text-emerald-600"
                          title="Assegna a squadra"
                        >
                          👷
                        </button>
                      )}
                      {vehicle.current_squad_id && (
                        <button 
                          onClick={() => handleReturnVehicle(vehicle.id)}
                          className="p-1.5 hover:bg-amber-100 rounded text-amber-600"
                          title="Restituisci"
                        >
                          ↩️
                        </button>
                      )}
                      <button 
                        onClick={() => setEditingVehicle(vehicle)}
                        className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                        title="Modifica"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDeleteVehicle(vehicle.id)}
                        className="p-1.5 hover:bg-red-100 rounded text-red-600"
                        title="Elimina"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <VehicleModal 
          vehicleTypes={vehicleTypes}
          companies={companies}
          onSave={handleAddVehicle}
          onClose={() => setShowAddModal(false)}
        />
      )}
      
      {editingVehicle && (
        <VehicleModal 
          vehicle={editingVehicle}
          vehicleTypes={vehicleTypes}
          companies={companies}
          onSave={(data) => handleUpdateVehicle(editingVehicle.id, data)}
          onClose={() => setEditingVehicle(null)}
        />
      )}
      
      {showAssignModal && assigningVehicle && (
        <AssignModal 
          vehicle={assigningVehicle}
          squads={squads}
          onAssign={(squadId, notes) => handleAssignVehicle(assigningVehicle.id, squadId, notes)}
          onClose={() => { setShowAssignModal(false); setAssigningVehicle(null); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const StatCard = ({ icon, bg, border, value, label }) => (
  <div className={`${bg} rounded-lg p-4 border ${border}`}>
    <div className="flex items-center gap-2">
      <span className="text-xl">{icon}</span>
      <div>
        <div className="text-2xl font-bold text-gray-700">{value}</div>
        <div className="text-xs text-gray-600">{label}</div>
      </div>
    </div>
  </div>
);

// Vehicle Add/Edit Modal
const VehicleModal = ({ vehicle, vehicleTypes, companies, onSave, onClose }) => {
  const [formData, setFormData] = useState(vehicle || {
    vehicle_code: '',
    vehicle_type_code: '',
    brand: '',
    model: '',
    license_plate: '',
    capacity: '',
    company_id: '',
    arrival_date: '',
    departure_date: '',
    status: 'available',
    notes: ''
  });

  const handleSubmit = () => {
    if (!formData.vehicle_code || !formData.vehicle_type_code) {
      alert('Compila i campi obbligatori: Codice e Tipo');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-800">
            {vehicle ? `✏️ Modifica: ${vehicle.vehicle_code}` : '🚜 Nuovo Mezzo'}
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codice *</label>
              <input 
                type="text" 
                value={formData.vehicle_code} 
                onChange={e => setFormData({...formData, vehicle_code: e.target.value})} 
                className="w-full px-3 py-2 border rounded-lg" 
                placeholder="GRU-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select 
                value={formData.vehicle_type_code} 
                onChange={e => setFormData({...formData, vehicle_type_code: e.target.value})} 
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">-- Seleziona --</option>
                {vehicleTypes.map(vt => (
                  <option key={vt.type_code} value={vt.type_code}>{vt.icon} {vt.type_name_it}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input 
                type="text" 
                value={formData.brand || ''} 
                onChange={e => setFormData({...formData, brand: e.target.value})} 
                className="w-full px-3 py-2 border rounded-lg" 
                placeholder="Liebherr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modello</label>
              <input 
                type="text" 
                value={formData.model || ''} 
                onChange={e => setFormData({...formData, model: e.target.value})} 
                className="w-full px-3 py-2 border rounded-lg" 
                placeholder="LTM 1100"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Targa</label>
              <input 
                type="text" 
                value={formData.license_plate || ''} 
                onChange={e => setFormData({...formData, license_plate: e.target.value})} 
                className="w-full px-3 py-2 border rounded-lg" 
                placeholder="AB123CD"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacità</label>
              <input 
                type="text" 
                value={formData.capacity || ''} 
                onChange={e => setFormData({...formData, capacity: e.target.value})} 
                className="w-full px-3 py-2 border rounded-lg" 
                placeholder="50t, 3000kg, 25m..."
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Azienda Proprietaria</label>
            <select 
              value={formData.company_id || ''} 
              onChange={e => setFormData({...formData, company_id: e.target.value || null})} 
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">-- Seleziona --</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.is_main ? '(Main)' : ''}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Arrivo</label>
              <input 
                type="date" 
                value={formData.arrival_date || ''} 
                onChange={e => setFormData({...formData, arrival_date: e.target.value})} 
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Uscita</label>
              <input 
                type="date" 
                value={formData.departure_date || ''} 
                onChange={e => setFormData({...formData, departure_date: e.target.value})} 
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
            <select 
              value={formData.status} 
              onChange={e => setFormData({...formData, status: e.target.value})} 
              className="w-full px-3 py-2 border rounded-lg"
            >
              {Object.entries(VEHICLE_STATUS).map(([key, val]) => (
                <option key={key} value={key}>{val.icon} {val.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea 
              value={formData.notes || ''} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
              className="w-full px-3 py-2 border rounded-lg" 
              rows={3}
              placeholder="Note aggiuntive..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">✔ Salva</button>
        </div>
      </div>
    </div>
  );
};

// Assign to Squad Modal
const AssignModal = ({ vehicle, squads, onAssign, onClose }) => {
  const [selectedSquad, setSelectedSquad] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!selectedSquad) {
      alert('Seleziona una squadra');
      return;
    }
    onAssign(selectedSquad, notes);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            👷 Assegna Mezzo a Squadra
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {vehicle.type_icon} {vehicle.vehicle_code} - {vehicle.type_name_it}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Squadra *</label>
            <select 
              value={selectedSquad} 
              onChange={e => setSelectedSquad(e.target.value)} 
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">-- Seleziona Squadra --</option>
              {squads.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (opzionale)</label>
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              className="w-full px-3 py-2 border rounded-lg" 
              rows={2}
              placeholder="Note sull'assegnazione..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Annulla</button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">✔ Assegna</button>
        </div>
      </div>
    </div>
  );
};
