const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const publicRoutes = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/check-username',
    '/api/auth/verify-recovery',
    '/api/auth/reset-account',
    '/api/health',
    '/api/services',
    '/api/verses/today',
    '/api/attendance'
  ];

  const isPublicRoute = publicRoutes.some(route => 
    req.originalUrl === route || req.originalUrl.startsWith(route)
  );

  // ✅ Marquer la route comme publique pour roleMiddleware
  req.isPublicRoute = isPublicRoute;

  if (isPublicRoute) {
    return next();
  }

  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
  }
};

const roleMiddleware = (...roles) => {
  return (req, res, next) => {
    // ✅ Laisser passer les routes publiques sans bloquer
    if (req.isPublicRoute) return next();

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