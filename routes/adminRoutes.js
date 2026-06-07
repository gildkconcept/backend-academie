const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Récupérer tous les versets
router.get('/verses', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('daily_verse')
      .select('*')
      .order('displayed_date', { ascending: false });
    
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Erreur get verses:', error);
    res.status(500).json({ error: error.message });
  }
});

// Créer un verset
router.post('/verses', async (req, res) => {
  try {
    const { verse, reference, displayed_date, is_active } = req.body;
    
    const { data, error } = await supabase
      .from('daily_verse')
      .insert([{ verse, reference, displayed_date, is_active: true }])
      .select()
      .single();
    
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Erreur create verse:', error);
    res.status(500).json({ error: error.message });
  }
});

// Modifier un verset
router.put('/verses', async (req, res) => {
  try {
    const { id, verse, reference, displayed_date, is_active } = req.body;
    
    const { data, error } = await supabase
      .from('daily_verse')
      .update({ verse, reference, displayed_date, is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Erreur update verse:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un verset
router.delete('/verses', async (req, res) => {
  try {
    const { id } = req.query;
    
    const { error } = await supabase
      .from('daily_verse')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur delete verse:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;