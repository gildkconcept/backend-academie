const VerseService = require('../services/verseService');

const getTodayVerse = async (req, res) => {
  try {
    const verse = await VerseService.getTodayVerse();
    res.json({ verse });
  } catch (error) {
    console.error('Erreur getTodayVerse:', error);
    res.json({ verse: null });
  }
};

const getAllVerses = async (req, res) => {
  try {
    const verses = await VerseService.getAllVerses();
    res.json(verses);
  } catch (error) {
    console.error('Erreur getAllVerses:', error);
    res.status(500).json({ error: error.message });
  }
};

const createVerse = async (req, res) => {
  try {
    const { verse, reference, displayed_date } = req.body;
    const newVerse = await VerseService.createVerse({ verse, reference, displayed_date }, req.user.id);
    res.status(201).json(newVerse);
  } catch (error) {
    console.error('Erreur createVerse:', error);
    res.status(400).json({ error: error.message });
  }
};

const updateVerse = async (req, res) => {
  try {
    const { id } = req.params;
    const { verse, reference, displayed_date, is_active } = req.body;
    const updated = await VerseService.updateVerse(id, { verse, reference, displayed_date, is_active });
    res.json(updated);
  } catch (error) {
    console.error('Erreur updateVerse:', error);
    res.status(500).json({ error: error.message });
  }
};

const deleteVerse = async (req, res) => {
  try {
    const { id } = req.params;
    await VerseService.deleteVerse(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur deleteVerse:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getTodayVerse, getAllVerses, createVerse, updateVerse, deleteVerse };