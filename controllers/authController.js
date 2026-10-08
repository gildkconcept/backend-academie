const AuthService = require('../services/authService');
const { checkRateLimit, recordFailedAttempt, resetRateLimit } = require('../utils/rateLimitAuth');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('=========================================');
    console.log('🔐 [CONTROLLER] Tentative de connexion:', username);

    if (!username || !password) {
      return res.status(400).json({ error: 'Username et mot de passe requis' });
    }

    // ✅ Vérifier le rate limiting
    const rateLimit = checkRateLimit(username);
    if (!rateLimit.allowed) {
      console.log(`❌ [CONTROLLER] Trop de tentatives pour: ${username}`);
      return res.status(429).json({
        error: rateLimit.message,
        blockedUntil: rateLimit.blockedUntil,
        minutesLeft: rateLimit.minutesLeft
      });
    }

    // 🔧 FIX : on isole l'appel pour distinguer une erreur d'infra
    // (Supabase down...) d'un vrai échec d'identifiants.
    let result;
    try {
      result = await AuthService.validateCredentials(username, password);
    } catch (err) {
      if (err.isInfraError) {
        console.error('🔥 [CONTROLLER] Panne infra au login:', err.message);
        // ⚠️ On NE compte PAS ça comme une tentative échouée : ce n'est
        // pas la faute de l'utilisateur, il ne faut pas le pénaliser.
        return res.status(503).json({
          error: 'Service momentanément indisponible. Merci de réessayer dans quelques instants.'
        });
      }
      throw err;
    }

    if (!result.success) {
      // ✅ Enregistrer la tentative échouée (uniquement pour un vrai échec)
      recordFailedAttempt(username);
      console.log(`❌ [CONTROLLER] Échec pour: ${username}, tentatives restantes: ${rateLimit.attemptsLeft - 1}`);
      return res.status(401).json({
        error: result.error,
        attemptsLeft: rateLimit.attemptsLeft - 1
      });
    }

    // ✅ Connexion réussie - Réinitialiser les tentatives
    resetRateLimit(username);

    const token = AuthService.generateToken(result.user);

    console.log('✅ [CONTROLLER] Connexion réussie pour:', username);
    console.log('=========================================\n');

    res.json({
      success: true,
      user: result.user,
      token,
    });
  } catch (error) {
    console.error('❌ [CONTROLLER] Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

const verify = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    // 🔧 FIX : on distingue "token invalide/expiré" (401, déconnexion
    // normale) d'une "panne d'infrastructure" (503, on ne déconnecte PAS
    // l'utilisateur pour un problème qui n'est pas de son fait).
    let result;
    try {
      result = await AuthService.verifyToken(token);
    } catch (err) {
      if (err.isInfraError) {
        console.error('🔥 [CONTROLLER] Panne infra au verify:', err.message);
        return res.status(503).json({
          error: 'Service momentanément indisponible. Merci de réessayer dans quelques instants.'
        });
      }
      throw err;
    }

    if (!result.valid) {
      const message = result.reason === 'invalid_token'
        ? 'Session expirée, merci de vous reconnecter.'
        : 'Compte introuvable.';
      return res.status(401).json({ error: message });
    }

    const user = result.user;

    // Récupérer la photo de profil
    const supabase = require('../config/supabase');
    let profile_image_url = null;
    let full_name = user.name;
    let level = user.level;
    let maison_grace = user.maisonGrace;

    if (user.role === 'student') {
      const { data: student } = await supabase
        .from('students')
        .select('profile_image_url, full_name, level, service_id, maison_grace')
        .eq('id', user.id)
        .single();

      profile_image_url = student?.profile_image_url;
      full_name = student?.full_name;
      level = student?.level;
      maison_grace = student?.maison_grace;
      user.serviceId = student?.service_id;
    } else {
      const { data: admin } = await supabase
        .from('users')
        .select('profile_image_url, name')
        .eq('id', user.id)
        .single();

      profile_image_url = admin?.profile_image_url;
      full_name = admin?.name;
    }

    res.json({
      user: {
        id: user.id,
        name: full_name || user.name,
        username: user.username,
        role: user.role,
        serviceId: user.serviceId,
        level: level,
        maisonGrace: maison_grace,
        profile_image_url: profile_image_url
      }
    });
  } catch (error) {
    console.error('Erreur verify:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const checkUsername = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username doit contenir au moins 3 caractères' });
    }
    const result = await AuthService.checkUsernameAvailability(username);
    res.json(result);
  } catch (error) {
    console.error('Erreur checkUsername:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const register = async (req, res) => {
  try {
    const { fullName, branch, level, serviceId, baptized, phone, username, password, maisonGrace } = req.body;

    console.log('📝 Nouvelle inscription:', username);
    console.log('📞 Téléphone fourni:', phone);

    if (!fullName || !branch || !level || !serviceId || !username || !password) {
      return res.status(400).json({ error: 'Tous les champs requis ne sont pas fournis' });
    }

    // ✅ Déterminer si l'étudiant a un téléphone
    const hasPhone = phone && phone.trim() !== '';
    console.log('📱 A un téléphone:', hasPhone);

    const student = await AuthService.createStudent({
      fullName, branch, level, serviceId, baptized, phone, username, password, maisonGrace, hasPhone
    });

    console.log('✅ Inscription réussie:', username);

    res.status(201).json({
      message: 'Compte créé avec succès',
      username: student.username,
      studentId: student.id,
    });
  } catch (error) {
    console.error('Erreur register:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
};

// ==================== FONCTIONS POUR LA RÉCUPÉRATION DE COMPTE ====================

// Normalise un nom : minuscules, sans accents, espaces simplifiés
const normalizeName = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Le nom saisi correspond-il au nom enregistré ?
// - identique (sans tenir compte des accents/majuscules), OU
// - au moins 2 mots saisis, tous présents dans le nom enregistré
//   (Avant : n'importe quelle lettre suffisait, ex. "a" trouvait un compte.)
const nameMatches = (typedName, storedName) => {
  const typed = normalizeName(typedName);
  const stored = normalizeName(storedName);
  if (!typed || !stored) return false;
  if (typed === stored) return true;
  const typedWords = typed.split(' ');
  const storedWords = stored.split(' ');
  return typedWords.length >= 2 && typedWords.every((w) => storedWords.includes(w));
};

const verifyRecovery = async (req, res) => {
  try {
    const { phone, fullName, branch, serviceId } = req.body || {};
    const supabase = require('../config/supabase');
    const crypto = require('crypto');

    // --- Validation des entrées (évite les plantages et les injections) ---
    if (
      typeof phone !== 'string' || typeof fullName !== 'string' ||
      typeof branch !== 'string' || typeof serviceId !== 'string' ||
      !phone.trim() || !fullName.trim() || !branch.trim() || !serviceId.trim()
    ) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    const cleanInput = phone.trim();
    if (!/^[0-9+\s().-]{6,20}$/.test(cleanInput)) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }

    console.log('🔐 Vérification récupération demandée');

    const cleanPhone = cleanInput.replace(/^0+/, '');

    // .in() échappe correctement les valeurs (contrairement à .or() avec
    // du texte concaténé, qui permettait d'injecter des filtres).
    const { data: students, error } = await supabase
      .from('students')
      .select('id, username, full_name, phone, branch, service_id')
      .eq('branch', branch)
      .eq('service_id', serviceId)
      .is('deleted_at', null)
      .in('phone', [cleanInput, cleanPhone]);

    if (error) {
      console.error('Erreur recherche:', error);
      return res.status(500).json({ error: 'Erreur lors de la recherche' });
    }

    const student = students?.find((s) => nameMatches(fullName, s.full_name));

    if (!student) {
      console.log('❌ Aucun étudiant trouvé pour la récupération');
      return res.status(404).json({ error: 'Aucun compte trouvé avec ces informations' });
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const recoveryToken = crypto.randomBytes(32).toString('hex');

    const { error: updateError } = await supabase
      .from('students')
      .update({
        recovery_token: recoveryToken,
        recovery_token_expires_at: expiresAt.toISOString()
      })
      .eq('id', student.id);

    if (updateError) {
      console.error('Erreur stockage token:', updateError);
      return res.status(500).json({ error: 'Erreur lors de la préparation de la récupération' });
    }

    console.log('✅ Token de récupération généré pour:', student.username);

    // Même format de réponse qu'avant : le frontend n'a pas besoin de changer
    res.json({
      success: true,
      recoveryToken: recoveryToken,
      student: {
        username: student.username
      }
    });
  } catch (error) {
    console.error('Erreur verifyRecovery:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

const resetAccount = async (req, res) => {
  try {
    const { recoveryToken, newUsername, newPassword } = req.body || {};
    const bcrypt = require('bcryptjs');
    const supabase = require('../config/supabase');

    // --- Validation des entrées (mêmes minimums que le formulaire) ---
    if (typeof recoveryToken !== 'string' || !/^[a-f0-9]{64}$/i.test(recoveryToken)) {
      return res.status(400).json({ error: 'Token invalide' });
    }
    if (typeof newUsername !== 'string' || newUsername.trim().length < 3 || newUsername.length > 50) {
      return res.status(400).json({ error: 'Nom d\'utilisateur invalide (3 caractères minimum)' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 100) {
      return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });
    }

    console.log('🔐 Réinitialisation de compte demandée');

    const { data: student, error } = await supabase
      .from('students')
      .select('id, username, recovery_token, recovery_token_expires_at')
      .eq('recovery_token', recoveryToken)
      .is('deleted_at', null)
      .single();

    if (error || !student) {
      console.log('❌ Token invalide');
      return res.status(400).json({ error: 'Token invalide' });
    }

    // ✅ Vérification d'expiration réactivée (elle était désactivée
    // "temporairement"). Marge de 2 minutes, comme dans l'ancien code commenté.
    const expiresAt = student.recovery_token_expires_at
      ? new Date(student.recovery_token_expires_at)
      : null;
    if (!expiresAt || Date.now() > expiresAt.getTime() + 2 * 60 * 1000) {
      console.log('❌ Token expiré');
      return res.status(400).json({ error: 'Token expiré. Veuillez recommencer la procédure.' });
    }

    const { data: existingUser } = await supabase
      .from('students')
      .select('id')
      .eq('username', newUsername)
      .neq('id', student.id)
      .maybeSingle();

    if (existingUser) {
      console.log('❌ Username déjà pris');
      const suggestions = [];
      for (let i = 1; i <= 3; i++) {
        const candidate = `${newUsername}${i}`;
        const { data: existing } = await supabase
          .from('students')
          .select('id')
          .eq('username', candidate)
          .maybeSingle();
        if (!existing) suggestions.push(candidate);
      }
      return res.status(400).json({
        error: 'Ce nom d\'utilisateur est déjà pris',
        usernameTaken: true,
        suggestions
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from('students')
      .update({
        username: newUsername,
        password: hashedPassword,
        recovery_token: null,
        recovery_token_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', student.id);

    if (updateError) {
      console.error('Erreur mise à jour:', updateError);
      throw updateError;
    }

    console.log('✅ Compte réinitialisé avec succès pour:', newUsername);

    res.json({
      success: true,
      message: 'Compte réinitialisé avec succès'
    });
  } catch (error) {
    console.error('Erreur resetAccount:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = { login, verify, checkUsername, register, verifyRecovery, resetAccount };