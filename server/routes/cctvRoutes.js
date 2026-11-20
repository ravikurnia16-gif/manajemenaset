const express = require('express');
const router = express.Router();
const cctvController = require('../controllers/cctvController');
const { verifyToken } = require('../middleware/authMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

const sdpTextParser = express.text({
    type: ['application/sdp', 'application/trickle-ice-sdpfrag', 'text/plain'],
    limit: '1mb'
});

router.use(verifyToken);

// Cek hak akses user yang sedang login (untuk menampilkan/menyembunyikan menu Sidebar & route guard)
router.get('/my-access', cctvController.getMyAccess);

// Mengambil daftar kamera yang diizinkan untuk ditonton (Kabid Sarana = semua, User lain = sesuai hak akses)
router.get('/streams', cctvController.getAccessibleStreams);

// Proxy pemutaran video (autentikasi + cek hak akses per kamera dilakukan di backend)
router.post('/play/:id/whep', sdpTextParser, cctvController.playWhep);
router.patch('/play/:id/whep-session', sdpTextParser, cctvController.playWhepSession);
router.delete('/play/:id/whep-session', cctvController.playWhepSession);
router.use('/play/:id/hls', cctvController.playHls);

// Endpoint pengelolaan di bawah ini EKSKLUSIF untuk position Kepala Bidang Sarana
router.get('/cameras', cctvController.requireKabidSaranaPosition, cctvController.getAllCameras);
router.post('/cameras/batch', cctvController.requireKabidSaranaPosition, cctvController.createBatchCameras);
router.post('/cameras', cctvController.requireKabidSaranaPosition, cctvController.createCamera);
router.put('/cameras/:id', cctvController.requireKabidSaranaPosition, cctvController.updateCamera);
router.patch('/cameras/:id/toggle', cctvController.requireKabidSaranaPosition, cctvController.toggleCameraStatus);
router.delete('/cameras/:id', cctvController.requireKabidSaranaPosition, cctvController.deleteCamera);
router.post('/cameras/:id/test', cctvController.requireKabidSaranaPosition, cctvController.testCameraStream);

router.get('/access/users', cctvController.requireKabidSaranaPosition, cctvController.getUsersForAccess);
router.put('/access/user/:userId', cctvController.requireKabidSaranaPosition, cctvController.updateUserAccess);
router.put('/access/camera/:cameraId', cctvController.requireKabidSaranaPosition, cctvController.updateCameraAccess);

router.get('/gateway', cctvController.requireKabidSaranaPosition, cctvController.getGatewaySettings);
router.put('/gateway', cctvController.requireKabidSaranaPosition, cctvController.saveGatewaySettings);
router.post('/gateway/test', cctvController.requireKabidSaranaPosition, cctvController.testGatewayConnection);
router.post('/gateway/sync', cctvController.requireKabidSaranaPosition, cctvController.syncGatewayCameras);
router.get('/mediamtx-config', cctvController.requireKabidSaranaPosition, cctvController.getMediamtxConfig);

// Denah Lokasi CCTV (View: semua user berhak, Manage & Penempatan Titik: Kepala Bidang Sarana)
router.get('/floor-plans', cctvController.getFloorPlans);
router.post('/floor-plans', cctvController.requireKabidSaranaPosition, handleUpload('image', 'cctv-floorplans'), cctvController.createFloorPlan);
router.put('/floor-plans/:id', cctvController.requireKabidSaranaPosition, handleUpload('image', 'cctv-floorplans'), cctvController.updateFloorPlan);
router.put('/floor-plans/:id/positions', cctvController.requireKabidSaranaPosition, cctvController.saveFloorPlanPositions);
router.delete('/floor-plans/:id', cctvController.requireKabidSaranaPosition, cctvController.deleteFloorPlan);

module.exports = router;
