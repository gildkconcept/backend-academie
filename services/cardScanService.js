// services/cardScanService.js
// Pointage des présences par scan de la carte étudiant (réservé au superadmin).
//
// PRINCIPE : on écrit dans la MÊME table `attendance` que le code de présence existant, avec
// method = 'card' au lieu de 'code'. Mêmes règles d'éligibilité (niveau), mêmes statistiques,
// même historique : aucun système de présences parallèle.

const supabase = require('../config/supabase');
const cardService = require('./cardService');

const { CardError, TOKEN_RE, UUID_RE, formatCardNumber, fetchAllRows } = cardService;

// Même convention que le code de présence existant (sessionService.createSession)
const todayString = () => new Date().toISOString().split('T')[0];

const STUDENT_COLUMNS = 'id, full_name, branch, level, profile_image_url, deleted_at, services(id, name)';

const result = (outcome, message, extra = {}) => ({
  ok: outcome === 'recorded' || outcome === 'upgraded',
  outcome,
  message,
  ...extra,
});

// Informations affichées à l'administrateur : le strict nécessaire pour contrôler la personne
const studentInfo = (student, card) => ({
  fullName: student.full_name,
  photoUrl: student.profile_image_url || null,
  branch: student.branch || null,
  serviceName: student.services?.name || null,
  level: student.level ?? null,
  cardNumber: formatCardNumber(card.serial_no),
});

const alreadyResult = (row, info) => {
  const previous = { status: row.status, method: row.method || null, at: row.scanned_at || null };
  if (row.status === 'present') {
    return result('already_present', 'Cet étudiant est déjà marqué présent pour cette séance', { student: info, previous });
  }
  if (row.status === 'late') {
    return result('already_present', 'Cet étudiant est déjà enregistré en retard pour cette séance', { student: info, previous });
  }
  return result('already_present', 'Cet étudiant a déjà un enregistrement pour cette séance', { student: info, previous });
};

const findRows = async (studentId, sessionId) => {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, status, method, scanned_at')
    .eq('student_id', studentId)
    .eq('session_id', sessionId);
  if (error) throw error;
  return data || [];
};

// Une ligne qui compte comme "déjà pointé" : tout sauf "absent" (présent d'abord, puis le reste)
const pickMarked = (rows) =>
  rows.find((r) => r.status === 'present') || rows.find((r) => r.status !== 'absent') || null;

// ---------------------------------------------------------------------------
// Scan d'une carte
// ---------------------------------------------------------------------------
async function scanCard({ sessionId, token }) {
  if (!UUID_RE.test(String(sessionId || ''))) throw new CardError(400, 'Séance invalide');
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) {
    return result('invalid_card', 'Carte inconnue ou invalide');
  }

  // 1. La séance : elle doit exister et être celle du jour (même esprit que l'expiration du code)
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, date, level')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) return result('session_not_found', 'Aucune séance active sélectionnée');
  if (session.date !== todayString()) {
    return result('session_closed', "Cette séance n'est plus ouverte au pointage (séance d'un autre jour)");
  }

  // 2. La carte
  const { data: card, error: cardError } = await supabase
    .from('student_cards')
    .select('student_id, serial_no, status')
    .eq('verify_token', token)
    .maybeSingle();
  if (cardError) {
    if (cardError.code === '42P01' || cardError.code === 'PGRST205') {
      throw new CardError(503, "La fonctionnalité carte étudiant n'est pas encore initialisée.");
    }
    throw cardError;
  }
  if (!card) return result('invalid_card', 'Carte inconnue ou invalide');

  const cardNumber = formatCardNumber(card.serial_no);
  if (card.status === 'revoked') {
    return result('revoked', 'Carte désactivée', { card: { cardNumber } });
  }

  // 3. L'étudiant
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select(STUDENT_COLUMNS)
    .eq('id', card.student_id)
    .maybeSingle();
  if (studentError) throw studentError;
  if (!student || student.deleted_at) {
    return result('invalid_card', 'Carte invalide : étudiant non actif', { card: { cardNumber } });
  }
  const info = studentInfo(student, card);

  // 4. Éligibilité : même règle que le code de présence (séance réservée à un niveau)
  if (session.level !== null && student.level !== session.level) {
    return result(
      'not_eligible',
      `Cet étudiant est de niveau ${student.level} ; cette séance est réservée au niveau ${session.level}`,
      { student: info }
    );
  }

  // 5. Déjà pointé (par code, par carte ou à la main) ?
  const rows = await findRows(student.id, session.id);
  const marked = pickMarked(rows);
  if (marked) return alreadyResult(marked, info);

  // 6. Enregistrement. Une absence posée automatiquement à l'expiration du code est remplacée
  //    par la présence (même procédé que la présence assistée : suppression puis insertion).
  const absentRows = rows.filter((r) => r.status === 'absent');
  const scannedAt = new Date().toISOString();
  const record = {
    student_id: student.id,
    session_id: session.id,
    status: 'present',
    date: session.date,
    scanned_at: scannedAt,
    method: 'card',
  };

  if (absentRows.length) {
    const { error: deleteError } = await supabase
      .from('attendance')
      .delete()
      .in('id', absentRows.map((r) => r.id));
    if (deleteError) throw deleteError;
  }

  const { error: insertError } = await supabase.from('attendance').insert(record);

  if (!insertError) {
    return result(absentRows.length ? 'upgraded' : 'recorded', 'Présence enregistrée avec succès', {
      student: info,
      scannedAt,
    });
  }

  // --- Échec de l'insertion ---
  // Scan simultané par un autre appareil : la présence existe déjà, rien à restaurer
  const again = pickMarked(await findRows(student.id, session.id));
  if (again) return alreadyResult(again, info);

  // On remet l'absence qu'on venait de retirer, pour ne rien perdre
  if (absentRows.length) {
    const restore = absentRows.map((r) => ({
      student_id: student.id,
      session_id: session.id,
      status: 'absent',
      date: session.date,
      scanned_at: r.scanned_at,
      method: r.method,
    }));
    const { error: restoreError } = await supabase.from('attendance').insert(restore);
    if (restoreError) console.error('⚠️ Absence non restaurée après échec du pointage par carte:', restoreError.message);
  }

  console.error('Erreur technique pointage par carte:', insertError.code, insertError.message);

  if (insertError.code === '23505') {
    // Doublon qui ne concerne pas la présence (ex. table des classements)
    return result(
      'technical',
      "Impossible d'enregistrer la présence (erreur de classement côté base). Utilisez la présence assistée et prévenez le développeur.",
      { student: info, reason: /student_rankings/.test(insertError.message || '') ? 'rankings' : 'duplicate' }
    );
  }
  if (insertError.code === '23514') {
    return result(
      'technical',
      'Impossible d\'enregistrer la présence : la base refuse la méthode « card ». Prévenez le développeur.',
      { student: info, reason: 'method' }
    );
  }
  throw insertError;
}

// ---------------------------------------------------------------------------
// Séances du jour (celles créées par la génération de code existante)
// ---------------------------------------------------------------------------
const summarize = (rows) => {
  const counts = { present: 0, late: 0, absent: 0, byMethod: {} };
  for (const r of rows) {
    if (r.status === 'present') counts.present += 1;
    else if (r.status === 'late') counts.late += 1;
    else if (r.status === 'absent') counts.absent += 1;
    if (r.status === 'present' || r.status === 'late') {
      const method = r.method || 'inconnu';
      counts.byMethod[method] = (counts.byMethod[method] || 0) + 1;
    }
  }
  return counts;
};

async function listScannableSessions() {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, code, date, level, created_at, expires_at')
    .eq('date', todayString())
    .order('created_at', { ascending: false });
  if (error) throw error;

  const list = sessions || [];
  if (!list.length) return [];

  const rows = await fetchAllRows(() =>
    supabase.from('attendance').select('session_id, status, method').in('session_id', list.map((s) => s.id)).order('id')
  );

  const now = Date.now();
  return list.map((s) => ({
    id: s.id,
    code: s.code,
    date: s.date,
    level: s.level,
    createdAt: s.created_at,
    expiresAt: s.expires_at,
    codeOpen: new Date(s.expires_at).getTime() > now,
    counts: summarize(rows.filter((r) => r.session_id === s.id)),
  }));
}

// Liste des présents d'une séance (tous moyens confondus) + compteurs
async function getSessionAttendance(sessionId) {
  if (!UUID_RE.test(String(sessionId || ''))) throw new CardError(400, 'Séance invalide');

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, code, date, level, expires_at')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) throw new CardError(404, 'Séance introuvable');

  const rows = await fetchAllRows(() =>
    supabase.from('attendance').select('status, method').eq('session_id', sessionId).order('id')
  );

  const { data: present, error } = await supabase
    .from('attendance')
    .select('status, method, scanned_at, students(id, full_name, branch, level, profile_image_url, services(name))')
    .eq('session_id', sessionId)
    .in('status', ['present', 'late'])
    .order('scanned_at', { ascending: false })
    .limit(300);
  if (error) throw error;

  return {
    session: {
      id: session.id,
      code: session.code,
      date: session.date,
      level: session.level,
      expiresAt: session.expires_at,
    },
    counts: summarize(rows),
    items: (present || []).map((a) => ({
      studentId: a.students?.id || null,
      fullName: a.students?.full_name || 'Étudiant',
      photoUrl: a.students?.profile_image_url || null,
      branch: a.students?.branch || null,
      serviceName: a.students?.services?.name || null,
      level: a.students?.level ?? null,
      status: a.status,
      method: a.method || null,
      scannedAt: a.scanned_at,
    })),
  };
}

module.exports = { scanCard, listScannableSessions, getSessionAttendance };