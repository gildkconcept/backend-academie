// utils/rateLimitAuth.js
const rateLimitMap = new Map();

// Nettoyer les entrées expirées toutes les heures
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.blockedUntil) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 60 * 1000);

function checkRateLimit(username) {
  const now = Date.now();
  const key = `login_${username}`;
  const record = rateLimitMap.get(key);
  
  // Si aucune tentative pour cet utilisateur
  if (!record) {
    return { allowed: true, attemptsLeft: 3 };
  }
  
  // Si bloqué
  if (record.blockedUntil && now < record.blockedUntil) {
    const minutesLeft = Math.ceil((record.blockedUntil - now) / 60000);
    return { 
      allowed: false, 
      blockedUntil: record.blockedUntil,
      minutesLeft,
      message: `Trop de tentatives. Réessayez dans ${minutesLeft} minute(s).`
    };
  }
  
  // Si plus de 3 tentatives, bloquer
  if (record.attempts >= 3) {
    record.blockedUntil = now + 10 * 60 * 1000; // 10 minutes
    rateLimitMap.set(key, record);
    return { 
      allowed: false, 
      blockedUntil: record.blockedUntil,
      minutesLeft: 10,
      message: 'Trop de tentatives. Compte bloqué 10 minutes.'
    };
  }
  
  return { allowed: true, attemptsLeft: 3 - record.attempts };
}

function recordFailedAttempt(username) {
  const key = `login_${username}`;
  const record = rateLimitMap.get(key);
  
  if (!record) {
    rateLimitMap.set(key, {
      attempts: 1,
      firstAttempt: Date.now(),
      blockedUntil: null
    });
  } else {
    record.attempts++;
    rateLimitMap.set(key, record);
  }
}

function resetRateLimit(username) {
  const key = `login_${username}`;
  rateLimitMap.delete(key);
}

module.exports = { checkRateLimit, recordFailedAttempt, resetRateLimit };