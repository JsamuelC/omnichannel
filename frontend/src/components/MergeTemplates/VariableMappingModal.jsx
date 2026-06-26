import React, { useState } from 'react';
import { useMergeTemplateStore } from '../../store';
import toast from 'react-hot-toast';

const SOURCE_OPTIONS = [
  { value: 'contact',      label: 'Contacto',     desc: 'name, phone, email del perfil' },
  { value: 'chatbot',      label: 'Chatbot',       desc: 'Datos recopilados por el bot' },
  { value: 'system',       label: 'Sistema',       desc: 'Fecha, hora automatica' },
  { value: 'conversation', label: 'Conversacion',  desc: 'Metadata de la conversacion' },
  { value: 'static',       label: 'Valor fijo',    desc: 'Un valor constante' },
];

const SOURCE_COLORS = {
  contact:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  chatbot:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  system:       'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  conversation: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  static:       'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const CONTACT_FIELDS = [
  { value: 'name', label: 'Nombre' },
  { value: 'phone', label: 'Telefono' },
  { value: 'email', label: 'Email' },
];

const SYSTEM_FIELDS = [
  { value: 'date', label: 'Fecha actual' },
  { value: 'time', label: 'Hora actual' },
];

export default function VariableMappingModal({ template, onClose, onSaved }) {
  const { updateMapping, updateTemplate } = useMergeTemplateStore();
  const [mapping, setMapping] = useState(template.variable_mapping || {});
  const [autoMerge, setAutoMerge] = useState(template.auto_merge || false);
  const [saving, setSaving] = useState(false);

  const variables = template.variables || [];

  const updateVar = (variable, field, value) => {
    setMapping(prev => ({
      ...prev,
      [variable]: { ...prev[variable], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMapping(template.id, mapping);
      if (autoMerge !== template.auto_merge) {
        await updateTemplate(template.id, { auto_merge: autoMerge });
      }
      toast.success('Mapeo guardado');
      onSaved();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const getFieldOptions = (source) => {
    if (source === 'contact') return CONTACT_FIELDS;
    if (source === 'system') return SYSTEM_FIELDS;
    return null;
  };

  const chatbotCount = variables.filter(v => (mapping[v]?.source || 'chatbot') === 'chatbot').length;
  const autoCount = variables.length - chatbotCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Mapeo de variables</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{template.nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{variables.length}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Variables</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{autoCount}</p>
              <p className="text-[10px] text-green-600 dark:text-green-400 uppercase tracking-wider">Auto-resolubles</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{chatbotCount}</p>
              <p className="text-[10px] text-purple-600 dark:text-purple-400 uppercase tracking-wider">Via chatbot</p>
            </div>
          </div>

          {/* Auto-merge toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border-2 border-dashed border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">Merge automatico</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Generar resultado automaticamente al completar recoleccion del chatbot</p>
            </div>
            <button onClick={() => setAutoMerge(!autoMerge)}
              className={`relative w-12 h-6 rounded-full transition-colors ${autoMerge ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoMerge ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Flow diagram */}
          <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Flujo de datos</p>
            <div className="flex items-center justify-center gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium">Chatbot recopila</span>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              <span className="px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium">Mapeo automatico</span>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              <span className="px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">Mensaje generado</span>
            </div>
          </div>

          {/* Variable mappings */}
          {variables.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Esta plantilla no tiene variables</p>
          ) : (
            <div className="space-y-2">
              {variables.map((v) => {
                const m = mapping[v] || { source: 'chatbot', field: v };
                const fieldOpts = getFieldOptions(m.source);
                return (
                  <div key={v} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-sm transition-shadow">
                    <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 min-w-[130px]">{`{${v}}`}</span>
                    <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    <select value={m.source} onChange={(e) => {
                      const s = e.target.value;
                      updateVar(v, 'source', s);
                      updateVar(v, 'field', s === 'contact' ? 'name' : s === 'system' ? 'date' : v);
                    }}
                      className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                      {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    {fieldOpts ? (
                      <select value={m.field} onChange={(e) => updateVar(v, 'field', e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200">
                        {fieldOpts.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    ) : m.source === 'static' ? (
                      <input value={m.value || ''} onChange={(e) => updateVar(v, 'value', e.target.value)}
                        placeholder="Valor fijo..."
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200" />
                    ) : (
                      <input value={m.field || v} onChange={(e) => updateVar(v, 'field', e.target.value)}
                        placeholder="Campo..."
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200" />
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${SOURCE_COLORS[m.source] || SOURCE_COLORS.chatbot}`}>
                      {SOURCE_OPTIONS.find(s => s.value === m.source)?.label || m.source}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl shadow-sm">
            {saving ? 'Guardando...' : 'Guardar mapeo'}
          </button>
        </div>
      </div>
    </div>
  );
}
