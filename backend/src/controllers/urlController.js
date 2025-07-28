const { nanoid } = require('nanoid');
const { validationResult } = require('express-validator');
const Url = require('../models/Url');
const redisClient = require('../utils/redis');

const isValidUrl = (string) => {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

const generateShortCode = () => {
  return nanoid(8); // Generates 8-character unique ID
};

// Guest shorten (temporary URLs without authentication)
const guestShortenUrl = async (req, res) => {
  try {
    const { longUrl } = req.body;
    
    // Validate URL
    if (!longUrl || !isValidUrl(longUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid URL'
      });
    }

    // Generate unique short code
    let shortCode;
    do {
      shortCode = generateShortCode();
    } while (await redisClient.getCachedUrl(shortCode));

    // Store in Redis with 24-hour expiration (guest URLs are temporary)
    await redisClient.cacheUrl(shortCode, longUrl, 86400); // 24 hours

    const shortUrl = `${process.env.BASE_URL}/${shortCode}`;

    res.status(201).json({
      success: true,
      message: 'URL shortened successfully (temporary)',
      data: {
        longUrl,
        shortCode,
        shortUrl,
        expiresIn: '24 hours',
        note: 'This is a temporary link. Sign up to save and manage your URLs!'
      }
    });
  } catch (error) {
    console.error('Guest shorten URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const shortenUrl = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { longUrl, customCode, expiresAt } = req.body;
    const userId = req.user._id;

    // Validate URL
    if (!isValidUrl(longUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid URL'
      });
    }

    // Check if user already has this URL shortened
    const existingUrl = await Url.findOne({ 
      userId, 
      longUrl, 
      isActive: true 
    });

    if (existingUrl) {
      return res.json({
        success: true,
        message: 'URL already exists',
        data: {
          id: existingUrl._id,
          longUrl: existingUrl.longUrl,
          shortCode: existingUrl.shortCode,
          shortUrl: `${process.env.BASE_URL}/${existingUrl.shortCode}`,
          clicks: existingUrl.clicks,
          createdAt: existingUrl.createdAt,
          expiresAt: existingUrl.expiresAt
        }
      });
    }

    let shortCode = customCode;

    // If custom code provided, check if it's available
    if (customCode) {
      const customExists = await Url.findOne({ 
        $or: [
          { shortCode: customCode },
          { customCode: customCode }
        ]
      });

      if (customExists) {
        return res.status(400).json({
          success: false,
          message: 'Custom code is already taken'
        });
      }
    } else {
      // Generate unique short code
      let attempts = 0;
      do {
        shortCode = generateShortCode();
        attempts++;
        if (attempts > 10) {
          throw new Error('Unable to generate unique short code');
        }
      } while (await Url.findOne({ shortCode }));
    }

    // Create new URL entry
    const newUrl = new Url({
      longUrl,
      shortCode,
      customCode: customCode || null,
      userId,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    await newUrl.save();

    // Cache the URL in Redis
    await redisClient.cacheUrl(shortCode, longUrl);

    res.status(201).json({
      success: true,
      message: 'URL shortened successfully',
      data: {
        id: newUrl._id,
        longUrl: newUrl.longUrl,
        shortCode: newUrl.shortCode,
        shortUrl: `${process.env.BASE_URL}/${newUrl.shortCode}`,
        clicks: newUrl.clicks,
        createdAt: newUrl.createdAt,
        expiresAt: newUrl.expiresAt
      }
    });
  } catch (error) {
    console.error('Shorten URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const redirectUrl = async (req, res) => {
  try {
    const { shortCode } = req.params;

    // Validate shortCode: alphanumeric, hyphen, underscore, length 4-20
    if (!/^[a-zA-Z0-9_-]{4,20}$/.test(shortCode)) {
      return res.status(404).json({
        success: false,
        message: 'Invalid short code'
      });
    }

    // First check Redis cache
    let longUrl = await redisClient.getCachedUrl(shortCode);

    if (!longUrl) {
      // If not in cache, check database
      const urlDoc = await Url.findOne({ 
        shortCode, 
        isActive: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      if (!urlDoc) {
        return res.status(404).render('404', { 
          message: 'URL not found or expired',
          shortCode 
        });
      }

      longUrl = urlDoc.longUrl;
      
      // Cache for future requests
      await redisClient.cacheUrl(shortCode, longUrl);
    }

    // Increment click count in Redis (async, don't wait)
    redisClient.incrementClicks(shortCode).catch(console.error);

    // Update database click count (async, don't wait)
    Url.updateOne(
      { shortCode }, 
      { $inc: { clicks: 1 } }
    ).catch(console.error);

    // Redirect to original URL
    res.redirect(301, longUrl);
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getUserUrls = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10)); // Limit between 1-50
    const skip = (page - 1) * limit;

    // Get URLs with pagination
    const [urls, total] = await Promise.all([
      Url.find({ 
        userId, 
        isActive: true 
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      Url.countDocuments({ 
        userId, 
        isActive: true 
      })
    ]);

    // Enhance with cached click counts
    const enhancedUrls = await Promise.all(
      urls.map(async (url) => {
        try {
          const cachedClicks = await redisClient.getClicks(url.shortCode);
          return {
            ...url.toObject(),
            shortUrl: `${process.env.BASE_URL}/${url.shortCode}`,
            totalClicks: Math.max(url.clicks, cachedClicks),
            isExpired: url.expiresAt && url.expiresAt < new Date()
          };
        } catch (error) {
          console.error(`Error getting clicks for ${url.shortCode}:`, error);
          return {
            ...url.toObject(),
            shortUrl: `${process.env.BASE_URL}/${url.shortCode}`,
            totalClicks: url.clicks,
            isExpired: url.expiresAt && url.expiresAt < new Date()
          };
        }
      })
    );

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        urls: enhancedUrls,
        pagination: {
          current: page,
          pages: totalPages,
          total,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get user URLs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const getUrlStats = async (req, res) => {
  try {
    const { shortCode } = req.params;
    const userId = req.user._id;

    const url = await Url.findOne({ 
      shortCode, 
      userId, 
      isActive: true 
    });

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'URL not found'
      });
    }

    // Get latest click count from Redis
    let totalClicks = url.clicks;
    try {
      const cachedClicks = await redisClient.getClicks(shortCode);
      totalClicks = Math.max(url.clicks, cachedClicks);
    } catch (error) {
      console.error('Error getting cached clicks:', error);
    }

    res.json({
      success: true,
      data: {
        id: url._id,
        longUrl: url.longUrl,
        shortCode: url.shortCode,
        shortUrl: `${process.env.BASE_URL}/${url.shortCode}`,
        clicks: totalClicks,
        createdAt: url.createdAt,
        updatedAt: url.updatedAt,
        expiresAt: url.expiresAt,
        isExpired: url.expiresAt && url.expiresAt < new Date(),
        customCode: url.customCode
      }
    });
  } catch (error) {
    console.error('Get URL stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const deleteUrl = async (req, res) => {
  try {
    const { shortCode } = req.params;
    const userId = req.user._id;

    const url = await Url.findOneAndUpdate(
      { shortCode, userId, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'URL not found'
      });
    }

    // Remove from Redis cache
    try {
      await Promise.all([
        redisClient.client.del(`url:${shortCode}`),
        redisClient.client.del(`clicks:${shortCode}`)
      ]);
    } catch (error) {
      console.error('Error clearing Redis cache:', error);
      // Don't fail the request if cache clearing fails
    }

    res.json({
      success: true,
      message: 'URL deleted successfully'
    });
  } catch (error) {
    console.error('Delete URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  guestShortenUrl,
  shortenUrl,
  redirectUrl,
  getUserUrls,
  getUrlStats,
  deleteUrl
};