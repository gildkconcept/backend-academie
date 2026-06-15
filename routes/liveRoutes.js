// routes/liveRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const supabase = require('../config/supabase');

// Appliquer authMiddleware à toutes les routes
router.use(authMiddleware);

// POST - Heartbeat (garder la session active)
router.post('/heartbeat', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { currentPage, isOnline } = req.body;
    
    // Si isOnline est explicitement false, marquer comme hors ligne
    const shouldBeOnline = isOnline !== false;
    
    console.log(`💓 [Heartbeat] Utilisateur: ${req.user.name}, Rôle: ${userRole}, Online: ${shouldBeOnline}, Page: ${currentPage}`);
    
    let userName = req.user.name;
    let profileImageUrl = null;
    let serviceId = null;
    let level = null;
    let branch = null;
    
    // Récupérer les informations complètes de l'utilisateur
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
    
    // Vérifier si l'utilisateur existe déjà
    const { data: existing } = await supabase
      .from('online_users')
      .select('id, connected_at, service_id, branch, level')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (existing) {
      // Récupérer ou définir connected_at
      let connectedAt = existing.connected_at;
      
      // Si l'utilisateur revient en ligne et n'avait pas de connected_at
      if (shouldBeOnline && !connectedAt) {
        connectedAt = now;
      }
      
      // Mettre à jour avec toutes les informations
      await supabase
        .from('online_users')
        .update({
          last_seen: now,
          current_page: currentPage || null,
          is_online: shouldBeOnline,
          connected_at: shouldBeOnline ? connectedAt : null,
          // ✅ Mettre à jour ces champs à chaque heartbeat
          user_name: userName,
          profile_image_url: profileImageUrl,
          service_id: serviceId,
          level: level,
          branch: branch
        })
        .eq('user_id', userId);
    } else {
      // Créer une nouvelle entrée
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
    
    // Nettoyer les utilisateurs inactifs (plus de 2 minutes sans heartbeat)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: inactiveUsers, error: inactiveError } = await supabase
      .from('online_users')
      .select('user_id, user_name')
      .lt('last_seen', twoMinutesAgo)
      .eq('is_online', true);
    
    if (inactiveError) {
      console.error('Erreur récupération utilisateurs inactifs:', inactiveError);
    } else if (inactiveUsers && inactiveUsers.length > 0) {
      console.log(`🗑️ Marquage de ${inactiveUsers.length} utilisateur(s) comme hors ligne (inactif depuis plus de 2 minutes):`);
      inactiveUsers.forEach(u => console.log(`   - ${u.user_name}`));
      
      await supabase
        .from('online_users')
        .update({ is_online: false })
        .lt('last_seen', twoMinutesAgo)
        .eq('is_online', true);
    }
    
    res.json({ success: true, timestamp: now, connected_at: now });
  } catch (error) {
    console.error('Erreur heartbeat:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Récupérer les utilisateurs en ligne
router.get('/online-users', async (req, res) => {
  try {
    const { role, serviceId, level, branch, status = 'all' } = req.query;
    
    console.log('🔍 [ONLINE-USERS] Récupération des utilisateurs en ligne');
    
    // Nettoyer d'abord les utilisateurs inactifs
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: cleanedUsers } = await supabase
      .from('online_users')
      .update({ is_online: false })
      .lt('last_seen', twoMinutesAgo)
      .eq('is_online', true)
      .select();
    
    if (cleanedUsers && cleanedUsers.length > 0) {
      console.log(`🗑️ Nettoyage: ${cleanedUsers.length} utilisateur(s) marqué(s) hors ligne`);
    }
    
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
    
    console.log(`📊 [ONLINE-USERS] ${users?.length || 0} utilisateurs trouvés dans la base`);
    
    // Enrichir avec les noms des services
    const enrichedUsers = await Promise.all((users || []).map(async (user) => {
      let serviceName = null;
      if (user.service_id) {
        const { data: service, error: serviceError } = await supabase
          .from('services')
          .select('name')
          .eq('id', user.service_id)
          .single();
        
        if (serviceError) {
          console.log(`⚠️ Service non trouvé pour ID: ${user.service_id} - Utilisateur: ${user.user_name}`);
        } else {
          serviceName = service?.name;
        }
      }
      
      // Log pour debug
      console.log(`📊 Utilisateur: ${user.user_name}, rôle: ${user.user_role}, service_id: ${user.service_id}, service_name: ${serviceName}, branch: ${user.branch}, level: ${user.level}`);
      
      // ✅ Calculer la durée de connexion (éviter les valeurs négatives)
      let connectedDuration = null;
      if (user.is_online && user.connected_at) {
        const connectedAt = new Date(user.connected_at);
        const now = new Date();
        let diffMs = now.getTime() - connectedAt.getTime();
        
        // Éviter les valeurs négatives
        if (diffMs < 0) diffMs = 0;
        
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
      
      // Formater la dernière activité
      let lastSeenFormatted = '';
      if (user.last_seen) {
        const lastSeen = new Date(user.last_seen);
        const now = new Date();
        let diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);
        
        // Éviter les valeurs négatives
        if (diffMinutes < 0) diffMinutes = 0;
        
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
    }));
    
    // Statistiques
    const onlineUsers = enrichedUsers.filter(u => u.is_online);
    const studentsOnline = onlineUsers.filter(u => u.user_role === 'student').length;
    const managersOnline = onlineUsers.filter(u => u.user_role === 'service_manager').length;
    
    // Service le plus actif
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
    
    console.log(`📊 [ONLINE-USERS] ${onlineUsers.length} en ligne, ${studentsOnline} étudiants, ${managersOnline} managers`);
    console.log(`📊 Service le plus actif: ${mostActiveService || 'aucun'}`);
    
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