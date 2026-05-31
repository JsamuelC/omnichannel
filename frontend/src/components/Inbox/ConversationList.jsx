// frontend/src/components/Inbox/ConversationList.jsx
// ─────────────────────────────────────────────────────────────
// Lista de conversaciones con pestañas de canal visuales
// WA | MS | IG + contador de no leídos por pestaña
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useConversationStore, useAuthStore } from '../../store';

// ─── Configuración de canales ────────────────────────────────
const CHANNELS = [
  {
    key:     '',
    label:   'Todos',
    color:   '',
    iconBg:  'bg-slate-100',
    iconFg:  'text-slate-600',
    activeBg:'bg-slate-900',
    activeFg:'text-white',
    dot:     'bg-slate-400',
    icon: (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/>
      </svg>
    )
  },
  {
    key:     'whatsapp',
    label:   'WhatsApp',
    color:   'border-green-500',
    iconBg:  'bg-green-50',
    iconFg:  'text-green-600',
    activeBg:'bg-green-600',
    activeFg:'text-white',
    dot:     'bg-green-500',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.49"/>
      </svg>
    )
  },
  {
    key:     'messenger',
    label:   'Messenger',
    color:   'border-blue-500',
    iconBg:  'bg-blue-50',
    iconFg:  'text-blue-600',
    activeBg:'bg-blue-600',
    activeFg:'text-white',
    dot:     'bg-blue-500',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
        <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z"/>
      </svg>
    )
  },
  {
    key:     'instagram',
    label:   'Instagram',
    color:   'border-pink-500',
    iconBg:  'bg-pink-50',
    iconFg:  'text-pink-600',
    activeBg:'bg-gradient-to-br from-purple-500 to-pink-500',
    activeFg:'text-white',
    dot:     'bg-pink-500',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    )
  },
];

const STATUS_CONFIG = {
  bot:      { label: 'Bot',      className: 'bg-violet-100 text-violet-700' },
  open:     { label: 'Abierto',  className: 'bg-amber-100  text-amber-700'  },
  assigned: { label: 'Asignado', className: 'bg-blue-100   text-blue-700'   },
  resolved: { label: 'Resuelto', className: 'bg-green-100  text-green-700'  },
};

const CHANNEL_DOT = {
  whatsapp:  'bg-green-500',
  messenger: 'bg-blue-500',
  instagram: 'bg-pink-500',
};

// ─────────────────────────────────────────────────────────────
export default function ConversationList() {
  const {
    conversations, activeConversation,
    selectConversation, filters, setFilters,
    fetchConversations, isLoading,
    channelTab, setChannelTab,
    unreadByChannel
  } = useConversationStore();

  const { user } = useAuthStore();
  const [search, setSearch] = useState('');

  // Cargar conversaciones al montar
  useEffect(() => { fetchConversations(); }, []);

  const unread = unreadByChannel();

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    setFilters({ search: val });
    fetchConversations();
  };

  const handleStatusFilter = (e) => {
    setFilters({ status: e.target.value });
    fetchConversations();
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-full">

      {/* ── Header ────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900 text-base">Bandeja</h2>
          {totalUnread > 0 && (
            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.25rem] text-center">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </div>

        {/* Buscador */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar contacto..."
            value={search}
            onChange={handleSearch}
            className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        {/* Filtro de estado */}
        <select
          value={filters.status || ''}
          onChange={handleStatusFilter}
          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5
                     focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          <option value="bot">Bot activo</option>
          <option value="open">Abiertos</option>
          <option value="assigned">Asignados</option>
          <option value="resolved">Resueltos</option>
        </select>
      </div>

      {/* ── Pestañas de canal ─────────────────────────── */}
      <div className="flex border-b border-slate-100 bg-white">
        {CHANNELS.map((ch) => {
          const isActive = channelTab === ch.key;
          const count = ch.key ? unread[ch.key] : totalUnread;

          return (
            <button
              key={ch.key}
              onClick={() => setChannelTab(ch.key)}
              className={`
                flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1
                text-xs font-semibold transition-all duration-150 relative
                ${isActive
                  ? 'text-indigo-600 bg-indigo-50/60'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }
              `}
            >
              {/* Icono */}
              <span className={`
                w-6 h-6 rounded-lg flex items-center justify-center
                ${isActive
                  ? `${ch.activeBg} ${ch.activeFg} shadow-sm`
                  : `${ch.iconBg} ${ch.iconFg}`
                }
              `}>
                {ch.icon}
              </span>

              {/* Label (oculto en pantallas muy pequeñas) */}
              <span className="hidden sm:block leading-none">
                {ch.key === '' ? 'Todos' : ch.key === 'whatsapp' ? 'WA' : ch.key === 'messenger' ? 'MS' : 'IG'}
              </span>

              {/* Badge no leídos */}
              {count > 0 && (
                <span className={`
                  absolute -top-0.5 right-0.5 min-w-[1rem] h-4 px-1 rounded-full
                  text-white text-xs font-bold flex items-center justify-center
                  ${ch.dot || 'bg-indigo-500'}
                `}>
                  {count > 9 ? '9+' : count}
                </span>
              )}

              {/* Línea indicadora activa */}
              {isActive && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Lista de conversaciones ───────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
            <span className="text-xs text-slate-400">Cargando...</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <p className="text-slate-500 text-sm font-medium">Sin conversaciones</p>
            <p className="text-slate-400 text-xs mt-1">
              {user?.role === 'agent'
                ? 'Tus conversaciones asignadas aparecerán aquí'
                : 'Los mensajes aparecerán aquí'}
            </p>
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={activeConversation?.id === conv.id}
              onClick={() => selectConversation(conv)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Item individual de conversación ─────────────────────────
function ConversationItem({ conversation, isActive, onClick }) {
  const status  = STATUS_CONFIG[conversation.status] || STATUS_CONFIG.open;
  const dotColor= CHANNEL_DOT[conversation.channel] || 'bg-slate-400';
  const name    = conversation.contact?.name || 'Contacto desconocido';
  const preview = conversation.last_message_preview || 'Sin mensajes';
  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), { locale: es, addSuffix: false })
    : '';

  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

  return (
    <div
      onClick={onClick}
      className={`
        flex items-start gap-3 px-4 py-3 cursor-pointer
        border-b border-slate-50 transition-all duration-100
        ${isActive
          ? 'bg-indigo-50 border-l-2 border-l-indigo-500 pl-[14px]'
          : 'hover:bg-slate-50/80 border-l-2 border-l-transparent'
        }
      `}
    >
      {/* Avatar con dot de canal */}
      <div className="relative flex-shrink-0 mt-0.5">
        <div className={`
          w-9 h-9 rounded-full flex items-center justify-center
          font-semibold text-sm select-none
          ${isActive
            ? 'bg-indigo-100 text-indigo-700'
            : 'bg-slate-100 text-slate-600'
          }
        `}>
          {initials}
        </div>
        {/* Dot de canal */}
        <span className={`
          absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${dotColor}
          rounded-full border-2 border-white
        `} />
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm truncate ${isActive ? 'font-semibold text-indigo-700' : 'font-medium text-slate-900'}`}>
            {name}
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {conversation.unread_count > 0 && (
              <span className="bg-indigo-600 text-white text-xs rounded-full min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center font-bold">
                {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
              </span>
            )}
            {timeAgo && (
              <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo}</span>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500 truncate mt-0.5 leading-relaxed">{preview}</p>

        <div className="flex items-center gap-1.5 mt-1.5">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${status.className}`}>
            {status.label}
          </span>
          {conversation.assigned_agent?.name && (
            <span className="text-xs text-slate-400 truncate">
              · {conversation.assigned_agent.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
