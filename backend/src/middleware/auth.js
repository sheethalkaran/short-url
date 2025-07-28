const jwt = require('jsonwebtoken');
const redisClient = require('../utils/redis');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.authToken;

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if session exists in Redis
    const sessionData = await redisClient.getSession(token);
    if (!sessionData) {
      return res.status(401).json({ 
        success: false, 
        message: 'Session expired. Please login again.' 
      });
    }

    // Verify user still exists and is active
    const user = await User.findById(decoded.userId).select('-password');
    if (!user || !user.isActive) {
      await redisClient.deleteSession(token);
      return res.status(401).json({ 
        success: false, 
        message: 'User not found or inactive.' 
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

module.exports = { authenticate };