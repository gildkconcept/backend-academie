const supabase = require('../config/supabase');

class Attendance {
  static async create(attendanceData) {
    const { data, error } = await supabase
      .from('attendance')
      .insert(attendanceData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async findByStudentAndSession(studentId, sessionId) {
    const { data, error } = await supabase
      .from('attendance')
      .select('id')
      .eq('student_id', studentId)
      .eq('session_id', sessionId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }

  static async getStudentHistory(studentId, limit = 10) {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, sessions(*)')
      .eq('student_id', studentId)
      .order('date', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }
}

module.exports = Attendance;