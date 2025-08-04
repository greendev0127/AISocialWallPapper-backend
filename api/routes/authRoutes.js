const express = require('express');
const { register, login, me } = require('../controllers/authController');
const router = express.Router();

router.get('/me', me)
router.post('/login', login);
router.post('/register', register);

module.exports = router;