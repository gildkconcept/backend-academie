const express = require('express');
const router = express.Router();
const { getQuizzes, getQuizById, submitQuiz, getMyResults } = require('../controllers/quizController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const supabase = require('../config/supabase');

// ==================== ROUTES STATIQUES EN PREMIER ====================
router.get('/', getQuizzes);
router.get('/my-results', getMyResults);

// ✅ ROUTE POUR CRÉER UN QUIZ (superadmin uniquement)
router.post('/', roleMiddleware('superadmin'), async (req, res) => {
  try {
    console.log('🔍 Création quiz par:', req.user?.username);
    
    const { title, description, level, start_date, end_date, questions } = req.body;
    
    // Validation
    if (!title || !start_date || !end_date || !questions || questions.length === 0) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }
    
    // 1. Créer le quiz
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        title,
        description: description || null,
        level: parseInt(level),
        start_date,
        end_date,
        is_active: true,
        created_by: req.user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (quizError) throw quizError;
    
    // 2. Créer les questions
    const questionsToInsert = questions.map((q, index) => ({
      quiz_id: quiz.id,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      order_index: index
    }));
    
    const { error: questionsError } = await supabase
      .from('questions')
      .insert(questionsToInsert);
    
    if (questionsError) throw questionsError;
    
    res.status(201).json({ success: true, quiz });
  } catch (error) {
    console.error('Erreur création quiz:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ /history et /detail AVANT /:id pour éviter le conflit
router.get('/history', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { limit = 50, offset = 0, level, serviceId, branch, search } = req.query;

    let query = supabase
      .from('quiz_results')
      .select(`
        *,
        student:students(id, full_name, username, branch, level, service_id, baptized, phone),
        quiz:quizzes(id, title, level, start_date, end_date)
      `)
      .order('submitted_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (level && level !== 'all') query = query.eq('quiz.level', parseInt(level));
    if (serviceId && serviceId !== 'all') query = query.eq('student.service_id', serviceId);
    if (branch && branch !== 'all') query = query.eq('student.branch', branch);
    if (search) query = query.ilike('student.full_name', `%${search}%`);

    const { data: results, error } = await query;
    if (error) throw error;

    let countQuery = supabase.from('quiz_results').select('*', { count: 'exact', head: true });

    if (level && level !== 'all') {
      const { data: quizzes } = await supabase.from('quizzes').select('id').eq('level', parseInt(level));
      const quizIds = quizzes?.map(q => q.id) || [];
      if (quizIds.length > 0) countQuery = countQuery.in('quiz_id', quizIds);
    }

    const { count: total, error: countError } = await countQuery;
    if (countError) throw countError;

    const { data: allResults } = await supabase.from('quiz_results').select('percentage, student_id');
    const totalQuizzes = allResults?.length || 0;
    const averageScore = totalQuizzes > 0
      ? Math.round(allResults.reduce((acc, r) => acc + r.percentage, 0) / totalQuizzes) : 0;
    const perfectScores = allResults?.filter(r => r.percentage === 100).length || 0;
    const totalStudents = [...new Set(allResults?.map(r => r.student_id) || [])].length;

    res.json({
      results: results || [],
      total: total || 0,
      stats: { totalQuizzes, averageScore, perfectScores, totalStudents }
    });
  } catch (error) {
    console.error('Erreur historique quiz:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/detail', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { resultId } = req.query;
    if (!resultId) return res.status(400).json({ error: 'resultId requis' });

    const { data: result, error: resultError } = await supabase
      .from('quiz_results')
      .select(`
        *,
        student:students(id, full_name, username, branch, level, service_id, baptized, phone),
        quiz:quizzes(id, title, level, start_date, end_date)
      `)
      .eq('id', resultId)
      .single();

    if (resultError) throw resultError;

    const { data: answers, error: answersError } = await supabase
      .from('quiz_answers')
      .select(`
        *,
        question:questions(id, question, option_a, option_b, option_c, option_d, correct_answer)
      `)
      .eq('student_id', result.student_id)
      .eq('quiz_id', result.quiz_id);

    if (answersError) throw answersError;

    res.json({ result, answers: answers || [] });
  } catch (error) {
    console.error('Erreur détail quiz:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Routes dynamiques EN DERNIER
router.get('/:id', getQuizById);
router.post('/:id/submit', submitQuiz);

module.exports = router;