const supabase = require('../config/supabase');

class RankingService {
  static async getFairRanking(filters = {}) {
    // Récupérer tous les étudiants
    let studentsQuery = supabase
      .from('students')
      .select('id, full_name, username, profile_image_url, branch, level, service_id, baptized')
      .is('deleted_at', null);
    
    if (filters.level && filters.level !== 'all') {
      studentsQuery = studentsQuery.eq('level', parseInt(filters.level));
    }
    
    const { data: students } = await studentsQuery;
    if (!students) return [];
    
    // Récupérer les services
    const { data: services } = await supabase.from('services').select('id, name');
    const serviceMap = new Map(services?.map(s => [s.id, s.name]));
    
    // Récupérer les quizzes par niveau
    const { data: allQuizzes } = await supabase.from('quizzes').select('id, title, level');
    const quizzesByLevel = {};
    allQuizzes?.forEach(q => {
      if (!quizzesByLevel[q.level]) quizzesByLevel[q.level] = [];
      quizzesByLevel[q.level].push(q);
    });
    
    // Récupérer les résultats
    const { data: quizResults } = await supabase.from('quiz_results').select('student_id, quiz_id, percentage');
    const resultsMap = new Map();
    quizResults?.forEach(r => {
      if (!resultsMap.has(r.student_id)) resultsMap.set(r.student_id, new Map());
      resultsMap.get(r.student_id).set(r.quiz_id, r.percentage);
    });
    
    // Récupérer les sessions
    const { data: allSessions } = await supabase.from('sessions').select('id');
    const totalSessions = allSessions?.length || 1;
    
    // Récupérer les présences
    const { data: attendances } = await supabase.from('attendance').select('student_id, session_id').eq('status', 'present');
    const presenceMap = new Map();
    attendances?.forEach(a => {
      if (!presenceMap.has(a.student_id)) presenceMap.set(a.student_id, new Set());
      presenceMap.get(a.student_id).add(a.session_id);
    });
    
    // Calculer les scores
    const rankings = students.map(student => {
      const studentLevel = student.level || 1;
      const relevantQuizzes = quizzesByLevel[studentLevel] || [];
      const studentResults = resultsMap.get(student.id) || new Map();
      
      let totalQuizScore = 0;
      let completedCount = 0;
      
      for (const quiz of relevantQuizzes) {
        const score = studentResults.get(quiz.id);
        if (score !== undefined) {
          totalQuizScore += score;
          completedCount++;
        }
      }
      
      const fairQuizScore = relevantQuizzes.length > 0 ? totalQuizScore / relevantQuizzes.length : 0;
      const presenceCount = presenceMap.get(student.id)?.size || 0;
      const fairPresenceRate = totalSessions > 0 ? (presenceCount / totalSessions) * 100 : 0;
      const finalScore = (fairQuizScore * 0.6) + (fairPresenceRate * 0.4);
      
      return {
        student_id: student.id,
        final_score: Math.round(finalScore),
        attendance_score: Math.round(fairPresenceRate),
        quiz_score: Math.round(fairQuizScore),
        total_quizzes_expected: relevantQuizzes.length,
        completed_quizzes: completedCount,
        missed_quizzes: relevantQuizzes.length - completedCount,
        total_sessions_expected: totalSessions,
        present_sessions: presenceCount,
        missed_sessions: totalSessions - presenceCount,
        student: {
          id: student.id,
          full_name: student.full_name,
          username: student.username,
          profile_image_url: student.profile_image_url,
          branch: student.branch || '-',
          level: student.level,
          service_id: student.service_id,
          service_name: serviceMap.get(student.service_id) || '-',
          baptized: student.baptized
        }
      };
    });
    
    // Appliquer filtres et trier
    let filtered = rankings;
    if (filters.serviceId && filters.serviceId !== 'all') {
      filtered = filtered.filter(r => r.student.service_id === filters.serviceId);
    }
    if (filters.branch && filters.branch !== 'all') {
      filtered = filtered.filter(r => r.student.branch === filters.branch);
    }
    
    filtered.sort((a, b) => b.final_score - a.final_score);
    
    return filtered.map((r, index) => ({ ...r, rank: index + 1 }));
  }
}

module.exports = RankingService;