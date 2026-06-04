const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');

class QuizService {
  static async getQuizzesForStudent(studentLevel) {
    const quizzes = await Quiz.findAll(studentLevel);
    const results = await QuizResult.getStudentResults(studentId);
    const resultsMap = new Map(results?.map(r => [r.quiz_id, r]));
    
    const today = new Date().toISOString().split('T')[0];
    
    return quizzes.map(quiz => {
      const isCompleted = resultsMap.has(quiz.id);
      const isActivePeriod = quiz.start_date <= today && quiz.end_date >= today;
      
      return {
        ...quiz,
        completed: isCompleted,
        is_active_period: isActivePeriod,
        can_take: !isCompleted && isActivePeriod,
        result: resultsMap.get(quiz.id) || null
      };
    }).filter(quiz => quiz.completed || quiz.is_active_period);
  }

  static async getQuizById(quizId) {
    return await Quiz.findWithQuestions(quizId);
  }

  static async submitQuiz(studentId, quizId, answers) {
    const quiz = await Quiz.findWithQuestions(quizId);
    
    // Calculer le score
    let score = 0;
    const answerRecords = [];
    
    for (const question of quiz.questions) {
      const selectedAnswer = answers[question.id];
      const isCorrect = selectedAnswer === question.correct_answer;
      if (isCorrect) score++;
      
      answerRecords.push({
        student_id: studentId,
        quiz_id: quizId,
        question_id: question.id,
        selected_answer: selectedAnswer || null,
        is_correct: isCorrect
      });
    }
    
    // Supprimer les anciennes réponses
    await QuizResult.deleteOldAnswers(studentId, quizId);
    
    // Sauvegarder les réponses
    await QuizResult.saveAnswers(answerRecords);
    
    // Sauvegarder le résultat
    const totalQuestions = quiz.questions.length;
    const percentage = (score / totalQuestions) * 100;
    
    const result = await QuizResult.saveResult({
      student_id: studentId,
      quiz_id: quizId,
      score,
      total_questions: totalQuestions,
      percentage,
      submitted_at: new Date().toISOString()
    });
    
    return { score, totalQuestions, percentage, resultId: result.id };
  }
}

module.exports = QuizService;