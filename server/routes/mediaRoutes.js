const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');

// Public route to access media files through the proxy
// Public route to access media files through the proxy
router.get(/\/(.*)/, mediaController.getMedia);

module.exports = router;
