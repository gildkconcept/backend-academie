// controllers/notificationController.js
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const supabase = require('../config/supabase');

/**
 * GET - Récupérer les notifications de l'utilisateur connecté
 */
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, unread = 'false' } = req.query;
    
    const notifications = await Notification.findByUserId(
      userId, 
      parseInt(limit), 
      unread === 'true'
    );
    
    const unreadCount = await Notification.countUnread(userId);
    
    res.json({
      notifications: notifications || [],
      unreadCount,
      total: notifications?.length || 0
    });
  } catch (error) {
    console.error('Erreur getMyNotifications:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * PATCH - Marquer une notification comme lue
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    await Notification.markAsRead(id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur markAsRead:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * PATCH - Marquer toutes les notifications comme lues
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    await Notification.markAllAsRead(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur markAllAsRead:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE - Supprimer une notification
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    await Notification.delete(id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur deleteNotification:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Créer une notification (superadmin uniquement)
 */
const createNotification = async (req, res) => {
  try {
    const { userIds, title, message, type, link } = req.body;
    
    if (!userIds || !userIds.length) {
      return res.status(400).json({ error: 'userIds requis' });
    }
    if (!title || !message) {
      return res.status(400).json({ error: 'title et message requis' });
    }
    
    const notifications = userIds.map(userId => ({
      user_id: userId,
      title,
      message,
      type: type || 'announcement',
      link: link || null
    }));
    
    await Notification.createMany(notifications);
    
    res.status(201).json({ 
      success: true, 
      message: `${notifications.length} notification(s) envoyée(s)` 
    });
  } catch (error) {
    console.error('Erreur createNotification:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Annonce à tous les étudiants (superadmin uniquement)
 */
const announceToAll = async (req, res) => {
  try {
    const { title, message, type = 'announcement', link } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ error: 'title et message requis' });
    }
    
    const students = await Student.findAll();
    
    if (!students || students.length === 0) {
      return res.status(404).json({ error: 'Aucun étudiant trouvé' });
    }
    
    const notifications = students.map(student => ({
      user_id: student.id,
      title,
      message,
      type,
      link: link || null
    }));
    
    await Notification.createMany(notifications);
    
    res.json({ 
      success: true, 
      message: `Annonce envoyée à ${notifications.length} étudiants` 
    });
  } catch (error) {
    console.error('Erreur announceToAll:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Annonce à un service spécifique (superadmin uniquement)
 */
const announceToService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { title, message, type = 'announcement', link } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ error: 'title et message requis' });
    }
    
    const students = await Student.findAll({ serviceId });
    
    if (!students || students.length === 0) {
      return res.status(404).json({ error: 'Aucun étudiant trouvé pour ce service' });
    }
    
    const notifications = students.map(student => ({
      user_id: student.id,
      title,
      message,
      type,
      link: link || null
    }));
    
    await Notification.createMany(notifications);
    
    res.json({ 
      success: true, 
      message: `Annonce envoyée à ${notifications.length} étudiants du service` 
    });
  } catch (error) {
    console.error('Erreur announceToService:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Annonce par niveau (superadmin uniquement)
 */
const announceToLevel = async (req, res) => {
  try {
    const { level } = req.params;
    const { title, message, type = 'announcement', link } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ error: 'title et message requis' });
    }
    
    const students = await Student.findAll({ level });
    
    if (!students || students.length === 0) {
      return res.status(404).json({ error: 'Aucun étudiant trouvé pour ce niveau' });
    }
    
    const notifications = students.map(student => ({
      user_id: student.id,
      title,
      message,
      type,
      link: link || null
    }));
    
    await Notification.createMany(notifications);
    
    res.json({ 
      success: true, 
      message: `Annonce envoyée à ${notifications.length} étudiants du niveau ${level}` 
    });
  } catch (error) {
    console.error('Erreur announceToLevel:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  announceToAll,
  announceToService,
  announceToLevel
};