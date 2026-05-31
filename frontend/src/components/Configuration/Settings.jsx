  // frontend/src/components/Configuration/Settings.jsx
  import React, { useState } from 'react';
  import { NavLink, useNavigate } from 'react-router-dom';

  const SettingsIcon = () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  );

  const SECTIONS = [
    {
      title: 'General',
      items: [
        { label: 'Perfil de la empresa',   to: '/config/perfilEmpresa' },
        { label: 'Perfiles',               to: '/config/configPerfiles'},
        { label: 'Operadores',             to: '/team'                 },
        { label: 'Departamentos',          to: '/config/departamentos' },
        { label: 'Importar',               to: '/config/upload'        },
        { label: 'Etiquetas',              to: '/config/etiquetas'        },
      ],
    },
    {
      title: 'Canales de Mensajería',
      items: [
        { label: 'WhatsApp',  to: '/config/whatsapp'  },
        { label: 'Messenger', to: '/config/messenger' },
        { label: 'Instagram', to: '/config/instagram' },
        { label: 'TikTok',    to: '/config/tiktok'},
        { label: 'Telegram',  to: '/config/telegram'},
      ],
    },
    {
      title: 'Bot',
      items: [
        { label: 'Chatbot',          to: '/bot-config'            },
        { label: 'Bot de Respuesta', to: '/config/bot-respuesta'  },
      ],
    },
    {
      title: 'Automatizaciones',
      items: [
        { label: 'Campañas',             to: '/campaigns'              },
        { label: 'Enrutamiento de Chat', to: '/config/enrutamiento'    },
        { label: 'Programar Informe',    to: '/config/informes'        },
        { label: 'Mensajes rápidos',     to: '/config/mensajesRapidos' },
        { label: 'Programar Informe',    to: '/config/informes'     },
      ],
    },

    {
      title: 'Desarrolladores',
      items: [
        { label: 'Integraciones', to: '/config/integraciones'      },
        { label: 'Widgets',       to: '/config/widgets'            },
        { label: 'Complementos',  to: '/config/complementos'       },
      ],
    },
  ];

  export default function Settings() {
    const [query, setQuery] = useState('');
    const navigate = useNavigate();

    const filtered = SECTIONS.map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase())
      ),
    })).filter(section => section.items.length > 0);

    return (
      <div className="h-full overflow-y-auto bg-white"
          style={{ fontFamily: 'system-ui, sans-serif', color: '#020202' }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-10 py-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400">
              <SettingsIcon />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold leading-none">Configuración</h1>
              <p className="text-slate-500 text-xs mt-1">Configura tu cuenta · Tecnossync</p>
            </div>
          </div>

          {/* X — volver atrás */}
          <button
            onClick={() => navigate(-1)}
            title="Volver"
            className="w-9 h-9 rounded-xl border border-white/8 text-slate-400 hover:text-white hover:bg-white/8 flex items-center justify-center transition-colors"
            style={{ border: '0.5px solid rgba(255,255,255,0.08)' }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* ── Buscador ───────────────────────────────────── */}
        <div className="px-10 py-5 border-b border-white/5">
          <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 max-w-sm"
              style={{ background: '#f1f5f9', border: '0.5px solid #e2e8f0' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z"/>
            </svg>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="bg-transparent text-slate-700 text-sm outline-none w-full placeholder-slate-400"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-300 text-sm leading-none">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── Grid de secciones ──────────────────────────── */}
        <div className="px-10 py-8">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm">Sin resultados para "<span className="text-slate-400">{query}</span>"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-10 xl:grid-cols-5 gap-x-6 gap-y-8">
              {filtered.map(section => (
                <div key={section.title}>
                  <p className="font-semibold uppercase text-xs mb-4 tracking-widest"
                    style={{ color: '#94a3b8' }}>
                    {section.title}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {section.items.map(item => (
                      <NavLink
                        key={item.label}
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm transition-all duration-150
                          ${isActive
                            ? 'text-indigo-400 bg-indigo-500/10'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                          }`
                        }
                      >
                        <span className="text-base leading-none">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
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