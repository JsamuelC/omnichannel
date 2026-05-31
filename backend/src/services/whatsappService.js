// backend/src/services/whatsappService.js
const { default: makeWASocket, DisconnectReason,
        useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys')
const { Boom }   = require('@hapi/boom')
const qrcode     = require('qrcode')
const path       = require('path')
const fs         = require('fs')
const logger     = require('../config/logger')
const { WhatsappMessage, WhatsappChat } = require('../models')

const sessions    = {}
const SESSION_DIR = path.join(__dirname, '../../sessions')
const MEDIA_DIR   = path.join(__dirname, '../../uploads/whatsapp-media')

fs.mkdirSync(SESSION_DIR, { recursive: true })
fs.mkdirSync(MEDIA_DIR,   { recursive: true })

let _io = null
const setSocketIO = (io) => { _io = io }

async function saveMedia(msg, contentType) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {})
    const ext    = { image: 'jpg', audio: 'ogg', video: 'mp4', document: 'bin' }[contentType] || 'bin'
    const fname  = `${Date.now()}_${msg.key.id}.${ext}`
    const fpath  = path.join(MEDIA_DIR, fname)
    fs.writeFileSync(fpath, buffer)
    return `/uploads/whatsapp-media/${fname}`
  } catch {
    return null
  }
}

// ── syncChat ahora recibe sessionType ────────────────────────
async function syncChat(sessionId, chat, sessionType = 'personal') {
  const jid = chat.id
  if (!jid || jid === 'status@broadcast') return
  if (jid.endsWith('@g.us')) return
  try {
    await WhatsappChat.findOrCreate({
      where:    { session_id: sessionId, jid },
      defaults: {
        session_id:      sessionId,
        jid,
        session_type:    sessionType,
        contact_name:    chat.name || '',
        last_message:    '',
        last_message_at: chat.conversationTimestamp || 0,
        unread_count:    chat.unreadCount || 0
      }
    })
  } catch (_) {}
}

// ── createSession ahora recibe sessionType ───────────────────
async function createSession(sessionId, sessionType = 'personal') {
  const sessionPath = path.join(SESSION_DIR, sessionId)
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

  const sock = makeWASocket({
    auth:              state,
    printQRInTerminal: false,
    logger:            require('pino')({ level: 'silent' }),
    syncFullHistory:   true
  })

  sessions[sessionId] = { sock, status: 'connecting', sessionType }

  // ── Conexión ─────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      const qrImage = await qrcode.toDataURL(qr)
      _io?.to(`session:${sessionId}`).emit('whatsapp:qr', { sessionId, qr: qrImage, sessionType })
    }

    if (connection === 'open') {
  if (sessions[sessionId]) sessions[sessionId].status = 'connected'
  _io?.to('agents').emit('whatsapp:status', { sessionId, status: 'connected', sessionType })
  logger.info(`✅ WhatsApp ${sessionType} conectado: ${sessionId}`)

  // ── NUEVO: forzar sync de contactos al conectar ──
  setTimeout(async () => {
    try {
      const contacts = await sock.fetchStatus('@all')
      logger.info(`👤 Contactos sincronizados: ${sessionId}`)
    } catch (_) {}
  }, 3000)
}

    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode
      if (sessions[sessionId]) sessions[sessionId].status = 'disconnected'
      _io?.to('agents').emit('whatsapp:status', { sessionId, status: 'disconnected', sessionType })
      if (code !== DisconnectReason.loggedOut) {
        logger.info(`🔄 Reconectando sesión ${sessionType}: ${sessionId}`)
        createSession(sessionId, sessionType)
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)

  // ── chats.set ────────────────────────────────────────────
  sock.ev.on('chats.set', async ({ chats }) => {
    logger.info(`📋 chats.set: ${chats.length} chats para ${sessionId} (${sessionType})`)
    for (const chat of chats) await syncChat(sessionId, chat, sessionType)
    _io?.to('agents').emit('whatsapp:chats_synced', { sessionId, sessionType })
  })

  // ── chats.upsert ─────────────────────────────────────────
  sock.ev.on('chats.upsert', async (chats) => {
    logger.info(`📋 chats.upsert: ${chats.length} chats para ${sessionId} (${sessionType})`)
    for (const chat of chats) await syncChat(sessionId, chat, sessionType)
    _io?.to('agents').emit('whatsapp:chats_synced', { sessionId, sessionType })
  })

  // ── messaging-history.set ────────────────────────────────
  sock.ev.on('messaging-history.set', async ({ chats, contacts, messages }) => {
    logger.info(`📋 messaging-history.set: chats=${chats?.length || 0} contacts=${contacts?.length || 0} messages=${messages?.length || 0} para ${sessionId} (${sessionType})`)

    for (const chat of (chats || [])) await syncChat(sessionId, chat, sessionType)

    for (const contact of (contacts || [])) {
      const jid  = contact.id
      const name = contact.name || contact.notify || contact.verifiedName || ''
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@lid')) continue
      if (!name) continue
      try {
        await WhatsappChat.update(
          { contact_name: name },
          { where: { session_id: sessionId, jid } }
        )
      } catch (_) {}
    }

    for (const msg of (messages || [])) {
      const key       = msg.key
      const m         = msg.message
      const pushName  = msg.pushName || ''
      const timestamp = msg.messageTimestamp || 0

      if (!m || !key?.remoteJid || !key?.id) continue
      const jid = key.remoteJid
      if (jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@lid')) continue

      let body        = ''
      let contentType = 'text'

      if (m.conversation)                   { body = m.conversation;                          contentType = 'text'     }
      else if (m.extendedTextMessage?.text) { body = m.extendedTextMessage.text;               contentType = 'text'     }
      else if (m.imageMessage)              { body = m.imageMessage.caption || '[Imagen]';     contentType = 'image'    }
      else if (m.audioMessage)              { body = '[Audio]';                                contentType = 'audio'    }
      else if (m.videoMessage)              { body = m.videoMessage.caption || '[Video]';      contentType = 'video'    }
      else if (m.documentMessage)           { body = m.documentMessage.fileName || '[Doc]';    contentType = 'document' }
      else                                  { continue }

      if (!body) continue

      try {
        await WhatsappMessage.findOrCreate({
          where:    { external_id: key.id },
          defaults: {
            session_id:   sessionId,
            jid,
            contact_name: pushName,
            body,
            from_me:      key.fromMe || false,
            timestamp,
            external_id:  key.id,
            content_type: contentType,
            metadata:     {}
          }
        })
      } catch (e) {
        logger.error(`❌ Error guardando mensaje histórico: ${e.message}`)
      }
    }

    _io?.to('agents').emit('whatsapp:chats_synced', { sessionId, sessionType })
    logger.info(`✅ messaging-history sincronizado: ${sessionId} (${sessionType})`)
  })

  // ── contacts.set ─────────────────────────────────────────
  sock.ev.on('contacts.set', async ({ contacts }) => {
    logger.info(`👤 contacts.set: ${contacts.length} contactos para ${sessionId}`)
    for (const contact of contacts) {
      const jid  = contact.id
      const name = contact.name || contact.notify || contact.verifiedName || ''
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') continue
      if (!name) continue
      try {
        await WhatsappChat.update(
          { contact_name: name },
          { where: { session_id: sessionId, jid } }
        )
      } catch (_) {}
    }
  })

  // ── contacts.upsert ──────────────────────────────────────
  sock.ev.on('contacts.upsert', async (contacts) => {
    for (const contact of contacts) {
      const jid  = contact.id
      const name = contact.name || contact.notify || contact.verifiedName || ''
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') continue
      if (!name) continue
      try {
        await WhatsappChat.update(
          { contact_name: name },
          { where: { session_id: sessionId, jid } }
        )
      } catch (_) {}
    }
  })

  // ── messages.upsert ──────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    if (!msg?.message) return

    const jid       = msg.key.remoteJid
    const fromMe    = msg.key.fromMe || false
    const extId     = msg.key.id
    const pushName  = msg.pushName || ''
    const timestamp = msg.messageTimestamp

    if (!jid) return
    if (jid.endsWith('@g.us'))      return
    if (jid === 'status@broadcast') return
    if (jid.endsWith('@lid'))       return
    if (timestamp && (Date.now() / 1000 - timestamp) > 86400) return

    let body        = ''
    let contentType = 'text'
    let mediaUrl    = null

    if (msg.message.conversation) {
      body = msg.message.conversation; contentType = 'text'
    } else if (msg.message.extendedTextMessage?.text) {
      body = msg.message.extendedTextMessage.text; contentType = 'text'
    } else if (msg.message.imageMessage) {
      body = msg.message.imageMessage.caption || ''; contentType = 'image'
      mediaUrl = await saveMedia(msg, 'image')
    } else if (msg.message.audioMessage || msg.message.pttMessage) {
      body = '[Audio]'; contentType = 'audio'
      mediaUrl = await saveMedia(msg, 'audio')
    } else if (msg.message.videoMessage) {
      body = msg.message.videoMessage.caption || ''; contentType = 'video'
      mediaUrl = await saveMedia(msg, 'video')
    } else if (msg.message.documentMessage) {
      body = msg.message.documentMessage.fileName || '[Documento]'; contentType = 'document'
      mediaUrl = await saveMedia(msg, 'document')
    } else if (msg.message.stickerMessage) {
      body = '[Sticker]'; contentType = 'image'
      mediaUrl = await saveMedia(msg, 'image')
    } else {
      body = '[Multimedia]'; contentType = 'text'
    }

    try {
      await WhatsappMessage.findOrCreate({
        where:    { external_id: extId },
        defaults: {
          session_id:   sessionId,
          jid,
          contact_name: pushName,
          body,
          from_me:      fromMe,
          timestamp,
          external_id:  extId,
          content_type: contentType,
          metadata:     mediaUrl ? { media_url: mediaUrl } : {}
        }
      })
    } catch (_) {}

    try {
      const [chatRecord] = await WhatsappChat.findOrCreate({
        where:    { session_id: sessionId, jid },
        defaults: { session_id: sessionId, jid, contact_name: pushName, session_type: sessionType }
      })
      await chatRecord.update({
        contact_name:    pushName || chatRecord.contact_name || '',
        last_message:    body,
        last_message_at: timestamp,
        unread_count:    fromMe ? chatRecord.unread_count : chatRecord.unread_count + 1
      })

      // ── Bot solo se activa en sesiones personales, no en business ──
      if (sessionType === 'personal' && !fromMe && contentType === 'text' && body.trim() && chatRecord.bot_enabled !== false) {
        try {
          const chatbotService = require('./chatbotService')
          const { BotConfig }  = require('../models')

          let prompt = chatRecord.bot_prompt || null
          let useBot = chatRecord.bot_enabled

          if (useBot === null || useBot === undefined) {
            const globalConfig = await BotConfig.findOne({
              where: { is_active: true },
              order: [['created_at', 'DESC']]
            })
            if (globalConfig && globalConfig.is_active) {
              prompt = chatRecord.bot_prompt || globalConfig.system_prompt
              useBot = true
            } else {
              useBot = false
            }
          }

          if (!useBot || !prompt) return

          const aiResponse = await chatbotService.generateResponse(prompt, body)
          if (aiResponse) {
            await sock.sendMessage(jid, { text: aiResponse })
            await WhatsappMessage.create({
              session_id:   sessionId,
              jid,
              contact_name: pushName,
              body:         aiResponse,
              from_me:      true,
              timestamp:    Math.floor(Date.now() / 1000),
              content_type: 'text',
              external_id:  `bot_${Date.now()}_${jid}`
            })
            _io?.to('agents').emit('whatsapp:message', {
              sessionId, from: jid, body: aiResponse,
              timestamp: Math.floor(Date.now() / 1000),
              fromMe: true, pushName: 'Bot', contentType: 'text', mediaUrl: null,
              sessionType
            })
          }
        } catch (e) {
          logger.error('Bot Baileys error:', e.message)
        }
      }
    } catch (e) {
      logger.error('Error actualizando chat:', e.message)
    }

    if (!fromMe) {
      _io?.to('agents').emit('whatsapp:message', {
        sessionId, from: jid, body, timestamp,
        pushName, fromMe: false, contentType, mediaUrl,
        sessionType
      })
    }
  })

  return sock
}

async function sendMessage(sessionId, to, text) {
  const session = sessions[sessionId]
  if (!session || session.status !== 'connected')
    throw new Error('Sesión no conectada')
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
  return session.sock.sendMessage(jid, { text })
}

function getSession(sessionId)       { return sessions[sessionId] || null }
function getSessionStatus(sessionId) { return sessions[sessionId]?.status || 'not_found' }

function getAllSessions() {
  return Object.entries(sessions).map(([id, s]) => ({
    sessionId:   id,
    status:      s.status,
    sessionType: s.sessionType || 'personal'
  }))
}

// ── Filtros por tipo ─────────────────────────────────────────
function getPersonalSessions() {
  return getAllSessions().filter(s => s.sessionType === 'personal')
}

function getBusinessSessions() {
  return getAllSessions().filter(s => s.sessionType === 'business')
}

function disconnectSession(sessionId) {
  if (sessions[sessionId]) {
    sessions[sessionId].sock.logout()
    delete sessions[sessionId]
  }
}

async function restoreAllSessions() {
  if (!fs.existsSync(SESSION_DIR)) return
  const dirs = fs.readdirSync(SESSION_DIR).filter(f =>
    fs.statSync(path.join(SESSION_DIR, f)).isDirectory()
  )
  logger.info(`🔄 Restaurando ${dirs.length} sesión(es) de WhatsApp...`)
  for (const sessionId of dirs) {
    try {
      // Detectar tipo por prefijo del sessionId
      const sessionType = sessionId.startsWith('business_') ? 'business' : 'personal'
      await createSession(sessionId, sessionType)
      logger.info(`✅ Sesión ${sessionType} restaurada: ${sessionId}`)
    } catch (e) {
      logger.error(`❌ Error restaurando sesión ${sessionId}: ${e.message}`)
    }
  }
}

module.exports = {
  createSession, sendMessage, getSession,
  getSessionStatus, getAllSessions,
  getPersonalSessions, getBusinessSessions,
  disconnectSession, setSocketIO, restoreAllSessions
}