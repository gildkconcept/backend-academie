const supabase = require('../config/supabase');

class QuizResult {
  static async findByStudentAndQuiz(studentId, quizId) {
    const { data, error } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('student_id', studentId)
      .eq('quiz_id', quizId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }

  static async saveResult(resultData) {
    const { data, error } = await supabase
      .from('quiz_results')
      .upsert(resultData, { onConflict: 'student_id,quiz_id' })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async saveAnswers(answers) {
    const { error } = await supabase
      .from('quiz_answers')
      .insert(answers);
    
    if (error) throw error;
  }

  static async deleteOldAnswers(studentId, quizId) {
    const { error } = await supabase
      .from('quiz_answers')
      .delete()
      .eq('student_id', studentId)
      .eq('quiz_id', quizId);
    
    if (error) throw error;
  }

  static async getStudentResults(studentId) {
    const { data, error } = await supabase
      .from('quiz_results')
      .select('*, quiz:quizzes(id, title, level, start_date, end_date)')
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }
}

module.exports = QuizResult;