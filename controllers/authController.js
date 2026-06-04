const AuthService = require('../services/authService');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('=========================================');
    console.log('🔐 [CONTROLLER] Tentative de connexion:', username);
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username et mot de passe requis' });
    }
    
    const result = await AuthService.validateCredentials(username, password);
    
    if (!result.success) {
      console.log('❌ [CONTROLLER] Échec:', result.error);
      return res.status(401).json({ error: result.error });
    }
    
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
    res.json({ user });
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
    
    if (!fullName || !branch || !level || !serviceId || !username || !password) {
      return res.status(400).json({ error: 'Tous les champs requis ne sont pas fournis' });
    }
    
    const student = await AuthService.createStudent({
      fullName, branch, level, serviceId, baptized, phone, username, password, maisonGrace
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

module.exports = { login, verify, checkUsername, register };