import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, Code, Palette, Eye, MessageSquare, Plus, Trash2, GripVertical, ToggleLeft, ToggleRight, ClipboardList } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const COLORS = [
  { value: '#6366f1', label: 'Índigo' },
  { value: '#8b5cf6', label: 'Violeta' },
  { value: '#0ea5e9', label: 'Celeste' },
  { value: '#10b981', label: 'Esmeralda' },
  { value: '#f59e0b', label: 'Ámbar' },
  { value: '#ef4444', label: 'Rojo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#1e293b', label: 'Oscuro' },
];

const DEFAULT_FIELDS = [
  { key: 'name',  label: 'Nombre',   type: 'text',  placeholder: 'Tu nombre completo', required: true,  enabled: true },
  { key: 'email', label: 'Correo',   type: 'email', placeholder: 'tu@correo.com',      required: true,  enabled: true },
  { key: 'phone', label: 'Teléfono', type: 'tel',   placeholder: '+1 809 000 0000',    required: false, enabled: true },
];

const Toggle = ({ checked, onChange, size = 'md' }) => {
  const w = size === 'sm' ? 'w-8 h-4' : 'w-10 h-5';
  const dot = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const translate = size === 'sm' ? 'translateX(16px)' : 'translateX(20px)';
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative inline-flex flex-shrink-0 ${w} rounded-full transition-colors duration-200`}
      style={{ background: checked ? '#6366f1' : '#e2e8f0' }}>
      <span className={`absolute top-0.5 left-0.5 ${dot} bg-white rounded-full shadow transition-transform duration-200`}
        style={{ transform: checked ? translate : 'translateX(0)' }} />
    </button>
  );
};

export default function WidgetsConfig() {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('Te respondemos al instante');
  const [position, setPosition] = useState('right');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preFormEnabled, setPreFormEnabled] = useState(true);
  const [preFormTitle, setPreFormTitle] = useState('Antes de comenzar');
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/company');
        if (res.success && res.data) {
          setCompanyId(res.data.id);
          setCompanyName(res.data.nombre);
          setTitle(res.data.nombre || 'Chat con nosotros');
        }
      } catch { }
      setLoading(false);
    };
    load();
  }, []);

  const toggleField = (idx) => {
    setFields(f => f.map((field, i) => i === idx ? { ...field, enabled: !field.enabled } : field));
  };

  const toggleRequired = (idx) => {
    setFields(f => f.map((field, i) => i === idx ? { ...field, required: !field.required } : field));
  };

  const removeField = (idx) => {
    setFields(f => f.filter((_, i) => i !== idx));
  };

  const addField = () => {
    if (!newFieldLabel.trim()) return toast.error('El nombre del campo es obligatorio');
    const key = newFieldLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (fields.some(f => f.key === key)) return toast.error('Ya existe un campo con ese identificador');
    setFields(f => [...f, { key, label: newFieldLabel.trim(), type: newFieldType, placeholder: '', required: false, enabled: true }]);
    setNewFieldLabel('');
    setNewFieldType('text');
  };

  const API_BASE = 'https://app.tecnossync.com.do';

  const enabledFields = fields.filter(f => f.enabled);
  const fieldsJson = JSON.stringify(enabledFields.map(f => ({ key: f.key, label: f.label, type: f.type, placeholder: f.placeholder, required: f.required })));

  const scriptCode = `<script>
  window.TecnoSyncWidget = {
    companyId: '${companyId}',
    server: '${API_BASE}/api',
    title: '${title || companyName}',
    subtitle: '${subtitle}',
    color: '${color}',
    position: '${position}'${preFormEnabled && enabledFields.length > 0 ? `,
    preForm: {
      enabled: true,
      title: '${preFormTitle}',
      fields: ${fieldsJson}
    }` : ''}
  };
</script>
<script src="${API_BASE}/widget.js"></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    toast.success('Código copiado al portapapeles');
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: '#94a3b8' }}>
        Cargando...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#fff', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>

      {/* Topbar */}
      <div className="flex items-center justify-between px-8 py-4 flex-shrink-0" style={{ borderBottom: '0.5px solid #e2e8f0' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/config')} className="flex items-center gap-1.5 text-sm" style={{ color: '#94a3b8' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            Configuración
          </button>
          <span style={{ color: '#cbd5e1' }}>›</span>
          <span className="text-sm font-medium">Widget de Chat Web</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-3xl">

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              <MessageSquare size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Widget de Chat</h2>
              <p className="text-sm" style={{ color: '#94a3b8' }}>Agrega un chat en vivo a tu sitio web. Los mensajes llegan al inbox de la plataforma.</p>
            </div>
          </div>

          {/* Personalización */}
          <div className="mb-8 pb-8" style={{ borderBottom: '0.5px solid #e2e8f0' }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>
              <Palette size={12} className="inline mr-1.5" />
              Personalización
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: '#64748b' }}>Título del widget</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Chat con nosotros"
                  className="rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0' }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: '#64748b' }}>Subtítulo</label>
                <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Te respondemos al instante"
                  className="rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0' }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: '#64748b' }}>Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => setColor(c.value)} title={c.label}
                      className="w-8 h-8 rounded-lg transition-all"
                      style={{
                        background: c.value,
                        border: color === c.value ? '2.5px solid #0f172a' : '2px solid transparent',
                        transform: color === c.value ? 'scale(1.15)' : 'scale(1)',
                      }} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: '#64748b' }}>Posición</label>
                <div className="flex gap-2">
                  {['right', 'left'].map(p => (
                    <button key={p} onClick={() => setPosition(p)}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: position === p ? '#6366f1' : '#f8fafc',
                        color: position === p ? '#fff' : '#64748b',
                        border: `0.5px solid ${position === p ? '#6366f1' : '#e2e8f0'}`,
                      }}>
                      {p === 'right' ? 'Derecha' : 'Izquierda'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Formulario pre-chat */}
          <div className="mb-8 pb-8" style={{ borderBottom: '0.5px solid #e2e8f0' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                <ClipboardList size={12} className="inline mr-1.5" />
                Formulario pre-chat
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: preFormEnabled ? '#6366f1' : '#94a3b8' }}>
                  {preFormEnabled ? 'Activado' : 'Desactivado'}
                </span>
                <Toggle checked={preFormEnabled} onChange={setPreFormEnabled} />
              </div>
            </div>

            {preFormEnabled && (
              <>
                <p className="text-sm mb-4" style={{ color: '#64748b' }}>
                  El visitante debe completar estos campos antes de iniciar el chat.
                </p>

                <div className="flex flex-col gap-1.5 mb-4" style={{ maxWidth: 320 }}>
                  <label className="text-xs font-medium" style={{ color: '#64748b' }}>Título del formulario</label>
                  <input value={preFormTitle} onChange={e => setPreFormTitle(e.target.value)} placeholder="Antes de comenzar"
                    className="rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0' }}
                    onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>

                {/* Lista de campos */}
                <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid #e2e8f0' }}>
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_100px_80px_80px_40px] gap-0 px-4 py-2" style={{ background: '#f8fafc', borderBottom: '0.5px solid #e2e8f0' }}>
                    <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>Campo</span>
                    <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>Tipo</span>
                    <span className="text-xs font-medium text-center" style={{ color: '#94a3b8' }}>Requerido</span>
                    <span className="text-xs font-medium text-center" style={{ color: '#94a3b8' }}>Activo</span>
                    <span></span>
                  </div>
                  {fields.map((field, idx) => (
                    <div key={field.key}
                      className="grid grid-cols-[1fr_100px_80px_80px_40px] gap-0 px-4 py-3 items-center"
                      style={{ borderBottom: '0.5px solid #f1f5f9', opacity: field.enabled ? 1 : 0.5 }}>
                      <div className="flex items-center gap-2">
                        <GripVertical size={12} style={{ color: '#cbd5e1' }} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: field.enabled ? '#0f172a' : '#94a3b8' }}>{field.label}</p>
                          <p className="text-xs" style={{ color: '#cbd5e1' }}>{field.key}</p>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: '#64748b' }}>{field.type}</span>
                      <div className="flex justify-center">
                        <Toggle checked={field.required} onChange={() => toggleRequired(idx)} size="sm" />
                      </div>
                      <div className="flex justify-center">
                        <Toggle checked={field.enabled} onChange={() => toggleField(idx)} size="sm" />
                      </div>
                      <div className="flex justify-center">
                        {!['name', 'email', 'phone'].includes(field.key) && (
                          <button onClick={() => removeField(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Agregar campo */}
                  <div className="flex items-center gap-2 px-4 py-3" style={{ background: '#fafbfc' }}>
                    <input value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} placeholder="Nombre del campo"
                      className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: '#fff', border: '0.5px solid #e2e8f0' }}
                      onKeyDown={e => e.key === 'Enter' && addField()} />
                    <select value={newFieldType} onChange={e => setNewFieldType(e.target.value)}
                      className="rounded-lg px-2 py-2 text-sm outline-none" style={{ background: '#fff', border: '0.5px solid #e2e8f0', color: '#64748b' }}>
                      <option value="text">Texto</option>
                      <option value="email">Correo</option>
                      <option value="tel">Teléfono</option>
                      <option value="number">Número</option>
                      <option value="url">URL</option>
                    </select>
                    <button onClick={addField}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{ background: '#eef2ff', color: '#6366f1', border: '0.5px solid #c7d2fe' }}>
                      <Plus size={13} /> Agregar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Código */}
          <div className="mb-8 pb-8" style={{ borderBottom: '0.5px solid #e2e8f0' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                <Code size={12} className="inline mr-1.5" />
                Código de integración
              </h3>
              <button onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: copied ? '#ecfdf5' : '#eef2ff', color: copied ? '#059669' : '#6366f1', border: `0.5px solid ${copied ? '#a7f3d0' : '#c7d2fe'}` }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar código'}
              </button>
            </div>
            <p className="text-sm mb-3" style={{ color: '#64748b' }}>
              Pega este código antes de <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>&lt;/body&gt;</code> en tu sitio web:
            </p>
            <div className="rounded-xl overflow-hidden" style={{ background: '#0f172a', border: '1px solid #334155' }}>
              <pre className="p-4 text-sm overflow-x-auto" style={{ color: '#a5b4fc', fontFamily: 'monospace', margin: 0, lineHeight: 1.6 }}>
                {scriptCode}
              </pre>
            </div>
          </div>

          {/* Preview */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>
              <Eye size={12} className="inline mr-1.5" />
              Vista previa
            </h3>
            <div className="rounded-xl overflow-hidden relative" style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0', height: preFormEnabled ? 520 : 400 }}>
              <div className="p-6">
                <div className="h-4 w-32 rounded" style={{ background: '#e2e8f0' }} />
                <div className="mt-4 h-3 w-full rounded" style={{ background: '#e2e8f0' }} />
                <div className="mt-2 h-3 w-3/4 rounded" style={{ background: '#e2e8f0' }} />
                <div className="mt-2 h-3 w-5/6 rounded" style={{ background: '#e2e8f0' }} />
              </div>
              {/* Widget button */}
              <div className="absolute bottom-4" style={{ [position]: 20 }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg" style={{ background: color }}>
                  <MessageSquare size={24} className="text-white" />
                </div>
              </div>
              {/* Chat preview */}
              <div className="absolute bottom-20 w-80" style={{ [position]: 20 }}>
                <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: '#0f172a' }}>
                  <div className="p-4 flex items-center gap-3" style={{ background: color }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,.2)' }}>
                      <span className="text-white text-sm">💬</span>
                    </div>
                    <div>
                      <p className="text-white text-xs font-bold">{title || companyName}</p>
                      <p className="text-white/70 text-[10px]">{subtitle}</p>
                    </div>
                  </div>
                  {preFormEnabled && enabledFields.length > 0 ? (
                    <div className="p-4">
                      <p className="text-xs font-semibold text-slate-300 mb-3">{preFormTitle}</p>
                      {enabledFields.map(f => (
                        <div key={f.key} className="mb-2">
                          <label className="text-[10px] text-slate-500 mb-0.5 block">
                            {f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}
                          </label>
                          <div className="rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: '#1e293b', border: '1px solid #334155', color: '#475569' }}>
                            {f.placeholder || f.label}
                          </div>
                        </div>
                      ))}
                      <div className="mt-3 rounded-lg py-1.5 text-center text-[11px] font-semibold text-white" style={{ background: color }}>
                        Iniciar chat
                      </div>
                    </div>
                  ) : (
                    <div className="p-3">
                      <div className="text-xs px-3 py-2 rounded-xl" style={{ background: '#1e293b', color: '#e2e8f0', maxWidth: '80%' }}>
                        ¡Hola! 👋 ¿En qué te podemos ayudar?
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
