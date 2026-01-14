import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ============================================================================
// PROJECT WORKING DAYS CONFIGURATION
// Aggiungi questo componente alla pagina impostazioni progetto
// ============================================================================

export default function WorkingDaysConfig({ projectId, onUpdate }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    working_days: {
      mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false
    },
    hours_per_day: 8,
    working_hours_start: '08:00',
    working_hours_end: '17:00'
  });

  const dayLabels = {
    mon: 'Lunedì',
    tue: 'Martedì', 
    wed: 'Mercoledì',
    thu: 'Giovedì',
    fri: 'Venerdì',
    sat: 'Sabato',
    sun: 'Domenica'
  };

  useEffect(() => {
    if (projectId) fetchConfig();
  }, [projectId]);

  const fetchConfig = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('working_days, hours_per_day, working_hours_start, working_hours_end')
      .eq('id', projectId)
      .single();
    
    if (error) {
      console.error('Error fetching working days config:', error);
    } else if (data) {
      setConfig({
        working_days: data.working_days || config.working_days,
        hours_per_day: data.hours_per_day || 8,
        working_hours_start: data.working_hours_start || '08:00',
        working_hours_end: data.working_hours_end || '17:00'
      });
    }
    setLoading(false);
  };

  const handleDayToggle = (day) => {
    setConfig(prev => ({
      ...prev,
      working_days: {
        ...prev.working_days,
        [day]: !prev.working_days[day]
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          working_days: config.working_days,
          hours_per_day: Number(config.hours_per_day),
          working_hours_start: config.working_hours_start,
          working_hours_end: config.working_hours_end,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
      
      if (error) throw error;
      
      if (onUpdate) onUpdate(config);
      alert('Configurazione salvata!');
    } catch (error) {
      alert('Errore: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Calcola giorni lavorativi a settimana
  const workingDaysCount = Object.values(config.working_days).filter(Boolean).length;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="animate-pulse h-32 bg-gray-100 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          📅 Configurazione Giorni Lavorativi
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Imposta i giorni e gli orari di lavoro per questo progetto
        </p>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Giorni della settimana */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Giorni Lavorativi
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(dayLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleDayToggle(key)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  config.working_days[key]
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {label.substring(0, 3)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {workingDaysCount} giorni lavorativi a settimana
          </p>
        </div>

        {/* Ore per giorno */}
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ore per Giorno
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="24"
                step="0.5"
                value={config.hours_per_day}
                onChange={(e) => setConfig({...config, hours_per_day: e.target.value})}
                className="w-24 px-3 py-2 border rounded-lg"
              />
              <span className="text-gray-500">ore</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Orario Inizio
            </label>
            <input
              type="time"
              value={config.working_hours_start}
              onChange={(e) => setConfig({...config, working_hours_start: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Orario Fine
            </label>
            <input
              type="time"
              value={config.working_hours_end}
              onChange={(e) => setConfig({...config, working_hours_end: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        {/* Riepilogo */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">📊 Riepilogo Settimanale</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-600">Giorni/Settimana:</span>
              <span className="font-bold text-blue-800 ml-2">{workingDaysCount}</span>
            </div>
            <div>
              <span className="text-blue-600">Ore/Giorno:</span>
              <span className="font-bold text-blue-800 ml-2">{config.hours_per_day}</span>
            </div>
            <div>
              <span className="text-blue-600">Ore/Settimana:</span>
              <span className="font-bold text-blue-800 ml-2">{(workingDaysCount * config.hours_per_day).toFixed(1)}</span>
            </div>
            <div>
              <span className="text-blue-600">Orario:</span>
              <span className="font-bold text-blue-800 ml-2">{config.working_hours_start} - {config.working_hours_end}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
        <button
          onClick={fetchConfig}
          className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
        >
          ↻ Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Salvataggio...' : '✓ Salva Configurazione'}
        </button>
      </div>
    </div>
  );
}
