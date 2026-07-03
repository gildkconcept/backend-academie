// routes/documentRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const documentController = require('../controllers/documentController');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// Routes étudiant
router.get('/student', documentController.getStudentDocuments);
router.post('/:id/download', documentController.downloadDocument);
router.post('/:id/view', documentController.viewDocument);

// Routes superadmin
router.get('/', roleMiddleware('superadmin'), documentController.getAllDocuments);
router.get('/stats', roleMiddleware('superadmin'), documentController.getStats);
router.get('/:id/downloads', roleMiddleware('superadmin'), documentController.getDocumentDownloads);
router.get('/:id', roleMiddleware('superadmin'), documentController.getDocumentById);

router.post('/upload', roleMiddleware('superadmin'), documentController.upload.single('file'), documentController.uploadFile);
router.post('/', roleMiddleware('superadmin'), documentController.createDocument);

router.put('/:id', roleMiddleware('superadmin'), documentController.updateDocument);

router.delete('/:id', roleMiddleware('superadmin'), documentController.deleteDocument);

module.exports = router;