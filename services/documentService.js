// services/documentService.js
const Document = require('../models/Document');
const supabase = require('../config/supabase');

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
        const fileName = `${Date.now()}_${file.originalname}`;
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
            name: file.originalname,
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