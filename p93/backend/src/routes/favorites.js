const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');

router.get('/user/:userId', favoriteController.getFavoritesByUserId);
router.get('/check/:userId/:craftId', favoriteController.checkFavorite);
router.post('/toggle', favoriteController.toggleFavorite);

module.exports = router;
