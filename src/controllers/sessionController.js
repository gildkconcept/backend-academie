const SessionService = require('../services/sessionService');

const generateCode = async (req, res) => {
  try {
    const { lat, lng, radius = 200, level = null } = req.body;
    
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    const session = await SessionService.createSession(lat, lng, radius, level);
    
    // Planifier le marquage des absents dans 15 minutes
    setTimeout(async () => {
      try {
        await SessionService.markAbsentAfterExpiration(session.id);
      } catch (error) {
        console.error('Erreur marquage absents:', error);
      }
    }, 15 * 60 * 1000);
    
    res.json({
      success: true,
      code: session.code,
      sessionId: session.id,
      expiresAt: session.expires_at,
      level: session.level,
      mode: session.level === null ? 'universal' : 'by_level',
      center: lat ? { lat, lng, radius } : null
    });
  } catch (error) {
    console.error('Erreur generateCode:', error);
    res.status(500).json({ error: error.message });
  }
};

const verifyCode = async (req, res) => {
  try {
    const { code, lat, lng } = req.body;
    const studentId = req.user.id;
    
    const result = await SessionService.verifyCode(studentId, code, lat, lng);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Erreur verifyCode:', error);
    res.status(400).json({ error: error.message });
  }
};

const getActiveSessions = async (req, res) => {
  try {
    const studentId = req.user.id;
    const sessions = await SessionService.getActiveSessions(studentId);
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Erreur getActiveSessions:', error);
    res.status(500).json({ error: error.message });
  }
};

const markAbsent = async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    const result = await SessionService.markAbsentAfterExpiration(sessionId);
    res.json(result);
  } catch (error) {
    console.error('Erreur markAbsent:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { generateCode, verifyCode, getActiveSessions, markAbsent };