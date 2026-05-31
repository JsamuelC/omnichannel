// frontend/src/services/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socket = null;

export const initSocket = (userId) => {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  socket.on('connect', () => {
    console.log('🔌 Socket conectado:', socket.id);
    if (userId) socket.emit('join:agents', userId);
  });

  socket.on('disconnect', () => console.log('🔌 Socket desconectado'));
  socket.on('connect_error', (err) => console.error('Socket error:', err.message));

  return socket;
};

export const getSocket = () => socket;

export const joinConversation = (conversationId) => {
  socket?.emit('join:conversation', conversationId);
};

export const leaveConversation = (conversationId) => {
  socket?.emit('leave:conversation', conversationId);
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};

export const joinWhatsappSession = (sessionId) => {
  socket?.emit('join:whatsapp', sessionId);
};