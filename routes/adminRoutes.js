const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// ==================== MIDDLEWARE ====================
router.use(authMiddleware);
router.use(roleMiddleware('superadmin'));

// ==================== ROUTES POUR LES VERSETS ====================

router.get('/verses', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('daily_verse')
      .select('*')
      .order('displayed_date', { ascending: false });
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Erreur get verses:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/verses', async (req, res) => {
  try {
    const { verse, reference, displayed_date, is_active } = req.body;
    
    const { data, error } = await supabase
      .from('daily_verse')
      .insert([{ verse, reference, displayed_date, is_active: true }])
      .select()
      .single();
    
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Erreur create verse:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/verses', async (req, res) => {
  try {
    const { id, verse, reference, displayed_date, is_active } = req.body;
    
    const { data, error } = await supabase
      .from('daily_verse')
      .update({ verse, reference, displayed_date, is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Erreur update verse:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/verses', async (req, res) => {
  try {
    const { id } = req.query;
    
    const { error } = await supabase
      .from('daily_verse')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur delete verse:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES POUR LES NOTES MANUELLES ====================

// GET - Récupérer les étudiants sans téléphone, les quiz et les notes manuelles
router.get('/quiz-manual', async (req, res) => {
  try {
    const { studentId } = req.query;
    
    // 1. Récupérer les étudiants sans téléphone
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, full_name, username, level, service_id, phone, has_phone, maison_grace, branch')
      .is('deleted_at', null)
      .eq('has_phone', false)
      .order('full_name');
    
    if (studentsError) throw studentsError;
    
    // 2. Récupérer tous les quiz
    const { data: quizzes, error: quizzesError } = await supabase
      .from('quizzes')
      .select('id, title, level, start_date, end_date')
      .eq('is_active', true)
      .order('title');
    
    if (quizzesError) throw quizzesError;
    
    // 3. Récupérer les notes pour l'étudiant sélectionné
    let manualNotes = [];
    if (studentId) {
      // Requête sans is_manual
      const { data: notes, error: notesError } = await supabase
        .from('quiz_results')
        .select(`
          id,
          student_id,
          quiz_id,
          score,
          total_questions,
          percentage,
          quiz:quizzes(id, title, level, start_date, end_date)
        `)
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false });
      
      if (notesError) throw notesError;
      manualNotes = notes || [];
    }
    
    res.json({
      students: students || [],
      quizzes: quizzes || [],
      manualNotes: manualNotes
    });
  } catch (error) {
    console.error('Erreur GET /quiz-manual:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Créer, modifier ou supprimer une note manuelle
router.post('/quiz-manual', async (req, res) => {
  try {
    const { studentId, quizId, score, totalQuestions, percentage, action } = req.body;
    
    if (action === 'delete') {
      // Supprimer la note
      const { error } = await supabase
        .from('quiz_results')
        .delete()
        .eq('student_id', studentId)
        .eq('quiz_id', quizId);
      
      if (error) throw error;
      return res.json({ success: true, message: 'Note supprimée' });
    }
    
    // Vérifier si une note existe déjà
    const { data: existing, error: checkError } = await supabase
      .from('quiz_results')
      .select('id')
      .eq('student_id', studentId)
      .eq('quiz_id', quizId)
      .maybeSingle();
    
    if (checkError) throw checkError;
    
    if (existing) {
      // Mise à jour si la note existe déjà
      const { error: updateError } = await supabase
        .from('quiz_results')
        .update({
          score,
          total_questions: totalQuestions,
          percentage,
          submitted_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      if (updateError) throw updateError;
      return res.json({ success: true, message: 'Note mise à jour' });
    }
    
    // Créer une nouvelle note
    const { error: insertError } = await supabase
      .from('quiz_results')
      .insert({
        student_id: studentId,
        quiz_id: quizId,
        score,
        total_questions: totalQuestions,
        percentage,
        submitted_at: new Date().toISOString()
      });
    
    if (insertError) throw insertError;
    
    res.json({ success: true, message: 'Note ajoutée' });
  } catch (error) {
    console.error('Erreur POST /quiz-manual:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;