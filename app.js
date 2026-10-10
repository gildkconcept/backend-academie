const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('./middleware/auth');

// Routes
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const quizRoutes = require('./routes/quizRoutes');
const rankingRoutes = require('./routes/rankingRoutes');
const verseRoutes = require('./routes/verseRoutes');
const liveRoutes = require('./routes/liveRoutes');
const statsRoutes = require('./routes/statsRoutes');
const sessionTypesRoutes = require('./routes/sessionTypesRoutes');
const serviceAttendanceRoutes = require('./routes/serviceAttendanceRoutes');
const serviceSessionsRoutes = require('./routes/serviceSessionsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const profileRoutes = require('./routes/profileRoutes');
const badgesRoutes = require('./routes/badgesRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');
const chatRoutes = require('./routes/chatRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const documentRoutes = require('./routes/documentRoutes');
const cardRoutes = require('./routes/cardRoutes');
const cardVerifyRoutes = require('./routes/cardVerifyRoutes');

const app = express();

const isDev = process.env.NODE_ENV !== 'production';

// ==================== 🔧 FIX #1 : TRUST PROXY ====================
// OBLIGATOIRE car le backend tourne derrière Nginx (CloudPanel) sur le VPS.
// Sans ça, req.ip renvoie l'IP interne de Nginx pour TOUT LE MONDE,
// donc express-rate-limit traite tous tes étudiants comme UNE SEULE personne.
// C'est la cause principale du blocage "réessayez dans 15 minutes" en masse.
// "1" = on fait confiance au premier proxy devant l'app (Nginx).
app.set('trust proxy', 1);

// ==================== CORS (DOIT ÊTRE EN PREMIER) ====================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://academie-de-la-grace-gold.vercel.app',
  'https://www.academiedelagrace.org',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.log(`❌ CORS bloqué pour: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'Cookie'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ==================== SÉCURITÉ ====================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ==================== 🔧 FIX #2 : RATE LIMITERS ADAPTÉS ====================
// Contexte important : beaucoup d'étudiants se connectent depuis le même
// Wi-Fi (église) ou le même réseau mobile (CGNAT), donc ils PARTAGENT
// souvent la même IP publique même une fois trust proxy corrigé.
// On desserre donc fortement les limites en prod, et on exclut les routes
// de polling (heartbeat, online-users, notifications) qui sont appelées
// très fréquemment par des utilisateurs légitimes.

const POLLING_ROUTES = [
  '/api/verses/today',
  '/api/health',
  '/api/live/heartbeat',
  '/api/live/online-users',
  '/api/notifications',
];

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // 🔧 FIX : 100 était beaucoup trop bas pour une école entière derrière
  // la même IP. On monte à 2000 (à ajuster selon ta volumétrie réelle).
  max: isDev ? 5000 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez dans 15 minutes.' },
  skip: (req) => POLLING_ROUTES.some(route => req.path.startsWith(route)),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // 🔧 FIX : 10 tentatives partagées par toute une école = tout le monde
  // bloqué en quelques secondes. On monte fortement la limite globale par IP
  // ET on limite en plus par identifiant (voir rateLimitAuth.js, déjà en place),
  // qui lui reste la vraie protection anti brute-force par compte.
  max: isDev ? 200 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion depuis ce réseau, réessayez dans 15 minutes.' },
  // 🔧 FIX : on limite par IP + username combinés plutôt que par IP seule,
  // pour ne pas pénaliser tous les étudiants d'un même Wi-Fi quand un seul
  // se trompe de mot de passe.
  keyGenerator: (req) => {
    const username = req.body?.username || 'unknown';
    return `${req.ip}_${username}`;
  },
});

app.use(globalLimiter);

// ==================== MIDDLEWARES DE BASE ====================
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ==================== LOGGING HTTP ====================
const morganFormat = isDev ? 'dev' : ':remote-addr :method :url :status :res[content-length] - :response-time ms';

app.use(morgan(morganFormat, {
  skip: (req) => req.url === '/api/health',
}));

// ==================== ROUTES PUBLIQUES ====================
app.use('/api/auth', authLimiter, authRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/services', serviceRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/verses', verseRoutes);
app.use('/api/cards/verify', cardVerifyRoutes); // vérification publique d'une carte (QR code)

// ==================== MIDDLEWARE AUTH GLOBAL ====================
app.use(authMiddleware);

// ==================== ROUTES PROTÉGÉES ====================
app.use('/api/students', studentRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/session-types', sessionTypesRoutes);
app.use('/api/service/attendance', serviceAttendanceRoutes);
app.use('/api/service-sessions', serviceSessionsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/badges', badgesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/cards', cardRoutes);

// ==================== 404 ====================
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Route introuvable',
    path: req.originalUrl,
    method: req.method,
  });
});

// ==================== ERROR HANDLER GLOBAL ====================
app.use((err, req, res, next) => {
  if (err.type === 'validation') {
    return res.status(422).json({
      error: 'Données invalides',
      details: err.details,
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON malformé' });
  }

  if (err.status === 413) {
    return res.status(413).json({ error: 'Requête trop volumineuse' });
  }

  const status = err.status || err.statusCode || 500;

  console.error(JSON.stringify({
    level: 'ERROR',
    time: new Date().toISOString(),
    msg: err.message,
    stack: isDev ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method,
  }));

  res.status(status).json({
    error: status === 500 ? 'Erreur interne du serveur' : err.message,
    ...(isDev && { stack: err.stack }),
  });
});

// ==================== HELPER VALIDATION ====================
function validate(rules) {
  return async (req, res, next) => {
    await Promise.all(rules.map(rule => rule.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    next({ type: 'validation', details: errors.array() });
  };
}

module.exports = { app, validate, body };