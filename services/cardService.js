// services/cardService.js
// Carte d'identité numérique des étudiants.
// Principe : AUCUNE donnée de profil n'est copiée. La table student_cards ne contient
// que le numéro de série, le jeton de vérification (QR code) et le statut de la carte.
// Nom, photo, branche, service et niveau sont lus dans la table students à chaque appel.

const crypto = require('crypto');
const supabase = require('../config/supabase');

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// La photo apparaît sur la page publique de vérification (pour comparer le visage).
// Pour la masquer : CARD_VERIFY_SHOW_PHOTO=false dans le .env du backend.
const showPhotoOnVerify = () =>
  String(process.env.CARD_VERIFY_SHOW_PHOTO || 'true').toLowerCase() !== 'false';

const STUDENT_COLUMNS =
  'id, full_name, prenom, nom, branch, level, profile_image_url, deleted_at, services(id, name)';

class CardError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const formatCardNumber = (serialNo) => `AG-${String(serialNo).padStart(6, '0')}`;

// Convertit une erreur Supabase en erreur lisible (table absente = migration non exécutée)
const dbError = (error) => {
  if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
    return new CardError(503, 'La fonctionnalité carte étudiant n\'est pas encore initialisée.');
  }
  return error;
};

async function getStudent(studentId, { includeDeleted = false } = {}) {
  let query = supabase.from('students').select(STUDENT_COLUMNS).eq('id', studentId);
  if (!includeDeleted) query = query.is('deleted_at', null);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function findCardByStudent(studentId) {
  const { data, error } = await supabase
    .from('student_cards')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw dbError(error);
  return data;
}

// Crée la carte la première fois que l'étudiant l'ouvre (aucune création en masse).
async function getOrCreateCard(studentId) {
  const existing = await findCardByStudent(studentId);
  if (existing) return existing;

  const token = crypto.randomBytes(24).toString('base64url'); // 32 caractères, 192 bits
  const { data, error } = await supabase
    .from('student_cards')
    .insert({ student_id: studentId, verify_token: token })
    .select('*')
    .single();

  if (error) {
    // 23505 = doublon : une autre requête vient de créer la carte au même instant
    if (error.code === '23505') {
      const again = await findCardByStudent(studentId);
      if (again) return again;
    }
    throw dbError(error);
  }
  return data;
}

const studentDto = (s) => ({
  fullName: s.full_name,
  firstName: s.prenom || null,
  lastName: s.nom || null,
  branch: s.branch || null,
  level: s.level ?? null,
  serviceName: s.services?.name || null,
  profileImageUrl: s.profile_image_url || null,
});

// ---------------------------------------------------------------------------
// Carte PRIVÉE : uniquement pour l'étudiant connecté (son id vient du token JWT)
// ---------------------------------------------------------------------------
async function getMyCard(studentId) {
  const student = await getStudent(studentId);
  if (!student) throw new CardError(404, 'Étudiant introuvable');

  const card = await getOrCreateCard(studentId);
  return {
    card: {
      cardNumber: formatCardNumber(card.serial_no),
      status: card.status,
      issuedAt: card.issued_at,
      verifyToken: card.verify_token,
    },
    student: studentDto(student),
  };
}

// ---------------------------------------------------------------------------
// Vérification PUBLIQUE : ne renvoie que le strict nécessaire
// ---------------------------------------------------------------------------
async function verifyCard(token) {
  const unknown = { httpStatus: 404, body: { valid: false, status: 'unknown' } };

  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return unknown;

  const { data: card, error } = await supabase
    .from('student_cards')
    .select('student_id, serial_no, status, issued_at, revoked_at')
    .eq('verify_token', token)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!card) return unknown;

  const cardNumber = formatCardNumber(card.serial_no);

  if (card.status === 'revoked') {
    // Aucune donnée personnelle pour une carte révoquée
    return { httpStatus: 200, body: { valid: false, status: 'revoked', cardNumber, revokedAt: card.revoked_at } };
  }

  const student = await getStudent(card.student_id, { includeDeleted: true });
  if (!student || student.deleted_at) {
    return { httpStatus: 200, body: { valid: false, status: 'invalid', cardNumber } };
  }

  return {
    httpStatus: 200,
    body: {
      valid: true,
      status: 'valid',
      cardNumber,
      issuedAt: card.issued_at,
      student: {
        fullName: student.full_name,
        photoUrl: showPhotoOnVerify() ? student.profile_image_url || null : null,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Administration (superadmin) : révoquer / réactiver une carte
// ---------------------------------------------------------------------------
async function setCardStatus(studentId, status, { reason, adminId } = {}) {
  if (!UUID_RE.test(String(studentId))) throw new CardError(400, 'Identifiant étudiant invalide');

  const student = await getStudent(studentId, { includeDeleted: true });
  if (!student) throw new CardError(404, 'Étudiant introuvable');

  const card = await getOrCreateCard(studentId);

  const update =
    status === 'revoked'
      ? {
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_reason: typeof reason === 'string' ? reason.trim().slice(0, 200) || null : null,
          revoked_by: UUID_RE.test(String(adminId)) ? adminId : null,
        }
      : { status: 'active', revoked_at: null, revoked_reason: null, revoked_by: null };

  const { error } = await supabase.from('student_cards').update(update).eq('id', card.id);
  if (error) throw dbError(error);

  return { cardNumber: formatCardNumber(card.serial_no), status };
}

module.exports = { CardError, getMyCard, verifyCard, setCardStatus, formatCardNumber };