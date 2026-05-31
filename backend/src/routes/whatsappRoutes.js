// backend/src/routes/whatsappRoutes.js
const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { auth, requireRole } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');
const { WhatsappChat, WhatsappMessage } = require('../models');
const { Op } = require('sequelize');

const upload = multer({
  dest: path.join(__dirname, '../../uploads/whatsapp-media')
});

// ═══════════════════════════════════════════════════════
// SESIONES PERSONALES (lo que ya tenías, sin cambios)
// ═══════════════════════════════════════════════════════

// ── Iniciar sesión personal ───────────────────────────
router.post('/session/start', auth, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId requerido' });
    await whatsappService.createSession(sessionId, 'personal');
    res.json({ success: true, message: `Sesión personal ${sessionId} iniciando` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Todas las sesiones ────────────────────────────────
router.get('/sessions', auth, async (req, res) => {
  try {
    const all = whatsappService.getAllSessions();
    if (req.user.role === 'admin') {
      return res.json({ success: true, data: all });
    }
    const mine = all.filter(s =>
      s.sessionId.toLowerCase().includes(req.user.name?.split(' ')[0]?.toLowerCase()) ||
      s.sessionId.toLowerCase().includes(req.user.email?.split('@')[0]?.toLowerCase())
    );
    res.json({ success: true, data: mine });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Estado de sesión ──────────────────────────────────
router.get('/session/:sessionId/status', auth, (req, res) => {
  const status = whatsappService.getSessionStatus(req.params.sessionId);
  res.json({ success: true, data: { sessionId: req.params.sessionId, status } });
});

// ── Desconectar sesión ────────────────────────────────
router.delete('/session/:sessionId', auth, async (req, res) => {
  whatsappService.disconnectSession(req.params.sessionId);
  res.json({ success: true, message: 'Sesión desconectada' });
});

// ── Chats de una sesión personal ──────────────────────
router.get('/session/:sessionId/chats', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = whatsappService.getSession(sessionId);
    const myJid   = session?.sock?.user?.id?.replace(/:\d+/, '') || '';

    const chats = await WhatsappChat.findAll({
      where: {
        session_id:   sessionId,
        session_type: 'personal',
        jid: {
          [Op.and]: [
            { [Op.notLike]: '%@g.us' },
            { [Op.notLike]: '%@lid' },
            { [Op.notLike]: '%@broadcast' },
            { [Op.notLike]: '%status%' },
          ]
        }
      },
      order:      [['last_message_at', 'DESC']],
      limit:      100,
      attributes: ['id', 'jid', 'contact_name', 'last_message',
                   'last_message_at', 'unread_count', 'bot_enabled', 'session_type']
    });

    res.json({ success: true, data: { chats } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Historial de mensajes ─────────────────────────────
router.get('/session/:sessionId/chat/:jid', auth, async (req, res) => {
  try {
    const { sessionId }  = req.params;
    const jid            = decodeURIComponent(req.params.jid);
    const { limit = 50 } = req.query;
    const messages = await WhatsappMessage.findAll({
      where: { session_id: sessionId, jid },
      order: [['timestamp', 'ASC']],
      limit: +limit
    });
    res.json({ success: true, data: { messages } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Config del chat (bot) ─────────────────────────────
router.get('/session/:sessionId/chat/:jid/config', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const jid           = decodeURIComponent(req.params.jid);
    const [chat] = await WhatsappChat.findOrCreate({
      where:    { session_id: sessionId, jid },
      defaults: { session_id: sessionId, jid, bot_enabled: false, session_type: 'personal' }
    });
    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Toggle bot ────────────────────────────────────────
router.patch('/session/:sessionId/chat/:jid/bot', auth, async (req, res) => {
  try {
    const { sessionId }               = req.params;
    const jid                         = decodeURIComponent(req.params.jid);
    const { bot_enabled, bot_prompt } = req.body;
    const [chat] = await WhatsappChat.findOrCreate({
      where:    { session_id: sessionId, jid },
      defaults: { session_id: sessionId, jid, session_type: 'personal' }
    });
    await chat.update({
      bot_enabled,
      ...(bot_prompt !== undefined && { bot_prompt })
    });
    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Enviar mensaje texto ──────────────────────────────
router.post('/send', auth, async (req, res) => {
  try {
    const { sessionId, to, message } = req.body;
    await whatsappService.sendMessage(sessionId, to, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Enviar archivo multimedia ─────────────────────────
router.post('/send-media', auth, upload.single('file'), async (req, res) => {
  try {
    const { sessionId, to, caption } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'Archivo requerido' });

    const session = whatsappService.getSession(sessionId);
    if (!session || session.status !== 'connected')
      return res.status(400).json({ success: false, message: 'Sesión no conectada' });

    const jid  = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const mime = file.mimetype;
    const buf  = fs.readFileSync(file.path);

    if (mime.startsWith('image/')) {
      await session.sock.sendMessage(jid, { image: buf, caption: caption || '', mimetype: mime });
    } else if (mime.startsWith('audio/')) {
      await session.sock.sendMessage(jid, { audio: buf, mimetype: mime, ptt: false });
    } else if (mime.startsWith('video/')) {
      await session.sock.sendMessage(jid, { video: buf, caption: caption || '', mimetype: mime });
    } else {
      await session.sock.sendMessage(jid, { document: buf, fileName: file.originalname, mimetype: mime });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Limpiar mensajes basura ───────────────────────────
router.delete('/cleanup', auth, requireRole('admin'), async (req, res) => {
  try {
    const deleted = await WhatsappMessage.destroy({
      where: {
        body: { [Op.in]: ['[multimedia]', '[Audio]', '[Video]', '[Sticker]', '[Multimedia]'] }
      }
    });
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Sincronizar nombres de contactos ──────────────────
router.post('/session/:sessionId/sync-contacts', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = whatsappService.getSession(sessionId);
    if (!session || session.status !== 'connected')
      return res.status(400).json({ success: false, message: 'Sesion no conectada' });

    const store    = session.sock.store;
    const contacts = store?.contacts || {};

    let updated = 0;
    for (const [jid, contact] of Object.entries(contacts)) {
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') continue;
      const name = contact.name || contact.notify || contact.verifiedName || '';
      if (!name) continue;
      const rows = await WhatsappChat.update(
        { contact_name: name },
        { where: { session_id: sessionId, jid } }
      );
      if (rows[0] > 0) updated++;
    }

    res.json({ success: true, updated, message: `${updated} contactos actualizados` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ═══════════════════════════════════════════════════════
// SESIONES BUSINESS (nuevas rutas para asesores)
// ═══════════════════════════════════════════════════════

// ── Iniciar sesión business del asesor ────────────────
router.post('/business/session/start', auth, async (req, res) => {
  try {
    // El sessionId se construye automáticamente con el ID del asesor
    // así cada asesor tiene exactamente un número business
    const sessionId = `business_${req.user.id}`;
    await whatsappService.createSession(sessionId, 'business');
    res.json({
      success: true,
      sessionId,
      message: `Sesión business iniciando para ${req.user.name || req.user.email}`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Estado de la sesión business del asesor ───────────
router.get('/business/session/status', auth, (req, res) => {
  const sessionId = `business_${req.user.id}`;
  const status    = whatsappService.getSessionStatus(sessionId);
  res.json({ success: true, data: { sessionId, status } });
});

// ── Todas las sesiones business (admin ve todas) ──────
router.get('/business/sessions', auth, async (req, res) => {
  try {
    const all = whatsappService.getBusinessSessions();
    if (req.user.role === 'admin') {
      return res.json({ success: true, data: all });
    }
    // El asesor solo ve la suya
    const mine = all.filter(s => s.sessionId === `business_${req.user.id}`);
    res.json({ success: true, data: mine });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Desconectar sesión business del asesor ────────────
router.delete('/business/session', auth, async (req, res) => {
  try {
    const sessionId = `business_${req.user.id}`;
    whatsappService.disconnectSession(sessionId);
    res.json({ success: true, message: 'Sesión business desconectada' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Chats de la sesión business del asesor ────────────
router.get('/business/chats', auth, async (req, res) => {
  try {
    const sessionId = `business_${req.user.id}`;

    const chats = await WhatsappChat.findAll({
      where: {
        session_id:   sessionId,
        session_type: 'business',
        jid: {
          [Op.and]: [
            { [Op.notLike]: '%@g.us' },
            { [Op.notLike]: '%@lid' },
            { [Op.notLike]: '%@broadcast' },
            { [Op.notLike]: '%status%' },
          ]
        }
      },
      order:      [['last_message_at', 'DESC']],
      limit:      100,
      attributes: ['id', 'jid', 'contact_name', 'last_message',
                   'last_message_at', 'unread_count', 'session_type']
    });

    res.json({ success: true, data: { chats, sessionId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Historial de mensajes business ───────────────────
router.get('/business/chat/:jid', auth, async (req, res) => {
  try {
    const sessionId      = `business_${req.user.id}`;
    const jid            = decodeURIComponent(req.params.jid);
    const { limit = 50 } = req.query;

    const messages = await WhatsappMessage.findAll({
      where: { session_id: sessionId, jid },
      order: [['timestamp', 'ASC']],
      limit: +limit
    });
    res.json({ success: true, data: { messages, sessionId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Enviar mensaje business ───────────────────────────
router.post('/business/send', auth, async (req, res) => {
  try {
    const sessionId = `business_${req.user.id}`;
    const { to, message } = req.body;
    if (!to || !message)
      return res.status(400).json({ success: false, message: 'to y message son requeridos' });

    await whatsappService.sendMessage(sessionId, to, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Enviar multimedia business ────────────────────────
router.post('/business/send-media', auth, upload.single('file'), async (req, res) => {
  try {
    const sessionId = `business_${req.user.id}`;
    const { to, caption } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'Archivo requerido' });

    const session = whatsappService.getSession(sessionId);
    if (!session || session.status !== 'connected')
      return res.status(400).json({ success: false, message: 'Sesión business no conectada' });

    const jid  = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const mime = file.mimetype;
    const buf  = fs.readFileSync(file.path);

    if (mime.startsWith('image/')) {
      await session.sock.sendMessage(jid, { image: buf, caption: caption || '', mimetype: mime });
    } else if (mime.startsWith('audio/')) {
      await session.sock.sendMessage(jid, { audio: buf, mimetype: mime, ptt: false });
    } else if (mime.startsWith('video/')) {
      await session.sock.sendMessage(jid, { video: buf, caption: caption || '', mimetype: mime });
    } else {
      await session.sock.sendMessage(jid, { document: buf, fileName: file.originalname, mimetype: mime });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;