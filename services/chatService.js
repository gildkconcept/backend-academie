// services/chatService.js
const ChatGroup = require('../models/ChatGroup');
const ChatMessage = require('../models/ChatMessage');
const ChatUserReadStatus = require('../models/ChatUserReadStatus');
const Student = require('../models/Student');
const User = require('../models/User');

class ChatService {
  // ==================== GROUPES ====================
  
  /**
   * Récupérer les groupes d'un utilisateur
   */
  static async getUserGroups(userId, userRole) {
    let userData = null;
    
    if (userRole === 'student') {
      userData = await Student.findById(userId);
    }
    
    return await ChatGroup.findByUserId(userId, userRole, userData);
  }

  /**
   * Créer un nouveau groupe
   */
  static async createGroup(groupData, userId) {
    const group = await ChatGroup.create({
      ...groupData,
      created_by: userId
    });
    
    // Ajouter le créateur comme membre
    await ChatGroup.addMember(group.id, userId);
    
    return group;
  }

  /**
   * Ajouter des membres à un groupe
   */
  static async addMembers(groupId, memberIds) {
    await ChatGroup.addMembers(groupId, memberIds);
    return { success: true, count: memberIds.length };
  }

  /**
   * Retirer un membre d'un groupe
   */
  static async removeMember(groupId, userId) {
    await ChatGroup.removeMember(groupId, userId);
    return { success: true };
  }

  /**
   * Vérifier si un utilisateur est membre d'un groupe
   */
  static async isMember(groupId, userId) {
    return await ChatGroup.isMember(groupId, userId);
  }

  // ==================== MESSAGES ====================

  /**
   * Récupérer les messages d'un groupe
   */
  static async getGroupMessages(groupId, limit = 50, before = null) {
    return await ChatMessage.findByGroupId(groupId, limit, before);
  }

  /**
   * Envoyer un message
   */
  static async sendMessage(groupId, senderId, senderName, senderType, content, replyTo = null) {
    const message = await ChatMessage.create({
      group_id: groupId,
      sender_id: senderId,
      sender_name: senderName,
      sender_type: senderType,
      content,
      reply_to: replyTo
    });
    
    // Marquer comme lu pour l'expéditeur
    await ChatUserReadStatus.markAsRead(groupId, senderId);
    
    return message;
  }

  /**
   * Modifier un message
   */
  static async editMessage(messageId, content) {
    return await ChatMessage.update(messageId, { content });
  }

  /**
   * Supprimer un message
   */
  static async deleteMessage(messageId) {
    await ChatMessage.softDelete(messageId);
    return { success: true };
  }

  // ==================== STATUT DE LECTURE ====================

  /**
   * Marquer les messages d'un groupe comme lus
   */
  static async markAsRead(groupId, userId) {
    await ChatUserReadStatus.markAsRead(groupId, userId);
    return { success: true };
  }

  /**
   * Compter les messages non lus pour un utilisateur
   */
  static async countUnread(groupId, userId) {
    return await ChatUserReadStatus.countUnread(groupId, userId);
  }
}

module.exports = ChatService;