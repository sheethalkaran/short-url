const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const redisClient = require('./utils/redis');
const authRoutes = require('./routes/auth');
const urlRoutes = require('./routes/url');
const redirectRoutes = require('./routes/redirect');
const { generalRateLimit } = require('./middleware/rateLimiter');

const app = express();
let server = null;

// Trust proxy for Docker deployment
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CORS configuration for Docker environment
app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS origin:', origin); // Debug CORS
    
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
}));

app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
app.use(generalRateLimit);

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${req.get('origin') || 'no-origin'}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
console.log('Registering auth routes...');
app.use('/api/auth', authRoutes);

console.log('Registering URL routes...');
app.use('/api/url', urlRoutes);

console.log('Registering redirect routes...');
// Direct redirect route (short URLs like /abc123)
app.use('/', redirectRoutes);

// Debug: List all registered routes
console.log('Registered routes:');
app._router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    console.log(`  ${Object.keys(r.route.methods).join(',').toUpperCase()} ${r.route.path}`);
  } else if (r.name === 'router') {
    console.log(`  Router: ${r.regexp}`);
    if (r.handle.stack) {
      r.handle.stack.forEach((nestedRoute) => {
        if (nestedRoute.route) {
          const methods = Object.keys(nestedRoute.route.methods).join(',').toUpperCase();
          console.log(`    ${methods} ${nestedRoute.route.path}`);
        }
      });
    }
  }
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  console.log(`API 404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'API route not found'
  });
});

// 404 handler for all other routes
app.use('*', (req, res) => {
  console.log(`General 404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  res.status(error.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// Database connection with retry logic
const connectDB = async (retries = 5) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    if (retries > 0) {
      console.log(`🔄 Retrying MongoDB connection... (${retries} attempts left)`);
      setTimeout(() => connectDB(retries - 1), 5000);
    } else {
      console.error('❌ Failed to connect to MongoDB after multiple attempts');
      process.exit(1);
    }
  }
};

// Redis connection with retry logic
const connectRedis = async (retries = 5) => {
  try {
    await redisClient.connect();
    console.log('✅ Redis connected successfully');
  } catch (error) {
    console.error('❌ Redis connection error:', error.message);
    if (retries > 0) {
      console.log(`🔄 Retrying Redis connection... (${retries} attempts left)`);
      setTimeout(() => connectRedis(retries - 1), 5000);
    } else {
      console.error('❌ Failed to connect to Redis after multiple attempts');
      process.exit(1);
    }
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`🔄 Received ${signal}. Shutting down gracefully...`);
  
  try {
    if (server) {
      server.close(() => {
        console.log('✅ HTTP server closed');
      });
    }

    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    
    if (redisClient.isOpen) {
      await redisClient.disconnect();
      console.log('✅ Redis connection closed');
    }
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  gracefulShutdown('UNHANDLED_REJECTION');
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    
    const PORT = process.env.PORT || 5000;
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
      console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log(`🔗 Base URL: ${process.env.BASE_URL}`);
    });
    
    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;