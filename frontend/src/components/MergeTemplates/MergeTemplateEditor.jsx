import React, { useState, useEffect } from 'react';
import { useMergeTemplateStore } from '../../store';
import toast from 'react-hot-toast';

const VARIABLE_REGEX = /\{([a-z0-9_]+)\}/g;
function extractVariables(text) {
  if (!text) return [];
  const m = new Set();
  let r;
  while ((r = VARIABLE_REGEX.exec(text)) !== null) m.add(r[1]);
  return Array.from(m);
}

const CHANNELS = [
  { value: 'all',               label: 'Todos los canales' },
  { value: 'whatsapp',          label: 'WhatsApp Personal' },
  { value: 'whatsapp_business', label: 'WhatsApp Business' },
  { value: 'messenger',         label: 'Messenger' },
  { value: 'instagram',         label: 'Instagram' },
  { value: 'email',             label: 'Email' },
  { value: 'sms',               label: 'SMS' },
];

const QUICK_VARS = [
  { key: 'nombre_cliente', label: 'Nombre' },
  { key: 'telefono',       label: 'Telefono' },
  { key: 'email',          label: 'Email' },
  { key: 'numero_ticket',  label: 'Ticket' },
  { key: 'numero_pedido',  label: 'Pedido' },
  { key: 'fecha',          label: 'Fecha' },
];

const SOURCE_OPTIONS = [
  { value: 'contact',      label: 'Contacto',     desc: 'Datos del perfil del contacto' },
  { value: 'chatbot',      label: 'Chatbot',       desc: 'Recopilado por el bot en la conversacion' },
  { value: 'system',       label: 'Sistema',       desc: 'Fecha, hora y datos automaticos' },
  { value: 'conversation', label: 'Conversacion',  desc: 'Metadata de la conversacion' },
  { value: 'static',       label: 'Valor fijo',    desc: 'Un valor constante predefinido' },
];

const SOURCE_COLORS = {
  contact:      'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20',
  chatbot:      'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20',
  system:       'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20',
  conversation: 'border-teal-300 dark:border-teal-600 bg-teal-50 dark:bg-teal-900/20',
  static:       'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700',
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

export default function MergeTemplateEditor({ template, onSaved, onClose }) {
  const { createTemplate, updateTemplate, detectAndMap } = useMergeTemplateStore();
  const isEditing = !!template;

  const [nombre, setNombre]           = useState(template?.nombre || '');
  const [descripcion, setDescripcion] = useState(template?.descripcion || '');
  const [canal, setCanal]             = useState(template?.canal || 'all');
  const [contenido, setContenido]     = useState(template?.contenido || '');
  const [autoMerge, setAutoMerge]     = useState(template?.auto_merge || false);
  const [mapping, setMapping]         = useState(template?.variable_mapping || {});
  const [saving, setSaving]           = useState(false);
  const [detecting, setDetecting]     = useState(false);

  const variables = extractVariables(contenido);

  const insertVar = (key) => setContenido((p) => p + `{${key}}`);

  useEffect(() => {
    if (contenido && variables.length > 0 && Object.keys(mapping).length === 0) {
      handleDetect();
    }
  }, []);

  const handleDetect = async () => {
    if (!contenido.trim()) return;
    setDetecting(true);
    try {
      const res = await detectAndMap(contenido);
      setMapping(res.suggestedMapping || {});
      if (res.requiresChatbot > 0) {
        toast(`${res.requiresChatbot} variable(s) se asignaron al chatbot`, { icon: 'i' });
      }
    } catch (e) {
      const vars = extractVariables(contenido);
      const fallback = {};
      for (const v of vars) fallback[v] = { source: 'chatbot', field: v };
      setMapping(fallback);
    } finally { setDetecting(false); }
  };

  const updateVarMapping = (variable, field, value) => {
    setMapping(prev => ({
      ...prev,
      [variable]: { ...prev[variable], [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!nombre.trim()) return toast.error('El nombre es obligatorio');
    if (!contenido.trim()) return toast.error('El contenido es obligatorio');
    setSaving(true);
    try {
      const data = { nombre, descripcion, canal, contenido, variable_mapping: mapping, auto_merge: autoMerge };
      if (isEditing) { await updateTemplate(template.id, data); toast.success('Actualizada'); }
      else { await createTemplate(data); toast.success('Creada'); }
      onSaved();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const getFieldOptions = (source) => {
    if (source === 'contact') return CONTACT_FIELDS;
    if (source === 'system') return SYSTEM_FIELDS;
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">{isEditing ? 'Editar plantilla' : 'Nueva plantilla auto-merge'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Confirmacion de poliza"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Canal</label>
              <select value={canal} onChange={(e) => setCanal(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500">
                {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Descripcion</label>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Uso o contexto..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* Auto-merge toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border-2 border-dashed border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">Merge automatico</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cuando el chatbot recopile los datos, generar el mensaje automaticamente sin intervencion</p>
            </div>
            <button onClick={() => setAutoMerge(!autoMerge)}
              className={`relative w-12 h-6 rounded-full transition-colors ${autoMerge ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoMerge ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Quick variables */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Variables rapidas <span className="font-normal text-slate-400">(clic para insertar)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_VARS.map((v) => (
                <button key={v.key} onClick={() => insertVar(v.key)}
                  className="px-2.5 py-1 text-xs font-mono rounded-md border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                  {`{${v.key}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Contenido del mensaje *</label>
              {contenido.trim() && (
                <button onClick={handleDetect} disabled={detecting}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors disabled:opacity-50">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  {detecting ? 'Detectando...' : 'Detectar y mapear'}
                </button>
              )}
            </div>
            <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={6}
              placeholder={"Hola {nombre_cliente}, tu cedula {cedula} ha sido verificada..."}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y font-mono" />
          </div>

          {/* Variable mapping */}
          {variables.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mapeo de variables ({variables.length})</h4>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Fuente de datos para cada variable</span>
              </div>
              <div className="space-y-3">
                {variables.map((v) => {
                  const m = mapping[v] || { source: 'chatbot', field: v };
                  const fieldOpts = getFieldOptions(m.source);
                  return (
                    <div key={v} className={`flex items-center gap-3 p-3 rounded-lg border ${SOURCE_COLORS[m.source] || SOURCE_COLORS.chatbot}`}>
                      <span className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 min-w-[140px]">{`{${v}}`}</span>
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      <select value={m.source} onChange={(e) => {
                        const newSource = e.target.value;
                        const defaultField = newSource === 'contact' ? 'name' : newSource === 'system' ? 'date' : v;
                        updateVarMapping(v, 'source', newSource);
                        updateVarMapping(v, 'field', defaultField);
                      }}
                        className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500">
                        {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                      {fieldOpts ? (
                        <select value={m.field} onChange={(e) => updateVarMapping(v, 'field', e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500">
                          {fieldOpts.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      ) : m.source === 'static' ? (
                        <input value={m.value || ''} onChange={(e) => updateVarMapping(v, 'value', e.target.value)}
                          placeholder="Valor fijo..."
                          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500" />
                      ) : (
                        <input value={m.field} onChange={(e) => updateVarMapping(v, 'field', e.target.value)}
                          placeholder="Nombre del campo..."
                          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl shadow-sm">
            {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}
