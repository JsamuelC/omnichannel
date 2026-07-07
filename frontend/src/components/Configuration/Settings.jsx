// frontend/src/components/Configuration/Settings.jsx
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
import { Search, X, ChevronRight, Settings2 } from 'lucide-react';

const SECTIONS = [
  {
    title: 'General',
    items: [
      { label: 'Perfil de la empresa',  to: '/config/perfilEmpresa',   feature: 'config_company_profile', permission: 'config_company_profile' },
      { label: 'Operadores',            to: '/team',                   feature: 'team_management',        permission: 'config_team_management' },
      { label: 'Etiquetas',             to: '/config/etiquetas',       feature: 'labels',                 permission: 'config_labels' },
      { label: 'Panel de información',  to: '/config/panel-info',      feature: 'config_info_panel',      permission: 'config_info_panel' },
      { label: 'Importar contactos',    to: '/config/upload',          feature: 'config_import_contacts', permission: 'config_import_contacts' },
    ],
  },
  {
    title: 'Roles y permisos',
    items: [
      // Sin `permission` a propósito: un admin nunca debe poder auto-ocultarse
      // esta pantalla asignándose un rol personalizado restrictivo.
      { label: 'Roles personalizados',  to: '/config/roles' },
    ],
  },
  {
    title: 'Canales',
    items: [
      { label: 'WhatsApp API (Meta)',   to: '/config/whatsapp',  badge: 'Meta', feature: 'whatsapp_business', permission: 'config_whatsapp_business' },
      { label: 'Compartir WhatsApp',   to: '/config/wa-sharing',  feature: 'whatsapp_personal',  permission: 'config_wa_sharing' },
      { label: 'Messenger',             to: '/config/messenger',  feature: 'config_messenger',   permission: 'config_messenger' },
      { label: 'Instagram',             to: '/config/instagram',  feature: 'config_instagram',   permission: 'config_instagram' },
      { label: 'TikTok',               to: '/config/tiktok',     feature: 'config_tiktok',       permission: 'config_tiktok' },
      { label: 'Telegram',             to: '/config/telegram',   feature: 'config_telegram',     permission: 'config_telegram' },
    ],
  },
  {
    title: 'Bot IA',
    items: [
      { label: 'Configuración del bot', to: '/bot-config',            feature: 'bot_ai',              permission: 'config_bot_ai' },
      { label: 'Reglas de flujo',       to: '/config/flow-rules',     feature: 'flow_rules',          permission: 'config_flow_rules' },
      { label: 'Bot de respuesta',      to: '/config/bot-respuesta',  feature: 'config_bot_response', permission: 'config_bot_response' },
    ],
  },
  {
    title: 'Automatizaciones',
    items: [
      { label: 'Campañas masivas',      to: '/campaigns',              feature: 'campaigns',           permission: 'view_campaigns' },
      { label: 'Mensajes rápidos',      to: '/config/mensajesRapidos', feature: 'quick_messages',      permission: 'config_quick_messages' },
      { label: 'Enrutamiento de chat',  to: '/config/enrutamiento',    feature: 'config_chat_routing', permission: 'config_chat_routing' },
      { label: 'Programar informe',     to: '/config/informes',        feature: 'config_reports',      permission: 'config_reports' },
    ],
  },
  {
    title: 'Módulos',
    items: [
      { label: 'Módulos personalizados', to: '/config/modulos', feature: 'custom_modules', permission: 'config_modules' },
    ],
  },
  {
    title: 'Desarrolladores',
    items: [
      { label: 'Integraciones',         to: '/config/integraciones',   feature: 'config_integrations', permission: 'config_integrations' },
      { label: 'Widgets',               to: '/config/widgets',         feature: 'config_widgets',       permission: 'config_widgets' },
      { label: 'Complementos',          to: '/config/complementos',    feature: 'config_plugins',       permission: 'config_plugins' },
    ],
  },
];

export default function Settings() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { hasFeature, canViewSection } = useAuthStore();

  const filtered = SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) &&
        (!item.feature || hasFeature(item.feature)) &&
        (!item.permission || canViewSection(item.permission))
      ),
    }))
    .filter(section => section.items.length > 0);

  return (
    <div className="ts-config-panel h-full overflow-y-auto">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="ts-config-header sticky top-0 z-10 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ts-icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings2 size={16} style={{ color: '#6366f1' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--db-text-strong)' }}>Configuración</h1>
            <p style={{ fontSize: 12, color: 'var(--db-text-muted)', margin: '2px 0 0' }}>Administra tu cuenta y preferencias</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--db-text-muted)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="ts-config-input"
              style={{ paddingLeft: 30, paddingRight: query ? 30 : 10, width: 180, fontSize: 12 }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--db-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => navigate(-1)}
            style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--ts-icon-bg)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--db-text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Contenido ───────────────────────────────────────── */}
      <div style={{ padding: '1.5rem 2rem', maxWidth: 1100 }}>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 0', color: 'var(--db-text-muted)' }}>
            <Search size={28} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p style={{ fontSize: 13, margin: 0 }}>Sin resultados para "<span style={{ color: 'var(--db-text)' }}>{query}</span>"</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filtered.map(section => (
              <div key={section.title} className="ts-config-card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--db-card-border)' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--db-text-muted)', margin: 0 }}>
                    {section.title}
                  </p>
                </div>
                <div style={{ padding: '4px 6px' }}>
                  {section.items.map(item => (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      style={({ isActive }) => ({
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 8, padding: '8px 10px', borderRadius: 8, fontSize: 13,
                        textDecoration: 'none', transition: 'all 0.15s',
                        background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                        color: isActive ? '#6366f1' : 'var(--db-text)',
                        fontWeight: isActive ? 600 : 400,
                      })}
                      className="ts-config-nav-item"
                    >
                      {({ isActive }) => (
                        <>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.label}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {item.badge && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                                {item.badge}
                              </span>
                            )}
                            <ChevronRight size={12} style={{ color: isActive ? '#6366f1' : 'var(--db-text-muted)', opacity: 0.6 }} />
                          </div>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
