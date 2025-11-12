import { UserStore } from '../state/UserStore.js';

export default class AuthView {
    constructor() {
        this.userStore = new UserStore();
    }

    async render(container) {
        // Masquer la sidebar pendant l'auth
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.style.display = 'none';

        container.innerHTML = `
            <div class="auth-view">
                <div class="auth-container">
                    <div class="auth-card">
                        <div class="auth-logo">
                            <div class="logo-icon">📋</div>
                            <h1 id="auth-title">OT Manager</h1>
                            <p class="subtitle">Gestion des Ordres de Travail</p>
                        </div>

                        <div class="tabs">
                            <button class="tab-btn active" data-tab="login">Connexion</button>
                            <button class="tab-btn" data-tab="register">Inscription</button>
                        </div>

                        <div id="login-tab" class="tab-content active">
                            <form id="login-form">
                                <div class="form-group">
                                    <label class="form-label">Nom d'utilisateur</label>
                                    <input type="text" name="username" class="form-input" required autocomplete="username">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Mot de passe</label>
                                    <input type="password" name="password" class="form-input" required autocomplete="current-password">
                                </div>
                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="remember"> Se souvenir de moi
                                    </label>
                                </div>
                                <button type="submit" class="btn btn-primary btn-block">
                                    <span>🔐</span> Se connecter
                                </button>
                            </form>
                            <div class="auth-footer">
                                <p>Pas encore de compte ? <a href="#" id="switch-to-register">Créer un compte</a></p>
                            </div>
                        </div>

                        <div id="register-tab" class="tab-content">
                            <form id="register-form">
                                <div class="form-group">
                                    <label class="form-label">Nom d'utilisateur *</label>
                                    <input type="text" name="username" class="form-input" required minlength="3" autocomplete="username">
                                    <small class="form-hint">Au moins 3 caractères</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Email *</label>
                                    <input type="email" name="email" class="form-input" required autocomplete="email">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Mot de passe *</label>
                                    <input type="password" name="password" class="form-input" required minlength="6" autocomplete="new-password">
                                    <small class="form-hint">Au moins 6 caractères</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Confirmer le mot de passe *</label>
                                    <input type="password" name="confirmPassword" class="form-input" required autocomplete="new-password">
                                </div>
                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="terms" required> 
                                        J'accepte les conditions d'utilisation
                                    </label>
                                </div>
                                <button type="submit" class="btn btn-primary btn-block">
                                    <span>✨</span> Créer mon compte
                                </button>
                            </form>
                            <div class="auth-footer">
                                <p>Déjà un compte ? <a href="#" id="switch-to-login">Se connecter</a></p>
                            </div>
                        </div>

                        <div class="auth-info">
                            <p>💾 Toutes vos données sont stockées localement sur votre appareil</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        document.getElementById('switch-to-register')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchTab('register');
        });

        document.getElementById('switch-to-login')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchTab('login');
        });

        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            this.handleLogin(e);
        });

        document.getElementById('register-form')?.addEventListener('submit', (e) => {
            this.handleRegister(e);
        });
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}-tab`).classList.add('active');
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const username = formData.get('username');
        const password = formData.get('password');
        const remember = formData.get('remember');

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳</span> Connexion...';

        try {
            const user = await this.userStore.login(username, password);

            if (remember) {
                localStorage.setItem('remember_user', 'true');
            }

            // Afficher la sidebar
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.style.display = 'flex';

            // Vérifier si c'est la première connexion (tutoriel non vu)
            const tutorialSeen = localStorage.getItem(`tutorial_seen_${user.username}`) || user.tutorialSeen;

            if (!tutorialSeen) {
                console.log('🎓 Première connexion : redirection vers le tutoriel');
                window.location.hash = 'tutorial';
            } else {
                console.log('👋 Bienvenue à nouveau !');
                window.location.hash = 'home';
            }

            window.location.reload();
        } catch (error) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>🔐</span> Se connecter';
            this.showError('❌ ' + error.message);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const username = formData.get('username');
        const email = formData.get('email');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        const terms = formData.get('terms');

        if (!terms) {
            this.showError('❌ Vous devez accepter les conditions d\'utilisation');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('❌ Les mots de passe ne correspondent pas');
            return;
        }

        if (password.length < 6) {
            this.showError('❌ Le mot de passe doit contenir au moins 6 caractères');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳</span> Création...';

        try {
            await this.userStore.register(username, password, email);
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>✨</span> Créer mon compte';

            this.showSuccess('✅ Compte créé avec succès ! Connectez-vous pour commencer.');

            // Remplir automatiquement le formulaire de connexion
            setTimeout(() => {
                this.switchTab('login');
                document.querySelector('#login-form input[name="username"]').value = username;
                document.querySelector('#login-form input[name="password"]').focus();
            }, 1500);

            document.getElementById('register-form').reset();
        } catch (error) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>✨</span> Créer mon compte';
            this.showError('❌ ' + error.message);
        }
    }

    showError(message) {
        const existingAlert = document.querySelector('.alert-error');
        if (existingAlert) existingAlert.remove();

        const alert = document.createElement('div');
        alert.className = 'alert alert-error';
        alert.textContent = message;

        const authCard = document.querySelector('.auth-card');
        authCard.insertBefore(alert, authCard.firstChild);

        setTimeout(() => alert.remove(), 5000);
    }

    showSuccess(message) {
        const existingAlert = document.querySelector('.alert-success');
        if (existingAlert) existingAlert.remove();

        const alert = document.createElement('div');
        alert.className = 'alert alert-success';
        alert.textContent = message;

        const authCard = document.querySelector('.auth-card');
        authCard.insertBefore(alert, authCard.firstChild);

        setTimeout(() => alert.remove(), 5000);
    }

    destroy() {
        // Cleanup if needed
    }
}
