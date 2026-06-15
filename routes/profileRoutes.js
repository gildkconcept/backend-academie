// routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const multer = require('multer');
const path = require('path');

// Configuration multer
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    allowedTypes.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Format non autorisé (JPG, PNG, WebP)'));
  }
});

const BUCKET_NAME = 'student-profiles';

// PUT - Mettre à jour le profil
router.put('/update', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { name, username, email, phone, baptized, maisonGrace, profileImageUrl } = req.body;

    const isAdmin = userRole === 'superadmin' || userRole === 'service_manager';
    const table = isAdmin ? 'users' : 'students';
    const updateData = isAdmin
      ? {
          name,
          username,
          email: email || null,
          profile_image_url: profileImageUrl || null,
          updated_at: new Date().toISOString()
        }
      : {
          full_name: name,
          username,
          email: email || null,
          phone: phone || null,
          baptized: baptized === true || baptized === 'true',
          maison_grace: maisonGrace || null,
          profile_image_url: profileImageUrl || null,
          updated_at: new Date().toISOString()
        };

    const { data, error } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, message: 'Profil mis à jour avec succès', user: data });
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Changer le mot de passe
router.post('/change-password', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { currentPassword, newPassword } = req.body;
    const bcrypt = require('bcryptjs');

    const table = (userRole === 'superadmin' || userRole === 'service_manager') ? 'users' : 'students';

    const { data: user, error: fetchError } = await supabase
      .from(table)
      .select('password')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from(table)
      .update({ password: hashedPassword, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) throw updateError;

    res.json({ success: true, message: 'Mot de passe changé avec succès' });
  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Upload photo
router.post('/upload-photo', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    console.log('📸 Upload - User:', userId, '| Fichier:', file.originalname, file.size, 'bytes');

    const table = (userRole === 'student') ? 'students' : 'users';
    const fileExt = path.extname(file.originalname);
    const fileName = `${userId}/profile${fileExt}`;

    // Upload vers Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      throw uploadError;
    }

    // Récupérer l'URL publique
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    console.log('✅ Upload OK - URL:', urlData.publicUrl);

    // Mettre à jour la base de données
    const { error: updateError } = await supabase
      .from(table)
      .update({ profile_image_url: urlData.publicUrl })
      .eq('id', userId);

    if (updateError) throw updateError;

    res.json({ success: true, url: urlData.publicUrl });
  } catch (error) {
    console.error('❌ Upload Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Supprimer la photo de profil
router.delete('/delete-photo', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const table = (userRole === 'student') ? 'students' : 'users';

    const { data: user } = await supabase
      .from(table)
      .select('profile_image_url')
      .eq('id', userId)
      .single();

    if (user?.profile_image_url) {
      const urlParts = user.profile_image_url.split('/');
      const bucketIndex = urlParts.indexOf(BUCKET_NAME);
      if (bucketIndex !== -1) {
        const filePath = urlParts.slice(bucketIndex + 1).join('/');
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      }
    }

    await supabase
      .from(table)
      .update({ profile_image_url: null })
      .eq('id', userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression photo:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;