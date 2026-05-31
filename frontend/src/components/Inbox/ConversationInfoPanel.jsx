// frontend/src/components/Inbox/ConversationInfoPanel.jsx
import { useState, useEffect } from 'react';
import {
  User, Phone, Mail, MessageSquare, Calendar, Clock,
  Bot, UserCheck, ChevronDown, ChevronUp, RefreshCw,
  Edit2, Check, X, Plus, Trash2, Hash
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ─── Campo editable ──────────────────────────────────────────
function EditableField({ label, value, onSave, icon: Icon }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value || '');

  useEffect(() => setVal(value || ''), [value]);

  const save = () => { onSave(val); setEditing(false); };

  return (
    <div className="group">
      <span className="flex items-center gap-1 text-xs text-slate-400 mb-0.5">
        {Icon && <Icon size={10} strokeWidth={1.5} />}
        {label}
      </span>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className="flex-1 text-sm border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
          />
          <button onClick={save} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={12} /></button>
          <button onClick={() => setEditing(false)} className="p-1 text-red-400 hover:bg-red-50 rounded"><X size={12} /></button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className={`text-sm ${value ? 'text-slate-800 font-medium' : 'text-slate-300 italic'}`}>
            {value || 'Sin datos'}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-all"
          >
            <Edit2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sección colapsable ──────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {Icon && <Icon size={12} strokeWidth={2} />}
          {title}
        </span>
        {open ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Fila de info (solo lectura) ─────────────────────────────
function InfoRow({ label, value, mono = false }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-slate-400 flex-shrink-0">{label}</span>
      <span className={`text-xs text-slate-700 font-medium text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────
export default function ConversationInfoPanel({ conversation }) {
  const [contact, setContact]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [addingField, setAddingField] = useState(false);
  const [newField, setNewField]       = useState({ label: '', value: '' });

  const convId    = conversation?.id;
  const contactId = conversation?.contact_id || conversation?.contact?.id;

  const load = async () => {
    if (!contactId) return;
    try {
      const r = await api.get(`/contacts/${contactId}`);
      if (r.data.success) {
        const c = r.data.data;
        setContact(c);
        setCustomFields(c.metadata?.custom_fields || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setLoading(true); load(); }, [contactId]);

  const handleRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const updateContact = async (field, value) => {
    try {
      const r = await api.patch(`/contacts/${contactId}`, { [field]: value });
      if (r.data.success) { setContact(r.data.data); toast.success('Guardado'); }
    } catch { toast.error('Error al guardar'); }
  };

  const updateMeta = async (key, value) => {
    const meta = { ...(contact?.metadata || {}), [key]: value };
    await updateContact('metadata', meta);
  };

  const saveCustomFields = async (fields) => {
    const meta = { ...(contact?.metadata || {}), custom_fields: fields };
    try {
      const r = await api.patch(`/contacts/${contactId}`, { metadata: meta });
      if (r.data.success) { setContact(r.data.data); setCustomFields(fields); }
    } catch { toast.error('Error al guardar'); }
  };

  const addCustomField = async () => {
    if (!newField.label.trim()) return;
    const fields = [...customFields, { ...newField, id: Date.now() }];
    await saveCustomFields(fields);
    setNewField({ label: '', value: '' });
    setAddingField(false);
  };

  const removeCustomField = async (id) => {
    const fields = customFields.filter(f => f.id !== id);
    await saveCustomFields(fields);
  };

  const updateCustomField = async (id, value) => {
    const fields = customFields.map(f => f.id === id ? { ...f, value } : f);
    await saveCustomFields(fields);
  };

  // ── Datos de la conversación ─────────────────────────────
  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const getDuration = () => {
    if (!conversation?.created_at) return null;
    const start = new Date(conversation.created_at);
    const end   = conversation.assigned_agent_id
      ? new Date(conversation.updated_at)
      : new Date();
    const mins  = Math.floor((end - start) / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  };

  const summary = conversation?.metadata?.summary;
  const summaryDate = conversation?.metadata?.summary_updated_at
    ? formatDate(conversation.metadata.summary_updated_at)
    : null;

  const statusMap = {
    bot:      { label: 'Bot activo',  class: 'bg-violet-100 text-violet-700' },
    open:     { label: 'Sin asignar', class: 'bg-amber-100 text-amber-700'   },
    assigned: { label: 'Asignado',    class: 'bg-blue-100 text-blue-700'     },
    resolved: { label: 'Resuelto',    class: 'bg-green-100 text-green-700'   },
  };
  const statusInfo = statusMap[conversation?.status] || statusMap.open;

  if (!conversation) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
      Selecciona una conversacion
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
      Cargando...
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-white flex flex-col">

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
        <span className="text-sm font-semibold text-slate-700">Informacion</span>
        <button
          onClick={handleRefresh}
          className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* AVATAR + NOMBRE */}
      <div className="px-4 py-4 flex items-center gap-3 border-b border-slate-100 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center font-bold text-indigo-600 text-base flex-shrink-0">
          {contact?.name ? contact.name[0].toUpperCase() : '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 text-sm truncate">
            {contact?.name || 'Cliente sin nombre'}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.class}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* DATOS DE CONTACTO */}
      <Section title="Datos de contacto" icon={User}>
        <EditableField label="Nombre"   value={contact?.name}  onSave={v => updateContact('name', v)}  icon={User} />
        <EditableField label="Telefono" value={contact?.phone} onSave={v => updateContact('phone', v)} icon={Phone} />
        <EditableField label="Correo"   value={contact?.email} onSave={v => updateContact('email', v)} icon={Mail} />
        <EditableField label="Empresa"  value={contact?.metadata?.empresa}  onSave={v => updateMeta('empresa', v)} />
        <EditableField label="Ciudad"   value={contact?.metadata?.ciudad}   onSave={v => updateMeta('ciudad', v)} />
      </Section>

      {/* INFO DE LA CONVERSACION */}
      <Section title="Conversacion" icon={MessageSquare}>
        <InfoRow label="Canal"        value={conversation?.channel?.toUpperCase()} />
        <InfoRow label="Iniciada"     value={formatDate(conversation?.created_at)} />
        <InfoRow label="Duracion"     value={getDuration()} />
        <InfoRow label="Agente"       value={conversation?.assigned_agent?.name} />
        <InfoRow label="Estado"       value={statusInfo.label} />
        <InfoRow label="ID"           value={`#${conversation?.id?.slice(0, 8)}`} mono />
      </Section>

      {/* RESUMEN IA */}
      <Section title="Resumen IA" icon={Bot} defaultOpen={!!summary}>
        {summary ? (
          <div>
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-2.5 border border-slate-100">
              {summary}
            </p>
            {summaryDate && (
              <p className="text-xs text-slate-400 mt-1.5">Actualizado: {summaryDate}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">
            El resumen se genera automaticamente cada 15 mensajes.
          </p>
        )}
      </Section>

      {/* CAMPOS PERSONALIZADOS */}
      <Section title="Campos adicionales" icon={Hash} defaultOpen={customFields.length > 0}>
        {customFields.map(field => (
          <div key={field.id} className="group">
            <span className="text-xs text-slate-400">{field.label}</span>
            <div className="flex items-center gap-1">
              <EditableField
                label=""
                value={field.value}
                onSave={v => updateCustomField(field.id, v)}
              />
              <button
                onClick={() => removeCustomField(field.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-50 rounded flex-shrink-0 transition-all"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}

        {addingField ? (
          <div className="space-y-2 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
            <input
              autoFocus
              placeholder="Nombre del campo (ej: Vehiculo)"
              value={newField.label}
              onChange={e => setNewField(f => ({ ...f, label: e.target.value }))}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
            />
            <input
              placeholder="Valor"
              value={newField.value}
              onChange={e => setNewField(f => ({ ...f, value: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addCustomField()}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
            />
            <div className="flex gap-1.5">
              <button onClick={addCustomField} className="flex-1 text-xs bg-indigo-600 text-white rounded-lg py-1.5 font-medium hover:bg-indigo-700 transition-colors">
                Agregar
              </button>
              <button onClick={() => { setAddingField(false); setNewField({ label: '', value: '' }); }}
                className="flex-1 text-xs bg-slate-100 text-slate-600 rounded-lg py-1.5 font-medium hover:bg-slate-200 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingField(true)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 border border-dashed border-indigo-200 hover:border-indigo-400 rounded-lg py-2 transition-colors hover:bg-indigo-50"
          >
            <Plus size={12} /> Agregar campo
          </button>
        )}
      </Section>

    </div>
  );
}