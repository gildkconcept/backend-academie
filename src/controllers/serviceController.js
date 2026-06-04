const ServiceService = require('../services/serviceService');

const getAllServices = async (req, res) => {
  try {
    const services = await ServiceService.getAllServices();
    res.json(services);
  } catch (error) {
    console.error('Erreur getAllServices:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

module.exports = { getAllServices };