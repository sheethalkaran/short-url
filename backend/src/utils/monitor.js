// Add to utils/monitor.js
const os = require('os');

class Monitor {
  static getSystemStats() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: os.loadavg(),
      platform: os.platform(),
      nodeVersion: process.version
    };
  }

  static async getDatabaseStats() {
    const User = require('../models/User');
    const Url = require('../models/Url');
    
    const [userCount, urlCount, activeUrls] = await Promise.all([
      User.countDocuments(),
      Url.countDocuments(),
      Url.countDocuments({ isActive: true })
    ]);

    return {
      users: userCount,
      totalUrls: urlCount,
      activeUrls,
      inactiveUrls: urlCount - activeUrls
    };
  }
}

module.exports = Monitor;