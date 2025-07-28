const express = require('express');
const { body } = require('express-validator');
const { 
  guestShortenUrl,
  shortenUrl, 
  getUserUrls, 
  getUrlStats, 
  deleteUrl 
} = require('../controllers/urlController');
const { authenticate } = require('../middleware/auth');
const { urlRateLimit, generalRateLimit } = require('../middleware/rateLimiter');

const router = express.Router();

// Validation rules
const shortenValidation = [
  body('longUrl')
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Please provide a valid URL with http or https protocol')
    .isLength({ max: 2048 })
    .withMessage('URL is too long'),
  body('customCode')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('Custom code must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Custom code can only contain letters, numbers, hyphens, and underscores'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid expiration date format')
];

const guestShortenValidation = [
  body('longUrl')
    .isURL({ protocols: ['http', 'https'] })
    .withMessage('Please provide a valid URL with http or https protocol')
    .isLength({ max: 2048 })
    .withMessage('URL is too long')
];

// Routes - Order matters! Put specific routes before generic ones
router.post('/guest-shorten', generalRateLimit, guestShortenValidation, guestShortenUrl);
router.post('/shorten', authenticate, urlRateLimit, shortenValidation, shortenUrl);
router.get('/my-urls', authenticate, getUserUrls);
router.get('/stats/:shortCode', authenticate, getUrlStats);
router.delete('/:shortCode', authenticate, deleteUrl);

module.exports = router;