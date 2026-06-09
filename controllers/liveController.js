// controllers/liveController.js
const OnlineUser = require('../models/OnlineUser');
const Student = require('../models/Student');
const User = require('../models/User');
const supabase = require('../config/supabase');

/**
 * POST - Envoyer un heartbeat (garder la session active)
 */
const sendHeartbeat = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { currentPage } = req.body;
    
    let userName = req.user.name;
    let profileImageUrl = null;
    let serviceId = null;
    let level = null;
    let branch = null;
    
    if (userRole === 'student') {
      const student = await Student.findById(userId);
      if (student) {
        userName = student.full_name;
        profileImageUrl = student.profile_image_url;
        serviceId = student.service_id;
        level = student.level;
        branch = student.branch;
      }
    } else {
      const user = await User.findById(userId);
      if (user) {
        userName = user.name;
        profileImageUrl = user.profile_image_url;
        serviceId = user.service_id;
      }
    }
    
    await OnlineUser.upsert({
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      profile_image_url: profileImageUrl,
      service_id: serviceId,
      level,
      branch,
      current_page: currentPage || null
    });
    
    // Nettoyer les anciennes entrées
    await OnlineUser.cleanupInactive();
    
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Erreur sendHeartbeat:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET - Récupérer les utilisateurs en ligne
 */
const getOnlineUsers = async (req, res) => {
  try {
    const { role, serviceId, level, branch, status = 'all' } = req.query;
    
    let filters = {};
    if (status === 'online') filters.isOnline = true;
    if (role && role !== 'all') filters.role = role;
    if (serviceId && serviceId !== 'all') filters.serviceId = serviceId;
    if (level && level !== 'all') filters.level = level;
    if (branch && branch !== 'all') filters.branch = branch;
    
    const users = await OnlineUser.getOnlineUsers(filters);
    
    // Enrichir avec les noms des services
    const enrichedUsers = await Promise.all(users.map(async (user) => {
      let serviceName = null;
      if (user.service_id) {
        const { data: service } = await supabase
          .from('services')
          .select('name')
          .eq('id', user.service_id)
          .single();
        serviceName = service?.name;
      }
      
      // Calculer la durée de connexion
      let connectedDuration = null;
      if (user.connected_at) {
        const diff = Date.now() - new Date(user.connected_at).getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
          connectedDuration = `${hours}h ${minutes % 60}min`;
        } else {
          connectedDuration = `${minutes}min`;
        }
      }
      
      // Formater la dernière activité
      let lastSeenFormatted = '';
      if (user.last_seen) {
        const lastSeen = new Date(user.last_seen);
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);
        
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
};

/**
 * GET - Statistiques de connexion (superadmin uniquement)
 */
const getConnectionStats = async (req, res) => {
  try {
    const { period = 'day' } = req.query;
    
    let interval;
    let days;
    switch (period) {
      case 'week':
        interval = '7 days';
        days = 7;
        break;
      case 'month':
        interval = '30 days';
        days = 30;
        break;
      default:
        interval = '1 day';
        days = 1;
    }
    
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: connections, error } = await supabase
      .from('online_users')
      .select('connected_at, user_role')
      .gte('connected_at', since);
    
    if (error) throw error;
    
    const byRole = {
      superadmin: 0,
      service_manager: 0,
      student: 0
    };
    
    connections?.forEach(c => {
      if (c.user_role === 'superadmin') byRole.superadmin++;
      else if (c.user_role === 'service_manager') byRole.service_manager++;
      else byRole.student++;
    });
    
    res.json({
      period,
      total: connections?.length || 0,
      byRole,
      averagePerDay: Math.round((connections?.length || 0) / days)
    });
  } catch (error) {
    console.error('Erreur getConnectionStats:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Déconnecter un utilisateur (superadmin uniquement)
 */
const disconnectUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.role !== 'superadmin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    await OnlineUser.setOffline(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur disconnectUser:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  sendHeartbeat,
  getOnlineUsers,
  getConnectionStats,
  disconnectUser
};