const express = require('express');
const router = express.Router();
const disposalController = require('../controllers/disposalController');
const { verifyToken, authorizeRole } = require('../middleware/authMiddleware');

router.get('/', verifyToken, disposalController.getAllDisposals);
router.get('/auctions', verifyToken, disposalController.getAuctions);
router.get('/:id', verifyToken, disposalController.getDisposalDetail);
router.post('/', verifyToken, disposalController.createDisposal); // Anyone authenticated can propose
router.patch('/:id/review', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), disposalController.reviewDisposal);

// Bidding Routes
router.post('/auctions/:id/bids', verifyToken, disposalController.submitBid);
router.patch('/auctions/bids/:bidId/win', verifyToken, authorizeRole(['SUPER_ADMIN', 'ADMIN_ASET']), disposalController.setWinner);

module.exports = router;
