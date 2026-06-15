// controllers/sessionController.js
const SessionService = require('../services/sessionService');

// Générer un code de présence
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

// Vérifier un code saisi par un étudiant
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

// Récupérer les sessions actives pour un étudiant
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

// Marquer les absents après expiration (superadmin)
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

// Récupérer l'historique des sessions d'un étudiant
const getSessionHistory = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;
    
    const supabase = require('../config/supabase');
    
    const { data: attendance, error } = await supabase
      .from('attendance')
      .select(`
        *,
        sessions (*)
      `)
      .eq('student_id', studentId)
      .order('date', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    
    if (error) throw error;
    
    res.json({
      success: true,
      sessions: attendance || [],
      total: attendance?.length || 0
    });
  } catch (error) {
    console.error('Erreur getSessionHistory:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ NOUVELLE FONCTION - Récupérer toutes les sessions (pour superadmin)
const getAllSessionsHistory = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est superadmin
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    const { limit = 50, offset = 0 } = req.query;
    const sessions = await SessionService.getSessionHistory(parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      sessions: sessions || [],
      total: sessions?.length || 0
    });
  } catch (error) {
    console.error('Erreur getAllSessionsHistory:', error);
    res.status(500).json({ error: error.message });
  }
};

// Récupérer les détails d'une session spécifique
const getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const supabase = require('../config/supabase');
    
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (sessionError) throw sessionError;
    
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select(`
        *,
        students(id, full_name, branch, level, phone)
      `)
      .eq('session_id', sessionId);
    
    if (attendanceError) throw attendanceError;
    
    res.json({
      success: true,
      session,
      attendance: attendance || []
    });
  } catch (error) {
    console.error('Erreur getSessionDetails:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { 
  generateCode, 
  verifyCode, 
  getActiveSessions, 
  markAbsent,
  getSessionHistory,
  getSessionDetails,
  getAllSessionsHistory 
};