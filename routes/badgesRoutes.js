// routes/badgesRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const supabase = require('../config/supabase');

// ⚠️ IMPORTANT : Appliquer authMiddleware à TOUTES les routes
router.use(authMiddleware);

// GET - Récupérer les badges d'un étudiant (accessible par l'étudiant lui-même)
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Vérifier les droits : l'étudiant ne peut voir que ses propres badges
    if (userRole !== 'superadmin' && userId !== studentId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    const { data, error } = await supabase
      .from('student_badges')
      .select(`
        *,
        badge:badges(*)
      `)
      .eq('student_id', studentId)
      .order('awarded_at', { ascending: false });
    
    if (error) throw error;
    
    res.json(data || []);
  } catch (error) {
    console.error('Erreur récupération badges étudiant:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Récupérer tous les badges (superadmin uniquement)
router.get('/', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('badges')
      .select('*')
      .order('name');
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Erreur récupération badges:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Attribuer un badge (superadmin uniquement)
router.post('/assign', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { studentId, badgeId } = req.body;
    
    if (!studentId || !badgeId) {
      return res.status(400).json({ error: 'studentId et badgeId requis' });
    }
    
    // Vérifier si le badge existe déjà
    const { data: existing } = await supabase
      .from('student_badges')
      .select('id')
      .eq('student_id', studentId)
      .eq('badge_id', badgeId)
      .maybeSingle();
    
    if (existing) {
      return res.status(400).json({ error: 'Badge déjà attribué' });
    }
    
    const { error } = await supabase
      .from('student_badges')
      .insert({
        student_id: studentId,
        badge_id: badgeId,
        awarded_at: new Date().toISOString()
      });
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Badge attribué avec succès' });
  } catch (error) {
    console.error('Erreur attribution badge:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;