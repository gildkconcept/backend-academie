const supabase = require('../config/supabase');

class Quiz {
  static async findAll(level = null) {
    let query = supabase
      .from('quizzes')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (level) {
      query = query.eq('level', level);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  static async findWithQuestions(id) {
    const quiz = await this.findById(id);
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', id)
      .order('order_index', { ascending: true });
    
    if (error) throw error;
    return { ...quiz, questions };
  }

  static async create(quizData) {
    const { data, error } = await supabase
      .from('quizzes')
      .insert(quizData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async createQuestions(questions) {
    const { error } = await supabase
      .from('questions')
      .insert(questions);
    
    if (error) throw error;
  }
}

module.exports = Quiz;