const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/global', async (req, res) => {
  try {
    // 1. Récupérer tous les étudiants
    const { data: students } = await supabase
      .from('students')
      .select('id, service_id, level')
      .is('deleted_at', null);

    // 2. Récupérer toutes les présences
    const { data: attendances } = await supabase
      .from('attendance')
      .select('student_id, status, date');

    // 3. Récupérer les services
    const { data: services } = await supabase
      .from('services')
      .select('id, name');

    // 4. Calculer les stats par service
    const attendanceByService = (services || []).map(service => {
      const serviceStudents = students?.filter(s => s.service_id === service.id) || [];
      const studentIds = serviceStudents.map(s => s.id);
      const serviceAttendances = attendances?.filter(a => studentIds.includes(a.student_id)) || [];
      const presentCount = serviceAttendances.filter(a => a.status === 'present').length;
      const totalExpected = serviceStudents.length * 1; // Nombre de sessions à calculer
      const rate = totalExpected > 0 ? Math.round((presentCount / totalExpected) * 100) : 0;
      
      return {
        serviceId: service.id,
        serviceName: service.name,
        totalStudents: serviceStudents.length,
        presentCount,
        rate
      };
    });

    // 5. Évolution mensuelle (derniers 6 mois)
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: date.toLocaleString('fr-FR', { month: 'short' }),
        year: date.getFullYear(),
        start: new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0],
        end: new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]
      });
    }

    const attendanceOverTime = await Promise.all(months.map(async (m) => {
      const { data: monthlyAttendances } = await supabase
        .from('attendance')
        .select('student_id, status')
        .gte('date', m.start)
        .lte('date', m.end);
      
      const present = monthlyAttendances?.filter(a => a.status === 'present').length || 0;
      const total = monthlyAttendances?.length || 1;
      const rate = Math.round((present / total) * 100);
      
      return {
        month: m.month,
        rate,
        present,
        total
      };
    }));

    const sorted = [...attendanceByService].sort((a, b) => b.rate - a.rate);

    res.json({
      totalStudents: students?.length || 0,
      totalServices: services?.length || 0,
      totalAttendance: attendances?.filter(a => a.status === 'present').length || 0,
      expectedAttendance: attendances?.length || 0,
      globalAttendanceRate: attendances?.length > 0 
        ? Math.round((attendances.filter(a => a.status === 'present').length / attendances.length) * 100)
        : 0,
      bestService: sorted[0] || null,
      strugglingService: sorted[sorted.length - 1] || null,
      attendanceByService,
      attendanceOverTime
    });
  } catch (error) {
    console.error('Erreur stats global:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;