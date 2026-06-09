const express = require('express');
const router = express.Router();
const { getQuizzes, getQuizById, submitQuiz, getMyResults } = require('../controllers/quizController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const supabase = require('../config/supabase');

// Routes protégées
router.use(authMiddleware);

// Routes existantes
router.get('/', getQuizzes);
router.get('/my-results', getMyResults);
router.get('/:id', getQuizById);
router.post('/:id/submit', submitQuiz);

// ==================== NOUVELLES ROUTES ====================

// GET - Historique des quiz (superadmin uniquement)
router.get('/history', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { limit = 50, offset = 0, level, serviceId, branch, search } = req.query;
    
    // Requête de base
    let query = supabase
      .from('quiz_results')
      .select(`
        *,
        student:students(
          id,
          full_name,
          username,
          branch,
          level,
          service_id,
          baptized,
          phone
        ),
        quiz:quizzes(
          id,
          title,
          level,
          start_date,
          end_date
        )
      `)
      .order('submitted_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    
    // Appliquer les filtres
    if (level && level !== 'all') {
      query = query.eq('quiz.level', parseInt(level));
    }
    if (serviceId && serviceId !== 'all') {
      query = query.eq('student.service_id', serviceId);
    }
    if (branch && branch !== 'all') {
      query = query.eq('student.branch', branch);
    }
    if (search) {
      query = query.ilike('student.full_name', `%${search}%`);
    }
    
    const { data: results, error } = await query;
    
    if (error) throw error;
    
    // Compter le total
    let countQuery = supabase
      .from('quiz_results')
      .select('*', { count: 'exact', head: true });
    
    if (level && level !== 'all') {
      const { data: quizzes } = await supabase
        .from('quizzes')
        .select('id')
        .eq('level', parseInt(level));
      const quizIds = quizzes?.map(q => q.id) || [];
      if (quizIds.length > 0) {
        countQuery = countQuery.in('quiz_id', quizIds);
      }
    }
    
    const { count: total, error: countError } = await countQuery;
    
    if (countError) throw countError;
    
    // Calculer les statistiques globales
    const { data: allResults } = await supabase
      .from('quiz_results')
      .select('percentage, student_id');
    
    const totalQuizzes = allResults?.length || 0;
    const averageScore = totalQuizzes > 0 
      ? Math.round(allResults.reduce((acc, r) => acc + r.percentage, 0) / totalQuizzes)
      : 0;
    const perfectScores = allResults?.filter(r => r.percentage === 100).length || 0;
    const totalStudents = [...new Set(allResults?.map(r => r.student_id) || [])].length;
    
    res.json({
      results: results || [],
      total: total || 0,
      stats: {
        totalQuizzes,
        averageScore,
        perfectScores,
        totalStudents
      }
    });
  } catch (error) {
    console.error('Erreur récupération historique quiz:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Détail d'un résultat de quiz avec les réponses (superadmin uniquement)
router.get('/detail', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { resultId } = req.query;
    
    if (!resultId) {
      return res.status(400).json({ error: 'resultId requis' });
    }
    
    // Récupérer le résultat
    const { data: result, error: resultError } = await supabase
      .from('quiz_results')
      .select(`
        *,
        student:students(
          id,
          full_name,
          username,
          branch,
          level,
          service_id,
          baptized,
          phone
        ),
        quiz:quizzes(
          id,
          title,
          level,
          start_date,
          end_date
        )
      `)
      .eq('id', resultId)
      .single();
    
    if (resultError) throw resultError;
    
    // Récupérer les réponses avec les questions
    const { data: answers, error: answersError } = await supabase
      .from('quiz_answers')
      .select(`
        *,
        question:questions(
          id,
          question,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer
        )
      `)
      .eq('student_id', result.student_id)
      .eq('quiz_id', result.quiz_id);
    
    if (answersError) throw answersError;
    
    res.json({
      result,
      answers: answers || []
    });
  } catch (error) {
    console.error('Erreur récupération détail quiz:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;