// frontend/src/components/Inbox/ConversationList.jsx
// ─────────────────────────────────────────────────────────────
// Lista de conversaciones con pestañas de canal visuales
// WA | MS | IG | WEB + contador de no leídos por pestaña
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useConversationStore, useAuthStore } from '../../store';
import api from '../../services/api';
import toast from 'react-hot-toast';

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
  {
    key:     'web',
    label:   'Web',
    color:   'border-indigo-500',
    iconBg:  'bg-indigo-50',
    iconFg:  'text-indigo-600',
    activeBg:'bg-indigo-600',
    activeFg:'text-white',
    dot:     'bg-indigo-500',
    icon: (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
        <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd"/>
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
  web:       'bg-indigo-500',
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
  const [showNewWA, setShowNewWA] = useState(false);
  const [newWAPhone, setNewWAPhone] = useState('');
  const [newWAName, setNewWAName] = useState('');
  const [creatingWA, setCreatingWA] = useState(false);

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

  const handleCreateWhatsapp = async () => {
    if (!newWAPhone.trim()) return;
    setCreatingWA(true);
    try {
      const res = await api.post('/conversations/new-whatsapp', {
        phone: newWAPhone.trim(),
        name: newWAName.trim() || undefined
      });
      if (res.data) {
        await fetchConversations();
        selectConversation(res.data);
        toast.success('Conversación creada');
        setShowNewWA(false);
        setNewWAPhone('');
        setNewWAName('');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear conversación');
    } finally {
      setCreatingWA(false);
    }
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#111b21] border-r border-[#d1d7db] dark:border-[#2a3942] w-full">

      {/* ── Header estilo WhatsApp Web ─────────────────── */}
      <div className="px-4 pt-3 pb-2.5 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#d1d7db] dark:border-[#2a3942]">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-semibold text-[#111b21] dark:text-[#e9edef] text-base">Bandeja</h2>
          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <span className="bg-[#25d366] text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.25rem] text-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
            {user?.role === 'admin' && (
              <button
                onClick={() => setShowNewWA(true)}
                title="Nueva conversación WhatsApp"
                className="w-7 h-7 flex items-center justify-center rounded-full bg-[#25d366] hover:bg-[#1ea855] text-white transition-colors"
              >
                <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Buscador estilo WhatsApp (píldora redondeada) */}
        <div className="relative mb-2">
          <svg className="absolute left-3.5 top-2.5 w-3.5 h-3.5 text-[#54656f] dark:text-[#8696a0] pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar o empezar un chat nuevo"
            value={search}
            onChange={handleSearch}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#2a3942] text-[#111b21] dark:text-[#e9edef] placeholder-[#667781] dark:placeholder-[#8696a0]
                       border border-transparent rounded-full
                       focus:outline-none focus:ring-1 focus:ring-[#00a884]"
          />
        </div>

        {/* Filtro de estado */}
        <select
          value={filters.status || ''}
          onChange={handleStatusFilter}
          className="w-full text-xs bg-white dark:bg-[#2a3942] text-[#54656f] dark:text-[#8696a0] border border-[#d1d7db] dark:border-[#2a3942] rounded-lg px-2 py-1.5
                     focus:outline-none focus:ring-1 focus:ring-[#00a884]"
        >
          <option value="">Todos los estados</option>
          <option value="bot">Bot activo</option>
          <option value="open">Abiertos</option>
          <option value="assigned">Asignados</option>
          <option value="resolved">Resueltos</option>
        </select>
      </div>

      {/* ── Pestañas de canal ─────────────────────────── */}
      <div className="flex border-b border-[#d1d7db] dark:border-[#2a3942] bg-white dark:bg-[#111b21]">
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
                  ? 'text-[#00a884] bg-[#f0fdf4] dark:bg-[#00a884]/10'
                  : 'text-[#667781] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef] hover:bg-[#f5f6f6] dark:hover:bg-white/5'
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
                {ch.key === '' ? 'Todos' : ch.key === 'whatsapp' ? 'WA' : ch.key === 'messenger' ? 'MS' : ch.key === 'instagram' ? 'IG' : 'WEB'}
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
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#00a884] rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Lista de conversaciones ───────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-[#00a884] border-t-transparent rounded-full" />
            <span className="text-xs text-[#667781] dark:text-[#8696a0]">Cargando...</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 bg-[#dfe5e7] dark:bg-[#2a3942] rounded-full flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#54656f] dark:text-[#8696a0]" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <p className="text-[#41525d] dark:text-[#e9edef] text-sm font-medium">Sin conversaciones</p>
            <p className="text-[#667781] dark:text-[#8696a0] text-xs mt-1">
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

      {/* ── Modal nueva conversación WhatsApp ──────── */}
      {showNewWA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewWA(false)}>
          <div className="bg-white dark:bg-[#202c33] rounded-2xl shadow-xl w-[360px] max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e9edef] dark:border-[#2a3942]">
              <h3 className="font-semibold text-[#111b21] dark:text-[#e9edef] text-sm">Nueva conversación WhatsApp</h3>
              <button onClick={() => setShowNewWA(false)} className="text-[#667781] hover:text-[#111b21] dark:hover:text-[#e9edef]">
                <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#54656f] dark:text-[#8696a0] mb-1">Número de WhatsApp *</label>
                <input
                  autoFocus
                  type="tel"
                  value={newWAPhone}
                  onChange={e => setNewWAPhone(e.target.value)}
                  placeholder="Ej: 18095551234"
                  className="w-full px-3 py-2 text-sm border border-[#d1d7db] dark:border-[#3b4a54] rounded-lg bg-white dark:bg-[#2a3942] text-[#111b21] dark:text-[#e9edef] placeholder-[#667781] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#54656f] dark:text-[#8696a0] mb-1">Nombre del contacto</label>
                <input
                  type="text"
                  value={newWAName}
                  onChange={e => setNewWAName(e.target.value)}
                  placeholder="Opcional"
                  onKeyDown={e => e.key === 'Enter' && handleCreateWhatsapp()}
                  className="w-full px-3 py-2 text-sm border border-[#d1d7db] dark:border-[#3b4a54] rounded-lg bg-white dark:bg-[#2a3942] text-[#111b21] dark:text-[#e9edef] placeholder-[#667781] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-[#e9edef] dark:border-[#2a3942]">
              <button
                onClick={() => setShowNewWA(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-[#54656f] dark:text-[#8696a0] bg-[#f0f2f5] dark:bg-[#2a3942] rounded-lg hover:bg-[#e9edef] dark:hover:bg-[#3b4a54] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateWhatsapp}
                disabled={!newWAPhone.trim() || creatingWA}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#00a884] rounded-lg hover:bg-[#06987a] disabled:bg-[#d1d7db] dark:disabled:bg-[#3b4a54] disabled:cursor-not-allowed transition-colors"
              >
                {creatingWA ? 'Creando...' : 'Crear conversación'}
              </button>
            </div>
          </div>
        </div>
      )}
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
        flex items-start gap-3 px-3 py-3 cursor-pointer
        border-b border-[#f0f2f5] dark:border-white/5 transition-colors duration-100
        ${isActive ? 'bg-[#f0f2f5] dark:bg-[#2a3942]' : 'hover:bg-[#f5f6f6] dark:hover:bg-white/5'}
      `}
    >
      {/* Avatar con dot de canal */}
      <div className="relative flex-shrink-0 mt-0.5">
        <div className="w-12 h-12 rounded-full flex items-center justify-center
                        font-semibold text-sm select-none bg-[#dfe5e7] dark:bg-[#2a3942] text-[#54656f] dark:text-[#8696a0]">
          {initials}
        </div>
        {/* Dot de canal */}
        <span className={`
          absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${dotColor}
          rounded-full border-2 border-white dark:border-[#111b21]
        `} />
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0 border-b border-transparent">
        <p className="text-[10px] font-mono text-[#00a884] dark:text-[#00a884] opacity-70 mb-0.5">
          {conversation.ticket_number || `#${(conversation.id || '').slice(0, 8)}`}
        </p>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] truncate text-[#111b21] dark:text-[#e9edef] font-medium">
            {name}
          </p>
          {timeAgo && (
            <span className={`text-xs whitespace-nowrap flex-shrink-0 ${conversation.unread_count > 0 ? 'text-[#00a884] font-medium' : 'text-[#667781] dark:text-[#8696a0]'}`}>
              {timeAgo}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-sm text-[#667781] dark:text-[#8696a0] truncate leading-relaxed">{preview}</p>
          {conversation.unread_count > 0 && (
            <span className="bg-[#00a884] text-white text-xs rounded-full min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center font-bold flex-shrink-0">
              {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-1.5">
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${status.className}`}>
            {status.label}
          </span>
          {conversation.assigned_agent?.name && (
            <span className="text-xs text-[#667781] dark:text-[#8696a0] truncate">
              · {conversation.assigned_agent.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
