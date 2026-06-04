require('dotenv').config();

const {app} = require('./app');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3001;

// Logs structurés
const log = {
  info:  (msg, meta = {}) => console.log(JSON.stringify({ level: 'INFO',  time: new Date().toISOString(), msg, ...meta })),
  warn:  (msg, meta = {}) => console.warn(JSON.stringify({ level: 'WARN',  time: new Date().toISOString(), msg, ...meta })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'ERROR', time: new Date().toISOString(), msg, ...meta })),
};

// Vérification .env 
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_SECRET'];

log.info('📋 Vérification .env');
const missingVars = requiredEnvVars.filter(key => !process.env[key]);

requiredEnvVars.forEach(key => {
  log.info(`   ${key}: ${process.env[key] ? '✅' : '❌'}`);
});

if (missingVars.length > 0) {
  log.error('Variables d\'environnement manquantes', { missing: missingVars });
  process.exit(1);
}

// Connexion base de données
async function connectDatabase() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { error } = await supabase.from('students').select('count').limit(1);

  if (error) {
    throw new Error(`Connexion Supabase échouée : ${error.message}`);
  }

  log.info('✅ Connexion Supabase établie');
  return supabase;
}

// Démarrage serveur 
async function startServer() {
  await connectDatabase();

  const server = app.listen(PORT, () => {
    log.info('🚀 Serveur démarré', {
      url: `http://localhost:${PORT}`,
      health: `http://localhost:${PORT}/api/health`,
      env: process.env.NODE_ENV || 'development',
    });
  });

  // Graceful shutdown 
  function shutdown(signal) {
    log.warn(`${signal} reçu — arrêt en cours...`);

    server.close((err) => {
      if (err) {
        log.error('Erreur lors de la fermeture du serveur', { error: err.message });
        process.exit(1);
      }
      log.info('✅ Serveur arrêté proprement');
      process.exit(0);
    });

    // Forcer l'arrêt après 10s si le serveur ne se ferme pas
    setTimeout(() => {
      log.error('⏱️ Timeout dépassé — arrêt forcé');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

//  Erreurs non catchées
process.on('uncaughtException', (err) => {
  log.error('💥 uncaughtException — arrêt immédiat', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('💥 unhandledRejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});

// Lancement 
startServer().catch((err) => {
  log.error('❌ Échec du démarrage', { error: err.message });
  process.exit(1);
});