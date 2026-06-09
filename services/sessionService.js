// services/sessionService.js
const AcademySession = require('../models/AcademySession');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const { haversineDistance } = require('../utils/distance');
const supabase = require('../config/supabase');

class SessionService {
  // Générer un code aléatoire à 6 chiffres
  static generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Créer une nouvelle session de code
  static async createSession(lat, lng, radius = 200, level = null) {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const today = new Date().toISOString().split('T')[0];
    
    const session = await AcademySession.create({
      code: code,
      expires_at: expiresAt.toISOString(),
      date: today,
      level: level,
      lat: lat || null,
      lng: lng || null,
      radius: radius
    });
    
    return session;
  }

  // Vérifier un code saisi par un étudiant
  static async verifyCode(studentId, code, studentLat, studentLng) {
    // 1. Vérifier que le code existe
    const session = await AcademySession.findByCode(code);
    
    if (!session) {
      throw new Error('Code invalide');
    }
    
    // 2. Vérifier que le code n'est pas expiré
    if (new Date() > new Date(session.expires_at)) {
      throw new Error('Code expiré');
    }
    
    // 3. Vérifier le niveau de l'étudiant
    const student = await Student.findById(studentId);
    if (session.level !== null && student.level !== session.level) {
      throw new Error(`Ce code est pour le niveau ${session.level}. Votre niveau est ${student.level}`);
    }
    
    // 4. Vérifier la géolocalisation
    if (session.lat && session.lng && studentLat && studentLng) {
      const distance = haversineDistance(
        session.lat, session.lng,
        studentLat, studentLng
      );
      if (distance > session.radius) {
        throw new Error(`Vous êtes trop loin (${Math.round(distance)}m > ${session.radius}m)`);
      }
    }
    
    // 5. Vérifier si l'étudiant n'a pas déjà marqué sa présence
    const existing = await Attendance.findByStudentAndSession(studentId, session.id);
    if (existing) {
      throw new Error('Présence déjà enregistrée pour cette session');
    }
    
    // 6. Enregistrer la présence
    await Attendance.create({
      student_id: studentId,
      session_id: session.id,
      status: 'present',
      date: session.date,
      scanned_at: new Date().toISOString(),
      method: 'code',
      student_lat: studentLat,
      student_lng: studentLng
    });
    
    return { 
      success: true, 
      message: 'Présence enregistrée avec succès',
      sessionLevel: session.level,
      studentLevel: student.level
    };
  }

  // Récupérer les sessions actives pour un étudiant
  static async getActiveSessions(studentId) {
    const student = await Student.findById(studentId);
    const sessions = await AcademySession.findActiveByStudentLevel(student.level);
    
    const sessionsWithStatus = await Promise.all(sessions.map(async (session) => {
      const attendance = await Attendance.findByStudentAndSession(studentId, session.id);
      const timeLeftMs = new Date(session.expires_at) - new Date();
      
      return {
        id: session.id,
        code: session.code,
        level: session.level,
        expires_at: session.expires_at,
        created_at: session.created_at,
        hasMarked: !!attendance,
        isUniversal: session.level === null,
        isExpired: timeLeftMs <= 0,
        timeLeft: {
          minutes: Math.max(0, Math.floor(timeLeftMs / 60000)),
          seconds: Math.max(0, Math.floor((timeLeftMs % 60000) / 1000)),
          totalMs: timeLeftMs
        }
      };
    }));
    
    return sessionsWithStatus;
  }

  // Marquer les absents après expiration de la session
  static async markAbsentAfterExpiration(sessionId) {
    const session = await AcademySession.findById(sessionId);
    
    // Vérifier si la session est expirée
    if (new Date() <= new Date(session.expires_at)) {
      return { 
        status: 'waiting', 
        message: 'La session n\'est pas encore expirée' 
      };
    }
    
    // Récupérer les étudiants concernés
    let query = supabase
      .from('students')
      .select('id')
      .is('deleted_at', null);
    
    if (session.level !== null) {
      query = query.eq('level', session.level);
    }
    
    const { data: students } = await query;
    if (!students || students.length === 0) {
      return { status: 'completed', absents: 0 };
    }
    
    // Récupérer les étudiants déjà présents
    const { data: presents } = await supabase
      .from('attendance')
      .select('student_id')
      .eq('session_id', sessionId)
      .eq('status', 'present');
    
    const presentIds = new Set(presents?.map(p => p.student_id) || []);
    const absentStudents = students.filter(s => !presentIds.has(s.id));
    
    // Marquer les absents
    if (absentStudents.length > 0) {
      await AcademySession.markAbsent(sessionId, absentStudents.map(s => s.id));
    }
    
    return { 
      status: 'completed', 
      absents: absentStudents.length,
      total: students.length,
      presents: presents?.length || 0
    };
  }

  // Obtenir les statistiques d'une session
  static async getSessionStats(sessionId) {
    const session = await AcademySession.findById(sessionId);
    
    // Récupérer tous les étudiants concernés
    let query = supabase
      .from('students')
      .select('id')
      .is('deleted_at', null);
    
    if (session.level !== null) {
      query = query.eq('level', session.level);
    }
    
    const { data: students } = await query;
    const totalStudents = students?.length || 0;
    
    // Récupérer les présences
    const { data: attendances } = await supabase
      .from('attendance')
      .select('status')
      .eq('session_id', sessionId);
    
    const present = attendances?.filter(a => a.status === 'present').length || 0;
    const absent = attendances?.filter(a => a.status === 'absent').length || 0;
    const late = attendances?.filter(a => a.status === 'late').length || 0;
    
    return {
      sessionId,
      code: session.code,
      date: session.date,
      level: session.level,
      totalStudents,
      present,
      absent,
      late,
      attendanceRate: totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0
    };
  }
}

module.exports = SessionService;