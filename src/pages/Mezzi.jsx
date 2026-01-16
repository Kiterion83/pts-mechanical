import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';

// ============================================================================
// MEZZI - Mezzi e Attrezzature di Cantiere
// Gru, Camion, Escavatori, Piattaforme, ecc. con 100+ tipi e statistiche cliccabili
// ============================================================================

// Tipi di mezzi/attrezzature organizzati per categoria
const EQUIPMENT_CATEGORIES = {
  'Gru e Sollevamento': [
    'Gru a Torre', 'Gru Mobile', 'Gru Cingolata', 'Gru su Gomma', 'Gru Semovente',
    'Autogrù', 'Gru a Bandiera', 'Gru a Cavalletto', 'Gru Portuale', 'Gru Telescopica'
  ],
  'Camion e Trasporto': [
    'Camion Ribaltabile', 'Camion Cisterna', 'Camion Betoniera', 'Autocarro', 'Bilico',
    'Semirimorchio', 'Carrello Elevatore', 'Transpallet', 'Dumper', 'Camion Gru',
    'Autocarro con Cassone', 'Motrice', 'Rimorchio', 'Pianale', 'Bisarca'
  ],
  'Movimento Terra': [
    'Escavatore Cingolato', 'Escavatore Gommato', 'Mini Escavatore', 'Pala Caricatrice',
    'Pala Gommata', 'Terna', 'Bulldozer', 'Apripista', 'Ruspa', 'Livellatrice (Grader)',
    'Skid Loader (Bobcat)', 'Minicaricatore', 'Ragno', 'Scavatore', 'Dragline'
  ],
  'Piattaforme Aeree': [
    'Piattaforma Verticale', 'Piattaforma Articolata', 'Piattaforma Telescopica',
    'Piattaforma a Forbice', 'Piattaforma Cingolata', 'Piattaforma Autocarrata',
    'Cestello', 'Piattaforma Ragno', 'Sollevatore Telescopico (Telehandler)',
    'Nacelle', 'Ponte Sviluppabile', 'Cherry Picker'
  ],
  'Compattazione e Pavimentazione': [
    'Rullo Compressore', 'Rullo Vibrante', 'Piastra Vibrante', 'Costipatore (Jumping Jack)',
    'Rullo Tandem', 'Finitrice (Asfaltatrice)', 'Fresa Stradale', 'Spargitore',
    'Spruzzatrice Bitume', 'Tagliaasfalto', 'Fresatrice'
  ],
  'Calcestruzzo': [
    'Pompa Calcestruzzo', 'Autobetoniera', 'Betoniera', 'Vibratore per Calcestruzzo',
    'Staggia Vibrante', 'Frattazzatrice (Elicottero)', 'Pompa Carrellata',
    'Impianto di Betonaggio', 'Secchione per Calcestruzzo', 'Canala'
  ],
  'Generatori e Energia': [
    'Generatore Diesel', 'Generatore Benzina', 'Gruppo Elettrogeno', 'Torre Faro',
    'Compressore Aria', 'Compressore Portatile', 'Quadro Elettrico', 'Trasformatore',
    'Inverter', 'Pannelli Solari Mobili', 'Power Pack'
  ],
  'Saldatura e Taglio': [
    'Saldatrice MIG/MAG', 'Saldatrice TIG', 'Saldatrice Elettrodo', 'Saldatrice Multiprocesso',
    'Saldatrice a Filo', 'Cannello Ossiacetilenico', 'Plasma Cutter', 'Smerigliatrice',
    'Troncatrice', 'Flessibile', 'Saldatrice Orbitale', 'Saldatrice per Tubi'
  ],
  'Sollevamento e Movimentazione': [
    'Carrello Elevatore Diesel', 'Carrello Elevatore Elettrico', 'Carrello Retrattile',
    'Transpallet Elettrico', 'Transpallet Manuale', 'Stacker', 'Commissionatore',
    'Gru a Ponte', 'Paranchi', 'Argano', 'Verricello', 'Martinetto Idraulico'
  ],
  'Perforazione e Fondazioni': [
    'Perforatrice', 'Trivella', 'Battipalo', 'Vibroinfissore', 'Macchina Jet Grouting',
    'Sonda Geotermica', 'Carotatrice', 'Martello Demolitore', 'Idrofresa'
  ],
  'Pompaggio e Idraulica': [
    'Pompa Acqua', 'Pompa Sommergibile', 'Pompa Autoadescante', 'Pompa Fanghi',
    'Idropulitrice', 'Lancia Termica', 'Pompa per Drenaggio', 'Wellpoint'
  ],
  'Utensili e Attrezzature': [
    'Martello Pneumatico', 'Trapano a Colonna', 'Trapano Portatile', 'Avvitatore',
    'Seghetto Alternativo', 'Sega Circolare', 'Motosega', 'Decespugliatore',
    'Cesoie Idrauliche', 'Pinze Idrauliche', 'Gruppo Idraulico', 'Centralina Idraulica'
  ],
  'Veicoli di Servizio': [
    'Furgone', 'Pickup', 'Autocarro Leggero', 'Minibus', 'Automobile',
    'Quad', 'Motociclo', 'Bicicletta Elettrica', 'Veicolo Elettrico'
  ],
  'Container e Moduli': [
    'Container Ufficio', 'Container Magazzino', 'Container Spogliatoio', 'Container WC',
    'Container Mensa', 'Container Officina', 'Container Frigorifero', 'Baracca',
    'Modulo Prefabbricato', 'Box Cantiere'
  ],
  'Sicurezza e Segnaletica': [
    'Barriera New Jersey', 'Segnaletica Stradale', 'Semaforo Mobile', 'Pannello a Messaggio Variabile',
    'Estintore', 'Kit Antinquinamento', 'Barriere di Sicurezza', 'Recinzioni Mobili'
  ],
  'Altro': [
    'Altro', 'Non Specificato', 'Attrezzatura Speciale', 'Macchina Custom'
  ]
};

// Flatten per dropdown
const ALL_EQUIPMENT_TYPES = Object.entries(EQUIPMENT_CATEGORIES).flatMap(([category, types]) =>
  types.map(type => ({ type, category }))
);

// Stati disponibili
const EQUIPMENT_STATUSES = [
  { value: 'available', label: 'Disponibile', color: 'bg-green-100 text-green-700', icon: '✅' },
  { value: 'assigned', label: 'Assegnato', color: 'bg-blue-100 text-blue-700', icon: '👷' },
  { value: 'maintenance', label: 'In Manutenzione', color: 'bg-amber-100 text-amber-700', icon: '🔧' },
  { value: 'unavailable', label: 'Non Disponibile', color: 'bg-red-100 text-red-700', icon: '🚫' }
];

export default function Mezzi() {
  const { t } = useTranslation();
  const { activeProject, loading: projectLoading } = useProject();

  // Data
  const [equipment, setEquipment] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showStatsModal, setShowStatsModal] = useState(null); // quale stat mostrare

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    if (activeProject?.id) {
      fetchEquipment();
      fetchCompanies();
    }
  }, [activeProject?.id]);

  const fetchEquipment = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .eq('project_id', activeProject.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching equipment:', error);
    } else {
      setEquipment(data || []);
    }
    setLoading(false);
  };

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .eq('project_id', activeProject.id)
      .order('name');
    setCompanies(data || []);
  };

  // ============================================================================
  // STATISTICS
  // ============================================================================

  const stats = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const total = equipment.length;
    const unassigned = equipment.filter(e => e.status === 'available' || !e.status).length;
    const assigned = equipment.filter(e => e.status === 'assigned').length;
    const inMaintenance = equipment.filter(e => e.status === 'maintenance').length;
    const unavailable = equipment.filter(e => e.status === 'unavailable').length;
    
    const maintenanceSoon = equipment.filter(e => {
      if (!e.next_maintenance_date) return false;
      const maintDate = new Date(e.next_maintenance_date);
      return maintDate >= now && maintDate <= sevenDaysFromNow;
    }).length;

    return { total, unassigned, assigned, inMaintenance, unavailable, maintenanceSoon };
  }, [equipment]);

  // Dati filtrati per i popup delle statistiche
  const getFilteredByStats = (statType) => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    switch (statType) {
      case 'total':
        return equipment;
      case 'unassigned':
        return equipment.filter(e => e.status === 'available' || !e.status);
      case 'assigned':
        return equipment.filter(e => e.status === 'assigned');
      case 'maintenanceSoon':
        return equipment.filter(e => {
          if (!e.next_maintenance_date) return false;
          const maintDate = new Date(e.next_maintenance_date);
          return maintDate >= now && maintDate <= sevenDaysFromNow;
        });
      case 'unavailable':
        return equipment.filter(e => e.status === 'unavailable');
      case 'inMaintenance':
        return equipment.filter(e => e.status === 'maintenance');
      default:
        return [];
    }
  };

  // ============================================================================
  // FILTERS
  // ============================================================================

  const filteredEquipment = useMemo(() => {
    return equipment.filter(e => {
      if (filterType !== 'all' && e.equipment_type !== filterType) return false;
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (filterCompany !== 'all' && e.company_id !== filterCompany) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!e.tag?.toLowerCase().includes(search) &&
            !e.description?.toLowerCase().includes(search) &&
            !e.license_plate?.toLowerCase().includes(search) &&
            !e.equipment_type?.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [equipment, filterType, filterStatus, filterCompany, searchTerm]);

  // Tipi unici usati nel progetto
  const usedTypes = useMemo(() => {
    const types = [...new Set(equipment.map(e => e.equipment_type).filter(Boolean))];
    return types.sort();
  }, [equipment]);

  // ============================================================================
  // CRUD
  // ============================================================================

  const handleAdd = async (data) => {
    const { error } = await supabase.from('equipment').insert({
      project_id: activeProject.id,
      ...data,
      created_at: new Date().toISOString()
    });
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchEquipment();
      setShowAddModal(false);
    }
  };

  const handleUpdate = async (id, data) => {
    const { error } = await supabase
      .from('equipment')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchEquipment();
      setEditingItem(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo mezzo?')) return;
    const { error } = await supabase.from('equipment').delete().eq('id', id);
    if (error) {
      alert('Errore: ' + error.message);
    } else {
      fetchEquipment();
    }
  };

  // ============================================================================
  // EXPORT EXCEL
  // ============================================================================

  const exportToExcel = () => {
    const exportData = filteredEquipment.map(e => ({
      'Tag': e.tag,
      'Tipo': e.equipment_type,
      'Descrizione': e.description,
      'Targa': e.license_plate,
      'Modello': e.model,
      'Stato': EQUIPMENT_STATUSES.find(s => s.value === e.status)?.label || 'Disponibile',
      'Azienda': companies.find(c => c.id === e.company_id)?.name || '',
      'Prossima Manutenzione': e.next_maintenance_date || '',
      'Note': e.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mezzi');
    XLSX.writeFile(wb, `Mezzi_${activeProject?.code || 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`);
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
              🚛 Mezzi e Attrezzature
            </h1>
            <p className="text-gray-500 mt-1">{activeProject?.name} • Gestione mezzi di cantiere</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
            >
              📤 Esporta Excel
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
            >
              ➕ Nuovo Mezzo
            </button>
          </div>
        </div>

        {/* Stats Cards - Cliccabili */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
          <StatCard
            icon="🚛"
            bg="bg-slate-50"
            border="border-slate-200"
            value={stats.total}
            label="Totale"
            onClick={() => setShowStatsModal('total')}
          />
          <StatCard
            icon="✅"
            bg="bg-green-50"
            border="border-green-200"
            value={stats.unassigned}
            label="Da Assegnare"
            onClick={() => setShowStatsModal('unassigned')}
          />
          <StatCard
            icon="👷"
            bg="bg-blue-50"
            border="border-blue-200"
            value={stats.assigned}
            label="Assegnati"
            onClick={() => setShowStatsModal('assigned')}
          />
          <StatCard
            icon="📅"
            bg="bg-amber-50"
            border="border-amber-200"
            value={stats.maintenanceSoon}
            label="Pross. Manut."
            sub="entro 7 giorni"
            onClick={() => setShowStatsModal('maintenanceSoon')}
          />
          <StatCard
            icon="🚫"
            bg="bg-red-50"
            border="border-red-200"
            value={stats.unavailable}
            label="Non Disponibili"
            onClick={() => setShowStatsModal('unavailable')}
          />
          <StatCard
            icon="🔧"
            bg="bg-orange-50"
            border="border-orange-200"
            value={stats.inMaintenance}
            label="In Manutenzione"
            onClick={() => setShowStatsModal('inMaintenance')}
          />
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
              placeholder="Cerca per tag, descrizione, targa..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">Tutti i tipi</option>
            {usedTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">Tutti gli stati</option>
            {EQUIPMENT_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
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
                <th className="text-left p-3 font-medium">Tag</th>
                <th className="text-left p-3 font-medium">Tipo</th>
                <th className="text-left p-3 font-medium">Descrizione</th>
                <th className="text-center p-3 font-medium">Targa</th>
                <th className="text-center p-3 font-medium">Stato</th>
                <th className="text-center p-3 font-medium">Azienda</th>
                <th className="text-center p-3 font-medium">Pross. Manut.</th>
                <th className="text-center p-3 font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipment.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    Nessun mezzo trovato
                  </td>
                </tr>
              ) : (
                filteredEquipment.map(item => {
                  const status = EQUIPMENT_STATUSES.find(s => s.value === item.status) || EQUIPMENT_STATUSES[0];
                  const company = companies.find(c => c.id === item.company_id);
                  const isMaintenanceSoon = item.next_maintenance_date && 
                    new Date(item.next_maintenance_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                  return (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-mono font-medium text-blue-600">{item.tag}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">{item.equipment_type}</span>
                      </td>
                      <td className="p-3 text-gray-600 max-w-[200px] truncate">{item.description}</td>
                      <td className="p-3 text-center font-mono text-xs">{item.license_plate || '—'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.icon} {status.label}
                        </span>
                      </td>
                      <td className="p-3 text-center text-xs">{company?.name || '—'}</td>
                      <td className="p-3 text-center">
                        {item.next_maintenance_date ? (
                          <span className={`text-xs ${isMaintenanceSoon ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                            {isMaintenanceSoon && '⚠️ '}
                            {new Date(item.next_maintenance_date).toLocaleDateString('it-IT')}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 hover:bg-red-100 rounded text-red-600 ml-1"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <EquipmentModal
          companies={companies}
          onSave={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingItem && (
        <EquipmentModal
          item={editingItem}
          companies={companies}
          onSave={(data) => handleUpdate(editingItem.id, data)}
          onClose={() => setEditingItem(null)}
        />
      )}

      {showStatsModal && (
        <StatsPopupModal
          title={getStatTitle(showStatsModal)}
          items={getFilteredByStats(showStatsModal)}
          companies={companies}
          onClose={() => setShowStatsModal(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// HELPER
// ============================================================================

const getStatTitle = (type) => {
  const titles = {
    total: '🚛 Tutti i Mezzi',
    unassigned: '✅ Mezzi da Assegnare',
    assigned: '👷 Mezzi Assegnati',
    maintenanceSoon: '📅 Manutenzione entro 7 giorni',
    unavailable: '🚫 Mezzi Non Disponibili',
    inMaintenance: '🔧 Mezzi in Manutenzione'
  };
  return titles[type] || 'Mezzi';
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const StatCard = ({ icon, bg, border, value, label, sub, onClick }) => (
  <div
    onClick={onClick}
    className={`${bg} rounded-lg p-4 border ${border} cursor-pointer hover:shadow-md transition-shadow`}
  >
    <div className="flex items-center gap-2">
      <span className="text-xl">{icon}</span>
      <div>
        <div className="text-2xl font-bold text-gray-700">{value}</div>
        <div className="text-xs text-gray-600">{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  </div>
);

// Stats Popup Modal
const StatsPopupModal = ({ title, items, companies, onClose }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
      <div className="p-6 border-b flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        <span className="text-sm text-gray-500">{items.length} elementi</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Nessun elemento</p>
        ) : (
          <div className="space-y-2">
            {items.map(item => {
              const status = EQUIPMENT_STATUSES.find(s => s.value === item.status) || EQUIPMENT_STATUSES[0];
              const company = companies.find(c => c.id === item.company_id);
              return (
                <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-blue-600">{item.tag}</div>
                    <div className="text-sm text-gray-500">{item.equipment_type} {item.description && `- ${item.description}`}</div>
                  </div>
                  <div className="text-xs text-gray-400">{company?.name}</div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                    {status.icon} {status.label}
                  </span>
                  {item.next_maintenance_date && (
                    <span className="text-xs text-amber-600">
                      🔧 {new Date(item.next_maintenance_date).toLocaleDateString('it-IT')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="p-4 border-t bg-gray-50">
        <button onClick={onClose} className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
          Chiudi
        </button>
      </div>
    </div>
  </div>
);

// Equipment Add/Edit Modal
const EquipmentModal = ({ item, companies, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    tag: item?.tag || '',
    equipment_type: item?.equipment_type || '',
    description: item?.description || '',
    license_plate: item?.license_plate || '',
    model: item?.model || '',
    status: item?.status || 'available',
    company_id: item?.company_id || '',
    next_maintenance_date: item?.next_maintenance_date || '',
    notes: item?.notes || ''
  });

  const [selectedCategory, setSelectedCategory] = useState('');

  const handleSubmit = () => {
    if (!formData.tag || !formData.equipment_type) {
      alert('Compila i campi obbligatori: Tag e Tipo');
      return;
    }
    onSave({
      ...formData,
      company_id: formData.company_id || null,
      next_maintenance_date: formData.next_maintenance_date || null
    });
  };

  const typesForCategory = selectedCategory 
    ? EQUIPMENT_CATEGORIES[selectedCategory] || []
    : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-800">
            {item ? `✏️ Modifica: ${item.tag}` : '➕ Nuovo Mezzo'}
          </h2>
        </div>
        <div className="p-6 space-y-4">
          {/* Tag */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tag / Codice *</label>
            <input
              type="text"
              value={formData.tag}
              onChange={e => setFormData({...formData, tag: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Es: GRU-001, ESC-003"
            />
          </div>

          {/* Categoria + Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select
                value={selectedCategory}
                onChange={e => {
                  setSelectedCategory(e.target.value);
                  setFormData({...formData, equipment_type: ''});
                }}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">-- Seleziona --</option>
                {Object.keys(EQUIPMENT_CATEGORIES).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              {selectedCategory ? (
                <select
                  value={formData.equipment_type}
                  onChange={e => setFormData({...formData, equipment_type: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">-- Seleziona --</option>
                  {typesForCategory.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.equipment_type}
                  onChange={e => setFormData({...formData, equipment_type: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Oppure scrivi direttamente"
                />
              )}
            </div>
          </div>

          {/* Descrizione */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
            <input
              type="text"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Descrizione aggiuntiva"
            />
          </div>

          {/* Targa + Modello */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Targa</label>
              <input
                type="text"
                value={formData.license_plate}
                onChange={e => setFormData({...formData, license_plate: e.target.value.toUpperCase()})}
                className="w-full px-3 py-2 border rounded-lg font-mono"
                placeholder="AA123BB"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modello</label>
              <input
                type="text"
                value={formData.model}
                onChange={e => setFormData({...formData, model: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Caterpillar 320"
              />
            </div>
          </div>

          {/* Stato + Azienda */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
              <select
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {EQUIPMENT_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Azienda</label>
              <select
                value={formData.company_id}
                onChange={e => setFormData({...formData, company_id: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">-- Nessuna --</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Data Prossima Manutenzione */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prossima Manutenzione</label>
            <input
              type="date"
              value={formData.next_maintenance_date}
              onChange={e => setFormData({...formData, next_maintenance_date: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Note aggiuntive..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">
            Annulla
          </button>
          <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            ✓ Salva
          </button>
        </div>
      </div>
    </div>
  );
};
