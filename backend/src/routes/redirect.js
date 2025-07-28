const express = require('express');
const { redirectUrl } = require('../controllers/urlController');

const router = express.Router();

// Only handle GET /:shortCode for root-level redirects (validate in controller)
router.get('/:shortCode', redirectUrl);

module.exports = router;
