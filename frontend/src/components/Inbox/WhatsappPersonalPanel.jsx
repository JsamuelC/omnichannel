// frontend/src/components/Inbox/WhatsappPersonalPanel.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWhatsappStore } from '../../store';
import { whatsappApi } from '../../services/whatsappApi';
import { getSocket, joinWhatsappSession } from '../../services/socket';
import { notifyNewMessage, clearBadge, requestPermission } from '../../services/notificationService';
import { Search, Phone, MoreVertical, Paperclip, Smile, Mic, Send, Bot, Settings, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_DOT = {
  connected:    'bg-emerald-500',
  connecting:   'bg-amber-400 animate-pulse',
  disconnected: 'bg-red-500',
  not_found:    'bg-slate-400',
};


// Colores de avatar según nombre
const AVATAR_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-pink-500',
  'bg-orange-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500'
];

const getAvatarColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name, jid) => {
  const n = name || jid?.replace('@s.whatsapp.net', '') || '?';
  const words = n.trim().split(' ').filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  const now  = new Date();
  const diff = now - date;
  if (diff < 86400000) return date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return date.toLocaleDateString('es-DO', { weekday: 'short' });
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const formatMsgTime = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp * 1000).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
};

const chatDisplayName = (jid, name) =>
  name?.trim() || jid?.replace('@s.whatsapp.net', '') || '';

export default function WhatsappPersonalPanel() {
  const {
    sessions, setSessions, updateSessionStatus,
    activeSession, setActiveSession,
    activeChat, setActiveChat,
    addMessage, getMessages, setChats
  } = useWhatsappStore();

  const [msgText,       setMsgText]       = useState('');
  const [loadingChats,  setLoadingChats]  = useState(false);
  const [loadingMsgs,   setLoadingMsgs]   = useState(false);
  const [chatList,      setChatList]      = useState([]);
  const [filtered,      setFiltered]      = useState([]);
  const [search,        setSearch]        = useState('');
  const [botEnabled,    setBotEnabled]    = useState(null);
  const [botPrompt,     setBotPrompt]     = useState('');
  const [showBotPanel,  setShowBotPanel]  = useState(false);
  const [savingBot,     setSavingBot]     = useState(false);
  const [sending,       setSending]       = useState(false);
  const [showNewChat,   setShowNewChat]   = useState(false);
  const [newChatNumber, setNewChatNumber] = useState('');
  const [syncing,       setSyncing]       = useState(false);
  const bottomRef = useRef(null);
  const fileRef   = useRef(null);
  const inputRef  = useRef(null);

  // Filtrar por búsqueda
  useEffect(() => {
    if (!search.trim()) { setFiltered(chatList); return; }
    const q = search.toLowerCase();
    setFiltered(chatList.filter(c =>
      chatDisplayName(c.jid, c.contact_name).toLowerCase().includes(q) ||
      c.last_message?.toLowerCase().includes(q)
    ));
  }, [search, chatList]);

  useEffect(() => {
    requestPermission();
    whatsappApi.getAllSessions()
      .then(res => {
        const list = res.data || [];
        setSessions(list);
        list.forEach(s => joinWhatsappSession(s.sessionId));
      })
      .catch(() => setSessions([]));

    const socket = getSocket();
    if (!socket) return;

    socket.on('whatsapp:message', (msg) => {
      addMessage(msg.sessionId, msg);
      if (!msg.fromMe) notifyNewMessage(msg);
      setChatList(prev => {
        const exists = prev.find(c => c.jid === msg.from);
        if (exists) {
          return prev
            .map(c => c.jid === msg.from
              ? { ...c, last_message: msg.body, last_message_at: msg.timestamp, unread_count: msg.fromMe ? c.unread_count : (c.unread_count || 0) + 1 }
              : c
            ).sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0));
        }
        return [{
          jid: msg.from, contact_name: msg.pushName || '',
          last_message: msg.body, last_message_at: msg.timestamp, unread_count: msg.fromMe ? 0 : 1
        }, ...prev];
      });
    });

    socket.on('whatsapp:status', ({ sessionId, status }) => {
      updateSessionStatus(sessionId, status);
      if (status === 'connected') { setSyncing(true); toast.success(sessionId + ' conectado'); }
      if (status === 'disconnected') toast.error(sessionId + ' desconectado');
    });

    socket.on('whatsapp:chats_synced', ({ sessionId: sid }) => {
      setSyncing(false);
      if (sid === activeSession) {
        whatsappApi.getChats(sid)
          .then(res => setChatList(res.data?.chats || []))
          .catch(() => {});
      }
    });

    return () => {
      socket.off('whatsapp:message');
      socket.off('whatsapp:status');
      socket.off('whatsapp:chats_synced');
    };
  }, []);

  useEffect(() => {
    if (!activeSession) return;
    setLoadingChats(true);
    setChatList([]);
    whatsappApi.getChats(activeSession)
      .then(res => setChatList(res.data?.chats || []))
      .catch(() => setChatList([]))
      .finally(() => setLoadingChats(false));
  }, [activeSession]);

  const messages = activeSession && activeChat ? getMessages(activeSession, activeChat) : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleOpenChat = useCallback(async (jid) => {
    setActiveChat(jid);
    clearBadge();
    setLoadingMsgs(true);
    setShowBotPanel(false);
    setBotEnabled(null);
    setBotPrompt('');
    try {
      const [histRes, configRes] = await Promise.all([
        whatsappApi.getHistory(activeSession, jid),
        whatsappApi.getChatConfig(activeSession, jid)
      ]);
      const msgs = (histRes.data?.messages || []).map(m => ({
        sessionId: m.session_id, from: m.jid, body: m.body,
        timestamp: m.timestamp, fromMe: m.from_me,
        pushName: m.contact_name || '', contentType: m.content_type || 'text',
        mediaUrl: m.metadata?.media_url || null
      }));
      setChats(activeSession, jid, msgs);
      setBotEnabled(configRes.data?.bot_enabled ?? null);
      setBotPrompt(configRes.data?.bot_prompt || '');
      setChatList(prev => prev.map(c => c.jid === jid ? { ...c, unread_count: 0 } : c));
    } catch {
      toast.error('No se pudo cargar el historial');
    } finally {
      setLoadingMsgs(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeSession]);

  const handleStartNewChat = async () => {
    if (!newChatNumber.trim() || !activeSession) return;
    const number = newChatNumber.trim().replace(/[\s\-\(\)]/g, '');
    const jid    = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    setShowNewChat(false);
    setNewChatNumber('');
    if (!chatList.find(c => c.jid === jid)) {
      setChatList(prev => [{ jid, contact_name: '', last_message: '', last_message_at: 0, unread_count: 0 }, ...prev]);
    }
    await handleOpenChat(jid);
  };

  const handleBotModeChange = async (val) => {
    const newVal = val === 'global' ? null : val === 'on' ? true : false;
    setSavingBot(true);
    try {
      await whatsappApi.toggleBot(activeSession, activeChat, newVal, botPrompt);
      setBotEnabled(newVal);
      toast.success(val === 'global' ? 'Usando prompt global' : val === 'on' ? 'Bot activado' : 'Bot desactivado');
    } catch (e) { toast.error(e.message); }
    finally { setSavingBot(false); }
  };

  const handleSavePrompt = async () => {
    setSavingBot(true);
    try {
      await whatsappApi.toggleBot(activeSession, activeChat, botEnabled, botPrompt);
      toast.success('Prompt guardado');
      setShowBotPanel(false);
    } catch (e) { toast.error(e.message); }
    finally { setSavingBot(false); }
  };

  const handleSend = async () => {
    if (!msgText.trim() || !activeSession || !activeChat || sending) return;
    const text = msgText.trim();
    setMsgText('');
    setSending(true);
    try {
      await whatsappApi.sendMessage(activeSession, activeChat, text);
      addMessage(activeSession, {
        sessionId: activeSession, from: activeChat, body: text,
        timestamp: Math.floor(Date.now() / 1000), fromMe: true,
        contentType: 'text', mediaUrl: null
      });
      setChatList(prev => prev.map(c =>
        c.jid === activeChat ? { ...c, last_message: text, last_message_at: Math.floor(Date.now() / 1000) } : c
      ).sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0)));
    } catch (e) { toast.error(e.message); setMsgText(text); }
    finally { setSending(false); inputRef.current?.focus(); }
  };

  const handleSendMedia = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeSession || !activeChat) return;
    setSending(true);
    try {
      await whatsappApi.sendMedia(activeSession, activeChat, file);
      toast.success('Archivo enviado');
    } catch (err) { toast.error(err.message); }
    finally { setSending(false); e.target.value = ''; }
  };

  const activeContactName = activeChat
    ? chatDisplayName(activeChat, chatList.find(c => c.jid === activeChat)?.contact_name)
    : '';

  const botMode = botEnabled === null ? 'global' : botEnabled ? 'on' : 'off';

  if (!sessions.length) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-8 h-8 text-green-500" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.49"/>
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-600">Sin sesiones vinculadas</p>
        <p className="text-xs mt-1">Ve a <span className="text-indigo-500 font-medium">Configuracion - WhatsApp</span> para conectar</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden bg-[#f0f2f5]">

      {/* ── PANEL IZQUIERDO ─────────────────────────────── */}
      <div className="w-[380px] flex-shrink-0 flex flex-col bg-white border-r border-[#e9edef]">

        {/* Header sesiones */}
        <div className="bg-[#f0f2f5] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {sessions.map(({ sessionId, status }) => (
              <button
                key={sessionId}
                onClick={() => setActiveSession(sessionId)}
                title={sessionId}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  activeSession === sessionId
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-green-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] || 'bg-slate-400'}`} />
                <span className="truncate max-w-[80px]">{sessionId}</span>
              </button>
            ))}
          </div>
          {activeSession && (
            <button
              onClick={() => setShowNewChat(!showNewChat)}
              className="ml-2 p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors flex-shrink-0"
              title="Nuevo chat"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>

        {/* Nuevo chat */}
        {showNewChat && (
          <div className="px-3 py-2 bg-white border-b border-[#e9edef] flex gap-2">
            <input
              autoFocus
              value={newChatNumber}
              onChange={e => setNewChatNumber(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleStartNewChat(); if (e.key === 'Escape') setShowNewChat(false); }}
              placeholder="Numero ej: 18091234567"
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-green-200 outline-none focus:ring-2 focus:ring-green-400 bg-[#f0f2f5]"
            />
            <button onClick={handleStartNewChat} className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg font-medium hover:bg-green-600">
              Ir
            </button>
            <button onClick={() => setShowNewChat(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Buscador */}
        <div className="px-3 py-2 bg-white border-b border-[#e9edef]">
          <div className="flex items-center gap-2 bg-[#f0f2f5] rounded-lg px-3 py-2">
            <Search size={15} className="text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar o iniciar un chat"
              className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder-slate-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Lista de chats */}
        <div className="flex-1 overflow-y-auto">
          {!activeSession ? (
            <div className="text-center py-12 text-sm text-slate-400">Selecciona una sesion</div>
          ) : loadingChats || syncing ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="animate-spin w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full" />
              <span className="text-sm text-slate-400">{syncing ? 'Sincronizando WhatsApp...' : 'Cargando chats...'}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              {search ? 'Sin resultados' : 'Sin conversaciones aun'}
            </div>
          ) : (
            filtered.map(chat => {
              const name     = chatDisplayName(chat.jid, chat.contact_name);
              const isActive = activeChat === chat.jid;
              const color    = getAvatarColor(name);
              const initials = getInitials(chat.contact_name, chat.jid);
              return (
                <div
                  key={chat.jid}
                  onClick={() => handleOpenChat(chat.jid)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-[#e9edef] transition-colors ${
                    isActive ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-full ${color} text-white flex items-center justify-center font-semibold text-sm flex-shrink-0`}>
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#111b21] truncate">{name}</p>
                      <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                        {formatTime(chat.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-slate-500 truncate flex-1">
                        {chat.last_message || 'Sin mensajes'}
                      </p>
                      {chat.unread_count > 0 && (
                        <span className="ml-2 bg-[#25d366] text-white text-xs rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-medium flex-shrink-0">
                          {chat.unread_count > 99 ? '99+' : chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── PANEL DERECHO: CHAT ──────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeChat ? (
          /* Empty state estilo WhatsApp Web */
          <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#f0f2f5]">
            <div className="w-24 h-24 rounded-full bg-white shadow-sm flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-12 h-12 text-[#25d366]" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.49"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-2xl font-light text-[#41525d]">Tecnossync WhatsApp</p>
              <p className="text-sm text-slate-400 mt-2">Selecciona un chat para comenzar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header del chat */}
            <div className="bg-[#f0f2f5] px-4 py-3 flex items-center justify-between border-b border-[#e9edef] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${getAvatarColor(activeContactName)} text-white flex items-center justify-center font-semibold text-sm flex-shrink-0`}>
                  {getInitials(chatList.find(c => c.jid === activeChat)?.contact_name, activeChat)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111b21]">{activeContactName}</p>
                  <p className="text-xs text-slate-400">{activeChat.replace('@s.whatsapp.net', '')}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Bot toggle */}
                <div className="flex items-center gap-1 mr-2">
                  <Bot size={14} className={botMode === 'off' ? 'text-slate-400' : 'text-violet-500'} />
                  <select
                    value={botMode}
                    onChange={e => handleBotModeChange(e.target.value)}
                    disabled={savingBot}
                    className="text-xs rounded-lg px-2 py-1 border outline-none bg-white cursor-pointer"
                    style={{ borderColor: botMode === 'off' ? '#e2e8f0' : '#c4b5fd', color: botMode === 'off' ? '#94a3b8' : '#6d28d9' }}
                  >
                    <option value="global">Global</option>
                    <option value="on">Bot activo</option>
                    <option value="off">Sin IA</option>
                  </select>
                </div>

                <button
                  onClick={() => setShowBotPanel(!showBotPanel)}
                  className={`p-2 rounded-full transition-colors ${showBotPanel ? 'bg-violet-100 text-violet-600' : 'text-slate-500 hover:bg-slate-200'}`}
                  title="Configurar bot"
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>

            {/* Panel config bot */}
            {showBotPanel && (
              <div className="bg-violet-50 border-b border-violet-100 px-4 py-3 flex gap-2 flex-shrink-0">
                <input
                  value={botPrompt}
                  onChange={e => setBotPrompt(e.target.value)}
                  placeholder="Instrucciones personalizadas para este chat..."
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-violet-200 bg-white outline-none focus:ring-1 focus:ring-violet-400"
                />
                <button
                  onClick={handleSavePrompt}
                  disabled={savingBot}
                  className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50"
                >
                  Guardar
                </button>
                <button onClick={() => setShowBotPanel(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Mensajes — fondo estilo WhatsApp */}
            <div
              className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-1"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9fdd3' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                backgroundColor: '#efeae2'
              }}
            >
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full gap-2">
                  <div className="animate-spin w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full" />
                  <span className="text-sm text-slate-500">Cargando mensajes...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="bg-white/80 rounded-lg px-4 py-2 text-sm text-slate-500 shadow-sm">
                    Sin mensajes en este chat
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => {
const mediaUrl = msg.mediaUrl || msg.metadata?.media_url;
const fullUrl  = mediaUrl || null;
const showDate = i === 0 || Math.floor(msg.timestamp / 86400) !== Math.floor(messages[i-1]?.timestamp / 86400);

                  return (
                    <React.Fragment key={i}>
                      {showDate && (
                        <div className="flex justify-center my-2">
                          <span className="bg-white/80 text-xs text-slate-500 px-3 py-1 rounded-full shadow-sm">
                            {new Date((msg.timestamp || 0) * 1000).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[65%] rounded-lg shadow-sm overflow-hidden ${
                            msg.fromMe ? 'bg-[#d9fdd3]' : 'bg-white'
                          }`}
                          style={{ borderRadius: msg.fromMe ? '8px 0px 8px 8px' : '0px 8px 8px 8px' }}
                        >
                          {msg.contentType === 'image' && fullUrl && (
                            <img src={fullUrl} alt="imagen" className="max-w-[280px] w-full cursor-pointer" onClick={() => window.open(fullUrl, '_blank')} />
                          )}
                          {msg.contentType === 'audio' && fullUrl && (
                            <div className="px-3 pt-2"><audio controls className="w-full max-w-[240px]"><source src={fullUrl} /></audio></div>
                          )}
                          {msg.contentType === 'video' && fullUrl && (
                            <video controls className="max-w-[280px] w-full"><source src={fullUrl} /></video>
                          )}
                          {msg.contentType === 'document' && fullUrl && (
                            <a href={fullUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 font-medium hover:bg-slate-50">
                              <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                              <span className="truncate max-w-[200px]">{msg.body || 'Documento'}</span>
                            </a>
                          )}
                          {msg.body && msg.contentType !== 'document' && (
                            <p className="px-3 py-2 text-sm text-[#111b21] leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                          )}
                          <div className={`flex items-center justify-end gap-1 px-3 pb-1 -mt-1`}>
                            <span className="text-[11px] text-slate-400">{formatMsgTime(msg.timestamp)}</span>
                            {msg.fromMe && (
                              <svg viewBox="0 0 16 11" className="w-3.5 h-3.5 text-[#53bdeb]" fill="currentColor">
                                <path d="M11.071.653a.45.45 0 0 0-.63 0l-5.741 5.74-2.194-2.193a.45.45 0 0 0-.63.639l2.512 2.511a.45.45 0 0 0 .63 0l6.062-6.061a.45.45 0 0 0-.009-.636z"/>
                                <path d="M15.071.653a.45.45 0 0 0-.63 0l-5.741 5.74-.508-.507a.45.45 0 0 0-.63.638l.826.826a.45.45 0 0 0 .63 0l6.062-6.061a.45.45 0 0 0-.009-.636z"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input de mensaje */}
            <div className="bg-[#f0f2f5] px-4 py-3 flex items-center gap-3 flex-shrink-0">
              <input ref={fileRef} type="file" className="hidden"
                accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleSendMedia}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={sending}
                className="p-2.5 text-slate-500 hover:bg-slate-200 rounded-full transition-colors flex-shrink-0"
                title="Adjuntar archivo"
              >
                <Paperclip size={20} />
              </button>

              <div className="flex-1 bg-white rounded-lg px-4 py-2.5 flex items-center">
                <input
                  ref={inputRef}
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 text-sm text-[#111b21] outline-none placeholder-slate-400 bg-transparent"
                />
              </div>

              <button
                onClick={handleSend}
                disabled={!msgText.trim() || sending}
                className="p-2.5 bg-[#25d366] hover:bg-[#20b859] disabled:bg-slate-300 text-white rounded-full transition-colors flex-shrink-0"
                title="Enviar"
              >
                {sending
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send size={18} />
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}