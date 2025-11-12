/**
 * GÉNÉRATEUR DE CLÉS D'ACTIVATION - CÔTÉ SERVEUR UNIQUEMENT
 * Ce fichier ne doit PAS être accessible publiquement
 * À utiliser uniquement par l'administrateur pour générer des clés
 */

export class KeyGenerator {
    constructor() {
        this.secretKey = 'OTMANAGER2025_SECRET_KEY_V1'; // À changer en production !
    }

    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    formatKey(hash) {
        const key = hash.substring(0, 16).toUpperCase();
        return `${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}`;
    }

    async generateKey(email, userUniqueId) {
        const data = `${email.toLowerCase()}${userUniqueId}${this.secretKey}`;
        const hash = await this.sha256(data);
        return this.formatKey(hash);
    }

    // Interface console pour générer une clé
    async generateKeyFromConsole() {
        const email = prompt('Email de l\'utilisateur :');
        const userUniqueId = prompt('ID Unique de l\'utilisateur :');

        if (!email || !userUniqueId) {
            console.error('❌ Email et ID Unique requis');
            return;
        }

        const key = await this.generateKey(email, userUniqueId);

        console.log('\n========================================');
        console.log('🔑 CLÉ D\'ACTIVATION GÉNÉRÉE');
        console.log('========================================');
        console.log(`Email: ${email}`);
        console.log(`ID Unique: ${userUniqueId}`);
        console.log(`Clé: ${key}`);
        console.log('========================================\n');

        return key;
    }
}

// Pour utiliser dans la console du navigateur (en mode admin) :
// const generator = new KeyGenerator();
// await generator.generateKeyFromConsole();
