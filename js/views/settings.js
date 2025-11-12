import { ActivationService } from '../services/ActivationService.js';
import { BackupService } from '../services/BackupService.js';
import { StorageService } from '../services/StorageService.js';
import { CompanyService } from '../services/CompanyService.js';

export default class SettingsView {
    constructor() {
        this.activationService = new ActivationService();
        this.storageService = new StorageService();
        this.backupService = new BackupService(this.storageService);
        this.companyService = new CompanyService();
        this.currentUser = null;
    }

    async render(container) {
        await this.storageService.init();

        // Récupérer l'utilisateur actuel
        const currentUserId = localStorage.getItem('currentUserId');
        const users = await this.storageService.getAll('users');
        const user = users.find(u => u.id === parseInt(currentUserId));

        if (user) {
            this.currentUser = user;
            this.storageService.setCurrentUser(user.username);
            this.activationService.setCurrentUser(user.username);
            this.companyService.setCurrentUser(user.username);
        }

        const isPro = await this.activationService.isPro();
        const activationInfo = this.activationService.getActivationInfo();
        const companyInfo = this.companyService.getCompanyInfo();

        // Vérifier si l'utilisateur a un userUniqueId, sinon le générer
        if (user && !user.userUniqueId) {
            console.warn('⚠️ ID Unique manquant, génération en cours...');
            const { UserStore } = await import('../state/UserStore.js');
            const userStore = new UserStore();
            await userStore.init();
            const timestamp = user.createdAt || new Date().toISOString();
            user.userUniqueId = await userStore.generateUserUniqueId(user.username, user.email, timestamp);

            // Sauvegarder dans la base de données
            await this.storageService.update('users', user);
            console.log('✅ ID Unique généré et sauvegardé:', user.userUniqueId);
        }

        container.innerHTML = `
            <div class="settings-view">
                <div class="page-header">
                    <h1>Paramètres</h1>
                </div>

                <div class="card user-info-card">
                    <div class="card-header">
                        <h3 class="card-title">👤 Utilisateur</h3>
                    </div>
                    <div class="card-body">
                        <div class="user-badge">
                            <div class="user-avatar">${user ? user.username.charAt(0).toUpperCase() : '?'}</div>
                            <div class="user-details">
                                <h3>${user ? user.username : 'Non connecté'}</h3>
                                <p>${user ? user.email : ''}</p>
                                <small>Membre depuis ${user ? new Date(user.createdAt).toLocaleDateString('fr-FR') : 'N/A'}</small>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">🔑 Activation Pro</h3>
                    </div>
                    <div class="card-body">
                        ${isPro ? `
                            <div class="alert alert-success">
                                ✅ Version Pro activée pour <strong>${user.username}</strong>
                                <p><strong>Email:</strong> ${activationInfo.email}</p>
                                <p><strong>Activé le:</strong> ${new Date(activationInfo.activatedAt).toLocaleDateString('fr-FR')}</p>
                                <p><strong>ID Utilisateur:</strong> <code class="user-id-code">${user.userUniqueId || 'N/A'}</code></p>
                            </div>
                        ` : `
                            <div class="activation-info">
                                <h4>🔐 Comment obtenir une licence Pro ?</h4>
                                
                                

                                <ol class="activation-steps">
                                    <li>
                                        <strong>💳 Effectuez le paiement de 25€ pour OT Manager illimités</strong>
                                        <div class="payment-box">
                                            <a href="https://paypal.me/ikaoutefme/25" target="_blank" class="btn btn-paypal">
                                                <span class="paypal-logo">PayPal</span> Payer 25€
                                            </a>
                                            <p class="payment-link">
                                                Lien : <a href="https://paypal.me/ikaoutefme/25" target="_blank">paypal.me/ikaoutefme</a>
                                            </p>
                                        </div>
                                    </li>
                                    <li>
                                        <strong>📧 Envoyez vos informations</strong>
                                        <div class="contact-box">
                                            <p>Envoyez un email à : <a href="mailto:ikaoutef@gmail.com?subject=Demande de licence OT Manager Pro&body=Bonjour,%0D%0A%0D%0AJe souhaite activer ma licence OT Manager Pro.%0D%0A%0D%0AEmail : ${user?.email || '[votre-email]'}%0D%0AID Unique : ${user?.userUniqueId || '[votre-id-unique]'}%0D%0A%0D%0AJ'ai effectué le paiement de 25€ sur PayPal.%0D%0A%0D%0ACordialement" class="email-link">ikaoutef@gmail.com</a></p>
                                            <button id="copy-email-btn" class="btn btn-secondary btn-small">📋 Copier l'email</button>
                                        </div>
                                        <div class="email-template">
                                            <strong>Modèle d'email :</strong>
                                            <div class="template-box">
                                                <p><strong>Objet :</strong> Demande de licence OT Manager Pro</p>
                                                <p><strong>Message :</strong></p>
                                                <pre>Bonjour,

Je souhaite activer ma licence OT Manager Pro.

Email : ${user?.email || '[votre-email]'
            }
ID Unique : ${user?.userUniqueId || '[votre-id-unique]'}

J'ai effectué le paiement de 25€ sur PayPal.

Cordialement</pre>
                                            </div>
                                        </div>
                                    </li>
                                    <li>
                                        <strong>⏳ Attendez votre clé d'activation</strong>
                                        <p>Vous recevrez votre clé par email sous 24-48h (généralement plus rapide)</p>
                                    </li>
                                    <li>
                                        <strong>🔓 Activez votre licence</strong>
                                        <p>Utilisez le formulaire ci-dessous avec la clé reçue</p>
                                    </li>
                                </ol>
                                
                                <div class="user-id-box">
                                    <label class="form-label">🆔 Votre ID Utilisateur Unique</label>
                                    <div class="copy-box">
                                        <input type="text" id="user-unique-id" class="form-input" value="${user?.userUniqueId || 'Génération...'}" readonly>
                                        <button id="copy-id-btn" class="btn btn-secondary" ${!user?.userUniqueId ? 'disabled' : ''}>📋 Copier</button>
                                    </div>
                                    <small class="form-hint">⚠️ Notez cet ID, vous en aurez besoin pour l'email</small>
                                </div>
                            </div>
                            
                            <hr style="margin: 1.5rem 0;">
                            
                            <form id="activation-form">
                                
                                <div class="form-group">
                                    <label class="form-label">Email (utilisé lors du paiement)</label>
                                    <input type="email" name="email" class="form-input" value="${user?.email || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Clé d'activation</label>
                                    <input type="text" name="key" class="form-input" placeholder="XXXX-XXXX-XXXX-XXXX" required maxlength="19">
                                </div>
                                <button type="submit" class="btn btn-primary">🔓 Activer la version Pro</button>
                            </form>
                        `}
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">🏢 Informations Société</h3>
                    </div>
                    <div class="card-body">
                        <div class="alert alert-info">
                            ℹ️ Ces informations sont propres à l'utilisateur <strong>${user ? user.username : ''}</strong>
                        </div>
                        <form id="company-form">
                            <div class="form-group">
                                <label class="form-label">Nom de la société</label>
                                <input type="text" name="name" class="form-input" value="${companyInfo.name || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Adresse</label>
                                <input type="text" name="address" class="form-input" value="${companyInfo.address || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Téléphone</label>
                                <input type="tel" name="phone" class="form-input" value="${companyInfo.phone || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" name="email" class="form-input" value="${companyInfo.email || ''}">
                            </div>
                            <button type="submit" class="btn btn-primary">💾 Enregistrer</button>
                        </form>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">💾 Sauvegarde Complète & Synchronisation</h3>
                    </div>
                    <div class="card-body">
                        <div class="alert alert-info">
                            ℹ️ Sauvegardez TOUTES vos données pour les restaurer sur un autre appareil (PC, tablette, téléphone)
                        </div>
                        
                        <p class="info-text">
                            <strong>Utilisateur actuel:</strong> ${user ? user.username : 'Non connecté'}
                        </p>
                        
                        <div class="button-group">
                            <button id="export-complete-btn" class="btn btn-success">
                                💾 Sauvegarder tout (Backup complet)
                            </button>
                            <button id="import-complete-btn" class="btn btn-primary">
                                📱 Restaurer depuis un backup
                            </button>
                            <input type="file" id="import-complete-file" accept=".json" style="display: none;">
                        </div>
                        
                        <div class="info-box">
                            <p><strong>📦 Le backup complet contient :</strong></p>
                            <ul>
                                <li>✅ Vos informations de profil</li>
                                <li>✅ Tous vos Ordres de Travail (OT)</li>
                                <li>✅ Toutes vos Dépenses</li>
                                <li>✅ Vos informations société</li>
                                <li>✅ Votre activation Pro (si activée)</li>
                                <li>✅ Vos préférences (thème, etc.)</li>
                            </ul>
                            <p style="margin-top: 1rem;"><strong>🔄 Synchronisation multi-appareils :</strong></p>
                            <ul>
                                
                                <li>🔁 Gardez vos données synchronisées partout !</li>
                            </ul>
                        </div>
                        
                        <div class="warning-box">
                            <p><strong>⚠️ Important :</strong></p>
                            <ul>
                                <li>Sauvegardez régulièrement vos données</li>
                                <li>Conservez votre fichier de backup en sécurité</li>
                                <li>La restauration remplacera vos données actuelles</li>
                            </ul>
                        </div>
                        
                        <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--border-color);">
                        
                        <button id="clear-data-btn" class="btn btn-danger">
                            🗑️ Effacer toutes mes données
                        </button>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">🎨 Apparence</h3>
                    </div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="form-label">Thème</label>
                            <select id="theme-select" class="form-select">
                                <option value="light">Clair</option>
                                <option value="dark">Sombre</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">🎓 Tutoriel</h3>
                    </div>
                    <div class="card-body">
                        <button id="replay-tutorial-btn" class="btn btn-secondary">🎓 Revoir le tutoriel</button>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        this.loadTheme();
    }

    setupEventListeners() {
        document.getElementById('activation-form')?.addEventListener('submit', (e) => {
            this.handleActivation(e);
        });

        document.getElementById('copy-id-btn')?.addEventListener('click', () => {
            this.copyUserUniqueId();
        });

        document.getElementById('copy-email-btn')?.addEventListener('click', () => {
            this.copyEmail();
        });

        document.getElementById('company-form')?.addEventListener('submit', (e) => {
            this.saveCompanyInfo(e);
        });

        // CORRECTION : Connecter le bouton export complet
        document.getElementById('export-complete-btn')?.addEventListener('click', async () => {
            await this.handleBackup(); // Appeler la méthode qui télécharge le fichier
        });

        document.getElementById('import-complete-btn')?.addEventListener('click', () => {
            document.getElementById('import-complete-file').click();
        });

        document.getElementById('import-complete-file')?.addEventListener('change', async (e) => {
            await this.importCompleteBackup(e);
        });

        document.getElementById('clear-data-btn')?.addEventListener('click', () => {
            this.clearData();
        });

        document.getElementById('theme-select')?.addEventListener('change', (e) => {
            this.changeTheme(e.target.value);
        });

        document.getElementById('replay-tutorial-btn')?.addEventListener('click', async () => {
            const user = await this.userStore?.getCurrentUser();
            if (user) {
                localStorage.removeItem(`tutorial_seen_${user.username}`);
            }
            window.location.hash = 'tutorial';
        });
    }

    async handleActivation(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const email = formData.get('email').trim();
        const key = formData.get('key').trim().toUpperCase();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Vérification...';

        try {
            // Récupérer l'ID unique de l'utilisateur
            const userUniqueId = this.currentUser.userUniqueId;

            if (!userUniqueId) {
                throw new Error('ID utilisateur introuvable. Veuillez recréer votre compte.');
            }

            const success = await this.activationService.activate(email, key, userUniqueId);

            if (success) {
                alert('✅ Version Pro activée avec succès !\n\n🎉 Bienvenue dans OT Manager Pro !\n\nToutes les fonctionnalités sont maintenant débloquées.\n\nLa page va se recharger...');

                // Mettre à jour le titre avant de recharger
                document.getElementById('app-title').textContent = 'OT Manager Pro';
                document.getElementById('app-name').innerHTML = 'OT Manager Pro 💎';

                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                throw new Error('Clé d\'activation invalide');
            }
        } catch (error) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '🔓 Activer la version Pro';
            alert(`❌ Erreur d'activation\n\n${error.message}\n\nAssurez-vous que :\n• La clé est correcte\n• L'email correspond à celui utilisé pour générer la clé\n• Votre ID utilisateur est valide`);
        }
    }

    copyUserUniqueId() {
        const input = document.getElementById('user-unique-id');

        if (!input.value || input.value === 'Génération...') {
            alert('⚠️ ID Unique non disponible. Veuillez recharger la page.');
            return;
        }

        input.select();
        input.setSelectionRange(0, 99999); // Pour mobile

        try {
            document.execCommand('copy');
            const btn = document.getElementById('copy-id-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '✅ Copié !';
            setTimeout(() => {
                btn.innerHTML = originalText;
            }, 2000);
        } catch (err) {
            // Fallback pour les navigateurs modernes
            navigator.clipboard.writeText(input.value).then(() => {
                const btn = document.getElementById('copy-id-btn');
                const originalText = btn.innerHTML;
                btn.innerHTML = '✅ Copié !';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                }, 2000);
            }).catch(() => {
                alert('❌ Impossible de copier automatiquement. Veuillez copier manuellement : ' + input.value);
            });
        }
    }

    copyEmail() {
        const email = 'ikaoutef@gmail.com';

        try {
            navigator.clipboard.writeText(email).then(() => {
                const btn = document.getElementById('copy-email-btn');
                const originalText = btn.innerHTML;
                btn.innerHTML = '✅ Copié !';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                }, 2000);
            }).catch(() => {
                alert('Email de contact : ' + email);
            });
        } catch (err) {
            alert('Email de contact : ' + email);
        }
    }

    deactivatePro() {
        if (confirm('⚠️ Êtes-vous sûr de vouloir désactiver la version Pro ?')) {
            this.activationService.clearActivation();
            alert('✅ Version Pro désactivée');
            window.location.reload();
        }
    }

    saveCompanyInfo(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const info = Object.fromEntries(formData);
        this.companyService.saveCompanyInfo(info);
        alert(`✅ Informations enregistrées pour ${this.currentUser.username}`);
    }

    getCompanyInfo() {
        const info = localStorage.getItem('company_info');
        return info ? JSON.parse(info) : {};
    }

    async handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const result = await this.backupService.importData(file);
            alert(`✅ Import réussi !\n${result.importedOrders} OT et ${result.importedExpenses} dépenses importés.`);
            window.location.reload();
        } catch (error) {
            alert('❌ Erreur d\'import : ' + error.message);
        }
    }

    async clearData() {
        if (confirm(`⚠️ Êtes-vous sûr de vouloir supprimer TOUTES vos données (${this.currentUser.username}) ? Cette action est irréversible.`)) {
            if (confirm('Dernière confirmation : Toutes vos données seront perdues !')) {
                await this.backupService.clearAllData();

                // Supprimer aussi les paramètres locaux de l'utilisateur (mais pas l'activation Pro)
                this.companyService.clearCompanyInfo();

                alert('✅ Données supprimées');
                window.location.reload();
            }
        }
    }

    loadTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        const select = document.getElementById('theme-select');
        if (select) select.value = theme;
    }

    changeTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }

    async exportJSON() {
        try {
            const btn = document.getElementById('export-json-btn');
            btn.disabled = true;
            btn.innerHTML = '⏳ Export en cours...';

            await this.storageService.exportUserData();

            btn.disabled = false;
            btn.innerHTML = '📥 Exporter mes données JSON';

            alert(`✅ Export réussi !\n\nLe fichier data_${this.currentUser.username}.json a été téléchargé.`);
        } catch (error) {
            alert('❌ Erreur lors de l\'export : ' + error.message);
            console.error(error);

            const btn = document.getElementById('export-json-btn');
            btn.disabled = false;
            btn.innerHTML = '📥 Exporter mes données JSON';
        }
    }

    async importJSON(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Vérifier que c'est un fichier data_*.json
        if (!file.name.startsWith('data_') || !file.name.endsWith('.json')) {
            alert('❌ Fichier invalide. Veuillez sélectionner un fichier data_[nom].json');
            e.target.value = '';
            return;
        }

        try {
            const btn = document.getElementById('import-json-btn');
            btn.disabled = true;
            btn.innerHTML = '⏳ Import en cours...';

            const result = await this.storageService.importUserData(file);

            btn.disabled = false;
            btn.innerHTML = '📤 Importer mes données JSON';

            alert(`✅ Import réussi !\n\n${result.importedOrders} OT et ${result.importedExpenses} dépenses importés.`);

            // Recharger la page pour afficher les nouvelles données
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            const btn = document.getElementById('import-json-btn');
            btn.disabled = false;
            btn.innerHTML = '📤 Importer mes données JSON';

            alert('❌ Erreur lors de l\'import : ' + error.message);
            console.error(error);
        }

        // Réinitialiser l'input file
        e.target.value = '';
    }

    async exportCompleteBackup() {
        try {
            const btn = document.getElementById('export-complete-btn');
            btn.disabled = true;
            btn.innerHTML = '⏳ Création du backup...';

            const data = await this.storageService.exportUserData();

            const timestamp = new Date().toISOString().slice(0, 10);
            const username = this.currentUser?.username || 'backup';

            // Nom de fichier pour téléchargement local (lisible)
            const downloadFilename = `${username}_backup_complet_${timestamp}.json`;

            // Nom de fichier pour le serveur (format accepté par server.py)
            const serverFilename = `user_data_${username}_backup_${timestamp}.json`;

            // Créer un blob JSON avec les données
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });

            // Téléchargement LOCAL avec nom lisible
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = downloadFilename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();

            // Nettoyer après téléchargement
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);

            // Sauvegarder sur le NAS avec nom accepté par le serveur
            try {
                btn.innerHTML = '⏳ Sauvegarde sur le serveur...';

                const response = await fetch('https://ot.1030bx.com/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: serverFilename,  // ✅ Format accepté: user_data_*
                        content: data
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Backup sauvegardé sur le NAS:', result);
                } else {
                    const errorText = await response.text();
                    console.warn('⚠️ Erreur serveur:', errorText);
                }
            } catch (err) {
                console.warn('⚠️ Erreur sauvegarde NAS:', err);
            }

            btn.disabled = false;
            btn.innerHTML = '💾 Sauvegarder tout (Backup complet)';

            // Notification de succès
            this.showNotification('✅ Backup téléchargé et sauvegardé !', 'success');

            console.log('✅ Fichier local:', downloadFilename);
            console.log('✅ Fichier serveur:', serverFilename);
        } catch (error) {
            console.error('❌ Erreur sauvegarde:', error);

            const btn = document.getElementById('export-complete-btn');
            btn.disabled = false;
            btn.innerHTML = '💾 Sauvegarder tout (Backup complet)';

            this.showNotification('❌ Erreur lors de la sauvegarde', 'error');
            alert('Erreur: ' + error.message);
        }
    }

    async importCompleteBackup(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.includes('backup_complet') && !file.name.includes('_complet')) {
            const proceed = confirm(
                '⚠️ Ce fichier ne semble pas être un backup complet.\n\n' +
                'Un backup complet doit contenir "backup_complet" dans son nom.\n\n' +
                'Voulez-vous quand même continuer ?'
            );
            if (!proceed) {
                e.target.value = '';
                return;
            }
        }

        const confirmRestore = confirm(
            '🔄 RESTAURATION COMPLÈTE\n\n' +
            'Cette action va :\n' +
            '• Remplacer vos OT et dépenses actuels\n' +
            '• Restaurer vos paramètres\n' +
            '• Restaurer vos infos société\n' +
            '• Restaurer votre activation Pro (si présente)\n\n' +
            'Voulez-vous continuer ?'
        );

        if (!confirmRestore) {
            e.target.value = '';
            return;
        }

        // Créer et afficher l'écran de chargement
        const loadingScreen = this.createLoadingScreen('Restauration en cours');
        document.body.appendChild(loadingScreen);

        // Petit délai pour que l'animation s'affiche
        await new Promise(resolve => setTimeout(resolve, 100));
        loadingScreen.classList.add('show');

        try {
            const btn = document.getElementById('import-complete-btn');
            btn.disabled = true;
            btn.innerHTML = '⏳ Restauration en cours...';

            // Mise à jour du message de progression
            this.updateLoadingMessage(loadingScreen, 'Lecture du fichier de backup...');
            await new Promise(resolve => setTimeout(resolve, 500));

            // Restaurer les données
            this.updateLoadingMessage(loadingScreen, 'Import des données en cours...');
            const result = await this.storageService.importCompleteUserData(file);

            // Attendre que les données soient bien écrites
            this.updateLoadingMessage(loadingScreen, 'Synchronisation avec le serveur...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            this.updateLoadingMessage(loadingScreen, 'Finalisation de la restauration...');
            await new Promise(resolve => setTimeout(resolve, 500));

            // Masquer l'écran de chargement
            loadingScreen.classList.remove('show');
            await new Promise(resolve => setTimeout(resolve, 300));
            document.body.removeChild(loadingScreen);

            btn.disabled = false;
            btn.innerHTML = '📱 Restaurer depuis un backup';

            let message = `✅ Restauration complète réussie !\n\n`;
            message += `📊 Données importées :\n`;
            message += `• ${result.importedOrders} Ordres de Travail\n`;
            message += `• ${result.importedExpenses} Dépenses\n`;

            if (result.restoredSettings) {
                message += `• ✅ Paramètres restaurés\n`;
            }
            if (result.restoredActivation) {
                message += `• 💎 Activation Pro restaurée\n`;
            }

            message += `\n🔄 La page va se recharger dans 2 secondes...`;

            alert(message);

            // Recharger complètement après un délai
            setTimeout(() => {
                window.location.href = window.location.origin + window.location.pathname + '#home';
                setTimeout(() => {
                    window.location.reload(true);
                }, 100);
            }, 2000);

        } catch (error) {
            // Masquer l'écran de chargement en cas d'erreur
            loadingScreen.classList.remove('show');
            await new Promise(resolve => setTimeout(resolve, 300));
            document.body.removeChild(loadingScreen);

            const btn = document.getElementById('import-complete-btn');
            btn.disabled = false;
            btn.innerHTML = '📱 Restaurer depuis un backup';

            alert('❌ Erreur lors de la restauration : ' + error.message);
            console.error(error);
        }

        e.target.value = '';
    }

    // Créer l'écran de chargement
    createLoadingScreen(message) {
        const screen = document.createElement('div');
        screen.className = 'loading-screen';
        screen.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p id="loading-message">${message}<span class="loading-dots">...</span></p>
                <div class="loading-progress" id="loading-progress"></div>
            </div>
        `;
        return screen;
    }

    // Mettre à jour le message de chargement
    updateLoadingMessage(loadingScreen, message) {
        const messageEl = loadingScreen.querySelector('#loading-message');
        if (messageEl) {
            messageEl.innerHTML = `${message}<span class="loading-dots">...</span>`;
        }
    }

    async handleBackup() {
        try {
            const btn = document.getElementById('export-complete-btn');
            btn.disabled = true;
            btn.innerHTML = '⏳ Création du backup...';

            const data = await this.storageService.exportUserData();

            const timestamp = new Date().toISOString().slice(0, 10);
            const username = this.currentUser?.username || 'backup';

            // Nom de fichier pour téléchargement local (lisible)
            const downloadFilename = `${username}_backup_complet_${timestamp}.json`;

            // Nom de fichier pour le serveur (format accepté par server.py)
            const serverFilename = `user_data_${username}_backup_${timestamp}.json`;

            // Créer un blob JSON avec les données
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });

            // Téléchargement LOCAL avec nom lisible
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = downloadFilename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();

            // Nettoyer après téléchargement
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);

            // Sauvegarder sur le NAS avec nom accepté par le serveur
            try {
                btn.innerHTML = '⏳ Sauvegarde sur le serveur...';

                const response = await fetch('https://ot.1030bx.com/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: serverFilename,  // ✅ Format accepté: user_data_*
                        content: data
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Backup sauvegardé sur le NAS:', result);
                } else {
                    const errorText = await response.text();
                    console.warn('⚠️ Erreur serveur:', errorText);
                }
            } catch (err) {
                console.warn('⚠️ Erreur sauvegarde NAS:', err);
            }

            btn.disabled = false;
            btn.innerHTML = '💾 Sauvegarder tout (Backup complet)';

            // Notification de succès
            this.showNotification('✅ Backup téléchargé et sauvegardé !', 'success');

            console.log('✅ Fichier local:', downloadFilename);
            console.log('✅ Fichier serveur:', serverFilename);
        } catch (error) {
            console.error('❌ Erreur sauvegarde:', error);

            const btn = document.getElementById('export-complete-btn');
            btn.disabled = false;
            btn.innerHTML = '💾 Sauvegarder tout (Backup complet)';

            this.showNotification('❌ Erreur lors de la sauvegarde', 'error');
            alert('Erreur: ' + error.message);
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }

    destroy() {
        // Cleanup if needed
    }
}
