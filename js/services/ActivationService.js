export class ActivationService {
    constructor() {
        this.currentUser = null;
        this.secretKey = 'OTMANAGER2025_SECRET_KEY_V1'; // Clé secrète côté serveur (à changer en production)
    }

    setCurrentUser(username) {
        this.currentUser = username;
    }

    getStorageKey() {
        if (!this.currentUser) {
            return 'activation_default';
        }
        return `activation_${this.currentUser}`;
    }

    // Générer une clé d'activation UNIQUEMENT côté serveur
    // Cette méthode ne devrait PAS être accessible côté client en production
    async generateActivationKey(email, userUniqueId) {
        // Combinaison : email + userUniqueId + clé secrète
        const data = `${email.toLowerCase()}${userUniqueId}${this.secretKey}`;
        const hash = await this.sha256(data);
        return this.formatKey(hash);
    }

    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    formatKey(hash) {
        // Format : XXXX-XXXX-XXXX-XXXX (16 caractères)
        const key = hash.substring(0, 16).toUpperCase();
        return `${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}`;
    }

    // Valider la clé d'activation avec l'email et l'ID unique de l'utilisateur
    async validateKey(email, key, userUniqueId) {
        const expectedKey = await this.generateActivationKey(email, userUniqueId);
        return key.toUpperCase() === expectedKey.toUpperCase();
    }

    // Activer la version Pro
    async activate(email, key, userUniqueId) {
        const isValid = await this.validateKey(email, key, userUniqueId);
        if (isValid) {
            const activation = {
                email: email.toLowerCase(),
                key: key.toUpperCase(),
                activatedAt: new Date().toISOString(),
                isPro: true,
                username: this.currentUser,
                userUniqueId: userUniqueId
            };

            // Sauvegarder localement
            localStorage.setItem(this.getStorageKey(), JSON.stringify(activation));

            // Synchroniser avec le serveur via la route dédiée
            try {
                const response = await fetch('https://ot.1030bx.com/api/activate_pro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: this.currentUser,
                        key: key.toUpperCase()
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    console.log('✅ Activation Pro synchronisée avec le serveur:', result);
                } else {
                    console.warn('⚠️ Erreur synchronisation serveur:', result.error);
                    // L'activation locale reste valide même si la sync échoue
                }
            } catch (error) {
                console.warn('⚠️ Impossible de synchroniser avec le serveur:', error);
                // L'activation locale reste valide même si la sync échoue
            }

            return true;
        }
        return false;
    }

    async isPro() {
        const data = localStorage.getItem(this.getStorageKey());
        if (!data) return false;
        const activation = JSON.parse(data);
        return activation.isPro === true && activation.username === this.currentUser;
    }

    getActivationInfo() {
        const data = localStorage.getItem(this.getStorageKey());
        return data ? JSON.parse(data) : null;
    }
}
