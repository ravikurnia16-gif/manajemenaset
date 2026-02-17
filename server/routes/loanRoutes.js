const express = require('express');
const {
    requestLoan, reviewLoan, returnLoan, getAllLoans, getLoanDetail
} = require('../controllers/loanController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/request', verifyToken, requestLoan);
router.get('/', verifyToken, getAllLoans);
router.get('/:id', verifyToken, getLoanDetail);
router.post('/:id/review', verifyToken, reviewLoan);
router.post('/:id/return', verifyToken, returnLoan);

module.exports = router;
