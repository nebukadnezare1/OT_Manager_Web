import { StorageService } from '../services/StorageService.js';

export class UserStore {
    constructor() {
        this.storage = null;
        this.currentUser = null;
        this.initialized = false;
    }

    // Générer un identifiant unique pour l'utilisateur (comme une MAC address)
    async generateUserUniqueId(username, email, timestamp) {
        try {
            // Combinaison de plusieurs facteurs pour créer un ID unique
            const browserInfo = navigator.userAgent;
            const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
            const language = navigator.language;
            const platform = navigator.platform;
            const hardwareConcurrency = navigator.hardwareConcurrency || 'unknown';

            // Données aléatoires supplémentaires
            const randomSeed = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

            // Créer une empreinte unique
            const uniqueData = `${username}_${email}_${timestamp}_${browserInfo}_${screenInfo}_${language}_${platform}_${hardwareConcurrency}_${randomSeed}`;

            // Hasher pour obtenir un ID propre
            const msgBuffer = new TextEncoder().encode(uniqueData);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // Format : XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX (style UUID)
            const userUniqueId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`.toUpperCase();

            console.log('✅ ID Unique généré:', userUniqueId);
            return userUniqueId;
        } catch (error) {
            console.error('❌ Erreur génération ID Unique:', error);
            // Fallback simple si crypto n'est pas disponible
            const fallbackId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
            console.warn('⚠️ Utilisation ID Fallback:', fallbackId);
            return fallbackId;
        }
    }

    async init() {
        if (!this.initialized) {
            this.storage = new StorageService();
            await this.storage.init();
            const userId = localStorage.getItem('currentUserId');
            if (userId) {
                const users = await this.storage.getAll('users');
                this.currentUser = users.find(u => u.id === parseInt(userId));
            }
            this.initialized = true;
        }
    }

    async login(username, password) {
        await this.init();
        let users = await this.storage.getAll('users');
        let user = users.find(u => u.username === username);

        // --- Import NAS si utilisateur absent localement ---
        if (!user) {
            try {
                // Utiliser les endpoints corrects du serveur Flask
                const infoResponse = await fetch(`https://ot.1030bx.com/api/load_info/${username}`);
                const dataResponse = await fetch(`https://ot.1030bx.com/api/load_data/${username}`);

                if (infoResponse.ok && dataResponse.ok) {
                    const userInfo = await infoResponse.json();
                    const userData = await dataResponse.json();

                    if (userInfo && userInfo.username === username) {
                        // Créer un utilisateur complet avec les données du serveur
                        const newUser = {
                            username: userInfo.username,
                            email: userInfo.email,
                            password: 'imported_user', // Mot de passe temporaire pour les utilisateurs importés
                            createdAt: userInfo.createdAt,
                            lastLogin: userInfo.lastLogin,
                            userUniqueId: userInfo.userUniqueId,
                            tutorialSeen: false,
                            imported: true // Marquer comme importé
                        };

                        // Supprimer l'ancien si même username déjà existant
                        const existing = users.find(u => u.username === newUser.username);
                        if (existing) {
                            await this.storage.delete('users', existing.id);
                        }

                        // Ajouter le nouvel utilisateur
                        const id = await this.storage.add('users', newUser);
                        newUser.id = id;

                        console.log(`👤 Utilisateur importé depuis NAS: ${newUser.username}`);
                        console.log(`📱 Synchronisation inter-appareils réussie`);

                        // Restaurer les paramètres utilisateur
                        if (userInfo.companyInfo) {
                            localStorage.setItem(`company_info_${username}`, JSON.stringify(userInfo.companyInfo));
                        }
                        if (userInfo.activation) {
                            const activationData = { ...userInfo.activation, username: username };
                            localStorage.setItem(`activation_${username}`, JSON.stringify(activationData));
                            console.log('✅ Activation Pro synchronisée entre appareils');
                        }

                        user = newUser;
                    }
                } else {
                    console.warn(`⚠️ Utilisateur introuvable sur le NAS: ${username}`);
                }
            } catch (e) {
                console.error('❌ Erreur import NAS utilisateur:', e);
            }
        }

        // --- Vérification finale ---
        if (!user) throw new Error('Utilisateur non trouvé');

        // ⚠️ Pour les utilisateurs importés, ignorer la vérification de mot de passe
        if (user.imported) {
            console.warn('⚠️ Vérification mot de passe ignorée pour utilisateur importé');
        } else {
            // Vérification normale du mot de passe pour les utilisateurs locaux
            const hashedPassword = await this.hashPassword(password);
            if (user.password !== hashedPassword) {
                throw new Error('Mot de passe incorrect');
            }
        }

        // --- Authentification réussie ---
        this.currentUser = user;
        localStorage.setItem('currentUserId', user.id);

        // --- Sauvegarder dernière connexion ---
        user.lastLogin = new Date().toISOString();
        await this.storage.update('users', user);

        // --- Synchroniser avec le serveur ---
        try {
            await this.syncUserToServer(user);
        } catch (e) {
            console.warn('⚠️ Impossible de synchroniser avec le serveur:', e);
        }

        console.log(`✅ Connecté en tant que ${user.username} (${user.imported ? 'importé' : 'local'})`);

        // Déclencher un événement personnalisé pour mettre à jour l'UI
        window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: { user } }));

        return user;
    }

    async syncUserToServer(user) {
        try {
            // Enregistrer l'utilisateur sur le serveur s'il n'y est pas déjà
            const storage = new StorageService();
            const result = await storage.registerOnServer(user.username, user.email, 'sync_password');

            if (result.success) {
                console.log('📤 Utilisateur synchronisé avec le serveur');
            } else if (result.error === 'user_exists') {
                console.log('✅ Utilisateur déjà présent sur le serveur');
            }
        } catch (error) {
            console.warn('⚠️ Erreur synchronisation serveur:', error);
        }
    }

    async register(username, password, email) {
        await this.init();
        const users = await this.storage.getAll('users');
        const exists = users.find(u => u.username === username || u.email === email);

        if (exists) {
            throw new Error('Utilisateur déjà existant');
        }

        const hashedPassword = await this.hashPassword(password);
        const timestamp = new Date().toISOString();

        // Générer l'identifiant unique de l'utilisateur
        const userUniqueId = await this.generateUserUniqueId(username, email, timestamp);

        const user = {
            username,
            password: hashedPassword,
            email,
            createdAt: timestamp,
            lastLogin: timestamp,
            tutorialSeen: false,
            userUniqueId: userUniqueId,
            imported: false // Utilisateur créé localement
        };

        const id = await this.storage.add('users', user);
        user.id = id;

        // ÉTAPE 1 : Enregistrer l'utilisateur sur le serveur Flask AVANT l'export
        try {
            console.log('📤 Enregistrement de l\'utilisateur sur le serveur Flask...');

            const response = await fetch('https://ot.1030bx.com/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password // Mot de passe en clair pour le serveur
                })
            });

            const result = await response.json();

            if (response.ok) {
                console.log('✅ Utilisateur enregistré sur le serveur Flask:', result);
            } else {
                console.warn('⚠️ Erreur enregistrement serveur:', result.error);
                // Continuer même si l'enregistrement serveur échoue
            }
        } catch (error) {
            console.error('❌ Erreur réseau enregistrement serveur:', error);
            // Continuer même en cas d'erreur réseau
        }

        // ÉTAPE 2 : Configurer les services pour le nouvel utilisateur
        this.storage.setCurrentUser(username);

        // ÉTAPE 3 : Créer les fichiers de sauvegarde automatiquement
        try {
            console.log('🔄 Création des fichiers de sauvegarde pour le nouvel utilisateur...');

            // Exporter toutes les données de l'utilisateur (même si vides pour commencer)
            await this.storage.exportUserData();

            console.log('✅ Fichiers de sauvegarde créés automatiquement sur le NAS');
        } catch (error) {
            console.warn('⚠️ Impossible de créer les fichiers de sauvegarde:', error);
        }

        console.log(`✅ Utilisateur créé avec ID unique: ${userUniqueId}`);
        console.log('📁 Fichiers de sauvegarde générés automatiquement');

        return user;
    }

    async markTutorialAsSeen() {
        if (!this.currentUser) return;

        this.currentUser.tutorialSeen = true;
        await this.storage.update('users', this.currentUser);

        // Sauvegarder aussi dans localStorage pour vérification rapide
        localStorage.setItem(`tutorial_seen_${this.currentUser.username}`, 'true');
    }

    async hasSeenTutorial() {
        if (!this.currentUser) return false;
        return this.currentUser.tutorialSeen === true;
    }

    async logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUserId');

        // Déclencher un événement personnalisé pour mettre à jour l'UI
        window.dispatchEvent(new CustomEvent('userLoggedOut'));

        console.log('✅ Déconnexion réussie');
    }

    async getCurrentUser() {
        await this.init();
        return this.currentUser;
    }

    getUserUniqueId() {
        return this.currentUser?.userUniqueId || null;
    }

    async hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}
