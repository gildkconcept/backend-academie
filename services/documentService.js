// services/documentService.js
const Document = require('../models/Document');
const supabase = require('../config/supabase');

// 🔧 FIX : nettoie un nom de fichier pour en faire une clé Supabase Storage
// valide. Corrige aussi le mojibake classique (°, é, à... envoyés en UTF-8
// mais lus en Latin1 par Multer/Busboy, ex: "°" devient "Â°").
// C'est ce qui causait l'erreur "StorageApiError: Invalid key".
function sanitizeFileName(originalName) {
    // 1. Tenter de corriger le double-encodage Latin1 -> UTF-8
    let decoded = originalName;
    try {
        decoded = Buffer.from(originalName, 'latin1').toString('utf8');
    } catch (e) {
        decoded = originalName;
    }

    // 2. Séparer nom et extension
    const lastDot = decoded.lastIndexOf('.');
    const ext = lastDot !== -1 ? decoded.substring(lastDot) : '';
    const nameOnly = lastDot !== -1 ? decoded.substring(0, lastDot) : decoded;

    // 3. Retirer les accents/diacritiques (é -> e, à -> a, etc.)
    const withoutAccents = nameOnly.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 4. Ne garder que des caractères sûrs pour une clé de storage
    //    (supprime °, /, ?, apostrophes, etc.)
    const safeName = withoutAccents
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 100) || 'document';

    const safeExt = (ext.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase()) || '.pdf';

    return `${safeName}${safeExt}`;
}

// 🔧 FIX : nom "propre" à afficher à l'utilisateur (on garde les accents
// pour la lisibilité, on corrige juste l'encodage et on retire les
// caractères qui posaient problème comme °).
function displayFileName(originalName) {
    let decoded = originalName;
    try {
        decoded = Buffer.from(originalName, 'latin1').toString('utf8');
    } catch (e) {
        decoded = originalName;
    }
    return decoded.replace(/[°]/g, '').trim();
}

class DocumentService {
    static async getAllDocuments(filters = {}) {
        return await Document.findAll(filters);
    }

    static async getStudentDocuments(studentId) {
        return await Document.findByStudent(studentId);
    }

    static async getDocumentById(id) {
        return await Document.findById(id);
    }

    static async createDocument(data, userId) {
        // Vérifier que le fichier existe
        if (!data.file_url) {
            throw new Error('Le fichier PDF est requis');
        }

        return await Document.create({
            ...data,
            created_by: userId
        });
    }

    static async updateDocument(id, data) {
        return await Document.update(id, data);
    }

    static async deleteDocument(id) {
        return await Document.delete(id);
    }

    static async downloadDocument(documentId, studentId, req) {
        const document = await Document.findById(documentId);
        
        if (!document) {
            throw new Error('Document non trouvé');
        }

        if (!document.is_visible) {
            throw new Error('Ce document n\'est pas disponible');
        }

        if (!document.is_downloadable) {
            throw new Error('Le téléchargement de ce document n\'est pas autorisé');
        }

        // Enregistrer le téléchargement
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'] || 'Unknown';

        await Document.incrementDownload(documentId, studentId, ipAddress, userAgent);

        return document;
    }

    static async viewDocument(documentId) {
        await Document.incrementView(documentId);
        return await Document.findById(documentId);
    }

    static async getStats() {
        return await Document.getStats();
    }

    static async getDocumentDownloads(documentId) {
        return await Document.getDownloadsByDocument(documentId);
    }

    static async uploadFile(file, folder = 'documents') {
        // 🔧 FIX : on construit la clé de storage à partir d'un nom
        // nettoyé, plus jamais à partir de file.originalname brut.
        const cleanName = sanitizeFileName(file.originalname);
        const fileName = `${Date.now()}_${cleanName}`;
        const filePath = `${folder}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('documents')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        const { data: urlData } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath);

        return {
            url: urlData.publicUrl,
            // 🔧 FIX : nom affiché à l'utilisateur, lisible et sans le bug
            // d'encodage, même si la clé de storage a été simplifiée.
            name: displayFileName(file.originalname),
            size: file.size,
            path: filePath
        };
    }

    static async deleteFile(filePath) {
        const { error } = await supabase.storage
            .from('documents')
            .remove([filePath]);

        if (error) throw error;
        return true;
    }
}

module.exports = DocumentService;