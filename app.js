const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');

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

const app = express();

// Sécurité 
app.use(helmet());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez dans 15 minutes.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes.' },
});

app.use(globalLimiter);

// CORS 
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Middlewares de base 
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Logging HTTP
const morganFormat = process.env.NODE_ENV === 'production'
  ? ':remote-addr :method :url :status :res[content-length] - :response-time ms'
  : 'dev';

app.use(morgan(morganFormat, {
  skip: (req) => req.url === '/api/health', 
}));

// ==================== ROUTES ====================
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/verses', verseRoutes);
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 - Route non trouvée
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Route introuvable',
    path: req.originalUrl,
    method: req.method,
  });
});

// Error handler global
app.use((err, req, res, next) => {
  if (err.type === 'validation') {
    return res.status(422).json({
      error: 'Données invalides',
      details: err.details,
    });
  }
  
  // Body JSON malformé
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON malformé' });
  }

  // Body trop volumineux
  if (err.status === 413) {
    return res.status(413).json({ error: 'Requête trop volumineuse' });
  }

  // Erreur générique
  const status = err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV !== 'production';

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

// Helper validation
function validate(rules) {
  return async (req, res, next) => {
    await Promise.all(rules.map(rule => rule.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    next({ type: 'validation', details: errors.array() });
  };
}

module.exports = { app, validate, body };