import { UserStore } from '../state/UserStore.js';

export default class TutorialView {
    constructor() {
        this.userStore = new UserStore();
        this.currentStep = 0;
        this.steps = [
            {
                title: 'Bienvenue sur OT Manager',
                content: 'Une application complète pour gérer vos Ordres de Travail, vos dépenses et générer des rapports PDF.',
                icon: '👋'
            },
            {
                title: 'Gérez vos Ordres de Travail',
                content: 'Créez, modifiez et suivez tous vos ordres de travail. Filtrez par catégorie, date ou montant.',
                icon: '📋'
            },
            {
                title: 'Suivez vos Dépenses',
                content: 'Enregistrez toutes vos dépenses et visualisez vos statistiques par catégorie.',
                icon: '💰'
            },
            {
                title: 'Générez des Rapports',
                content: 'Créez des rapports PDF mensuels et annuels pour votre comptabilité.',
                icon: '📊'
            },
            {
                title: 'Synchronisez vos Données',
                content: 'Sauvegardez vos données et synchronisez-les entre vos appareils (PC, tablette, téléphone).',
                icon: '🔄'
            }
        ];
    }

    async render(container) {
        container.innerHTML = `
            <div class="tutorial-view">
                <div class="tutorial-container">
                    <div class="tutorial-card">
                        <div class="tutorial-icon" id="tutorial-icon"></div>
                        <h1 id="tutorial-title"></h1>
                        <p id="tutorial-content"></p>
                        
                        <div class="tutorial-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" id="progress-fill"></div>
                            </div>
                            <span class="progress-text" id="progress-text">1 / ${this.steps.length}</span>
                        </div>
                        
                        <div class="tutorial-dots">
                            ${this.steps.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" data-step="${i}"></span>`).join('')}
                        </div>
                        
                        <div class="tutorial-actions">
                            <button id="skip-btn" class="btn btn-secondary">Passer</button>
                            <button id="next-btn" class="btn btn-primary">Suivant</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.updateStep();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('next-btn')?.addEventListener('click', () => {
            if (this.currentStep < this.steps.length - 1) {
                this.currentStep++;
                this.updateStep();
            } else {
                this.finish();
            }
        });

        document.getElementById('skip-btn')?.addEventListener('click', () => {
            const confirmSkip = confirm('Êtes-vous sûr de vouloir passer le tutoriel ?');
            if (confirmSkip) {
                this.finish();
            }
        });

        document.querySelectorAll('.dot').forEach(dot => {
            dot.addEventListener('click', (e) => {
                this.currentStep = parseInt(e.target.dataset.step);
                this.updateStep();
            });
        });
    }

    updateStep() {
        const step = this.steps[this.currentStep];

        document.getElementById('tutorial-icon').textContent = step.icon;
        document.getElementById('tutorial-title').textContent = step.title;
        document.getElementById('tutorial-content').textContent = step.content;

        // Mettre à jour la barre de progression
        const progress = ((this.currentStep + 1) / this.steps.length) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
        document.getElementById('progress-text').textContent = `${this.currentStep + 1} / ${this.steps.length}`;

        document.querySelectorAll('.dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentStep);
        });

        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) {
            nextBtn.textContent = this.currentStep === this.steps.length - 1 ? 'Commencer 🚀' : 'Suivant';
        }
    }

    async finish() {
        // Marquer le tutoriel comme vu dans la base de données
        await this.userStore.markTutorialAsSeen();

        // Marquer également dans localStorage pour vérification rapide
        const user = await this.userStore.getCurrentUser();
        if (user) {
            localStorage.setItem(`tutorial_seen_${user.username}`, 'true');
        }

        console.log('✅ Tutoriel terminé');
        window.location.hash = 'home';
    }

    destroy() {
        // Cleanup if needed
    }
}
