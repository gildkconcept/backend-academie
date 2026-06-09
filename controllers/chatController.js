// controllers/chatController.js
const ChatGroup = require('../models/ChatGroup');
const ChatMessage = require('../models/ChatMessage');
const ChatUserReadStatus = require('../models/ChatUserReadStatus');
const Student = require('../models/Student');
const User = require('../models/User');
const supabase = require('../config/supabase');

// ==================== GROUPES ====================

/**
 * GET - Récupérer les groupes de l'utilisateur
 */
const getGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    let userData = null;
    
    if (userRole === 'student') {
      userData = await Student.findById(userId);
    }
    
    const groups = await ChatGroup.findByUserId(userId, userRole, userData);
    res.json({ groups: groups || [] });
  } catch (error) {
    console.error('Erreur getGroups:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Créer un nouveau groupe (superadmin uniquement)
 */
const createGroup = async (req, res) => {
  try {
    const { name, type, branch, level, service_id, memberIds = [] } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'name et type requis' });
    }
    
    // Créer le groupe
    const group = await ChatGroup.create({
      name,
      type,
      branch,
      level,
      service_id,
      created_by: req.user.id
    });
    
    // Ajouter les membres
    const members = [...memberIds];
    if (!members.includes(req.user.id)) {
      members.push(req.user.id);
    }
    
    if (members.length > 0) {
      await ChatGroup.addMembers(group.id, members);
    }
    
    res.status(201).json({ success: true, group });
  } catch (error) {
    console.error('Erreur createGroup:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET - Récupérer les membres d'un groupe
 */
const getGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    
    // Vérifier que l'utilisateur est membre
    const isMember = await ChatGroup.isMember(groupId, userId);
    if (!isMember && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    const members = await ChatGroup.getMembers(groupId);
    res.json({ members: members || [] });
  } catch (error) {
    console.error('Erreur getGroupMembers:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Ajouter des membres à un groupe (superadmin uniquement)
 */
const addMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    
    if (!memberIds || !memberIds.length) {
      return res.status(400).json({ error: 'memberIds requis' });
    }
    
    await ChatGroup.addMembers(groupId, memberIds);
    res.json({ success: true, message: `${memberIds.length} membre(s) ajouté(s)` });
  } catch (error) {
    console.error('Erreur addMembers:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Quitter un groupe
 */
const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    
    await ChatGroup.removeMember(groupId, userId);
    res.json({ success: true, message: 'Vous avez quitté le groupe' });
  } catch (error) {
    console.error('Erreur leaveGroup:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== MESSAGES ====================

/**
 * GET - Récupérer les messages d'un groupe
 */
const getMessages = async (req, res) => {
  try {
    const { groupId, limit = 50, before } = req.query;
    const userId = req.user.id;
    
    if (!groupId) {
      return res.status(400).json({ error: 'groupId requis' });
    }
    
    // Vérifier que l'utilisateur est membre
    const isMember = await ChatGroup.isMember(groupId, userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    const messages = await ChatMessage.findByGroupId(groupId, parseInt(limit), before);
    res.json({ messages: messages || [] });
  } catch (error) {
    console.error('Erreur getMessages:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST - Envoyer un message
 */
const sendMessage = async (req, res) => {
  try {
    const { groupId, content, replyTo, type = 'text' } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;
    const userRole = req.user.role;
    
    if (!groupId || !content) {
      return res.status(400).json({ error: 'groupId et content requis' });
    }
    
    // Vérifier que l'utilisateur est membre
    const isMember = await ChatGroup.isMember(groupId, userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    const message = await ChatMessage.create({
      group_id: groupId,
      sender_id: userId,
      sender_name: userName,
      sender_type: userRole === 'student' ? 'student' : userRole,
      content,
      type,
      reply_to: replyTo || null
    });
    
    // Marquer comme lu pour l'expéditeur
    await ChatUserReadStatus.markAsRead(groupId, userId);
    
    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Erreur sendMessage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * PUT - Modifier un message
 */
const editMessage = async (req, res) => {
  try {
    const { messageId, content } = req.body;
    const userId = req.user.id;
    
    if (!messageId || !content) {
      return res.status(400).json({ error: 'messageId et content requis' });
    }
    
    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }
    
    if (message.sender_id !== userId) {
      return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres messages' });
    }
    
    await ChatMessage.update(messageId, { content });
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur editMessage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE - Supprimer un message
 */
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    if (!messageId) {
      return res.status(400).json({ error: 'messageId requis' });
    }
    
    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }
    
    if (message.sender_id !== userId && userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    await ChatMessage.softDelete(messageId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur deleteMessage:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== STATUT DE LECTURE ====================

/**
 * POST - Marquer les messages d'un groupe comme lus
 */
const markAsRead = async (req, res) => {
  try {
    const { groupId } = req.body;
    const userId = req.user.id;
    
    if (!groupId) {
      return res.status(400).json({ error: 'groupId requis' });
    }
    
    await ChatUserReadStatus.markAsRead(groupId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur markAsRead:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getGroups,
  createGroup,
  getGroupMembers,
  addMembers,
  leaveGroup,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead
};