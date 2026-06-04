const express = require('express');
const router = express.Router();
const { getQuizzes, getQuizById, submitQuiz, getMyResults } = require('../controllers/quizController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getQuizzes);
router.get('/my-results', getMyResults);
router.get('/:id', getQuizById);
router.post('/:id/submit', submitQuiz);

module.exports = router;