const jwt = require('jsonwebtoken');

// ============================================================================
// ROUTES RÉELLEMENT PUBLIQUES : méthode HTTP + chemin EXACT.
// Avant : on utilisait startsWith() sur une liste de préfixes, ce qui rendait
// publique TOUTE l'arborescence /api/attendance/... (et marquait ces routes
// comme "publiques" pour roleMiddleware, qui laissait alors tout passer).
// Maintenant : seules ces routes précises sont accessibles sans connexion.
// ============================================================================
const PUBLIC_ROUTES = new Set([
  'POST /api/auth/login',
  'POST /api/auth/register',
  'GET /api/auth/check-username',
  'POST /api/auth/verify-recovery',
  'POST /api/auth/reset-account',
  'GET /api/health',
  'HEAD /api/health',
  'GET /api/services',
  'GET /api/verses/today',
]);

function getCleanPath(req) {
  // On enlève la query string (?a=b) et le "/" final éventuel
  const path = (req.originalUrl || '').split('?')[0];
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

const authMiddleware = (req, res, next) => {
  const isPublicRoute = PUBLIC_ROUTES.has(`${req.method} ${getCleanPath(req)}`);

  // Conservé pour compatibilité (plus utilisé par roleMiddleware)
  req.isPublicRoute = isPublicRoute;

  if (isPublicRoute) {
    return next();
  }

  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  try {
    // On impose l'algorithme HS256 (celui utilisé par jwt.sign par défaut)
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
  }
};

const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    // Plus aucun contournement : sans utilisateur authentifié => 401,
    // avec un mauvais rôle => 403. (Avant, une route "publique" passait.)
    if (!req.user) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    next();
  };
};

module.exports = { authMiddleware, roleMiddleware };