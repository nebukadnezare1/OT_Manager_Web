export class CompanyService {
    constructor() {
        this.currentUser = null;
    }

    setCurrentUser(username) {
        this.currentUser = username;
    }

    getStorageKey() {
        if (!this.currentUser) {
            return 'company_info_default';
        }
        return `company_info_${this.currentUser}`;
    }

    getCompanyInfo() {
        const info = localStorage.getItem(this.getStorageKey());
        return info ? JSON.parse(info) : {
            name: '',
            address: '',
            phone: '',
            email: '',
            siret: '',
            tva: ''
        };
    }

    async saveCompanyInfo(info) {
        // Sauvegarder localement
        localStorage.setItem(this.getStorageKey(), JSON.stringify(info));

        // Synchroniser avec le serveur
        if (this.currentUser) {
            try {
                const { StorageService } = await import('./StorageService.js');
                const storage = new StorageService();
                await storage.saveCompanyInfo(this.currentUser, info);
                console.log('✅ Infos société synchronisées avec le serveur');
            } catch (err) {
                console.warn('⚠️ Impossible de synchroniser avec le serveur:', err);
                // L'enregistrement local reste valide même si la sync échoue
            }
        }
    }

    async updateCompanyInfo(updates) {
        const current = this.getCompanyInfo();
        const updated = { ...current, ...updates };
        await this.saveCompanyInfo(updated);
        return updated;
    }

    clearCompanyInfo() {
        if (this.currentUser) {
            localStorage.removeItem(this.getStorageKey());
        }
    }
}
