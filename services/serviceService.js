const Service = require('../models/Service');

class ServiceService {
  static async getAllServices() {
    return await Service.findAll();
  }

  static async getServiceById(id) {
    return await Service.findById(id);
  }
}

module.exports = ServiceService;