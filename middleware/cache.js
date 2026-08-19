

const cacheStore = new Map();

/**
 * @param {number} ttlSeconds - durée de vie du cache en secondes
 * @param {function} keyFn - optionnel, pour personnaliser la clé de cache
 *                            (par défaut : req.originalUrl, donc inclut déjà
 *                            les query params comme ?level=1&serviceId=xxx)
 */
function cacheMiddleware(ttlSeconds, keyFn) {
  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.originalUrl;
    const cached = cacheStore.get(key);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      res.set('X-Cache', 'HIT');
      return res.json(cached.data);
    }

    // On intercepte res.json pour stocker la réponse avant de l'envoyer
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheStore.set(key, { data: body, expiresAt: now + ttlSeconds * 1000 });
      }
      res.set('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

/**
 * Supprime toutes les entrées de cache dont la clé commence par `prefix`.
 * Utile après une action qui invalide des données mises en cache
 * (ex: après avoir modifié un service, invalider '/api/services').
 */
function invalidateCache(prefix) {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) cacheStore.delete(key);
  }
}

// Nettoyage périodique des entrées expirées (évite une fuite mémoire lente)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cacheStore.entries()) {
    if (value.expiresAt <= now) cacheStore.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = { cacheMiddleware, invalidateCache };