// frontend/src/components/Team/TeamPanel.jsx
// Gestión del equipo con perfil profesional completo
import React, { useEffect, useState } from 'react';
import {
  User, Mail, Lock, Phone, Smartphone, Globe, Clock, Calendar,
  Briefcase, Shield, UserCheck, Hash, ChevronDown, ChevronUp,
  Plus, Trash2, Edit2, KeyRound, ToggleLeft, ToggleRight, Loader2, X,
} from 'lucide-react';
import { useTeamStore, useAuthStore } from '../../store';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────
const AVATAR_COLORS = [
  'from-indigo-400 to-violet-500', 'from-cyan-400 to-blue-500',
  'from-emerald-400 to-teal-500',  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
];
const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const initials    = (name = '') => name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

const IDIOMAS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
  { value: 'fr', label: 'Français' },
];

const ZONAS = [
  'America/Santo_Domingo', 'America/New_York', 'America/Chicago',
  'America/Denver',        'America/Los_Angeles', 'America/Bogota',
  'America/Lima',          'America/Santiago',    'America/Sao_Paulo',
  'America/Mexico_City',   'America/Buenos_Aires','Europe/Madrid',
  'Europe/London',         'UTC',
];

const GENEROS = [
  { value: 'masculino',       label: 'Masculino'         },
  { value: 'femenino',        label: 'Femenino'          },
  { value: 'no_binario',      label: 'No binario'        },
  { value: 'prefiero_no_decir', label: 'Prefiero no decir' },
];

const ROLES = [
  { value: 'agent',      label: 'Agente',          desc: 'Solo accede a sus conversaciones asignadas.' },
  { value: 'supervisor', label: 'Supervisor',       desc: 'Ve las conversaciones de su equipo.' },
  { value: 'admin',      label: 'Administrador',   desc: 'Acceso total a configuración y equipo.' },
];

// ── Campos de formulario compartidos ─────────────────────────
function Field({ label, icon, required, children, hint }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--db-text)' }}>
        {icon && React.cloneElement(icon, { size: 11 })}
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--db-text-muted)' }}>{hint}</p>}
    </div>
  );
}

function Input({ icon, ...props }) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none" style={{ color: 'var(--db-text-muted)' }}>
          {React.cloneElement(icon, { size: 14 })}
        </div>
      )}
      <input
        {...props}
        className={`w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all ${icon ? 'pl-9' : ''}`}
        style={{ background: 'var(--ts-input-bg)', border: '1px solid var(--ts-input-border)', color: 'var(--db-text-strong)' }}
      />
    </div>
  );
}

function Select({ icon, children, ...props }) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none" style={{ color: 'var(--db-text-muted)' }}>
          {React.cloneElement(icon, { size: 14 })}
        </div>
      )}
      <select
        {...props}
        className={`w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none ${icon ? 'pl-9' : ''}`}
        style={{ background: 'var(--ts-input-bg)', border: '1px solid var(--ts-input-border)', color: 'var(--db-text-strong)' }}
      >
        {children}
      </select>
    </div>
  );
}

// ── Sección colapsable dentro del formulario ──────────────────
function Section({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--db-card-border)' }}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{ background: 'var(--db-bg)' }}>
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--db-text)' }}>
          {React.cloneElement(icon, { size: 13, className: 'text-indigo-500' })}
          {title}
        </span>
        {open ? <ChevronUp size={14} style={{ color: 'var(--db-text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--db-text-muted)' }} />}
      </button>
      {open && <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>}
    </div>
  );
}

// ── Modal genérico ────────────────────────────────────────────
function Modal({ title, onClose, wide = false, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} mb-10`} style={{ background: 'var(--db-card-bg)' }}>
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 rounded-t-2xl z-10" style={{ borderBottom: '0.5px solid var(--db-card-border)', background: 'var(--db-card-bg)' }}>
          <h3 className="font-bold text-base" style={{ color: 'var(--db-text-strong)' }}>{title}</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--db-text-muted)' }}>
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Formulario completo de usuario ────────────────────────────
function UserForm({ initial = {}, onSave, onCancel, isNew }) {
  const [form, setForm] = useState({
    // Cuenta
    name:     initial.name     || '',
    email:    initial.email    || '',
    role:     initial.role     || 'agent',
    password: '',
    // Personal
    cedula:              initial.cedula              || '',
    identificacion:      initial.identificacion      || '',
    genero:              initial.genero              || '',
    fecha_nacimiento:    initial.fecha_nacimiento    || '',
    // Laboral
    fecha_incorporacion: initial.fecha_incorporacion || '',
    // Contacto
    movil:               initial.movil               || '',
    telefono:            initial.telefono            || '',
    extension_telefono:  initial.extension_telefono  || '',
    // Preferencias
    idioma_preferido:    initial.idioma_preferido    || 'es',
    zona_horaria:        initial.zona_horaria        || 'America/Santo_Domingo',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { toast.error('Nombre y email son requeridos.'); return; }
    if (isNew && (!form.password || form.password.length < 8)) {
      toast.error('La contraseña debe tener al menos 8 caracteres.'); return;
    }
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Sección: Cuenta ─────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--db-card-border)' }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid var(--db-card-border)' }}>
          <Shield size={13} style={{ color: '#6366f1' }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6366f1' }}>Datos de acceso</span>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ background: 'var(--db-card-bg)' }}>
          <div className="sm:col-span-2">
            <Field label="Nombre completo" icon={<User />} required>
              <Input icon={<User />} type="text" value={form.name}
                onChange={e => set('name', e.target.value)} placeholder="María García" required />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Correo electrónico" icon={<Mail />} required>
              <Input icon={<Mail />} type="email" value={form.email}
                onChange={e => set('email', e.target.value)} placeholder="m.garcia@empresa.com" required />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Rol" icon={<Shield />} required>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {ROLES.map(r => (
                  <button key={r.value} type="button" onClick={() => set('role', r.value)}
                    className="p-3 rounded-xl text-left transition-all"
                    style={{
                      border: form.role === r.value ? '2px solid #6366f1' : '2px solid var(--db-card-border)',
                      background: form.role === r.value ? 'rgba(99,102,241,0.1)' : 'var(--ts-input-bg)',
                    }}>
                    <p className="text-xs font-bold" style={{ color: form.role === r.value ? '#6366f1' : 'var(--db-text)' }}>
                      {r.label}
                    </p>
                    <p className="text-xs mt-0.5 leading-tight" style={{ color: 'var(--db-text-muted)' }}>{r.desc}</p>
                  </button>
                ))}
              </div>
            </Field>
          </div>
          {isNew && (
            <div className="sm:col-span-2">
              <Field label="Contraseña temporal" icon={<Lock />} required
                hint="Se enviará por correo junto al código de verificación.">
                <Input icon={<Lock />} type="password" value={form.password}
                  onChange={e => set('password', e.target.value)} placeholder="Mínimo 8 caracteres" minLength={8} />
              </Field>
            </div>
          )}
        </div>
      </div>

      {/* ── Sección: Información personal ───────────── */}
      <Section title="Información personal" icon={<User />}>
        <Field label="Cédula" icon={<Hash />}>
          <Input icon={<Hash />} value={form.cedula}
            onChange={e => set('cedula', e.target.value)} placeholder="001-0000000-0" />
        </Field>
        <Field label="Identificación / Pasaporte" icon={<UserCheck />}>
          <Input icon={<UserCheck />} value={form.identificacion}
            onChange={e => set('identificacion', e.target.value)} placeholder="A00000000" />
        </Field>
        <Field label="Género" icon={<User />}>
          <Select icon={<User />} value={form.genero} onChange={e => set('genero', e.target.value)}>
            <option value="">— Seleccionar —</option>
            {GENEROS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </Select>
        </Field>
        <Field label="Fecha de nacimiento" icon={<Calendar />}>
          <Input icon={<Calendar />} type="date" value={form.fecha_nacimiento}
            onChange={e => set('fecha_nacimiento', e.target.value)} />
        </Field>
      </Section>

      {/* ── Sección: Información laboral ────────────── */}
      <Section title="Información laboral" icon={<Briefcase />}>
        <Field label="Fecha de incorporación" icon={<Calendar />}>
          <Input icon={<Calendar />} type="date" value={form.fecha_incorporacion}
            onChange={e => set('fecha_incorporacion', e.target.value)} />
        </Field>
      </Section>

      {/* ── Sección: Contacto ───────────────────────── */}
      <Section title="Información de contacto" icon={<Phone />}>
        <Field label="Móvil" icon={<Smartphone />}>
          <Input icon={<Smartphone />} type="tel" value={form.movil}
            onChange={e => set('movil', e.target.value)} placeholder="+1 (809) 000-0000" />
        </Field>
        <Field label="Teléfono de oficina" icon={<Phone />}>
          <Input icon={<Phone />} type="tel" value={form.telefono}
            onChange={e => set('telefono', e.target.value)} placeholder="+1 (809) 000-0000" />
        </Field>
        <Field label="Extensión" icon={<Hash />}>
          <Input icon={<Hash />} value={form.extension_telefono}
            onChange={e => set('extension_telefono', e.target.value)} placeholder="102" />
        </Field>
      </Section>

      {/* ── Sección: Preferencias ───────────────────── */}
      <Section title="Preferencias del sistema" icon={<Globe />}>
        <Field label="Idioma preferido" icon={<Globe />}>
          <Select icon={<Globe />} value={form.idioma_preferido}
            onChange={e => set('idioma_preferido', e.target.value)}>
            {IDIOMAS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </Select>
        </Field>
        <Field label="Zona horaria" icon={<Clock />}>
          <Select icon={<Clock />} value={form.zona_horaria}
            onChange={e => set('zona_horaria', e.target.value)}>
            {ZONAS.map(z => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}
          </Select>
        </Field>
      </Section>

      {/* Acciones */}
      <div className="flex gap-3 pt-2 sticky bottom-0 pb-1" style={{ background: 'var(--db-card-bg)' }}>
        <button type="button" onClick={onCancel} disabled={saving}
          className="flex-1 py-2.5 text-sm disabled:opacity-50 rounded-xl font-semibold transition-colors"
          style={{ color: 'var(--db-text)', border: '1px solid var(--db-card-border)', background: 'var(--db-bg)' }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Guardando...' : isNew ? 'Crear empleado' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

// ── Formulario de contraseña ──────────────────────────────────
function PasswordForm({ userName, onSave, onCancel }) {
  const [form, setForm]   = useState({ newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8) { toast.error('Mínimo 8 caracteres.'); return; }
    if (form.newPassword !== form.confirm) { toast.error('Las contraseñas no coinciden.'); return; }
    setSaving(true);
    try { await onSave(form.newPassword); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--db-text)' }}>Nueva contraseña para <strong style={{ color: 'var(--db-text-strong)' }}>{userName}</strong>.</p>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--db-text)' }}>Nueva contraseña</label>
        <input type="password" value={form.newPassword} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
          placeholder="Mínimo 8 caracteres" minLength={8} required
          className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
          style={{ background: 'var(--ts-input-bg)', border: '1px solid var(--ts-input-border)', color: 'var(--db-text-strong)' }} />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--db-text)' }}>Confirmar contraseña</label>
        <input type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
          placeholder="Repetir contraseña" required
          className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
          style={{ background: 'var(--ts-input-bg)', border: '1px solid var(--ts-input-border)', color: 'var(--db-text-strong)' }} />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 text-sm rounded-xl font-semibold"
          style={{ color: 'var(--db-text)', border: '1px solid var(--db-card-border)' }}>Cancelar</button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl font-semibold flex items-center justify-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Guardando...' : 'Cambiar'}
        </button>
      </div>
    </form>
  );
}

// ── Tarjeta de usuario ────────────────────────────────────────
function UserCard({ user, isCurrentUser, onEdit, onToggle, onDelete, onPassword }) {
  const ini   = initials(user.name);
  const color = avatarColor(user.name);

  const ROLE_BADGE = {
    admin:      'bg-violet-100 text-violet-700',
    supervisor: 'bg-blue-100 text-blue-700',
    agent:      'bg-slate-100 text-slate-600',
  };

  return (
    <div className={`rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-all ${!user.is_active ? 'opacity-55' : ''}`} style={{ background: 'var(--db-card-bg)', border: '1px solid var(--db-card-border)' }}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
        {ini}
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-sm" style={{ color: 'var(--db-text-strong)' }}>{user.name}</p>
          {isCurrentUser && (
            <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">Tú</span>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[user.role] || ROLE_BADGE.agent}`}>
            {user.role === 'admin' ? 'Admin' : user.role === 'supervisor' ? 'Supervisor' : 'Agente'}
          </span>
          {!user.is_active && (
            <span className="bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">Inactivo</span>
          )}
          {!user.email_verified && (
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">Sin verificar</span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--db-text-muted)' }}>{user.email}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {user.movil    && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--db-text-muted)' }}><Smartphone size={10} />{user.movil}</span>}
          {user.telefono && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--db-text-muted)' }}><Phone size={10} />{user.telefono}{user.extension_telefono ? ` ext. ${user.extension_telefono}` : ''}</span>}
          {user.fecha_incorporacion && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--db-text-muted)' }}><Calendar size={10} />Ingresó {user.fecha_incorporacion}</span>}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={onEdit} title="Editar"
          className="w-8 h-8 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-colors"
          style={{ color: 'var(--db-text-muted)' }}>
          <Edit2 size={14} />
        </button>
        <button onClick={onPassword} title="Cambiar contraseña"
          className="w-8 h-8 rounded-lg hover:text-amber-600 hover:bg-amber-50 flex items-center justify-center transition-colors"
          style={{ color: 'var(--db-text-muted)' }}>
          <KeyRound size={14} />
        </button>
        {!isCurrentUser && (
          <button onClick={onToggle} title={user.is_active ? 'Desactivar' : 'Activar'}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
              ${user.is_active
                ? 'hover:text-emerald-600 hover:bg-emerald-50'
                : 'hover:text-slate-600 hover:bg-slate-100'}`}
            style={{ color: 'var(--db-text-muted)' }}>
            {user.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          </button>
        )}
        {!isCurrentUser && (
          <button onClick={onDelete} title="Eliminar"
            className="w-8 h-8 rounded-lg hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
            style={{ color: 'var(--db-text-muted)' }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PANEL PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function TeamPanel() {
  const { users, isLoading, error, fetchUsers, createUser, updateUser, toggleActive, removeUser, changePassword } = useTeamStore();
  const { user: currentUser } = useAuthStore();

  const [modalCreate,   setModalCreate]   = useState(false);
  const [modalEdit,     setModalEdit]     = useState(null);
  const [modalPassword, setModalPassword] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting,      setDeleting]      = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const agents     = users.filter(u => u.role === 'agent');
  const supervisors = users.filter(u => u.role === 'supervisor');
  const admins     = users.filter(u => u.role === 'admin');
  const total      = users.filter(u => u.is_active).length;

  const handleCreate = async (form) => {
    try {
      await createUser(form);
      toast.success(`${form.name} creado. Se envió correo de bienvenida.`);
      setModalCreate(false);
    } catch (err) {
      toast.error(err.message || 'Error al crear usuario.');
    }
  };

  const handleEdit = async (form) => {
    try {
      await updateUser(modalEdit.id, form);
      toast.success('Perfil actualizado.');
      setModalEdit(null);
    } catch (err) {
      toast.error(err.message || 'Error al actualizar.');
    }
  };

  const handleToggle = async (u) => {
    try {
      await toggleActive(u.id);
      toast.success(`Cuenta ${u.is_active ? 'desactivada' : 'activada'}.`);
    } catch { toast.error('Error.'); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await removeUser(confirmDelete.id);
      toast.success(`${confirmDelete.name} eliminado.`);
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err.message || 'Error al eliminar.');
    } finally {
      setDeleting(false);
    }
  };

  const handlePassword = async (newPassword) => {
    try {
      await changePassword(modalPassword.id, { newPassword });
      toast.success('Contraseña actualizada.');
      setModalPassword(null);
    } catch (err) {
      toast.error(err.message || 'Error al cambiar contraseña.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-sm" style={{ color: 'var(--db-text-muted)' }}>
        <Loader2 size={18} className="animate-spin" /> Cargando equipo...
      </div>
    );
  }

  const UserGroup = ({ title, list }) => list.length === 0 ? null : (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-wider mb-3 px-1 flex items-center gap-2" style={{ color: 'var(--db-text-muted)' }}>
        {title}
        <span className="px-2 py-0.5 rounded-full" style={{ background: 'var(--db-card-border)', color: 'var(--db-text)' }}>{list.length}</span>
      </h2>
      <div className="space-y-2">
        {list.map(u => (
          <UserCard key={u.id} user={u} isCurrentUser={u.id === currentUser?.id}
            onEdit={() => setModalEdit(u)} onToggle={() => handleToggle(u)}
            onDelete={() => setConfirmDelete(u)} onPassword={() => setModalPassword(u)} />
        ))}
      </div>
    </section>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: 'var(--db-bg)' }}>
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black" style={{ color: 'var(--db-text-strong)' }}>Equipo de trabajo</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--db-text-muted)' }}>
              {total} miembro{total !== 1 ? 's' : ''} activo{total !== 1 ? 's' : ''} ·
              {admins.length} admin · {supervisors.length} supervisor · {agents.length} agente{agents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={() => setModalCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-indigo-500/25 whitespace-nowrap">
            <Plus size={15} /> Nuevo empleado
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Grupos */}
        <UserGroup title="Administradores"  list={admins} />
        <UserGroup title="Supervisores"     list={supervisors} />
        <UserGroup title="Agentes"          list={agents} />

        {users.length === 0 && (
          <div className="rounded-2xl border border-dashed p-12 text-center" style={{ background: 'var(--db-card-bg)', borderColor: 'var(--db-card-border)' }}>
            <User size={32} className="mx-auto mb-3" style={{ color: 'var(--db-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--db-text-muted)' }}>No hay empleados registrados.</p>
            <button onClick={() => setModalCreate(true)}
              className="mt-3 text-indigo-600 text-sm font-semibold hover:underline">
              + Añadir el primer empleado
            </button>
          </div>
        )}
      </div>

      {/* MODALES */}
      {modalCreate && (
        <Modal title="Nuevo empleado" onClose={() => setModalCreate(false)} wide>
          <UserForm isNew onSave={handleCreate} onCancel={() => setModalCreate(false)} />
        </Modal>
      )}

      {modalEdit && (
        <Modal title={`Editar: ${modalEdit.name}`} onClose={() => setModalEdit(null)} wide>
          <UserForm initial={modalEdit} isNew={false} onSave={handleEdit} onCancel={() => setModalEdit(null)} />
        </Modal>
      )}

      {modalPassword && (
        <Modal title="Cambiar contraseña" onClose={() => setModalPassword(null)}>
          <PasswordForm userName={modalPassword.name} onSave={handlePassword} onCancel={() => setModalPassword(null)} />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Eliminar empleado" onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'var(--db-error-bg)', border: '1px solid var(--db-error-border)' }}>
              <Trash2 size={18} style={{ color: 'var(--db-error-text)' }} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--db-error-text)' }}>¿Eliminar a {confirmDelete.name}?</p>
                <p className="text-xs mt-1" style={{ color: 'var(--db-error-text)', opacity: 0.8 }}>La cuenta se desactivará. El historial de conversaciones se conserva.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                className="flex-1 py-2.5 text-sm rounded-xl font-semibold"
                style={{ color: 'var(--db-text)', border: '1px solid var(--db-card-border)' }}>
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-xl font-semibold flex items-center justify-center gap-2">
                {deleting && <Loader2 size={13} className="animate-spin" />}
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
