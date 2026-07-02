// backend/src/index.js
// ─────────────────────────────────────────────────────────────
// Servidor principal Tecnossync
// Modificación: crea equipo de 5 empleados en primer arranque
// ─────────────────────────────────────────────────────────────
require('dotenv').config();
const express     = require('express');
const http        = require('http');
const { Server }  = require('socket.io');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');

const logger          = require('./config/logger');
const { connectDB }   = require('./config/database');
const { connectRedis }= require('./config/redis');
const { migrate }     = require('./models');
const routes          = require('./routes');
const messageService  = require('./services/messageService');
const whatsappService = require('./services/whatsappService');
const campaignService = require('./services/campaignService');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const fs   = require('fs');
const path = require('path');
fs.mkdirSync(path.join(__dirname, '../logs'), { recursive: true });

// Crear directorios de uploads al arrancar
const VOUCHER_DIR  = process.env.VOUCHER_UPLOAD_DIR  || path.join(__dirname, '../uploads/vouchers');
const CATALOG_DIR  = process.env.CATALOG_UPLOAD_DIR  || path.join(__dirname, '../uploads/catalogs');
fs.mkdirSync(VOUCHER_DIR,  { recursive: true });
fs.mkdirSync(CATALOG_DIR,  { recursive: true });

const app        = express();
app.set('trust proxy', 1);
const httpServer = http.createServer(app);

// ─────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
    methods:     ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000
});

app.set('io', io);

io.on('connection', (socket) => {
  logger.info(`🔌 Cliente conectado: ${socket.id}`);

  socket.on('join:agents', async (userId) => {
    try {
      const { User } = require('./models');
      const user = await User.findByPk(userId, { attributes: ['company_id', 'role'] });
      const isSuperAdmin = user?.role === 'superadmin';
      const companyId    = user?.company_id;

      if (isSuperAdmin || !companyId) {
        socket.join('agents');
        logger.info(`👤 Superadmin ${userId} unido a sala agents global (socket ${socket.id})`);
      } else {
        socket.join(`agents:${companyId}`);
        logger.info(`👤 Agente ${userId} unido a sala agents:${companyId} (socket ${socket.id})`);
      }
      socket.join(`user:${userId}`);

      // Enviar estado actual de sesiones WA filtrado por empresa
      const waSessions = whatsappService.getAllSessions();
      for (const s of waSessions) {
        if (!isSuperAdmin && companyId) {
          const sessionCid = whatsappService.getSessionCompanyId(s.sessionId);
          if (sessionCid && sessionCid !== companyId) continue;
        }
        socket.emit('whatsapp:status', {
          sessionId:   s.sessionId,
          status:      s.status,
          sessionType: s.sessionType || 'personal'
        });
      }
    } catch (e) {
      // Fallback seguro: sala global si falla la DB
      socket.join('agents');
      socket.join(`user:${userId}`);
      logger.warn(`⚠️  join:agents fallback global para ${userId}: ${e.message}`);
    }
  });

  socket.on('join:conversation', (conversationId) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on('leave:conversation', (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on('typing:start', ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit('typing:start', { conversationId });
  });

  socket.on('disconnect', () => {
    logger.info(`🔌 Cliente desconectado: ${socket.id}`);
  });

  socket.on("join:whatsapp", (sessionId) => {
    socket.join(`session:${sessionId}`);
    logger.debug(`Cliente unido a session whatsapp: ${sessionId}`);

    // Re-emit cached QR/status so late-joining clients don't miss the event
    const session = whatsappService.getSession(sessionId);
    if (session) {
      if (session.status === 'connecting' && session.qr) {
        socket.emit('whatsapp:qr', {
          sessionId,
          qr: session.qr,
          sessionType: session.sessionType
        });
      }
      socket.emit('whatsapp:status', {
        sessionId,
        status: session.status,
        sessionType: session.sessionType
      });
    }
  });
});

messageService.setSocketIO(io);
whatsappService.setSocketIO(io);
try { require('./services/notificationService').setSocketIO(io); } catch (_) {}


// ─────────────────────────────────────
// WIDGET JS — ANTES de helmet para evitar headers restrictivos
// ─────────────────────────────────────
app.get('/widget.js', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.sendFile(path.join(__dirname, '../public/widget.js'));
});

// ─────────────────────────────────────
// MIDDLEWARES
// ─────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc:      ["'self'", "data:", "blob:", "https:"],
      connectSrc:  ["'self'", "wss:", "ws:", "https:"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
      baseUri:     ["'self'"],
      formAction:  ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'sameorigin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  permissionsPolicy: {
    features: {
      camera:        ["()"],
      microphone:    ["()"],
      geolocation:   ["()"],
      payment:       ["()"],
      usb:           ["()"],
      magnetometer:  ["()"],
      gyroscope:     ["()"],
      accelerometer: ["()"],
    },
  },
}));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/widget')) {
    cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] })(req, res, next);
  } else {
    cors({
      origin:         process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials:    true,
      methods:        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })(req, res, next);
  }
});


// Rate limiting: más restrictivo en auth, general en el resto
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 20,                    // 20 intentos de login por IP
  message: { success: false, message: 'Demasiados intentos. Espera 15 minutos.' }
});
app.use('/api/auth/login', authLimiter);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Demasiadas solicitudes. Intenta más tarde.' }
});
app.use('/api', globalLimiter);

// Guardar rawBody para verificación de firma Meta
app.use('/api/webhook', (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { data += chunk; });
  req.on('end',  () => { req.rawBody = data; next(); });
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));

// ─────────────────────────────────────
// RUTAS
// ─────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ success: true, service: 'tecnossync-backend', version: '2.0.0' });
});

// ─────────────────────────────────────
// ARCHIVOS ESTATICOS DE UPLOADS
// IMPORTANTE: debe ir ANTES de notFound para que no sea interceptado
// ─────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

// ─────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────
const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    await migrate();
    campaignService.initializeProcessor();
    require('./services/reminderService').startReminderChecker();
    await seedDefaultTeam();
    await whatsappService.restoreAllSessions();

    httpServer.listen(PORT, () => {
      logger.info(`🚀 Tecnossync Backend en http://localhost:${PORT}`);
      logger.info(`🌍 Entorno: ${process.env.NODE_ENV}`);
      logger.info(`📡 Socket.io activo`);
    });
  } catch (error) {
    logger.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
};

// ─────────────────────────────────────
// EQUIPO POR DEFECTO (5 empleados)
// Solo se crea si la tabla está vacía
// ─────────────────────────────────────
const seedDefaultTeam = async () => {
  const { User } = require('./models');
  const Company  = require('./models/Company');
  const bcrypt   = require('bcryptjs');
  const { Op }   = require('sequelize');

  // ── 1. Garantizar empresa por defecto ──────────────────────
  let company = await Company.findOne({ order: [['created_at', 'ASC']] });
  if (!company) {
    company = await Company.create({
      nombre:      'Tecnossync',
      email:       'contacto@tecnossync.com',
      descripcion: 'Empresa por defecto',
    });
    logger.info(`🏢 Empresa creada: ${company.nombre} (${company.id})`);
  }
  const companyId = company.id;

  // ── 2. Cuentas obligatorias (idempotente — nunca duplica) ──
  const ensureUser = async ({ name, email, password, role, company_id }) => {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      const valid = await bcrypt.compare(password, existing.password_hash);
      if (!valid) {
        const hash = await bcrypt.hash(password, 12);
        await User.update({ password_hash: hash }, { where: { id: existing.id }, hooks: false });
        logger.info(`🔧 Contraseña reparada: ${email}`);
      }
      if (role !== 'superadmin' && !existing.company_id) {
        await User.update({ company_id }, { where: { id: existing.id }, hooks: false });
      }
      return existing;
    }
    const user = await User.create({ name, email, password_hash: password, role, company_id });
    logger.info(`👤 Usuario creado: ${email} (${role})`);
    return user;
  };

  await ensureUser({
    name: 'Super Administrador',
    email:    process.env.SUPERADMIN_EMAIL    || 'superadmin@tecnossync.com',
    password: process.env.SUPERADMIN_PASSWORD || 'TuPassword123',
    role: 'superadmin', company_id: null
  });

  await ensureUser({
    name: 'Administrador',
    email:    process.env.ADMIN_EMAIL    || 'admin@tecnossync.com',
    password: process.env.ADMIN_PASSWORD || 'Tecnossync2025!',
    role: 'admin', company_id: companyId
  });

  // ── 3. Agentes de ejemplo (solo si no hay más usuarios) ────
  const totalUsers = await User.count();
  if (totalUsers <= 2) {
    const agents = [
      { name: 'Ana García',       email: 'ana.garcia@tecnossync.com'       },
      { name: 'Carlos López',     email: 'carlos.lopez@tecnossync.com'     },
      { name: 'María Rodríguez',  email: 'maria.rodriguez@tecnossync.com'  },
      { name: 'Luis Martínez',    email: 'luis.martinez@tecnossync.com'     },
    ];
    for (const a of agents) {
      await ensureUser({ ...a, password: 'Agente2025!', role: 'agent', company_id: companyId });
    }
  }

  // ── 4. Vincular usuarios huérfanos a la empresa ────────────
  const [fixed] = await User.update(
    { company_id: companyId },
    { where: { company_id: null, role: { [Op.ne]: 'superadmin' } }, hooks: false }
  );
  if (fixed > 0) logger.info(`🔗 ${fixed} usuario(s) vinculado(s) a empresa ${company.nombre}`);

  logger.info('─────────────────────────────────────────────');
  logger.info('Cuentas del sistema verificadas');
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`   SuperAdmin: ${process.env.SUPERADMIN_EMAIL || 'superadmin@tecnossync.com'}`);
    logger.info(`   Admin:      ${process.env.ADMIN_EMAIL || 'admin@tecnossync.com'}`);
  }
  logger.info('─────────────────────────────────────────────');
};

// ─────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido. Cerrando servidor...');
  httpServer.close(() => { logger.info('Servidor cerrado'); process.exit(0); });
});

process.on('unhandledRejection', (err) => {
  logger.error('Promesa sin manejar:', err);
});

startServer();
