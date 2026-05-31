// frontend/src/components/Inbox/WhatsappBusinessPanel.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWhatsappStore } from '../../store';
import { whatsappApi } from '../../services/whatsappApi';
import { getSocket } from '../../services/socket';
import { notifyNewMessage, clearBadge, requestPermission } from '../../services/notificationService';
import { Search, Paperclip, Send, X, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_DOT = {
  connected:    'bg-emerald-500',
  connecting:   'bg-amber-400 animate-pulse',
  disconnected: 'bg-red-500',
  not_found:    'bg-slate-400',
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-cyan-500',
  'bg-sky-500',  'bg-blue-600',   'bg-indigo-600', 'bg-violet-600'
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
  const now   = new Date();
  const diff  = now - date;
  if (diff < 86400000)  return date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return date.toLocaleDateString('es-DO', { weekday: 'short' });
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const formatMsgTime = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp * 1000).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
};

const chatDisplayName = (jid, name) =>
  name?.trim() || jid?.replace('@s.whatsapp.net', '') || '';

export default function WhatsappBusinessPanel() {
  const {
    activeChat, setActiveChat,
    addMessage, getMessages, setChats
  } = useWhatsappStore();

  // Estado propio del panel business
  const [sessionId,     setSessionId]     = useState(null);
  const [sessionStatus, setSessionStatus] = useState('not_found');
  const [qrImage,       setQrImage]       = useState(null);
  const [msgText,       setMsgText]       = useState('');
  const [loadingChats,  setLoadingChats]  = useState(false);
  const [loadingMsgs,   setLoadingMsgs]   = useState(false);
  const [chatList,      setChatList]      = useState([]);
  const [filtered,      setFiltered]      = useState([]);
  const [search,        setSearch]        = useState('');
  const [sending,       setSending]       = useState(false);
  const [showNewChat,   setShowNewChat]   = useState(false);
  const [newChatNumber, setNewChatNumber] = useState('');
  const [syncing,       setSyncing]       = useState(false);
  const [activeBusinessChat, setActiveBusinessChat] = useState(null);

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

  // Al montar: obtener estado de sesión business y suscribir socket
  useEffect(() => {
    requestPermission();
    loadBusinessSession();

    const socket = getSocket();
    if (!socket) return;

    socket.on('whatsapp:qr', ({ sessionId: sid, qr, sessionType }) => {
      if (sessionType === 'business') setQrImage(qr);
    });

    socket.on('whatsapp:status', ({ sessionId: sid, status, sessionType }) => {
      if (sessionType !== 'business') return;
      setSessionStatus(status);
      setQrImage(null);
      if (status === 'connected') {
        toast.success('WhatsApp Business conectado');
        setSyncing(true);
        loadChats(sid);
        setSessionId(sid);
      }
      if (status === 'disconnected') toast.error('WhatsApp Business desconectado');
    });

    socket.on('whatsapp:chats_synced', ({ sessionId: sid, sessionType }) => {
      if (sessionType !== 'business') return;
      setSyncing(false);
      loadChats(sid);
    });

    socket.on('whatsapp:message', (msg) => {
      if (!msg.sessionId?.startsWith('business_')) return;
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

    return () => {
      socket.off('whatsapp:qr');
      socket.off('whatsapp:status');
      socket.off('whatsapp:chats_synced');
      socket.off('whatsapp:message');
    };
  }, []);

  const loadBusinessSession = async () => {
    try {
      const res = await whatsappApi.getBusinessSessionStatus();
      const { sessionId: sid, status } = res.data;
      setSessionId(sid);
      setSessionStatus(status);
      if (status === 'connected') loadChats(sid);
    } catch {
      setSessionStatus('not_found');
    }
  };

  const loadChats = async (sid) => {
    setLoadingChats(true);
    try {
      const res = await whatsappApi.getBusinessChats();
      setChatList(res.data?.chats || []);
      if (sid) setSessionId(res.data?.sessionId || sid);
    } catch {
      setChatList([]);
    } finally {
      setLoadingChats(false);
    }
  };

  const handleConnect = async () => {
    try {
      setQrImage(null);
      setSessionStatus('connecting');
      const res = await whatsappApi.startBusinessSession();
      setSessionId(res.data.sessionId);
      toast.success('Escanea el QR con tu WhatsApp Business');
    } catch (e) {
      toast.error(e.message);
      setSessionStatus('disconnected');
    }
  };

  const handleDisconnect = async () => {
    try {
      await whatsappApi.disconnectBusinessSession();
      setSessionStatus('disconnected');
      setQrImage(null);
      setChatList([]);
      setActiveBusinessChat(null);
      toast.success('Sesión desconectada');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const messages = sessionId && activeBusinessChat
    ? getMessages(sessionId, activeBusinessChat)
    : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleOpenChat = useCallback(async (jid) => {
    setActiveBusinessChat(jid);
    clearBadge();
    setLoadingMsgs(true);
    try {
      const histRes = await whatsappApi.getBusinessHistory(jid);
      const msgs = (histRes.data?.messages || []).map(m => ({
        sessionId: m.session_id, from: m.jid, body: m.body,
        timestamp: m.timestamp, fromMe: m.from_me,
        pushName: m.contact_name || '', contentType: m.content_type || 'text',
        mediaUrl: m.metadata?.media_url || null
      }));
      setChats(histRes.data?.sessionId || sessionId, jid, msgs);
      setChatList(prev => prev.map(c => c.jid === jid ? { ...c, unread_count: 0 } : c));
    } catch {
      toast.error('No se pudo cargar el historial');
    } finally {
      setLoadingMsgs(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [sessionId]);

  const handleStartNewChat = async () => {
    if (!newChatNumber.trim() || !sessionId) return;
    const number = newChatNumber.trim().replace(/[\s\-\(\)]/g, '');
    const jid    = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    setShowNewChat(false);
    setNewChatNumber('');
    if (!chatList.find(c => c.jid === jid)) {
      setChatList(prev => [{ jid, contact_name: '', last_message: '', last_message_at: 0, unread_count: 0 }, ...prev]);
    }
    await handleOpenChat(jid);
  };

  const handleSend = async () => {
    if (!msgText.trim() || !sessionId || !activeBusinessChat || sending) return;
    const text = msgText.trim();
    setMsgText('');
    setSending(true);
    try {
      await whatsappApi.sendBusinessMessage(activeBusinessChat, text);
      addMessage(sessionId, {
        sessionId, from: activeBusinessChat, body: text,
        timestamp: Math.floor(Date.now() / 1000), fromMe: true,
        contentType: 'text', mediaUrl: null
      });
      setChatList(prev => prev.map(c =>
        c.jid === activeBusinessChat
          ? { ...c, last_message: text, last_message_at: Math.floor(Date.now() / 1000) }
          : c
      ).sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0)));
    } catch (e) {
      toast.error(e.message);
      setMsgText(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

const handleSendMedia = async (e) => {
  const file = e.target.files[0];
  if (!file || !sessionId || !activeBusinessChat) return;
  setSending(true);
  try {
    await whatsappApi.sendBusinessMedia(activeBusinessChat, file);
    
    // ── NUEVO: agregar mensaje localmente para que aparezca ──
    const isImage = file.type.startsWith('image/');
    const localUrl = URL.createObjectURL(file);
    addMessage(sessionId, {
      sessionId,
      from:        activeBusinessChat,
      body:        isImage ? '' : file.name,
      timestamp:   Math.floor(Date.now() / 1000),
      fromMe:      true,
      contentType: isImage ? 'image' : 'document',
      mediaUrl:    localUrl
    });

    toast.success('Archivo enviado');
  } catch (err) {
    toast.error(err.message);
  } finally {
    setSending(false);
    e.target.value = '';
  }
};

  const activeContactName = activeBusinessChat
    ? chatDisplayName(activeBusinessChat, chatList.find(c => c.jid === activeBusinessChat)?.contact_name)
    : '';

  // ── Estado: sin sesión conectada ─────────────────────────
  if (sessionStatus === 'not_found' || sessionStatus === 'disconnected') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Briefcase className="w-10 h-10 text-blue-500" />
        </div>
        <div>
          <p className="text-base font-semibold text-slate-700">WhatsApp Business</p>
          <p className="text-sm text-slate-400 mt-1">Conecta tu número empresarial para atender clientes</p>
        </div>
        <button
          onClick={handleConnect}
          className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Conectar número business
        </button>
      </div>
    );
  }

  // ── Estado: conectando / mostrando QR ────────────────────
  if (sessionStatus === 'connecting') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
        {qrImage ? (
          <>
            <p className="text-sm font-medium text-slate-600">Escanea con tu WhatsApp Business</p>
            <img src={qrImage} alt="QR Business" className="w-64 h-64 rounded-2xl shadow-lg border-4 border-blue-100" />
            <p className="text-xs text-slate-400">Abre WhatsApp Business → Dispositivos vinculados → Vincular dispositivo</p>
          </>
        ) : (
          <>
            <div className="animate-spin w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full" />
            <p className="text-sm text-slate-500">Generando QR...</p>
          </>
        )}
      </div>
    );
  }

  // ── Estado: conectado ─────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden bg-[#f0f4f8]">

      {/* ── PANEL IZQUIERDO ─────────────────────────────── */}
      <div className="w-[380px] flex-shrink-0 flex flex-col bg-white border-r border-[#e2e8f0]">

        {/* Header */}
        <div className="bg-[#ebf4ff] px-4 py-3 flex items-center justify-between border-b border-[#dbeafe]">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-blue-500" />
            <span className="text-sm font-semibold text-blue-700">WhatsApp Business</span>
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[sessionStatus]}`} />
          </div>
          <div className="flex items-center gap-1">
            {sessionStatus === 'connected' && (
              <button
                onClick={() => setShowNewChat(!showNewChat)}
                className="p-2 text-blue-400 hover:bg-blue-100 rounded-full transition-colors"
                title="Nuevo chat"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            <button
              onClick={handleDisconnect}
              className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-400 rounded-full transition-colors"
              title="Desconectar"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Nuevo chat */}
        {showNewChat && (
          <div className="px-3 py-2 bg-white border-b border-[#e2e8f0] flex gap-2">
            <input
              autoFocus
              value={newChatNumber}
              onChange={e => setNewChatNumber(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleStartNewChat(); if (e.key === 'Escape') setShowNewChat(false); }}
              placeholder="Número ej: 18091234567"
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-blue-200 outline-none focus:ring-2 focus:ring-blue-400 bg-[#f0f4f8]"
            />
            <button onClick={handleStartNewChat} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg font-medium hover:bg-blue-600">
              Ir
            </button>
            <button onClick={() => setShowNewChat(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Buscador */}
        <div className="px-3 py-2 bg-white border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2 bg-[#f0f4f8] rounded-lg px-3 py-2">
            <Search size={15} className="text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversación..."
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
          {loadingChats || syncing ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
              <span className="text-sm text-slate-400">{syncing ? 'Sincronizando...' : 'Cargando chats...'}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              {search ? 'Sin resultados' : 'Sin conversaciones aún'}
            </div>
          ) : (
            filtered.map(chat => {
              const name     = chatDisplayName(chat.jid, chat.contact_name);
              const isActive = activeBusinessChat === chat.jid;
              const color    = getAvatarColor(name);
              const initials = getInitials(chat.contact_name, chat.jid);
              return (
                <div
                  key={chat.jid}
                  onClick={() => handleOpenChat(chat.jid)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-[#e2e8f0] transition-colors ${
                    isActive ? 'bg-[#ebf4ff]' : 'hover:bg-[#f5f8ff]'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full ${color} text-white flex items-center justify-center font-semibold text-sm flex-shrink-0`}>
                    {initials}
                  </div>
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
                        <span className="ml-2 bg-blue-500 text-white text-xs rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-medium flex-shrink-0">
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
        {!activeBusinessChat ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#f0f4f8]">
            <div className="w-24 h-24 rounded-full bg-white shadow-sm flex items-center justify-center">
              <Briefcase className="w-12 h-12 text-blue-400" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-light text-[#41525d]">WhatsApp Business</p>
              <p className="text-sm text-slate-400 mt-2">Selecciona un chat para comenzar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header del chat */}
            <div className="bg-[#ebf4ff] px-4 py-3 flex items-center justify-between border-b border-[#dbeafe] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${getAvatarColor(activeContactName)} text-white flex items-center justify-center font-semibold text-sm flex-shrink-0`}>
                  {getInitials(chatList.find(c => c.jid === activeBusinessChat)?.contact_name, activeBusinessChat)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111b21]">{activeContactName}</p>
                  <p className="text-xs text-slate-400">{activeBusinessChat.replace('@s.whatsapp.net', '')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <Briefcase size={11} /> Business
                </span>
              </div>
            </div>

            {/* Mensajes */}
            <div
              className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-1"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23bfdbfe' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                backgroundColor: '#e8f0fe'
              }}
            >
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full gap-2">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
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
                            msg.fromMe ? 'bg-[#dbeafe]' : 'bg-white'
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
                            <a href={fullUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 font-medium hover:bg-slate-50">
                              <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                              <span className="truncate max-w-[200px]">{msg.body || 'Documento'}</span>
                            </a>
                          )}
                          {msg.body && msg.contentType !== 'document' && (
                            <p className="px-3 py-2 text-sm text-[#111b21] leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                          )}
                          <div className="flex items-center justify-end gap-1 px-3 pb-1 -mt-1">
                            <span className="text-[11px] text-slate-400">{formatMsgTime(msg.timestamp)}</span>
                            {msg.fromMe && (
                              <svg viewBox="0 0 16 11" className="w-3.5 h-3.5 text-blue-400" fill="currentColor">
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

            {/* Input */}
            <div className="bg-[#ebf4ff] px-4 py-3 flex items-center gap-3 flex-shrink-0 border-t border-[#dbeafe]">
              <input ref={fileRef} type="file" className="hidden"
                accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleSendMedia}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={sending}
                className="p-2.5 text-blue-400 hover:bg-blue-100 rounded-full transition-colors flex-shrink-0"
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
                className="p-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white rounded-full transition-colors flex-shrink-0"
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