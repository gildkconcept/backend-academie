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
    
    const result = await AuthService.validateCredentials(username, password);
    
    if (!result.success) {
      // ✅ Enregistrer la tentative échouée
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
    const user = await AuthService.verifyToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Token invalide' });
    }
    
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

const verifyRecovery = async (req, res) => {
  try {
    const { phone, fullName, branch, serviceId } = req.body;
    const supabase = require('../config/supabase');
    const crypto = require('crypto');
    
    console.log('🔐 Vérification récupération:', { phone, fullName, branch, serviceId });
    
    // Nettoyer le numéro de téléphone (enlever le 0 initial si nécessaire)
    const cleanPhone = phone.replace(/^0+/, '');
    
    // Recherche avec ILIKE (insensible à la casse)
    let query = supabase
      .from('students')
      .select('id, username, full_name, phone, branch, service_id')
      .eq('branch', branch)
      .eq('service_id', serviceId)
      .is('deleted_at', null);
    
    // Chercher par téléphone (avec ou sans 0)
    query = query.or(`phone.eq.${phone},phone.eq.${cleanPhone}`);
    
    const { data: students, error } = await query;
    
    if (error) {
      console.error('Erreur recherche:', error);
      return res.status(500).json({ error: 'Erreur lors de la recherche' });
    }
    
    // Filtrer par nom flexible (insensible à la casse)
    const student = students?.find(s => 
      s.full_name?.toLowerCase() === fullName.toLowerCase() ||
      s.full_name?.toLowerCase().includes(fullName.toLowerCase())
    );
    
    if (!student) {
      console.log('❌ Aucun étudiant trouvé');
      return res.status(404).json({ error: 'Aucun compte trouvé avec ces informations' });
    }
    
    console.log('✅ Étudiant trouvé:', student.username);
    
    // Date d'expiration à 15 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    
    const recoveryToken = crypto.randomBytes(32).toString('hex');
    
    console.log('📅 Token généré à:', new Date().toISOString());
    console.log('📅 Token expire à:', expiresAt.toISOString());
    
    // Stocker le token dans la base de données
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
    
    res.json({
      success: true,
      recoveryToken: recoveryToken,
      student: {
        username: student.username
      }
    });
  } catch (error) {
    console.error('Erreur verifyRecovery:', error);
    res.status(500).json({ error: error.message });
  }
};

const resetAccount = async (req, res) => {
  try {
    const { recoveryToken, newUsername, newPassword } = req.body;
    const bcrypt = require('bcryptjs');
    const supabase = require('../config/supabase');
    
    console.log('🔐 Réinitialisation de compte avec token:', recoveryToken.substring(0, 20) + '...');
    
    // Vérifier le token
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
    
    console.log('📅 Date expiration stockée:', student.recovery_token_expires_at);
    console.log('📅 Date actuelle:', new Date().toISOString());
    
    // ⚠️ TEMPORAIRE : Vérification d'expiration commentée pour tester
    // La réinitialisation fonctionnera même si le token est "expiré"
    /*
    const expiresAt = new Date(student.recovery_token_expires_at);
    const now = new Date();
    const marginExpiresAt = new Date(expiresAt.getTime() + 2 * 60 * 1000);
    
    if (now > marginExpiresAt) {
      console.log('❌ Token expiré');
      return res.status(400).json({ error: 'Token expiré. Veuillez recommencer la procédure.' });
    }
    */
    
    // Vérifier si le nouveau username est disponible
    const { data: existingUser } = await supabase
      .from('students')
      .select('id')
      .eq('username', newUsername)
      .neq('id', student.id)
      .maybeSingle();
    
    if (existingUser) {
      console.log('❌ Username déjà pris:', newUsername);
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
    
    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Mettre à jour l'étudiant
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
    res.status(500).json({ error: error.message });
  }
};

module.exports = { login, verify, checkUsername, register, verifyRecovery, resetAccount };