const QuizService = require('../services/quizService');

const getQuizzes = async (req, res) => {
  try {
    if (req.user.role === 'student') {
      const quizzes = await QuizService.getQuizzesForStudent(req.user.level, req.user.id);
      return res.json(quizzes);
    }
    
    const Quiz = require('../models/Quiz');
    const quizzes = await Quiz.findAll();
    res.json(quizzes);
  } catch (error) {
    console.error('Erreur getQuizzes:', error);
    res.status(500).json({ error: error.message });
  }
};

const getQuizById = async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await QuizService.getQuizById(id);
    res.json(quiz);
  } catch (error) {
    console.error('Erreur getQuizById:', error);
    res.status(500).json({ error: error.message });
  }
};

const submitQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body;
    const studentId = req.user.id;
    
    const result = await QuizService.submitQuiz(studentId, id, answers);
    res.json(result);
  } catch (error) {
    console.error('Erreur submitQuiz:', error);
    res.status(500).json({ error: error.message });
  }
};

const getMyResults = async (req, res) => {
  try {
    const QuizResult = require('../models/QuizResult');
    const results = await QuizResult.getStudentResults(req.user.id);
    
    const totalQuizzes = results.length;
    const averageScore = totalQuizzes > 0 
      ? Math.round(results.reduce((acc, r) => acc + r.percentage, 0) / totalQuizzes)
      : 0;
    const bestScore = totalQuizzes > 0
      ? Math.max(...results.map(r => r.percentage))
      : 0;
    
    res.json({ results, stats: { totalQuizzes, averageScore, bestScore } });
  } catch (error) {
    console.error('Erreur getMyResults:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getQuizzes, getQuizById, submitQuiz, getMyResults };