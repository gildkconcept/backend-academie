// Charger dotenv en premier
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

console.log('📋 Vérification .env:');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅' : '❌');
console.log('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅' : '❌');
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅' : '❌');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const serviceRoutes = require('./src/routes/serviceRoutes');
const sessionRoutes = require('./src/routes/sessionRoutes');
const quizRoutes = require('./src/routes/quizRoutes');
const rankingRoutes = require('./src/routes/rankingRoutes');
const verseRoutes = require('./src/routes/verseRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/rankings', rankingRoutes);
app.use('/api/verses', verseRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📋 API Health: http://localhost:${PORT}/api/health`);
});