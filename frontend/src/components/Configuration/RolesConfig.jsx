import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Plus, Trash2, Check, Info } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const BASE_ROLE_LABELS = { agent: 'Operador', supervisor: 'Supervisor', admin: 'Administrador' };

// Agrupación visual — las claves deben calzar con CustomRole.DEFAULT_PERMISSIONS (backend)
const PERMISSION_GROUPS = [
  {
    title: 'Bandeja / Canales',
    keys: [
      ['view_inbox',                     'Ver bandeja de entrada'],
      ['view_channel_whatsapp',          'Canal WhatsApp (Meta)'],
      ['view_channel_whatsapp_business', 'Canal WhatsApp Business'],
      ['view_channel_messenger',         'Canal Messenger'],
      ['view_channel_instagram',         'Canal Instagram'],
      ['view_channel_web',               'Canal Widget web'],
      ['view_all_conversations',         'Ver conversaciones de todos los agentes'],
      ['assign_conversations',           'Asignar conversaciones'],
    ],
  },
  {
    title: 'Módulos',
    keys: [
      ['view_campaigns',      'Campañas masivas'],
      ['view_vouchers',       'Comprobantes'],
      ['view_calendar',       'Calendario / citas'],
      ['view_templates',      'Documentos / plantillas'],
      ['view_dashboard',      'Dashboard'],
      ['view_custom_modules', 'Módulos personalizados'],
    ],
  },
  {
    title: 'Configuración',
    keys: [
      ['view_config',              'Acceder a Configuración'],
      ['config_company_profile',   'Perfil de la empresa'],
      ['config_team_management',   'Operadores'],
      ['config_labels',            'Etiquetas'],
      ['config_info_panel',        'Panel de información'],
      ['config_import_contacts',   'Importar contactos'],
      ['config_whatsapp_business', 'WhatsApp API (Meta)'],
      ['config_wa_sharing',        'Compartir WhatsApp'],
      ['config_messenger',         'Messenger'],
      ['config_instagram',         'Instagram'],
      ['config_tiktok',            'TikTok'],
      ['config_telegram',         'Telegram'],
      ['config_bot_ai',            'Configuración del bot'],
      ['config_flow_rules',        'Reglas de flujo'],
      ['config_bot_response',      'Bot de respuesta'],
      ['config_chat_routing',      'Enrutamiento de chat'],
      ['config_quick_messages',    'Mensajes rápidos'],
      ['config_reports',          'Programar informe'],
      ['config_modules',          'Módulos personalizados (config)'],
      ['config_integrations',     'Integraciones'],
      ['config_widgets',          'Widgets'],
      ['config_plugins',          'Complementos'],
    ],
  },
];

const emptyForm = { name: '', description: '', base_role: 'agent' };

export default function RolesConfig() {
  const navigate = useNavigate();
  const [roles, setRoles]       = useState([]);
  const [selected, setSelected] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/custom-roles');
      setRoles(res.data || []);
    } catch { toast.error('Error cargando roles'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectRole = (role) => {
    setSelected(role);
    setPermissions(role.permissions || {});
  };

  const togglePermission = (key) => {
    setPermissions(prev => ({ ...prev, [key]: prev[key] === false ? true : false }));
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.put(`/custom-roles/${selected.id}`, { permissions });
      const updated = res.data;
      setRoles(prev => prev.map(r => r.id === updated.id ? updated : r));
      setSelected(updated);
      toast.success(`Rol "${updated.name}" actualizado`);
    } catch (err) { toast.error(err.message || 'Error guardando'); }
    finally { setSaving(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) return toast.error('El nombre es obligatorio');
    setCreating(true);
    try {
      const res = await api.post('/custom-roles', createForm);
      setRoles(prev => [...prev, res.data]);
      setShowCreate(false);
      setCreateForm(emptyForm);
      toast.success(`Rol "${res.data.name}" creado`);
      selectRole(res.data);
    } catch (err) { toast.error(err.message || 'Error creando el rol'); }
    finally { setCreating(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/custom-roles/${deleteTarget.id}`);
      setRoles(prev => prev.filter(r => r.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) { setSelected(null); setPermissions({}); }
      toast.success('Rol eliminado. Los operadores que lo tenían vuelven al comportamiento estándar.');
      setDeleteTarget(null);
    } catch (err) { toast.error(err.message || 'Error eliminando el rol'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="ts-config-panel h-full flex flex-col overflow-hidden" style={{ fontFamily: 'system-ui' }}>
      <div className="flex items-center justify-between px-8 py-4" style={{ borderBottom: '0.5px solid var(--db-card-border)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/config')} className="text-sm" style={{ color: 'var(--db-text-muted)' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            Configuración
          </button>
          <span style={{ color: 'var(--db-text-muted)' }}>›</span>
          <span className="text-sm font-medium" style={{ color: 'var(--db-text-strong)' }}>Roles personalizados</span>
        </div>
        {selected && (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: '#6366f1', opacity: saving ? 0.7 : 1 }}>
            {saving ? '...' : 'Guardar'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* ── Panel izquierdo: lista de roles ── */}
        <div className="w-72 flex-shrink-0 overflow-y-auto px-4 py-6" style={{ borderRight: '0.5px solid var(--db-card-border)' }}>
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#eef2ff' }}>
              <Shield size={18} style={{ color: '#6366f1' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--db-text-strong)' }}>Roles personalizados</h2>
              <p className="text-xs" style={{ color: 'var(--db-text-muted)' }}>Por empresa</p>
            </div>
          </div>

          <button onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg mb-3 transition-colors"
            style={{ color: '#6366f1', border: '1px dashed #6366f1' }}>
            <Plus size={14} /> Nuevo rol
          </button>

          {loading ? (
            <p className="text-xs" style={{ color: 'var(--db-text-muted)' }}>Cargando...</p>
          ) : roles.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--db-text-muted)' }}>Sin roles todavía. Creá uno para restringir qué ven ciertos operadores.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {roles.map(role => (
                <button key={role.id} onClick={() => selectRole(role)}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: selected?.id === role.id ? '#eef2ff' : 'transparent',
                    border: `1px solid ${selected?.id === role.id ? '#6366f1' : 'transparent'}`,
                  }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--db-text-strong)' }}>{role.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--db-text-muted)' }}>
                      {BASE_ROLE_LABELS[role.base_role] || role.base_role}
                      {role.is_active === false ? ' · inactivo' : ''}
                    </p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(role); }}
                    className="p-1 flex-shrink-0 rounded hover:bg-red-50" style={{ color: '#ef4444' }}>
                    <Trash2 size={13} />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Panel derecho: editor de permisos ── */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          {!selected ? (
            <div className="max-w-lg">
              <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#6366f1' }} />
                <p className="text-xs" style={{ color: '#4338ca' }}>
                  Un rol personalizado solo puede <strong>restringir</strong> lo que un operador ya puede ver —
                  nunca le da acceso a algo que su rol base o el plan de la empresa no permitan. Creá un rol,
                  desmarcá lo que no querés que vea, y asignáselo a un operador desde Equipo.
                </p>
              </div>
              <p className="text-sm mt-6" style={{ color: 'var(--db-text-muted)' }}>
                Seleccioná un rol de la izquierda para editar sus permisos, o creá uno nuevo.
              </p>
            </div>
          ) : (
            <div className="max-w-2xl">
              <div className="mb-6">
                <h2 className="text-lg font-bold" style={{ color: 'var(--db-text-strong)' }}>{selected.name}</h2>
                {selected.description && (
                  <p className="text-sm mt-0.5" style={{ color: 'var(--db-text-muted)' }}>{selected.description}</p>
                )}
              </div>

              {PERMISSION_GROUPS.map(group => (
                <div key={group.title} className="mb-8">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--db-text-muted)' }}>
                    {group.title}
                  </p>
                  <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid var(--db-card-border)' }}>
                    {group.keys.map(([key, label]) => {
                      const checked = permissions[key] !== false;
                      return (
                        <div key={key}
                          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                          style={{ borderBottom: '0.5px solid var(--db-row-border)' }}
                          onClick={() => togglePermission(key)}>
                          <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                            style={{
                              background: checked ? '#6366f1' : 'var(--ts-input-bg)',
                              border: `1.5px solid ${checked ? '#6366f1' : 'var(--ts-input-border)'}`,
                            }}>
                            {checked && <Check size={12} color="#fff" />}
                          </div>
                          <span className="text-sm" style={{ color: 'var(--db-text-strong)' }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: crear rol ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.4)' }}>
          <form onSubmit={handleCreate} className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--db-bg)' }}>
            <h3 className="text-base font-bold mb-4" style={{ color: 'var(--db-text-strong)' }}>Nuevo rol personalizado</h3>

            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--db-text-muted)' }}>Nombre</label>
            <input autoFocus required value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Agente Junior"
              className="w-full text-sm px-3 py-2 rounded-lg mb-3"
              style={{ border: '1px solid var(--ts-input-border)', background: 'var(--ts-input-bg)', color: 'var(--db-text-strong)' }} />

            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--db-text-muted)' }}>Descripción (opcional)</label>
            <input value={createForm.description}
              onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Para qué se usa este rol"
              className="w-full text-sm px-3 py-2 rounded-lg mb-3"
              style={{ border: '1px solid var(--ts-input-border)', background: 'var(--ts-input-bg)', color: 'var(--db-text-strong)' }} />

            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--db-text-muted)' }}>Rol base</label>
            <select value={createForm.base_role}
              onChange={e => setCreateForm(f => ({ ...f, base_role: e.target.value }))}
              className="w-full text-sm px-3 py-2 rounded-lg mb-5"
              style={{ border: '1px solid var(--ts-input-border)', background: 'var(--ts-input-bg)', color: 'var(--db-text-strong)' }}>
              <option value="agent">Operador</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Administrador</option>
            </select>

            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowCreate(false); setCreateForm(emptyForm); }}
                className="flex-1 text-sm font-medium py-2 rounded-lg" style={{ color: 'var(--db-text-muted)', border: '1px solid var(--db-card-border)' }}>
                Cancelar
              </button>
              <button type="submit" disabled={creating}
                className="flex-1 text-sm font-semibold text-white py-2 rounded-lg"
                style={{ background: '#6366f1', opacity: creating ? 0.7 : 1 }}>
                {creating ? '...' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: confirmar eliminación ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--db-bg)' }}>
            <h3 className="text-base font-bold mb-2" style={{ color: 'var(--db-text-strong)' }}>¿Eliminar "{deleteTarget.name}"?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--db-text-muted)' }}>
              Los operadores que tengan este rol asignado volverán al comportamiento estándar de su rol base.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 text-sm font-medium py-2 rounded-lg" style={{ color: 'var(--db-text-muted)', border: '1px solid var(--db-card-border)' }}>
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 text-sm font-semibold text-white py-2 rounded-lg"
                style={{ background: '#ef4444', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? '...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
