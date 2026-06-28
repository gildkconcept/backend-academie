const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// ==================== ROUTES PUBLIQUES (si nécessaire) ====================

// ==================== ROUTES PROTÉGÉES ====================
router.use(authMiddleware);

// GET - Présences d'un étudiant spécifique
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Vérifier les droits
    if (userRole !== 'superadmin' && userId !== studentId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    const { data, error } = await supabase
      .from('attendance')
      .select('*, sessions(*)')
      .eq('student_id', studentId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Erreur getStudentAttendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Historique des présences de l'utilisateur connecté
router.get('/history', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .from('attendance')
      .select('*, sessions(*)')
      .eq('student_id', userId)
      .order('date', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    
    if (error) throw error;
    
    res.json({ sessions: data || [], total: data?.length || 0 });
  } catch (error) {
    console.error('Erreur getAttendanceHistory:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Présences par date (pour superadmin)
router.get('/by-date', async (req, res) => {
  try {
    const { date, serviceId } = req.query;
    
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    let query = supabase
      .from('attendance')
      .select('*, students(*), sessions(*)')
      .eq('date', date);
    
    if (serviceId && serviceId !== 'all') {
      query = query.eq('students.service_id', serviceId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.json(data || []);
  } catch (error) {
    console.error('Erreur getAttendanceByDate:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES POUR LA PRÉSENCE ASSISTÉE ====================

// GET - Récupérer les étudiants sans téléphone pour une session donnée
router.get('/assisted', async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId requis' });
    }
    
    console.log('🔍 [Assisted] Récupération des étudiants pour la session:', sessionId);
    
    // 1. Récupérer la session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (sessionError) {
      console.error('Erreur récupération session:', sessionError);
      return res.status(404).json({ error: 'Session non trouvée' });
    }
    
    console.log('📋 Session:', { code: session.code, level: session.level });
    
    // 2. Récupérer les étudiants UNIQUEMENT sans téléphone
    let query = supabase
      .from('students')
      .select('id, full_name, branch, level, phone, has_phone, maison_grace')
      .is('deleted_at', null)
      .or('has_phone.eq.false,phone.is.null,phone.eq.')
      .order('full_name');
    
    if (session.level !== null) {
      query = query.eq('level', session.level);
    }
    
    const { data: students, error: studentsError } = await query;
    
    if (studentsError) {
      console.error('Erreur récupération étudiants:', studentsError);
      return res.status(500).json({ error: 'Erreur récupération étudiants' });
    }
    
    console.log(`📋 Étudiants sans téléphone trouvés (SQL): ${students?.length || 0}`);
    
    // 3. Récupérer les présences déjà enregistrées
    const { data: existingAttendances, error: attendanceError } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('session_id', sessionId);
    
    if (attendanceError) {
      console.error('Erreur récupération présences:', attendanceError);
    }
    
    const statusMap = new Map();
    if (existingAttendances) {
      existingAttendances.forEach(att => {
        statusMap.set(att.student_id, att.status);
      });
    }
    
    const formattedStudents = (students || []).map(s => ({
      id: s.id,
      full_name: s.full_name,
      branch: s.branch,
      level: s.level,
      phone: s.phone || 'Pas de téléphone',
      maison_grace: s.maison_grace || '',
      status: statusMap.get(s.id) || 'absent'
    }));
    
    console.log(`📋 ${formattedStudents.length} étudiant(s) sans téléphone retourné(s)`);
    
    if (formattedStudents.length > 0) {
      console.log('📋 Liste des étudiants:', formattedStudents.map(s => s.full_name).join(', '));
    }
    
    res.json({ students: formattedStudents });
  } catch (error) {
    console.error('Erreur assisted attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Enregistrer les présences assistées
router.post('/assisted', async (req, res) => {
  try {
    const { sessionId, attendances } = req.body;
    
    if (!sessionId || !attendances || !Array.isArray(attendances)) {
      return res.status(400).json({ error: 'sessionId et attendances requis' });
    }
    
    console.log(`🔍 [Assisted] Enregistrement des présences pour la session: ${sessionId}`);
    console.log(`📋 ${attendances.length} présence(s) à enregistrer`);
    
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    const attendanceRecords = attendances.map(att => ({
      student_id: att.studentId,
      session_id: sessionId,
      status: att.status,
      date: today,
      scanned_at: now,
      method: 'manual'
    }));
    
    const studentIds = attendances.map(att => att.studentId);
    const { error: deleteError } = await supabase
      .from('attendance')
      .delete()
      .eq('session_id', sessionId)
      .in('student_id', studentIds);
    
    if (deleteError) {
      console.error('Erreur suppression anciennes présences:', deleteError);
    }
    
    const { error: insertError } = await supabase
      .from('attendance')
      .insert(attendanceRecords);
    
    if (insertError) {
      console.error('Erreur insertion présences:', insertError);
      return res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
    }
    
    console.log('✅ Présences enregistrées avec succès');
    res.json({ success: true, message: `${attendances.length} présence(s) enregistrée(s)` });
  } catch (error) {
    console.error('Erreur save assisted attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== NOUVELLES ROUTES POUR L'HISTORIQUE DES CODES ====================

// GET - Statistiques d'une session
router.get('/session/:sessionId/stats', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { data: attendances, error } = await supabase
      .from('attendance')
      .select('status')
      .eq('session_id', sessionId);
    
    if (error) throw error;
    
    const present = attendances?.filter(a => a.status === 'present').length || 0;
    const absent = attendances?.filter(a => a.status === 'absent').length || 0;
    const late = attendances?.filter(a => a.status === 'late').length || 0;
    const total = attendances?.length || 0;
    
    res.json({
      total,
      present,
      absent,
      late,
      rate: total > 0 ? Math.round((present / total) * 100) : 0
    });
  } catch (error) {
    console.error('Erreur stats session:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Étudiants d'une session
router.get('/session/:sessionId/students', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { data: attendances, error } = await supabase
      .from('attendance')
      .select(`
        *,
        students(id, full_name, branch, level, phone)
      `)
      .eq('session_id', sessionId);
    
    if (error) throw error;
    
    const formatted = (attendances || []).map(a => ({
      id: a.id,
      student_id: a.student_id,
      student_name: a.students?.full_name || 'N/A',
      branch: a.students?.branch || '-',
      level: a.students?.level || 1,
      phone: a.students?.phone || '-',
      status: a.status,
      scanned_at: a.scanned_at,
      method: a.method || 'code'
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Erreur étudiants session:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Supprimer une session (superadmin uniquement)
router.delete('/sessions/:sessionId', roleMiddleware('superadmin'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // 1. Supprimer les présences liées
    const { error: attendanceError } = await supabase
      .from('attendance')
      .delete()
      .eq('session_id', sessionId);
    
    if (attendanceError) throw attendanceError;
    
    // 2. Supprimer la session
    const { error: sessionError } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId);
    
    if (sessionError) throw sessionError;
    
    res.json({ success: true, message: 'Session supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression session:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;