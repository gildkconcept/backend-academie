// routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

/**
 * GET - Récupérer les numéros de téléphone des étudiants
 * Nécessite le rôle superadmin
 */
router.get('/students', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { serviceId, level, branch, baptized } = req.query;
    
    let query = supabase
      .from('students')
      .select('id, full_name, phone, branch, level, service_id, baptized')
      .is('deleted_at', null)
      .not('phone', 'is', null)
      .neq('phone', '')
      .order('full_name');
    
    if (serviceId && serviceId !== 'all') {
      query = query.eq('service_id', serviceId);
    }
    if (level && level !== 'all') {
      query = query.eq('level', parseInt(level));
    }
    if (branch && branch !== 'all') {
      query = query.eq('branch', branch);
    }
    if (baptized !== undefined && baptized !== 'all') {
      query = query.eq('baptized', baptized === 'true');
    }
    
    const { data: students, error } = await query;
    
    if (error) throw error;
    
    // Formater les numéros
    const formattedStudents = (students || []).map(s => ({
      ...s,
      phone_formatted: s.phone?.replace(/[^0-9]/g, '') || null
    }));
    
    res.json({
      success: true,
      total: formattedStudents.length,
      students: formattedStudents
    });
  } catch (error) {
    console.error('Erreur récupération téléphones:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST - Préparer l'envoi WhatsApp (génère les liens)
 */
router.post('/send', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { message, recipients, includeAll, serviceId, level } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Le message est requis' });
    }
    
    let students = [];
    
    if (includeAll) {
      // Récupérer tous les étudiants
      let query = supabase
        .from('students')
        .select('id, full_name, phone')
        .is('deleted_at', null)
        .not('phone', 'is', null)
        .neq('phone', '');
      
      if (serviceId && serviceId !== 'all') {
        query = query.eq('service_id', serviceId);
      }
      if (level && level !== 'all') {
        query = query.eq('level', parseInt(level));
      }
      
      const { data, error } = await query;
      if (error) throw error;
      students = data || [];
    } else if (recipients && recipients.length > 0) {
      // Récupérer les étudiants spécifiques
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, phone')
        .in('id', recipients)
        .is('deleted_at', null)
        .not('phone', 'is', null)
        .neq('phone', '');
      
      if (error) throw error;
      students = data || [];
    } else {
      return res.status(400).json({ error: 'Aucun destinataire spécifié' });
    }
    
    // Nettoyer les numéros
    const phoneNumbers = students
      .map(s => s.phone?.replace(/[^0-9]/g, ''))
      .filter(phone => phone && phone.length >= 8);
    
    // Générer les liens WhatsApp
    const encodedMessage = encodeURIComponent(message);
    const links = phoneNumbers.map(phone => {
      const formattedPhone = phone.startsWith('225') ? phone : `225${phone}`;
      return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    });
    
    // Compter les statistiques
    const stats = {
      totalStudents: students.length,
      withPhone: phoneNumbers.length,
      withoutPhone: students.length - phoneNumbers.length
    };
    
    res.json({
      success: true,
      stats,
      links,
      preview: {
        message,
        samplePhone: phoneNumbers.slice(0, 3),
        sampleLinks: links.slice(0, 3)
      }
    });
  } catch (error) {
    console.error('Erreur préparation WhatsApp:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST - Envoyer un message groupé via WhatsApp (génère un lien groupé)
 * Note: WhatsApp ne permet pas les envois groupés natifs
 */
router.post('/group-link', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { message, phones } = req.body;
    
    if (!message || !phones || phones.length === 0) {
      return res.status(400).json({ error: 'Message et numéros requis' });
    }
    
    // Nettoyer les numéros
    const cleanPhones = phones.map(p => p.replace(/[^0-9]/g, ''));
    
    // Générer un lien pour chaque numéro
    const encodedMessage = encodeURIComponent(message);
    const links = cleanPhones.map(phone => {
      const formattedPhone = phone.startsWith('225') ? phone : `225${phone}`;
      return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    });
    
    res.json({
      success: true,
      total: links.length,
      links,
      message: 'Liens WhatsApp générés avec succès'
    });
  } catch (error) {
    console.error('Erreur génération liens groupés:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;