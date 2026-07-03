// models/Document.js
const supabase = require('../config/supabase');

class Document {
    static async create(data) {
        const { data: document, error } = await supabase
            .from('documents')
            .insert({
                title: data.title,
                description: data.description,
                file_url: data.file_url,
                file_name: data.file_name,
                file_size: data.file_size,
                cover_image_url: data.cover_image_url || null,
                level: data.level || null,
                branch: data.branch || null,
                service_id: data.service_id || null,
                is_visible: data.is_visible !== undefined ? data.is_visible : true,
                is_downloadable: data.is_downloadable !== undefined ? data.is_downloadable : true,
                created_by: data.created_by,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return document;
    }

    static async findAll(filters = {}) {
        let query = supabase
            .from('documents')
            .select('*, services(name), users(name as creator_name)')
            .order('created_at', { ascending: false });

        if (filters.level) query = query.eq('level', filters.level);
        if (filters.branch) query = query.eq('branch', filters.branch);
        if (filters.service_id) query = query.eq('service_id', filters.service_id);
        if (filters.is_visible !== undefined) query = query.eq('is_visible', filters.is_visible);
        if (filters.search) query = query.ilike('title', `%${filters.search}%`);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    static async findByStudent(studentId) {
        // Récupérer les informations de l'étudiant
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('level, branch, service_id')
            .eq('id', studentId)
            .single();

        if (studentError) throw studentError;

        let query = supabase
            .from('documents')
            .select('*')
            .eq('is_visible', true)
            .order('created_at', { ascending: false });

        // Filtrer par niveau
        if (student.level) {
            query = query.or(`level.eq.${student.level},level.is.null`);
        }

        // Filtrer par branche
        if (student.branch) {
            query = query.or(`branch.eq.${student.branch},branch.is.null`);
        }

        // Filtrer par service
        if (student.service_id) {
            query = query.or(`service_id.eq.${student.service_id},service_id.is.null`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    static async findById(id) {
        const { data, error } = await supabase
            .from('documents')
            .select('*, services(name), users(name as creator_name)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    }

    static async update(id, data) {
        const { data: document, error } = await supabase
            .from('documents')
            .update({
                title: data.title,
                description: data.description,
                file_url: data.file_url,
                file_name: data.file_name,
                file_size: data.file_size,
                cover_image_url: data.cover_image_url || null,
                level: data.level || null,
                branch: data.branch || null,
                service_id: data.service_id || null,
                is_visible: data.is_visible !== undefined ? data.is_visible : true,
                is_downloadable: data.is_downloadable !== undefined ? data.is_downloadable : true,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return document;
    }

    static async delete(id) {
        // Supprimer aussi les téléchargements associés
        await supabase
            .from('document_downloads')
            .delete()
            .eq('document_id', id);

        const { error } = await supabase
            .from('documents')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }

    static async incrementDownload(id, studentId, ipAddress, userAgent) {
        // Incrémenter le compteur
        const { error: updateError } = await supabase.rpc('increment_download_count', { doc_id: id });
        if (updateError) throw updateError;

        // Enregistrer le téléchargement
        const { error: logError } = await supabase
            .from('document_downloads')
            .insert({
                document_id: id,
                student_id: studentId,
                ip_address: ipAddress,
                user_agent: userAgent
            });

        if (logError) throw logError;
        return true;
    }

    static async incrementView(id) {
        const { error } = await supabase.rpc('increment_view_count', { doc_id: id });
        if (error) throw error;
        return true;
    }

    static async getStats() {
        const { data, error } = await supabase
            .from('documents')
            .select('id, title, download_count, view_count, created_at')
            .order('download_count', { ascending: false });

        if (error) throw error;
        return data;
    }

    static async getDownloadsByDocument(documentId) {
        const { data, error } = await supabase
            .from('document_downloads')
            .select(`
                *,
                students(id, full_name, username, branch, level)
            `)
            .eq('document_id', documentId)
            .order('downloaded_at', { ascending: false });

        if (error) throw error;
        return data;
    }
}

module.exports = Document;