// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');

const { uploadAvatar, generateAvatar, saveGeneratedAvatar } = require('../controllers/userController');
const { verifyToken } = require('../middleware/verifyToken');

// Configure multer to store files in memory as a buffer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Route for local image uploads
router.post('/avatar/upload', verifyToken, upload.single('avatar'), uploadAvatar);

// Route for AI avatar generation (just generates and returns URL)
router.post('/avatar/generate', verifyToken, generateAvatar);

// Route for saving a confirmed AI-generated avatar
router.post('/avatar/save-generated', verifyToken, saveGeneratedAvatar);

module.exports = router;