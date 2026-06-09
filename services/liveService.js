// services/liveService.js
const OnlineUser = require('../models/OnlineUser');
const Student = require('../models/Student');
const User = require('../models/User');

class LiveService {
  /**
   * Envoyer un heartbeat (maintenir la session active)
   */
  static async sendHeartbeat(userId, userRole, userName, currentPage = null) {
    let profileImageUrl = null;
    let serviceId = null;
    let level = null;
    let branch = null;
    
    if (userRole === 'student') {
      const student = await Student.findById(userId);
      if (student) {
        profileImageUrl = student.profile_image_url;
        serviceId = student.service_id;
        level = student.level;
        branch = student.branch;
      }
    } else {
      const user = await User.findById(userId);
      if (user) {
        profileImageUrl = user.profile_image_url;
        serviceId = user.service_id;
      }
    }
    
    const onlineUser = await OnlineUser.upsert({
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      profile_image_url: profileImageUrl,
      service_id: serviceId,
      level,
      branch,
      current_page: currentPage
    });
    
    // Nettoyer les utilisateurs inactifs
    await OnlineUser.cleanupInactive();
    
    return onlineUser;
  }

  /**
   * Récupérer les utilisateurs en ligne
   */
  static async getOnlineUsers(filters = {}) {
    const users = await OnlineUser.getOnlineUsers(filters);
    
    // Enrichir avec les noms des services
    const supabase = require('../config/supabase');
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
    
    return {
      users: enrichedUsers,
      stats: {
        totalOnline: onlineUsers.length,
        studentsOnline,
        managersOnline,
        mostActiveService
      },
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Déconnecter un utilisateur
   */
  static async disconnectUser(userId) {
    await OnlineUser.setOffline(userId);
    return { success: true };
  }
}

module.exports = LiveService;