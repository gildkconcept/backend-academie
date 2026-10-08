// routes/liveRoutes.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const supabase = require('../config/supabase');

// Appliquer authMiddleware à toutes les routes
router.use(authMiddleware);

// ==================== 🔧 FIX : RATE LIMIT PAR UTILISATEUR ====================
// Le heartbeat frontend est envoyé toutes les 2 minutes (120000ms).
// On autorise 1 requête / 90 secondes PAR UTILISATEUR (via son ID JWT, pas
// par IP) : ça laisse une marge confortable pour le cycle normal, tout en
// bloquant un onglet buggé ou un script qui spammerait l'endpoint.
// Comme c'est keyé par user.id, ça ne pénalise jamais les autres étudiants
// du même réseau (contrairement à un rate limit par IP).
const heartbeatLimiter = rateLimit({
  windowMs: 90 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Heartbeat trop fréquent, réessayez dans quelques secondes.' },
});

// ==================== 🔧 FIX : NETTOYAGE PÉRIODIQUE UNIQUE ====================
// Avant : chaque heartbeat (donc potentiellement 100+ fois en parallèle)
// déclenchait un SELECT + UPDATE sur toute la table online_users pour
// nettoyer les inactifs. Ça multipliait la charge Supabase inutilement.
// Maintenant : un seul job tourne toutes les 60 secondes, quel que soit
// le nombre d'utilisateurs connectés.
const INACTIVITY_THRESHOLD_MS = 3 * 60 * 1000; // 3 min (marge sur le cycle de 2 min)

async function cleanupInactiveUsers() {
  try {
    const threshold = new Date(Date.now() - INACTIVITY_THRESHOLD_MS).toISOString();

    const { data: inactiveUsers, error: selectError } = await supabase
      .from('online_users')
      .select('user_id, user_name')
      .lt('last_seen', threshold)
      .eq('is_online', true);

    if (selectError) {
      console.error('Erreur récupération utilisateurs inactifs:', selectError);
      return;
    }

    if (inactiveUsers && inactiveUsers.length > 0) {
      console.log(`🗑️ Nettoyage périodique: ${inactiveUsers.length} utilisateur(s) marqué(s) hors ligne`);
      await supabase
        .from('online_users')
        .update({ is_online: false })
        .lt('last_seen', threshold)
        .eq('is_online', true);
    }
  } catch (error) {
    console.error('Erreur cleanupInactiveUsers:', error);
  }
}

// Démarre le job au chargement du module (une seule fois par process).
setInterval(cleanupInactiveUsers, 60 * 1000);

// POST - Heartbeat (garder la session active)
router.post('/heartbeat', heartbeatLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { currentPage, isOnline } = req.body;

    const shouldBeOnline = isOnline !== false;

    let userName = req.user.name;
    let profileImageUrl = null;
    let serviceId = null;
    let level = null;
    let branch = null;

    if (userRole === 'student') {
      const { data: student } = await supabase
        .from('students')
        .select('full_name, profile_image_url, service_id, level, branch')
        .eq('id', userId)
        .single();

      if (student) {
        userName = student.full_name;
        profileImageUrl = student.profile_image_url;
        serviceId = student.service_id;
        level = student.level;
        branch = student.branch;
      }
    } else {
      const { data: user } = await supabase
        .from('users')
        .select('name, profile_image_url, service_id')
        .eq('id', userId)
        .single();

      if (user) {
        userName = user.name;
        profileImageUrl = user.profile_image_url;
        serviceId = user.service_id;
      }
    }

    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('online_users')
      .select('id, connected_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      let connectedAt = existing.connected_at;
      if (shouldBeOnline && !connectedAt) {
        connectedAt = now;
      }

      await supabase
        .from('online_users')
        .update({
          last_seen: now,
          current_page: currentPage || null,
          is_online: shouldBeOnline,
          connected_at: shouldBeOnline ? connectedAt : null,
          user_name: userName,
          profile_image_url: profileImageUrl,
          service_id: serviceId,
          level: level,
          branch: branch
        })
        .eq('user_id', userId);
    } else {
      await supabase
        .from('online_users')
        .insert({
          user_id: userId,
          user_name: userName,
          user_role: userRole,
          profile_image_url: profileImageUrl,
          service_id: serviceId,
          level: level,
          branch: branch,
          is_online: shouldBeOnline,
          connected_at: shouldBeOnline ? now : null,
          last_seen: now,
          current_page: currentPage || null
        });
    }

    // 🔧 FIX : plus de nettoyage ici (voir job périodique ci-dessus)

    res.json({ success: true, timestamp: now, connected_at: now });
  } catch (error) {
    console.error('Erreur heartbeat:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Récupérer les utilisateurs en ligne
router.get('/online-users', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { role, serviceId, level, branch, status = 'all' } = req.query;

    // 🔧 FIX : plus de nettoyage inline ici non plus, le job périodique
    // s'en charge déjà toutes les 60s.

    let query = supabase
      .from('online_users')
      .select('*')
      .order('last_seen', { ascending: false });

    if (status === 'online') {
      query = query.eq('is_online', true);
    } else if (status === 'offline') {
      query = query.eq('is_online', false);
    }
    if (role && role !== 'all') {
      query = query.eq('user_role', role);
    }
    if (serviceId && serviceId !== 'all') {
      query = query.eq('service_id', serviceId);
    }
    if (level && level !== 'all') {
      query = query.eq('level', parseInt(level));
    }
    if (branch && branch !== 'all') {
      query = query.eq('branch', branch);
    }

    const { data: users, error } = await query;
    if (error) throw error;

    const serviceIds = [...new Set((users || []).map(u => u.service_id).filter(Boolean))];
    let serviceMap = new Map();
    if (serviceIds.length > 0) {
      const { data: services } = await supabase
        .from('services')
        .select('id, name')
        .in('id', serviceIds);
      serviceMap = new Map((services || []).map(s => [s.id, s.name]));
    }

    const enrichedUsers = (users || []).map((user) => {
      const serviceName = user.service_id ? serviceMap.get(user.service_id) : null;

      let connectedDuration = null;
      if (user.is_online && user.connected_at) {
        const connectedAt = new Date(user.connected_at);
        const now = new Date();
        let diffMs = Math.max(0, now.getTime() - connectedAt.getTime());
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) {
          connectedDuration = `${diffDays}j ${diffHours % 24}h`;
        } else if (diffHours > 0) {
          connectedDuration = `${diffHours}h ${diffMinutes % 60}min`;
        } else {
          connectedDuration = `${diffMinutes}min`;
        }
      }

      let lastSeenFormatted = '';
      if (user.last_seen) {
        const lastSeen = new Date(user.last_seen);
        const now = new Date();
        let diffMinutes = Math.max(0, Math.floor((now.getTime() - lastSeen.getTime()) / 60000));

        if (diffMinutes < 1) {
          lastSeenFormatted = 'À l\'instant';
        } else if (diffMinutes < 60) {
          lastSeenFormatted = `Il y a ${diffMinutes} min`;
        } else if (diffMinutes < 1440) {
          lastSeenFormatted = `Il y a ${Math.floor(diffMinutes / 60)}h`;
        } else {
          lastSeenFormatted = lastSeen.toLocaleDateString('fr-FR');
        }
      }

      return {
        ...user,
        service_name: serviceName,
        connected_duration: connectedDuration,
        last_seen_formatted: lastSeenFormatted
      };
    });

    const onlineUsers = enrichedUsers.filter(u => u.is_online);
    const studentsOnline = onlineUsers.filter(u => u.user_role === 'student').length;
    const managersOnline = onlineUsers.filter(u => u.user_role === 'service_manager').length;

    const serviceCount = new Map();
    onlineUsers.forEach(u => {
      if (u.service_name) {
        serviceCount.set(u.service_name, (serviceCount.get(u.service_name) || 0) + 1);
      } else if (u.service_id) {
        serviceCount.set(`Service ${u.service_id}`, (serviceCount.get(`Service ${u.service_id}`) || 0) + 1);
      }
    });
    let mostActiveService = null;
    let maxCount = 0;
    for (const [service, count] of serviceCount) {
      if (count > maxCount) {
        maxCount = count;
        mostActiveService = service;
      }
    }

    res.json({
      users: enrichedUsers,
      stats: {
        totalOnline: onlineUsers.length,
        studentsOnline,
        managersOnline,
        mostActiveService
      },
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur getOnlineUsers:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Déconnecter manuellement un utilisateur (superadmin uniquement)
router.post('/disconnect/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    console.log(`🔌 Déconnexion manuelle de l'utilisateur: ${userId}`);

    await supabase
      .from('online_users')
      .update({ is_online: false })
      .eq('user_id', userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur disconnect:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;