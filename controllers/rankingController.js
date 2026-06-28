const RankingService = require('../services/rankingService');

const getRankings = async (req, res) => {
  try {
    const { level, serviceId, branch } = req.query;
    
    const result = await RankingService.getFairRanking({ level, serviceId, branch });
    
    // ✅ Extraire les rankings de manière sécurisée
    let rankingsArray = [];
    let stats = {
      totalStudents: 0,
      averageScore: 0,
      totalStudentsWithMissedQuizzes: 0,
      totalStudentsWithMissedSessions: 0
    };
    
    // ✅ Vérifier le type de retour
    if (result) {
      if (Array.isArray(result)) {
        // Si c'est un tableau (ancienne version)
        rankingsArray = result;
      } else if (result.rankings && Array.isArray(result.rankings)) {
        // Si c'est un objet avec rankings et stats (nouvelle version)
        rankingsArray = result.rankings;
        stats = result.stats || stats;
      }
    }
    
    // ✅ Recalculer les stats si nécessaire (au cas où)
    if (rankingsArray.length > 0) {
      stats.totalStudents = rankingsArray.length;
      stats.averageScore = Math.round(
        rankingsArray.reduce((acc, r) => acc + (r.final_score || 0), 0) / rankingsArray.length
      );
      stats.totalStudentsWithMissedQuizzes = rankingsArray.filter(r => (r.missed_quizzes || 0) > 0).length;
      stats.totalStudentsWithMissedSessions = rankingsArray.filter(r => (r.missed_sessions || 0) > 0).length;
    }
    
    res.json({ rankings: rankingsArray, stats, isFair: true });
  } catch (error) {
    console.error('Erreur getRankings:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getRankings };