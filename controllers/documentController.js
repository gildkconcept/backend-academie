// controllers/documentController.js
const DocumentService = require('../services/documentService');
const multer = require('multer');
const path = require('path');

// Configuration multer pour les fichiers PDF
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf'];
        console.log('📄 Type de fichier:', file.mimetype);
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Seuls les fichiers PDF sont autorisés'));
        }
    }
});

// Configuration multer pour les images de couverture
const coverStorage = multer.memoryStorage();
const uploadCover = multer({
    storage: coverStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        console.log('📸 Type de fichier:', file.mimetype);
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Seuls les fichiers image sont autorisés (JPEG, PNG, WebP)'));
        }
    }
});

const getAllDocuments = async (req, res) => {
    try {
        const { level, branch, serviceId, search, isVisible } = req.query;
        const filters = { level, branch, service_id: serviceId, search, is_visible: isVisible };
        
        const documents = await DocumentService.getAllDocuments(filters);
        res.json(documents);
    } catch (error) {
        console.error('Erreur getAllDocuments:', error);
        res.status(500).json({ error: error.message });
    }
};

const getStudentDocuments = async (req, res) => {
    try {
        const studentId = req.user.id;
        const documents = await DocumentService.getStudentDocuments(studentId);
        res.json(documents);
    } catch (error) {
        console.error('Erreur getStudentDocuments:', error);
        res.status(500).json({ error: error.message });
    }
};

const getDocumentById = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await DocumentService.getDocumentById(id);
        
        if (!document) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }

        res.json(document);
    } catch (error) {
        console.error('Erreur getDocumentById:', error);
        res.status(500).json({ error: error.message });
    }
};

const createDocument = async (req, res) => {
    try {
        const {
            title,
            description,
            level,
            branch,
            serviceId,
            isVisible,
            isDownloadable,
            fileUrl,
            fileName,
            fileSize,
            coverImageUrl
        } = req.body;

        console.log('📝 Création document:', { title, fileUrl, fileName });

        if (!title || !fileUrl) {
            return res.status(400).json({ error: 'Le titre et le fichier sont requis' });
        }

        const document = await DocumentService.createDocument({
            title,
            description,
            file_url: fileUrl,
            file_name: fileName,
            file_size: fileSize || 0,
            cover_image_url: coverImageUrl || null,
            level: level || null,
            branch: branch || null,
            service_id: serviceId || null,
            is_visible: isVisible !== undefined ? isVisible : true,
            is_downloadable: isDownloadable !== undefined ? isDownloadable : true
        }, req.user.id);

        res.status(201).json(document);
    } catch (error) {
        console.error('Erreur createDocument:', error);
        res.status(500).json({ error: error.message });
    }
};

const updateDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            level,
            branch,
            serviceId,
            isVisible,
            isDownloadable,
            fileUrl,
            fileName,
            fileSize,
            coverImageUrl
        } = req.body;

        const document = await DocumentService.updateDocument(id, {
            title,
            description,
            file_url: fileUrl,
            file_name: fileName,
            file_size: fileSize || 0,
            cover_image_url: coverImageUrl || null,
            level: level || null,
            branch: branch || null,
            service_id: serviceId || null,
            is_visible: isVisible !== undefined ? isVisible : true,
            is_downloadable: isDownloadable !== undefined ? isDownloadable : true
        });

        res.json(document);
    } catch (error) {
        console.error('Erreur updateDocument:', error);
        res.status(500).json({ error: error.message });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        await DocumentService.deleteDocument(id);
        res.json({ success: true, message: 'Document supprimé avec succès' });
    } catch (error) {
        console.error('Erreur deleteDocument:', error);
        res.status(500).json({ error: error.message });
    }
};

const downloadDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const studentId = req.user.id;
        
        const document = await DocumentService.downloadDocument(id, studentId, req);
        
        res.json({
            success: true,
            url: document.file_url,
            file_name: document.file_name
        });
    } catch (error) {
        console.error('Erreur downloadDocument:', error);
        res.status(500).json({ error: error.message });
    }
};

const viewDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await DocumentService.viewDocument(id);
        res.json(document);
    } catch (error) {
        console.error('Erreur viewDocument:', error);
        res.status(500).json({ error: error.message });
    }
};

const getStats = async (req, res) => {
    try {
        const stats = await DocumentService.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Erreur getStats:', error);
        res.status(500).json({ error: error.message });
    }
};

const getDocumentDownloads = async (req, res) => {
    try {
        const { id } = req.params;
        const downloads = await DocumentService.getDocumentDownloads(id);
        res.json(downloads);
    } catch (error) {
        console.error('Erreur getDocumentDownloads:', error);
        res.status(500).json({ error: error.message });
    }
};

// Upload de fichier
const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier fourni' });
        }

        console.log('📤 Upload du fichier:', req.file.originalname);
        console.log('📏 Taille:', req.file.size, 'bytes');

        const result = await DocumentService.uploadFile(req.file);
        
        console.log('✅ Fichier uploadé:', result.url);
        
        res.json({
            success: true,
            url: result.url,
            name: result.name,
            size: result.size,
            path: result.path
        });
    } catch (error) {
        console.error('❌ Erreur uploadFile:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllDocuments,
    getStudentDocuments,
    getDocumentById,
    createDocument,
    updateDocument,
    deleteDocument,
    downloadDocument,
    viewDocument,
    getStats,
    getDocumentDownloads,
    uploadFile,
    upload,
    uploadCover
};