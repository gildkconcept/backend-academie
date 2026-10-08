// utils/sanitize.js
// Retire les champs sensibles d'un étudiant avant de l'envoyer au client.
// Les données en base ne sont PAS modifiées : on filtre uniquement la réponse.

const SENSITIVE_FIELDS = ['password', 'recovery_token', 'recovery_token_expires_at'];

function sanitizeStudent(student) {
  if (!student || typeof student !== 'object') return student;
  const copy = { ...student };
  for (const field of SENSITIVE_FIELDS) delete copy[field];
  return copy;
}

function sanitizeStudents(students) {
  return Array.isArray(students) ? students.map(sanitizeStudent) : students;
}

module.exports = { sanitizeStudent, sanitizeStudents };