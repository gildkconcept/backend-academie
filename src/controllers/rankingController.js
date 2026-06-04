const RankingService = require('../services/rankingService');

const getRankings = async (req, res) => {
  try {
    const { level, serviceId, branch } = req.query;
    
    const rankings = await RankingService.getFairRanking({ level, serviceId, branch });
    
    const stats = {
      totalStudents: rankings.length,
      averageScore: rankings.length > 0 
        ? Math.round(rankings.reduce((acc, r) => acc + r.final_score, 0) / rankings.length)
        : 0,
      totalStudentsWithMissedQuizzes: rankings.filter(r => r.missed_quizzes > 0).length,
      totalStudentsWithMissedSessions: rankings.filter(r => r.missed_sessions > 0).length
    };
    
    res.json({ rankings, stats, isFair: true });
  } catch (error) {
    console.error('Erreur getRankings:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getRankings };