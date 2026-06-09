// services/notificationService.js
const Notification = require('../models/Notification');
const Student = require('../models/Student');

class NotificationService {
  /**
   * Récupérer les notifications d'un utilisateur
   */
  static async getUserNotifications(userId, limit = 50, unreadOnly = false) {
    const notifications = await Notification.findByUserId(userId, limit, unreadOnly);
    const unreadCount = await Notification.countUnread(userId);
    
    return {
      notifications,
      unreadCount,
      total: notifications.length
    };
  }

  /**
   * Marquer une notification comme lue
   */
  static async markAsRead(notificationId, userId) {
    await Notification.markAsRead(notificationId, userId);
    return { success: true };
  }

  /**
   * Marquer toutes les notifications comme lues
   */
  static async markAllAsRead(userId) {
    await Notification.markAllAsRead(userId);
    return { success: true };
  }

  /**
   * Supprimer une notification
   */
  static async deleteNotification(notificationId, userId) {
    await Notification.delete(notificationId, userId);
    return { success: true };
  }

  /**
   * Créer une notification pour un utilisateur
   */
  static async createNotification(userId, title, message, type = 'announcement', link = null) {
    const notification = await Notification.create({
      user_id: userId,
      title,
      message,
      type,
      link
    });
    return notification;
  }

  /**
   * Créer des notifications pour plusieurs utilisateurs
   */
  static async createManyNotifications(userIds, title, message, type = 'announcement', link = null) {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      title,
      message,
      type,
      link
    }));
    
    await Notification.createMany(notifications);
    return { count: notifications.length };
  }

  /**
   * Envoyer une annonce à tous les étudiants
   */
  static async announceToAll(title, message, type = 'announcement', link = null) {
    const students = await Student.findAll();
    
    if (!students || students.length === 0) {
      throw new Error('Aucun étudiant trouvé');
    }
    
    const notifications = students.map(student => ({
      user_id: student.id,
      title,
      message,
      type,
      link
    }));
    
    await Notification.createMany(notifications);
    return { count: notifications.length };
  }

  /**
   * Envoyer une annonce à un service spécifique
   */
  static async announceToService(serviceId, title, message, type = 'announcement', link = null) {
    const students = await Student.findAll({ serviceId });
    
    if (!students || students.length === 0) {
      throw new Error('Aucun étudiant trouvé pour ce service');
    }
    
    const notifications = students.map(student => ({
      user_id: student.id,
      title,
      message,
      type,
      link
    }));
    
    await Notification.createMany(notifications);
    return { count: notifications.length };
  }

  /**
   * Envoyer une annonce par niveau
   */
  static async announceToLevel(level, title, message, type = 'announcement', link = null) {
    const students = await Student.findAll({ level: level.toString() });
    
    if (!students || students.length === 0) {
      throw new Error('Aucun étudiant trouvé pour ce niveau');
    }
    
    const notifications = students.map(student => ({
      user_id: student.id,
      title,
      message,
      type,
      link
    }));
    
    await Notification.createMany(notifications);
    return { count: notifications.length };
  }
}

module.exports = NotificationService;