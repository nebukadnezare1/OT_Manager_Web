export class StorageService {
    constructor() {
        this.dbName = 'OTManagerDB';
        this.version = 2;
        this.db = null;
        this.currentUser = null;
        this.serverUrl = 'https://ot.1030bx.com'; // URL du serveur NAS
        this.isInitialized = false;
    }

    setCurrentUser(username) {
        this.currentUser = username;
    }

    async ensureDBOpen() {
        if (!this.db || this.db.readyState === 'closed') {
            console.log('🔄 Reconnexion à la base de données...');
            await this.init();
        }
    }

    async init() {
        if (this.isInitialized && this.db && this.db.readyState !== 'closed') {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('❌ Erreur ouverture DB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;

                // Gérer la fermeture inattendue
                this.db.onclose = () => {
                    console.warn('⚠️ Connexion DB fermée de manière inattendue');
                    this.isInitialized = false;
                };

                console.log('✅ Base de données initialisée');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Créer tous les stores nécessaires
                const stores = ['users', 'orders', 'expenses', 'settings', 'stats'];
                for (const name of stores) {
                    if (!db.objectStoreNames.contains(name)) {
                        const store = db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });

                        // Ajouter des index pour orders et expenses
                        if (name === 'orders' || name === 'expenses') {
                            store.createIndex('date', 'date', { unique: false });
                            store.createIndex('category', 'category', { unique: false });
                            store.createIndex('username', 'username', { unique: false });
                        }
                    }
                }
            };
        });
    }

    async add(storeName, data) {
        await this.ensureDBOpen();

        // Ajouter le username aux données
        if (this.currentUser && (storeName === 'orders' || storeName === 'expenses')) {
            data.username = this.currentUser;
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);

                transaction.onerror = () => {
                    console.error('❌ Erreur transaction add:', transaction.error);
                    reject(transaction.error);
                };

                const request = store.add(data);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.error('❌ Erreur création transaction add:', error);
                reject(error);
            }
        });
    }

    async getAll(storeName) {
        await this.ensureDBOpen();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);

                transaction.onerror = () => {
                    console.error('❌ Erreur transaction getAll:', transaction.error);
                    reject(transaction.error);
                };

                const request = store.getAll();
                request.onsuccess = () => {
                    let results = request.result;

                    // Filtrer par utilisateur pour orders et expenses
                    if (this.currentUser && (storeName === 'orders' || storeName === 'expenses')) {
                        results = results.filter(item => item.username === this.currentUser);
                    }

                    resolve(results);
                };
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.error('❌ Erreur création transaction getAll:', error);
                reject(error);
            }
        });
    }

    // ---- Importer des données depuis un fichier JSON du NAS ----
    async import(data) {
        try {
            await this.ensureDBOpen();

            // Si c'est l'ancien format (compatibilité), utiliser l'ancienne logique
            if (data.user && data.data) {
                return this.importOldFormat(data);
            }

            // Nouveau format : données séparées
            console.log("🔄 Import avec nouveau format séparé");

            // Vider les données une par une pour éviter les conflits
            const storesToClear = ['orders', 'expenses'];
            for (const store of storesToClear) {
                try {
                    await this.clear(store);
                    console.log(`🧹 Store ${store} vidé`);
                } catch (e) {
                    console.warn(`⚠️ Impossible de vider le store ${store}:`, e);
                }
            }

            // Attendre un peu entre les opérations
            await new Promise(resolve => setTimeout(resolve, 100));

            // Importer les ordres
            if (data.data && data.data.orders) {
                for (const order of data.data.orders) {
                    try {
                        await this.add("orders", order);
                    } catch (e) {
                        console.warn('⚠️ Erreur import ordre:', e);
                    }
                }
            }

            // Attendre un peu entre les imports
            await new Promise(resolve => setTimeout(resolve, 100));

            // Importer les dépenses
            if (data.data && data.data.expenses) {
                for (const expense of data.data.expenses) {
                    try {
                        await this.add("expenses", expense);
                    } catch (e) {
                        console.warn('⚠️ Erreur import dépense:', e);
                    }
                }
            }

            console.log("✅ Données importées depuis le nouveau format");
        } catch (err) {
            console.error("❌ Erreur import:", err);
        }
    }

    // Méthode pour l'ancien format (compatibilité)
    async importOldFormat(data) {
        try {
            const storesToClear = ['orders', 'expenses'];
            for (const store of storesToClear) {
                try {
                    const tx = this.db.transaction([store], "readwrite");
                    const s = tx.objectStore(store);
                    await new Promise((resolve, reject) => {
                        const req = s.clear();
                        req.onsuccess = resolve;
                        req.onerror = () => reject(req.error);
                    });
                } catch (e) {
                    console.warn(`⚠️ Impossible de vider le store ${store}:`, e);
                }
            }

            const putData = async (storeName, value) => {
                const tx = this.db.transaction([storeName], "readwrite");
                const store = tx.objectStore(storeName);
                return new Promise((resolve, reject) => {
                    const req = store.put(value);
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                });
            };

            const { user, data: exportData } = data;

            if (user && user.username === this.currentUser) {
                try {
                    const existingUsers = await this.getAll('users');
                    const userExists = existingUsers.some(u => u.username === user.username);

                    if (!userExists) {
                        await putData("users", user);
                        console.log("👤 Utilisateur importé (ancien format)");
                    }
                } catch (e) {
                    console.warn("⚠️ Erreur import utilisateur:", e.message);
                }
            }

            if (exportData.orders) {
                for (const order of exportData.orders) await putData("orders", order);
            }
            if (exportData.expenses) {
                for (const exp of exportData.expenses) await putData("expenses", exp);
            }

            console.log("✅ Données importées (ancien format)");
        } catch (err) {
            console.error("❌ Erreur import ancien format:", err);
        }
    }

    // Exporter TOUTES les données de l'utilisateur actuel en JSON
    async exportUserData() {
        if (!this.currentUser) {
            throw new Error('Aucun utilisateur connecté');
        }

        const orders = await this.getAll('orders');
        const expenses = await this.getAll('expenses');

        // Récupérer les informations de l'utilisateur
        const users = await this.getAll('users');
        const currentUserData = users.find(u => u.username === this.currentUser);

        // Vérifier et générer l'ID unique si nécessaire
        if (currentUserData && !currentUserData.userUniqueId) {
            console.warn('⚠️ ID Unique manquant lors de l\'export, génération...');
            const { UserStore } = await import('../state/UserStore.js');
            const userStore = new UserStore();
            await userStore.init();
            const timestamp = currentUserData.createdAt || new Date().toISOString();
            currentUserData.userUniqueId = await userStore.generateUserUniqueId(
                currentUserData.username,
                currentUserData.email,
                timestamp
            );
            await this.update('users', currentUserData);
        }

        // Récupérer les paramètres stockés dans localStorage
        const companyInfo = localStorage.getItem(`company_info_${this.currentUser}`);
        const activationInfo = localStorage.getItem(`activation_${this.currentUser}`);
        const theme = localStorage.getItem('theme');

        // Format adapté pour server.py
        const userInfo = {
            username: currentUserData?.username,
            email: currentUserData?.email,
            userUniqueId: currentUserData?.userUniqueId,
            activation: activationInfo ? JSON.parse(activationInfo) : {
                isPro: false,
                key: null,
                activatedAt: null
            },
            settings: {
                theme: theme || 'light',
                companyInfo: companyInfo ? JSON.parse(companyInfo) : {
                    name: '',
                    address: '',
                    phone: '',
                    email: '',
                    siret: '',
                    tva: ''
                }
            },
            createdAt: currentUserData?.createdAt,
            lastLogin: currentUserData?.lastLogin,
            savedAt: new Date().toISOString()
        };

        const userData = {
            username: this.currentUser,
            type: "user_data",
            data: {
                orders: orders.map(order => ({
                    ...order,
                    type: "orders"
                })),
                expenses: expenses.map(expense => ({
                    ...expense,
                    type: "expenses"
                }))
            },
            stats: {
                totalOrders: orders.length,
                totalExpenses: expenses.length,
                totalRevenue: orders.reduce((sum, o) => sum + o.amount, 0),
                totalExpensesAmount: expenses.reduce((sum, e) => sum + e.amount, 0)
            },
            savedAt: new Date().toISOString()
        };

        // Utiliser uniquement /api/save qui existe dans server.py
        try {
            console.log("📤 Sauvegarde avec /api/save...");

            const infoResponse = await fetch(`${this.serverUrl}/api/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: `user_info_${this.currentUser}.json`,
                    content: userInfo
                })
            });

            if (!infoResponse.ok) {
                throw new Error(`Erreur info: ${infoResponse.status}`);
            }

            const infoResult = await infoResponse.json();
            console.log("📤 Infos utilisateur sauvegardées:", infoResult);

            const dataResponse = await fetch(`${this.serverUrl}/api/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: `user_data_${this.currentUser}.json`,
                    content: userData
                })
            });

            if (!dataResponse.ok) {
                throw new Error(`Erreur data: ${dataResponse.status}`);
            }

            const dataResult = await dataResponse.json();
            console.log("📤 Données utilisateur sauvegardées:", dataResult);

        } catch (err) {
            console.error("❌ Erreur sauvegarde NAS:", err);
            throw err; // Propager l'erreur pour que l'appelant puisse la gérer
        }

        // Retourner la structure complète pour compatibilité
        return {
            username: this.currentUser,
            exportDate: new Date().toISOString(),
            version: '1.0',
            user: currentUserData,
            settings: {
                theme: theme || 'light',
                companyInfo: companyInfo ? JSON.parse(companyInfo) : null,
                activation: activationInfo ? JSON.parse(activationInfo) : null
            },
            data: userData.data,
            stats: userData.stats
        };
    }



    // Charger les données utilisateur depuis le serveur (format server.py)
    async loadUserData(username) {
        try {
            // Essayer d'abord le nouveau format
            let response = await fetch(`${this.serverUrl}/api/load_data/${username}`);


            if (!response.ok) {
                // Fallback vers l'ancien format
                let response = await fetch(`${this.serverUrl}/api/user_data/${username}`);
                if (!response.ok) throw new Error("Données utilisateur non trouvées");
            }

            const data = await response.json();
            console.log("📥 Données utilisateur récupérées:", data);

            // Adapter le format server.py vers le format client
            let userData;
            if (Array.isArray(data)) {
                // Format server.py (tableau)
                userData = data.find(u => u.username === username);
            } else {
                // Format ancien
                userData = data;
            }

            if (!userData) {
                throw new Error("Données utilisateur non trouvées");
            }

            return userData;
        } catch (error) {
            console.warn("⚠️ Aucunes données utilisateur trouvées:", error.message);
            return null;
        }
    }

    // Sauvegarder automatiquement les données (format server.py)
    async autoSave() {
        if (!this.currentUser) return;

        try {
            const orders = await this.getAll('orders');
            const expenses = await this.getAll('expenses');

            const userData = {
                username: this.currentUser,
                saveDate: new Date().toISOString(),
                data: { orders, expenses }
            };

            // Sauvegarder dans localStorage comme backup
            localStorage.setItem(`backup_${this.currentUser}`, JSON.stringify(userData));

            console.log('✅ Sauvegarde automatique effectuée');

            // Envoyer la sauvegarde au serveur avec le nouveau format
            try {
                await this.exportUserData(); // Utilise déjà le nouveau format
            } catch (err) {
                console.error("❌ Erreur backup NAS:", err);
            }
        } catch (error) {
            console.error('❌ Erreur sauvegarde automatique:', error);
        }
    }

    // 🔽 Ajoute ceci dans StorageService.js
    async importUserData(content) {
        try {
            if (!content) throw new Error("Aucune donnée fournie");

            const data = typeof content === "string" ? JSON.parse(content) : content;

            if (!data.username) throw new Error("Fichier invalide (username manquant)");

            const filename = `user_data_${data.username}.json`;
            const path = `${this.dataDir}/${filename}`;

            await this.saveToNAS(filename, data);

            console.log(`✅ Données importées depuis le backup: ${filename}`);
            return { status: "imported", path };
        } catch (e) {
            console.error("❌ Erreur importUserData:", e);
            throw e;
        }
    }


    // Enregistrer un utilisateur sur le serveur
    async registerOnServer(username, email, password) {
        try {
            const response = await fetch(`${this.serverUrl}/api/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            });
            const result = await response.json();

            if (response.ok) {
                console.log("✅ Utilisateur enregistré sur le serveur");
                return { success: true, data: result };
            } else {
                console.error("❌ Erreur enregistrement:", result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error("❌ Erreur réseau:", error);
            return { success: false, error: error.message };
        }
    }

    // Se connecter via le serveur
    async loginOnServer(username, password) {
        try {
            const response = await fetch(`${this.serverUrl}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const result = await response.json();

            if (response.ok) {
                console.log("✅ Connexion serveur réussie");
                return { success: true, user: result.user };
            } else {
                console.error("❌ Erreur connexion:", result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error("❌ Erreur réseau:", error);
            return { success: false, error: error.message };
        }
    }

    async update(storeName, data) {
        await this.ensureDBOpen();

        // Ajouter le username aux données si nécessaire
        if (this.currentUser && (storeName === 'orders' || storeName === 'expenses')) {
            data.username = this.currentUser;
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);

                transaction.onerror = () => {
                    console.error('❌ Erreur transaction update:', transaction.error);
                    reject(transaction.error);
                };

                const request = store.put(data);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.error('❌ Erreur création transaction update:', error);
                reject(error);
            }
        });
    }

    async delete(storeName, id) {
        await this.ensureDBOpen();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);

                transaction.onerror = () => {
                    console.error('❌ Erreur transaction delete:', transaction.error);
                    reject(transaction.error);
                };

                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.error('❌ Erreur création transaction delete:', error);
                reject(error);
            }
        });
    }

    async clear(storeName) {
        await this.ensureDBOpen();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);

                transaction.onerror = () => {
                    console.error('❌ Erreur transaction clear:', transaction.error);
                    reject(transaction.error);
                };

                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.error('❌ Erreur création transaction clear:', error);
                reject(error);
            }
        });
    }

    // Charger les informations utilisateur depuis le serveur
    async loadUserInfo(username) {
        try {
            // Essayer d'abord la nouvelle route
            let response = await fetch(`${this.serverUrl}/api/load_info/${username}`);

            if (!response.ok) {
                // Fallback vers l'ancien format (compatibilité)
                response = await fetch(`${this.serverUrl}/api/users/${username}`);
                if (!response.ok) throw new Error("Infos utilisateur non trouvées");
            }

            const data = await response.json();
            console.log("📥 Infos utilisateur récupérées:", data);

            // Adapter le format server.py vers le format client
            let userInfo;
            if (Array.isArray(data)) {
                // Format server.py (tableau)
                userInfo = data.find(u => u.username === username);
            } else {
                // Format ancien
                userInfo = data;
            }

            if (!userInfo) {
                throw new Error("Utilisateur non trouvé dans les données");
            }

            // CORRECTION CRITIQUE : Restaurer les paramètres en localStorage avec le bon format
            if (userInfo.settings && userInfo.settings.companyInfo) {
                localStorage.setItem(`company_info_${username}`, JSON.stringify(userInfo.settings.companyInfo));
                console.log('✅ Infos société synchronisées');
            }

            // CORRECTION : Forcer la synchronisation de l'activation Pro avec username
            if (userInfo.activation) {
                const activationData = {
                    ...userInfo.activation,
                    username: username // AJOUTER le username manquant
                };
                localStorage.setItem(`activation_${username}`, JSON.stringify(activationData));
                console.log('✅ Activation Pro synchronisée avec username ajouté:', activationData);

                // Forcer une vérification immédiate du statut Pro
                if (activationData.isPro) {
                    console.log('💎 STATUT PRO DÉTECTÉ dans les données serveur !');
                }
            }

            if (userInfo.settings && userInfo.settings.theme) {
                localStorage.setItem('theme', userInfo.settings.theme);
                console.log('✅ Thème synchronisé');
            }

            return userInfo;
        } catch (error) {
            console.warn("⚠️ Aucunes infos utilisateur trouvées:", error.message);
            return null;
        }
    }



    async clearAll() {
        const stores = ['users', 'orders', 'expenses', 'settings', 'stats'];
        for (const store of stores) {
            try {
                await this.clear(store);
            } catch (e) {
                console.warn(`⚠️ Impossible de vider le store ${store}:`, e);
            }
        }
        console.log("🧹 Base locale vidée avant import");
    }

    // Sauvegarder les informations société sur le serveur
    async saveCompanyInfo(username, companyInfo) {
        try {
            const response = await fetch(`${this.serverUrl}/api/update_company_info`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, companyInfo })
            });

            if (!response.ok) {
                throw new Error(`Erreur serveur: ${response.status}`);
            }

            const data = await response.json();
            console.log("🏢 Infos société sauvegardées sur le serveur:", data);
            return data;
        } catch (err) {
            console.error("❌ Erreur sauvegarde infos société:", err);
            throw err;
        }
    }

    // 🔽 NOUVELLE MÉTHODE : Importer un backup complet utilisateur
    async importCompleteUserData(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.username) throw new Error("Fichier de backup invalide");

            console.log(`🔄 Début de l'import pour ${data.username}`);

            // Définir l'utilisateur courant
            this.setCurrentUser(data.username);

            // Restaurer les données dans IndexedDB
            if (data.data) {
                // Vider les données de cet utilisateur
                const tx = this.db.transaction(['orders', 'expenses'], 'readwrite');
                const ordersStore = tx.objectStore('orders');
                const expensesStore = tx.objectStore('expenses');

                const ordersRequest = ordersStore.getAll();
                ordersRequest.onsuccess = async () => {
                    const allOrders = ordersRequest.result;
                    for (const order of allOrders) {
                        if (order.username === data.username) {
                            await ordersStore.delete(order.id);
                        }
                    }
                };

                const expensesRequest = expensesStore.getAll();
                expensesRequest.onsuccess = async () => {
                    const allExpenses = expensesRequest.result;
                    for (const expense of allExpenses) {
                        if (expense.username === data.username) {
                            await expensesStore.delete(expense.id);
                        }
                    }
                };

                await new Promise(resolve => setTimeout(resolve, 500));

                // Importer les nouveaux ordres
                if (data.data.orders && data.data.orders.length > 0) {
                    console.log(`📥 Import de ${data.data.orders.length} ordres...`);
                    for (const order of data.data.orders) {
                        const { id, ...orderData } = order;
                        orderData.username = data.username;
                        await this.add('orders', orderData);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 300));

                // Importer les nouvelles dépenses
                if (data.data.expenses && data.data.expenses.length > 0) {
                    console.log(`📥 Import de ${data.data.expenses.length} dépenses...`);
                    for (const expense of data.data.expenses) {
                        const { id, ...expenseData } = expense;
                        expenseData.username = data.username;
                        await this.add('expenses', expenseData);
                    }
                }

                console.log('✅ Toutes les données importées dans IndexedDB');
            }

            // Restaurer les paramètres dans localStorage
            if (data.settings) {
                if (data.settings.companyInfo) {
                    localStorage.setItem(`company_info_${data.username}`, JSON.stringify(data.settings.companyInfo));
                    console.log('✅ Infos société restaurées');
                }
                if (data.settings.theme) {
                    localStorage.setItem('theme', data.settings.theme);
                    document.body.setAttribute('data-theme', data.settings.theme);
                    console.log('✅ Thème restauré');
                }
                if (data.settings.activation) {
                    localStorage.setItem(`activation_${data.username}`, JSON.stringify(data.settings.activation));
                    console.log('✅ Activation Pro restaurée');
                }
            }

            // Restaurer les infos utilisateur dans la table users
            if (data.user) {
                try {
                    const users = await this.getAll('users');
                    const existingUser = users.find(u => u.username === data.username);

                    if (existingUser) {
                        await this.update('users', { ...existingUser, ...data.user });
                    } else {
                        await this.add('users', data.user);
                    }
                    console.log('✅ Utilisateur restauré');
                } catch (e) {
                    console.warn('⚠️ Erreur restauration utilisateur:', e);
                }
            }

            // 🔽 CRUCIAL : Mettre à jour les fichiers serveur user_data et user_info
            try {
                console.log('📤 Mise à jour des fichiers serveur...');

                // Attendre que les données soient bien écrites dans IndexedDB
                await new Promise(resolve => setTimeout(resolve, 500));

                // Récupérer les données fraîchement importées
                const orders = await this.getAll('orders');
                const expenses = await this.getAll('expenses');

                // Format user_data pour le serveur
                const userData = {
                    username: data.username,
                    type: "user_data",
                    data: {
                        orders: orders.map(order => ({
                            ...order,
                            type: "orders"
                        })),
                        expenses: expenses.map(expense => ({
                            ...expense,
                            type: "expenses"
                        }))
                    },
                    stats: {
                        totalOrders: orders.length,
                        totalExpenses: expenses.length,
                        totalRevenue: orders.reduce((sum, o) => sum + o.amount, 0),
                        totalExpensesAmount: expenses.reduce((sum, e) => sum + e.amount, 0)
                    },
                    savedAt: new Date().toISOString()
                };

                // Format user_info pour le serveur
                const userInfo = {
                    username: data.username,
                    email: data.user?.email || data.username,
                    userUniqueId: data.user?.userUniqueId,
                    activation: data.settings?.activation || {
                        isPro: false,
                        key: null,
                        activatedAt: null
                    },
                    settings: {
                        theme: data.settings?.theme || 'light',
                        companyInfo: data.settings?.companyInfo || {}
                    },
                    createdAt: data.user?.createdAt || new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    savedAt: new Date().toISOString()
                };

                // Sauvegarder user_data
                const dataResponse = await fetch(`${this.serverUrl}/api/save`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        filename: `user_data_${data.username}.json`,
                        content: userData
                    })
                });

                if (dataResponse.ok) {
                    console.log('✅ user_data mis à jour sur le serveur');
                }

                // Sauvegarder user_info
                const infoResponse = await fetch(`${this.serverUrl}/api/save`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        filename: `user_info_${data.username}.json`,
                        content: userInfo
                    })
                });

                if (infoResponse.ok) {
                    console.log('✅ user_info mis à jour sur le serveur');
                }

                // Sauvegarder aussi le backup complet
                const backupFilename = `user_data_${data.username}_backup_${new Date().toISOString().slice(0, 10)}.json`;
                const backupResponse = await fetch(`${this.serverUrl}/api/save`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        filename: backupFilename,
                        content: data
                    })
                });

                if (backupResponse.ok) {
                    console.log(`✅ Backup daté sauvegardé: ${backupFilename}`);
                }

            } catch (err) {
                console.error("❌ Erreur mise à jour fichiers serveur:", err);
                // Ne pas bloquer la restauration si la synchro échoue
            }

            console.log(`✅ Import et synchronisation terminés pour ${data.username}`);

            return {
                importedOrders: data.data?.orders?.length || 0,
                importedExpenses: data.data?.expenses?.length || 0,
                restoredSettings: !!data.settings,
                restoredActivation: !!(data.settings && data.settings.activation)
            };
        } catch (e) {
            console.error("❌ Erreur importCompleteUserData:", e);
            throw e;
        }
    }

    // Sauvegarder les catégories personnalisées sur le serveur
    async saveCustomCategories(username, otCategories, expenseCategories) {
        try {
            const categoriesData = {
                username: username,
                otCategories: otCategories || [],
                expenseCategories: expenseCategories || [],
                savedAt: new Date().toISOString()
            };

            const response = await fetch(`${this.serverUrl}/api/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: `user_categories_${username}.json`,
                    content: categoriesData
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur serveur: ${response.status}`);
            }

            const result = await response.json();
            console.log("✅ Catégories personnalisées sauvegardées sur le serveur:", result);
            return categoriesData;
        } catch (err) {
            console.error("❌ Erreur sauvegarde catégories:", err);
            throw err;
        }
    }

    // Charger les catégories personnalisées depuis le serveur
    async loadCustomCategories(username) {
        try {
            const response = await fetch(`${this.serverUrl}/api/load_categories/${username}`);

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn("⚠️ Aucun fichier de catégories sur le serveur pour", username);
                    return null;
                }
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data.error) {
                console.warn("⚠️ Erreur dans les données:", data.error);
                return null;
            }

            console.log("✅ Catégories personnalisées chargées depuis le serveur:", data);

            return {
                otCategories: data.otCategories || [],
                expenseCategories: data.expenseCategories || []
            };
        } catch (error) {
            console.warn("⚠️ Erreur chargement catégories:", error.message);
            return null;
        }
    }

}

// Fonction de chargement adaptée aux nouveaux endpoints
export async function loadFromServer(username) {
    try {
        const storageService = new StorageService();

        // Charger les infos utilisateur
        const userInfo = await storageService.loadUserInfo(username);

        // Charger les données utilisateur
        const userData = await storageService.loadUserData(username);

        if (!userData) {
            throw new Error("Aucunes données trouvées");
        }

        // Retourner dans l'ancien format pour compatibilité
        return {
            username: username,
            user: userInfo ? {
                username: userInfo.username,
                email: userInfo.email,
                userUniqueId: userInfo.userUniqueId,
                createdAt: userInfo.createdAt,
                lastLogin: userInfo.lastLogin
            } : null,
            data: userData.data || { orders: [], expenses: [] },
            stats: userData.stats || {}
        };

    } catch (error) {
        console.warn("⚠️ Erreur chargement depuis serveur:", error.message);
        return null;
    }
}


