const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Rapport mensuel
router.get('/monthly', async (req, res) => {
  try {
    const { month, year, serviceId, level, branch } = req.query;
    
    console.log('📊 Rapports mensuels - Requête reçue:', { month, year, serviceId, level, branch });
    
    // 1. Récupérer tous les étudiants
    let studentsQuery = supabase
      .from('students')
      .select('*, services(id, name)')
      .is('deleted_at', null);
    
    if (serviceId && serviceId !== 'all') {
      studentsQuery = studentsQuery.eq('service_id', serviceId);
    }
    if (level && level !== 'all') {
      studentsQuery = studentsQuery.eq('level', parseInt(level));
    }
    if (branch && branch !== 'all') {
      studentsQuery = studentsQuery.eq('branch', branch);
    }
    
    const { data: students, error: studentsError } = await studentsQuery;
    
    if (studentsError) {
      console.error('Erreur students:', studentsError);
      return res.status(500).json({ error: studentsError.message });
    }
    
    // 2. Récupérer les présences du mois
    const startDate = new Date(parseInt(year), parseInt(month), 1).toISOString().split('T')[0];
    const endDate = new Date(parseInt(year), parseInt(month) + 1, 0).toISOString().split('T')[0];
    
    let attendanceQuery = supabase
      .from('attendance')
      .select('*, students!inner(service_id, level, branch, full_name, username, baptized, phone)')
      .gte('date', startDate)
      .lte('date', endDate);
    
    if (serviceId && serviceId !== 'all') {
      attendanceQuery = attendanceQuery.eq('students.service_id', serviceId);
    }
    if (level && level !== 'all') {
      attendanceQuery = attendanceQuery.eq('students.level', parseInt(level));
    }
    if (branch && branch !== 'all') {
      attendanceQuery = attendanceQuery.eq('students.branch', branch);
    }
    
    const { data: attendances, error: attendanceError } = await attendanceQuery;
    
    if (attendanceError) {
      console.error('Erreur attendances:', attendanceError);
      return res.status(500).json({ error: attendanceError.message });
    }
    
    // 3. Calculer les statistiques par service
    const servicesMap = new Map();
    students?.forEach(s => {
      const serviceId = s.service_id;
      if (!servicesMap.has(serviceId)) {
        servicesMap.set(serviceId, {
          serviceId,
          serviceName: s.services?.name || 'Inconnu',
          studentCount: 0,
          totalPresent: 0,
          totalAbsent: 0,
          totalLate: 0
        });
      }
      servicesMap.get(serviceId).studentCount++;
    });
    
    attendances?.forEach(a => {
      const serviceId = a.students?.service_id;
      if (serviceId && servicesMap.has(serviceId)) {
        const service = servicesMap.get(serviceId);
        if (a.status === 'present') service.totalPresent++;
        else if (a.status === 'absent') service.totalAbsent++;
        else if (a.status === 'late') service.totalLate++;
      }
    });
    
    const byService = Array.from(servicesMap.values()).map(s => ({
      ...s,
      rate: s.studentCount > 0 ? Math.round((s.totalPresent / (s.studentCount * 1)) * 100) : 0
    }));
    
    // 4. Calculer les statistiques par niveau
    const levelsMap = new Map();
    students?.forEach(s => {
      const level = s.level;
      if (!levelsMap.has(level)) {
        levelsMap.set(level, {
          level,
          studentCount: 0,
          totalPresent: 0,
          totalAbsent: 0,
          totalLate: 0
        });
      }
      levelsMap.get(level).studentCount++;
    });
    
    attendances?.forEach(a => {
      const level = a.students?.level;
      if (level && levelsMap.has(level)) {
        const levelData = levelsMap.get(level);
        if (a.status === 'present') levelData.totalPresent++;
        else if (a.status === 'absent') levelData.totalAbsent++;
        else if (a.status === 'late') levelData.totalLate++;
      }
    });
    
    const byLevel = Array.from(levelsMap.values()).map(l => ({
      ...l,
      rate: l.studentCount > 0 ? Math.round((l.totalPresent / (l.studentCount * 1)) * 100) : 0
    }));
    
    // 5. Statistiques globales
    const totalStudents = students?.length || 0;
    const totalPresent = attendances?.filter(a => a.status === 'present').length || 0;
    const totalAbsent = attendances?.filter(a => a.status === 'absent').length || 0;
    const totalLate = attendances?.filter(a => a.status === 'late').length || 0;
    const totalSessions = attendances?.length || 1;
    const globalRate = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;
    
    // 6. Détails des étudiants
    const studentsDetails = students?.map(s => {
      const studentAttendances = attendances?.filter(a => a.students?.full_name === s.full_name) || [];
      const presentCount = studentAttendances.filter(a => a.status === 'present').length;
      const absentCount = studentAttendances.filter(a => a.status === 'absent').length;
      const lateCount = studentAttendances.filter(a => a.status === 'late').length;
      const presenceRate = studentAttendances.length > 0 ? Math.round((presentCount / studentAttendances.length) * 100) : 0;
      
      return {
        id: s.id,
        name: s.full_name,
        username: s.username,
        serviceId: s.service_id,
        serviceName: s.services?.name || '-',
        branch: s.branch || '-',
        level: s.level,
        baptized: s.baptized,
        phone: s.phone || '-',
        presentCount,
        absentCount,
        lateCount,
        expectedPresences: 1,
        presenceRate,
        absenceRate: 100 - presenceRate
      };
    }) || [];
    
    const result = {
      stats: {
        totalStudents,
        totalSessions,
        totalPresent,
        totalAbsent,
        totalLate,
        globalRate,
        globalAbsenceRate: 100 - globalRate
      },
      byService,
      byLevel,
      byBranch: [],
      weeklyEvolution: [],
      studentsDetails,
      alerts: {
        lowParticipationServices: byService.filter(s => s.rate < 50),
        frequentAbsentStudents: studentsDetails.filter(s => s.presenceRate < 30),
        dropFromPreviousMonth: null
      }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Erreur monthly report:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;