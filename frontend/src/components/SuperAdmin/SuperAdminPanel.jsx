// frontend/src/components/SuperAdmin/SuperAdminPanel.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, ToggleLeft, Rocket, CreditCard, Trash2, Plus, SlidersHorizontal,
  Loader2, AlertTriangle, X, TrendingUp, Users, CheckCircle2, XCircle,
  Search, Shield, ChevronRight, Activity, Package
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import DeployPanel   from './DeployPanel';
import PlansPanel    from './PlansPanel';
import RevenuePanel  from './RevenuePanel';

function ConfirmModal({ open, title, description, confirmLabel = 'Confirmar', danger = false, loading = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4" onClick={!loading ? onCancel : undefined}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${danger ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
          <AlertTriangle size={20} className={danger ? 'text-red-400' : 'text-amber-400'} />
        </div>
        <h3 className="text-base font-black text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">{description}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl transition-colors font-medium">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60
              ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-amber-600 hover:bg-amber-500'}`}>
            {loading && <Loader2 size={13} className="animate-spin" />}
            {loading ? 'Eliminando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const FEATURE_CATALOG = [
  { key: 'inbox',              label: 'Bandeja / Mensajería',         desc: 'Acceso a conversaciones y mensajes', group: 'core' },
  { key: 'whatsapp_personal',  label: 'WhatsApp Personal',            desc: 'Sesiones Baileys (QR)',              group: 'channels' },
  { key: 'whatsapp_business',  label: 'WhatsApp Business',            desc: 'Meta Cloud API',                     group: 'channels' },
  { key: 'campaigns',          label: 'Campañas Masivas',             desc: 'Envío masivo de mensajes',           group: 'marketing' },
  { key: 'vouchers',           label: 'Comprobantes de Pago',         desc: 'Verificación de comprobantes',       group: 'finance' },
  { key: 'appointments',       label: 'Calendario / Citas',           desc: 'Agendamiento de citas',              group: 'core' },
  { key: 'document_templates', label: 'Plantillas de Documentos',     desc: 'Generación de documentos .docx',     group: 'core' },
  { key: 'bot_ai',             label: 'Bot con IA',                   desc: 'Claude, GPT, Gemini',                group: 'ai' },
  { key: 'flow_rules',         label: 'Reglas de Flujo',              desc: 'Automatización de mensajes',         group: 'ai' },
  { key: 'quick_messages',     label: 'Mensajes Rápidos',             desc: 'Canned responses',                   group: 'core' },
  { key: 'labels',             label: 'Etiquetas',                    desc: 'Clasificación por etiquetas',        group: 'core' },
  { key: 'custom_modules',     label: 'Módulos Personalizados',       desc: 'Tablas y formularios a medida',      group: 'advanced' },
  { key: 'bot_catalogs',       label: 'Catálogos del Bot',            desc: 'Base de conocimiento',               group: 'ai' },
  { key: 'dashboard',          label: 'Dashboard Analítico',          desc: 'Estadísticas y métricas',            group: 'core' },
  { key: 'team_management',    label: 'Gestión de Equipo',            desc: 'Crear y administrar usuarios',       group: 'core' },
  { key: 'merge_templates',    label: 'Plantillas de Mensajes',       desc: 'Mensajes reutilizables con variables', group: 'marketing' },
];

const GROUP_META = {
  core:      { label: 'Core',         color: 'indigo'  },
  channels:  { label: 'Canales',      color: 'emerald' },
  ai:        { label: 'IA & Bot',     color: 'violet'  },
  marketing: { label: 'Marketing',    color: 'amber'   },
  finance:   { label: 'Finanzas',     color: 'rose'    },
  advanced:  { label: 'Avanzado',     color: 'cyan'    },
};

const COLOR_MAP = {
  indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  text: 'text-indigo-400',  toggle: 'bg-indigo-600'  },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', toggle: 'bg-emerald-600' },
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  text: 'text-violet-400',  toggle: 'bg-violet-600'  },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   toggle: 'bg-amber-600'   },
  rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400',    toggle: 'bg-rose-600'    },
  cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    toggle: 'bg-cyan-600'    },
};

const DEFAULT_FEATURES = Object.fromEntries(FEATURE_CATALOG.map(f => [f.key, true]));

function FeatureToggle({ featureKey, label, desc, value, onChange, disabled, color = 'indigo' }) {
  const c = COLOR_MAP[color] || COLOR_MAP.indigo;
  return (
    <div className={`flex items-start justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer
      ${value ? `${c.bg} ${c.border}` : 'bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/70'}`}
      onClick={() => !disabled && onChange(featureKey, !value)}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${value ? 'text-white' : 'text-slate-400'}`}>{label}</p>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{desc}</p>
      </div>
      <div className={`relative flex-shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
        ${value ? c.toggle : 'bg-slate-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200
          ${value ? 'translate-x-[22px]' : 'translate-x-1'}`} />
      </div>
    </div>
  );
}

function CompanyAvatar({ name, size = 'md' }) {
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-xs';
  const colors = ['from-violet-500 to-indigo-600','from-emerald-500 to-teal-600','from-amber-500 to-orange-600',
                  'from-rose-500 to-pink-600','from-cyan-500 to-blue-600','from-fuchsia-500 to-purple-600'];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  return (
    <div className={`${sz} rounded-xl bg-gradient-to-br ${colors[idx]} flex items-center justify-center text-white font-black flex-shrink-0`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

export default function SuperAdminPanel() {
  const navigate = useNavigate();
  const [companies,       setCompanies]       = useState([]);
  const [selected,        setSelected]        = useState(null);
  const [features,        setFeatures]        = useState({});
  const [loading,         setLoading]         = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [search,          setSearch]          = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm,      setCreateForm]      = useState({ nombre: '', email: '', admin_name: '', admin_email: '', admin_password: '' });
  const [creating,        setCreating]        = useState(false);
  const [deleteTarget,    setDeleteTarget]    = useState(null);
  const [deleting,        setDeleting]        = useState(false);
  const [activeTab,       setActiveTab]       = useState('empresas');

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/company/all');
      const list = res.data || [];
      setCompanies(list);
      const savedId = localStorage.getItem('ts-admin-company-id');
      if (savedId && !selected) {
        const prev = list.find(c => c.id === savedId);
        if (prev) selectCompany(prev);
      }
    } catch {
      toast.error('Error cargando empresas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const selectCompany = async (company) => {
    setSelected(company);
    localStorage.setItem('ts-admin-company-id', company.id);
    localStorage.setItem('ts-admin-company-name', company.nombre);
    try {
      const res = await api.get(`/company/${company.id}/features`);
      setFeatures({ ...DEFAULT_FEATURES, ...(res.data?.active_features || {}) });
    } catch {
      setFeatures({ ...DEFAULT_FEATURES });
    }
  };

  const handleToggle = (key, value) => setFeatures(prev => ({ ...prev, [key]: value }));
  const handleEnableAll  = () => setFeatures(Object.fromEntries(FEATURE_CATALOG.map(f => [f.key, true])));
  const handleDisableAll = () => setFeatures(Object.fromEntries(FEATURE_CATALOG.map(f => [f.key, false])));

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/company/${selected.id}/features`, { features });
      toast.success(`Módulos de "${selected.nombre}" actualizados`);
    } catch (err) {
      toast.error(err.message || 'Error guardando módulos');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/company/create', createForm);
      toast.success(`Empresa "${createForm.nombre}" creada`);
      setShowCreateModal(false);
      setCreateForm({ nombre: '', email: '', admin_name: '', admin_email: '', admin_password: '' });
      fetchCompanies();
    } catch (err) {
      toast.error(err.message || 'Error creando empresa');
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/company/${deleteTarget.id}`);
      toast.success(`Empresa eliminada`);
      if (selected?.id === deleteTarget.id) {
        setSelected(null); setFeatures({});
        localStorage.removeItem('ts-admin-company-id');
        localStorage.removeItem('ts-admin-company-name');
      }
      setDeleteTarget(null);
      fetchCompanies();
    } catch (err) {
      toast.error(err.message || 'Error eliminando empresa');
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = Object.values(features).filter(Boolean).length;
  const filtered = companies.filter(c => c.nombre?.toLowerCase().includes(search.toLowerCase()));

  // Agrupar features por grupo
  const grouped = Object.entries(GROUP_META).map(([groupKey, meta]) => ({
    key: groupKey,
    ...meta,
    features: FEATURE_CATALOG.filter(f => f.group === groupKey),
  }));

  const TABS = [
    { id: 'empresas',  label: 'Empresas',     icon: <Building2 size={14} /> },
    { id: 'planes',    label: 'Planes',        icon: <Package size={14} /> },
    { id: 'deploy',    label: 'Despliegues',   icon: <Rocket size={14} /> },
    { id: 'ingresos',  label: 'Ingresos',      icon: <TrendingUp size={14} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white overflow-hidden">

      {/* ── Header global ─────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
            <Shield size={16} className="text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white leading-none">SuperAdmin</p>
            <p className="text-xs text-slate-500 leading-none mt-0.5">Panel de control global</p>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Building2 size={13} className="text-violet-400" />
            <span className="font-semibold text-white">{companies.length}</span> empresas
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Users size={13} className="text-emerald-400" />
            <span className="font-semibold text-white">{companies.reduce((s, c) => s + (c.user_count || 0), 0)}</span> usuarios
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <button
            onClick={() => navigate('/gestion-funcionalidades')}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded-lg transition-colors border border-indigo-500/30"
          >
            <SlidersHorizontal size={12} />
            Funcionalidades
          </button>
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-1 px-4 bg-slate-900/50 border-b border-slate-800">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px
              ${activeTab === t.id ? 'text-white border-violet-500 bg-violet-500/10' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'deploy'   && <DeployPanel />}
      {activeTab === 'planes'   && <PlansPanel companies={companies} />}
      {activeTab === 'ingresos' && <RevenuePanel />}

      <div className={`flex flex-1 overflow-hidden ${activeTab !== 'empresas' ? 'hidden' : ''}`}>

        {/* ── Lista de empresas ─────────────────────────── */}
        <div className="w-72 flex-shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/40">

          {/* Buscador */}
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar empresa..."
                className="w-full bg-slate-800 border border-slate-700 text-sm text-white pl-8 pr-3 py-2 rounded-lg focus:outline-none focus:border-violet-500 placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
                <Loader2 size={22} className="animate-spin text-violet-500" />
                <span className="text-xs">Cargando...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Building2 size={24} className="text-slate-600" />
                <p className="text-slate-500 text-xs text-center">
                  {search ? 'Sin resultados' : 'Sin empresas registradas'}
                </p>
              </div>
            ) : filtered.map(c => {
              const isActive = selected?.id === c.id;
              return (
                <div key={c.id} onClick={() => selectCompany(c)}
                  className={`group flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all
                    ${isActive ? 'bg-violet-600/20 border border-violet-500/40' : 'hover:bg-slate-800/60 border border-transparent'}`}>
                  <CompanyAvatar name={c.nombre} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>{c.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Users size={10} />{c.user_count ?? 0}
                      </span>
                      {c.features_count > 0 && (
                        <span className="text-xs text-violet-500 flex items-center gap-1">
                          <Activity size={10} />{c.features_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isActive && <ChevronRight size={14} className="text-violet-400" />}
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(c); }}
                      className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botón crear */}
          <div className="p-3 border-t border-slate-800">
            <button onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-violet-900/30">
              <Plus size={15} />
              Nueva empresa
            </button>
          </div>
        </div>

        {/* ── Panel de feature flags ─────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-xs">
                <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
                  <Building2 size={36} className="text-violet-400 opacity-50" />
                </div>
                <p className="text-slate-300 font-semibold mb-1">Selecciona una empresa</p>
                <p className="text-slate-500 text-sm">Haz clic en cualquier empresa de la lista para gestionar sus módulos y permisos</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header empresa seleccionada */}
              <div className="p-5 border-b border-slate-800 bg-slate-900/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CompanyAvatar name={selected.nombre} size="lg" />
                    <div>
                      <h2 className="text-lg font-black text-white">{selected.nombre}</h2>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Users size={11} className="text-slate-500" />
                          {selected.user_count ?? 0} usuarios
                        </span>
                        <span className="text-xs text-violet-400 flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          {activeCount}/{FEATURE_CATALOG.length} módulos activos
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleEnableAll}
                      className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors flex items-center gap-1">
                      <CheckCircle2 size={11} /> Activar todo
                    </button>
                    <button onClick={handleDisableAll}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors flex items-center gap-1">
                      <XCircle size={11} /> Desactivar todo
                    </button>
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-violet-900/30">
                      {saving ? <><Loader2 size={13} className="animate-spin" />Guardando...</> : 'Guardar cambios'}
                    </button>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="mt-4">
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${(activeCount / FEATURE_CATALOG.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Grid de features agrupados */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {grouped.map(group => {
                  const c = COLOR_MAP[group.color];
                  const groupActive = group.features.filter(f => features[f.key]).length;
                  return (
                    <div key={group.key}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>{group.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-md ${c.bg} ${c.text} border ${c.border}`}>
                          {groupActive}/{group.features.length}
                        </span>
                        <div className="flex-1 h-px bg-slate-800" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {group.features.map(f => (
                          <FeatureToggle
                            key={f.key}
                            featureKey={f.key}
                            label={f.label}
                            desc={f.desc}
                            value={features[f.key] ?? true}
                            onChange={handleToggle}
                            disabled={saving}
                            color={group.color}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modales ─────────────────────────────────────── */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Eliminar empresa"
        description={`¿Estás seguro de que deseas eliminar "${deleteTarget?.nombre}"? Se desactivarán todos sus usuarios y esta acción no se puede deshacer.`}
        confirmLabel="Eliminar empresa"
        danger loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-600/20 flex items-center justify-center">
                  <Building2 size={18} className="text-violet-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Nueva Empresa</h3>
                  <p className="text-xs text-slate-500">Completa los datos del administrador</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="p-6 space-y-4">
              {/* Empresa */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Datos de la empresa</p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nombre *</label>
                  <input required value={createForm.nombre}
                    onChange={e => setCreateForm(p => ({ ...p, nombre: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-violet-500 transition-colors"
                    placeholder="Ej: Acme Corp" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email</label>
                  <input type="email" value={createForm.email}
                    onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-violet-500 transition-colors"
                    placeholder="empresa@ejemplo.com" />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Administrador inicial</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Nombre</label>
                    <input value={createForm.admin_name}
                      onChange={e => setCreateForm(p => ({ ...p, admin_name: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-violet-500 transition-colors"
                      placeholder="Juan Pérez" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Email *</label>
                    <input required type="email" value={createForm.admin_email}
                      onChange={e => setCreateForm(p => ({ ...p, admin_email: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-violet-500 transition-colors"
                      placeholder="admin@empresa.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Contraseña *</label>
                  <input required type="password" minLength={8} value={createForm.admin_password}
                    onChange={e => setCreateForm(p => ({ ...p, admin_password: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:border-violet-500 transition-colors"
                    placeholder="Mínimo 8 caracteres" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-xl transition-colors flex items-center justify-center gap-2">
                  {creating && <Loader2 size={13} className="animate-spin" />}
                  {creating ? 'Creando...' : 'Crear empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
