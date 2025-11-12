import Router from './router.js';
import { StorageService } from './services/StorageService.js';
import { ActivationService } from './services/ActivationService.js';
import { UserStore } from './state/UserStore.js';
import { loadFromServer } from './services/StorageService.js';

class App {
    constructor() {
        this.router = new Router();
        this.storageService = new StorageService();
        this.activationService = new ActivationService();
        this.userStore = new UserStore();
    }

    async init() {
        try {
            await this.storageService.init();

            // --- Synchroniser les utilisateurs depuis le NAS au démarrage ---
            try {
                const username = localStorage.getItem("lastUsername");
                if (username) {
                    const serverData = await loadFromServer(username);
                    if (serverData && serverData.user) {
                        await this.storageService.add('users', serverData.user);
                        console.log('👤 Utilisateur importé depuis le NAS:', serverData.user.username);
                    }
                }
            } catch (err) {
                console.warn("⚠️ Aucun utilisateur NAS trouvé:", err.message);
            }


            // Vérifier l'authentification en premier
            const isAuthenticated = await this.checkAuth();

            if (!isAuthenticated) {
                // Si pas authentifié, rediriger vers auth et arrêter l'initialisation
                this.setupTheme();
                this.router.navigate('auth');
                return;
            }

            // Initialiser les services avec l'utilisateur actuel
            await this.initUserServices();

            // Mettre à jour le titre selon le statut Pro
            await this.updateAppTitle();

            // Continuer l'initialisation seulement si authentifié
            this.setupTheme();
            this.setupEventListeners();
            this.router.init();
            this.checkDemoMode();

            // Vérifier si c'est la première connexion (tutoriel non vu)
            await this.checkFirstLogin();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            alert('Erreur lors de l\'initialisation de l\'application. Vérifiez la console.');
        }
    }

    async initUserServices() {
        const currentUserId = localStorage.getItem('currentUserId');
        if (currentUserId) {
            const users = await this.storageService.getAll('users');
            const user = users.find(u => u.id === parseInt(currentUserId));
            if (user) {
                localStorage.setItem("lastUsername", user.username);

                // Configurer tous les services avec l'utilisateur actuel
                this.storageService.setCurrentUser(user.username);
                this.activationService.setCurrentUser(user.username);
                console.log('✅ Services initialisés pour:', user.username);

                // FORCER le rechargement depuis le NAS à chaque connexion
                await this.forceReloadFromNAS(user.username);

                // CORRECTION : Forcer plusieurs vérifications du statut Pro après synchronisation
                setTimeout(async () => {
                    // Re-configurer les services pour être sûr
                    this.activationService.setCurrentUser(user.username);
                    await this.updateAppTitle();
                    await this.checkDemoMode();
                    console.log('🔄 Première vérification statut Pro terminée');
                }, 1000);

                setTimeout(async () => {
                    // Deuxième vérification pour être absolument certain
                    this.activationService.setCurrentUser(user.username);
                    const isPro = await this.activationService.isPro();
                    console.log('🔍 VÉRIFICATION FINALE isPro():', isPro);
                    await this.updateAppTitle();
                    await this.checkDemoMode();
                }, 2000);
            }
        }
    }

    async forceReloadFromNAS(username) {
        try {
            console.log('🔄 Rechargement forcé depuis le NAS pour:', username);
            const serverData = await loadFromServer(username);

            if (serverData) {
                await this.storageService.import(serverData);
                console.log('📥 Données rechargées avec succès depuis le NAS');

                // Afficher notification de succès

            } else {
                console.log('⚠️ Aucun fichier trouvé sur le NAS pour cet utilisateur');
                this.showNotification('Aucune sauvegarde trouvée sur le serveur', 'info');
            }
        } catch (err) {
            console.error('❌ Erreur lors du rechargement forcé des données NAS:', err);
            this.showNotification('Erreur de synchronisation avec le serveur', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Créer la notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Afficher avec animation
        setTimeout(() => notification.classList.add('show'), 100);

        // Masquer après 3 secondes
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }

    async checkAuth() {
        const user = await this.userStore.getCurrentUser();
        if (!user) {
            // Masquer la sidebar si non authentifié
            this.updateLogoutButtonVisibility(false);
            return false;
        }

        // Afficher la sidebar si authentifié
        this.updateLogoutButtonVisibility(true);
        return true;
    }

    setupTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', theme);
        this.updateThemeIcon(theme);
    }

    setupEventListeners() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // Écouter les événements de connexion/déconnexion
        window.addEventListener('userLoggedIn', async (event) => {
            this.updateLogoutButtonVisibility(true);

            // Recharger depuis le NAS lors de la connexion
            const currentUserId = localStorage.getItem('currentUserId');
            if (currentUserId) {
                const users = await this.storageService.getAll('users');
                const user = users.find(u => u.id === parseInt(currentUserId));
                if (user) {
                    await this.forceReloadFromNAS(user.username);
                }
            }
        });

        window.addEventListener('userLoggedOut', () => {
            this.updateLogoutButtonVisibility(false);
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const route = item.dataset.route;
                if (route) {
                    this.router.navigate(route);
                }
            });
        });

        // Menu mobile
        this.setupMobileMenu();
    }

    setupMobileMenu() {
        // Créer le bouton hamburger avec la nouvelle structure
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'mobile-menu-toggle';
        toggleBtn.innerHTML = `
            <div class="hamburger">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        toggleBtn.id = 'mobile-menu-toggle';
        toggleBtn.setAttribute('aria-label', 'Menu');
        toggleBtn.setAttribute('aria-expanded', 'false');

        // Ajouter le bouton dans la bannière
        const topBanner = document.getElementById('top-banner');
        if (topBanner) {
            topBanner.appendChild(toggleBtn);
        }

        // Créer l'overlay
        const overlay = document.createElement('div');
        overlay.className = 'mobile-overlay';
        overlay.id = 'mobile-overlay';
        document.body.prepend(overlay);

        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('content');
        const hamburger = toggleBtn.querySelector('.hamburger');

        const toggleMenu = () => {
            const isOpen = sidebar.classList.contains('open');

            hamburger.classList.toggle('open');
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
            if (mainContent) {
                mainContent.classList.toggle('blur');
            }

            toggleBtn.setAttribute('aria-expanded', !isOpen);

            // Empêcher le scroll quand le menu est ouvert
            document.body.style.overflow = !isOpen ? 'hidden' : '';
        };

        // Event listeners
        toggleBtn.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', toggleMenu);

        // Fermer le menu avec Échap
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('open')) {
                toggleMenu();
            }
        });

        // Fermer le menu lors du clic sur un lien de navigation
        const navItems = sidebar.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                setTimeout(toggleMenu, 150); // Délai pour une meilleure UX
            });
        });

        // Gestion du redimensionnement
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && sidebar.classList.contains('open')) {
                toggleMenu();
            }
        });
    }

    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const icon = document.getElementById('theme-toggle');
        if (icon) {
            icon.textContent = theme === 'light' ? '🌙' : '☀️';
        }
    }

    async updateAppTitle() {
        const isPro = await this.activationService.isPro();
        const title = isPro ? 'OT Manager Pro' : 'OT Manager';
        const badge = isPro ? ' <span class="pro-diamond">💎</span>' : '';

        // Mettre à jour le titre de la page
        document.getElementById('app-title').textContent = title;

        // Mettre à jour le nom dans la sidebar
        const appName = document.getElementById('app-name');
        if (appName) {
            appName.innerHTML = `${title}${badge}`;

            // Ajouter une classe CSS pour le style Pro
            if (isPro) {
                appName.classList.add('pro-version');
            } else {
                appName.classList.remove('pro-version');
            }
        }

        // Mettre à jour la bannière globale
        const topBanner = document.getElementById('top-banner');
        if (topBanner) {
            // Conserver le bouton hamburger s'il existe
            const hamburgerBtn = topBanner.querySelector('.mobile-menu-toggle');
            topBanner.innerHTML = `<span>${title}</span>`;
            if (hamburgerBtn) {
                topBanner.appendChild(hamburgerBtn);
            }
        }

        console.log(isPro ? '💎 Version Pro activée' : '🆓 Version Démo');
    }

    async checkDemoMode() {
        const isPro = await this.activationService.isPro();
        const banner = document.getElementById('demo-banner');
        if (!isPro && banner) {
            banner.classList.remove('hidden');
        } else if (isPro && banner) {
            banner.classList.add('hidden');
        }
    }

    async checkFirstLogin() {
        const user = await this.userStore.getCurrentUser();
        if (!user) return;

        // Vérifier si le tutoriel a été vu
        const tutorialSeen = localStorage.getItem(`tutorial_seen_${user.username}`);

        if (!tutorialSeen && user.tutorialSeen !== true) {
            // Première connexion : afficher le tutoriel
            console.log('🎓 Première connexion détectée, affichage du tutoriel');
            this.router.navigate('tutorial');
        }
    }

    updateLogoutButtonVisibility(show) {
        const logoutBtn = document.getElementById('logout-btn');
        const sidebar = document.getElementById('sidebar');

        if (logoutBtn) {
            if (show) {
                logoutBtn.style.display = 'flex';
                logoutBtn.style.visibility = 'visible';
                logoutBtn.style.opacity = '1';
            } else {
                logoutBtn.style.display = 'none';
                logoutBtn.style.visibility = 'hidden';
                logoutBtn.style.opacity = '0';
            }
        }

        if (sidebar) {
            sidebar.style.display = show ? 'flex' : 'none';
        }

        console.log(`🔘 Bouton déconnexion: ${show ? 'visible' : 'caché'}`);
    }

    async logout() {
        const confirmLogout = confirm('Êtes-vous sûr de vouloir vous déconnecter ?');
        if (!confirmLogout) return;

        await this.userStore.logout();

        // Réinitialiser les services
        this.activationService.setCurrentUser(null);
        this.storageService.setCurrentUser(null);

        // Masquer la sidebar et le bouton de déconnexion
        this.updateLogoutButtonVisibility(false);

        this.router.navigate('auth');
    }
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});

export default App;
