import HomeView from './views/home.js';
import OTListView from './views/ot_list.js';
import ExpensesView from './views/expenses.js';
import ReportsView from './views/reports.js';
import SettingsView from './views/settings.js';
import AuthView from './views/auth.js';
import TutorialView from './views/tutorial.js';

class Router {
    constructor() {
        this.routes = {
            'home': HomeView,
            'ot-list': OTListView,
            'expenses': ExpensesView,
            'reports': ReportsView,
            'settings': SettingsView,
            'auth': AuthView,
            'tutorial': TutorialView
        };
        this.currentView = null;
    }

    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute();
    }

    async handleRoute() {
        const hash = window.location.hash.slice(1) || 'home';
        await this.navigate(hash);
    }

    async navigate(route) {
        // Vérifier l'authentification pour les routes protégées
        if (route !== 'auth') {
            const { UserStore } = await import('./state/UserStore.js');
            const userStore = new UserStore();
            const user = await userStore.getCurrentUser();

            if (!user) {
                window.location.hash = 'auth';
                return;
            }
        }

        const ViewClass = this.routes[route] || this.routes['home'];

        if (this.currentView && this.currentView.destroy) {
            this.currentView.destroy();
        }

        this.currentView = new ViewClass();
        const container = document.getElementById('view-container');

        if (container) {
            container.innerHTML = '';
            await this.currentView.render(container);
        }

        this.updateActiveNav(route);
        window.location.hash = route;
    }

    updateActiveNav(route) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.route === route) {
                item.classList.add('active');
            }
        });
    }
}

export default Router;
