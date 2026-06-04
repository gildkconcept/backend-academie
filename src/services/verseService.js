const DailyVerse = require('../models/DailyVerse');

class VerseService {
  // Récupérer le verset du jour
  static async getTodayVerse() {
    return await DailyVerse.getToday();
  }

  // Récupérer tous les versets
  static async getAllVerses() {
    return await DailyVerse.getAll();
  }

  // Créer un nouveau verset
  static async createVerse(verseData, userId) {
    const { verse, reference, displayed_date } = verseData;
    
    if (!verse || !reference || !displayed_date) {
      throw new Error('Champs requis: verse, reference, displayed_date');
    }
    
    // Vérifier si un verset existe déjà pour cette date
    const existing = await DailyVerse.getByDate(displayed_date);
    if (existing) {
      throw new Error(`Un verset existe déjà pour le ${displayed_date}`);
    }
    
    return await DailyVerse.create({ 
      verse, 
      reference, 
      displayed_date, 
      is_active: true 
    }, userId);
  }

  // Modifier un verset
  static async updateVerse(id, verseData) {
    const { verse, reference, displayed_date, is_active } = verseData;
    
    const updated = await DailyVerse.update(id, { 
      verse, 
      reference, 
      displayed_date, 
      is_active,
      updated_at: new Date().toISOString()
    });
    
    return updated;
  }

  // Supprimer un verset
  static async deleteVerse(id) {
    await DailyVerse.delete(id);
    return true;
  }
}

module.exports = VerseService;