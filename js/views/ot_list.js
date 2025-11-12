import { OTStore } from '../state/OTStore.js';
import { ActivationService } from '../services/ActivationService.js';
import { StorageService } from '../services/StorageService.js';

export default class OTListView {
    constructor() {
        this.otStore = new OTStore();
        this.activationService = new ActivationService();
        this.storageService = new StorageService();
        this.filters = {};
        this.sortBy = 'date';
        this.sortOrder = 'desc';
        this.customCategories = [];
        this.currentUser = null;
    }

    async init() {
        await this.storageService.init();
        // Récupérer le nom d'utilisateur depuis IndexedDB
        const currentUserId = localStorage.getItem('currentUserId');
        if (currentUserId) {
            const users = await this.storageService.getAll('users');
            const user = users.find(u => u.id === parseInt(currentUserId));
            if (user) {
                this.currentUser = user.username;
            }
        }
    }

    async loadCustomCategories() {
        if (!this.currentUser) {
            await this.init();
        }

        if (this.currentUser) {
            try {
                const serverCategories = await this.storageService.loadCustomCategories(this.currentUser);
                if (serverCategories && serverCategories.otCategories) {
                    this.customCategories = serverCategories.otCategories;
                    localStorage.setItem(`ot_custom_categories_${this.currentUser}`, JSON.stringify(this.customCategories));
                    console.log('✅ Catégories OT chargées depuis le serveur:', this.customCategories);
                    return;
                }
            } catch (err) {
                console.warn('⚠️ Impossible de charger depuis le serveur, utilisation locale');
            }
        }

        const saved = localStorage.getItem(`ot_custom_categories_${this.currentUser}`);
        this.customCategories = saved ? JSON.parse(saved) : [];
        console.log('📂 Catégories OT locales:', this.customCategories);
    }

    async saveCustomCategories() {
        if (!this.currentUser) {
            await this.init();
        }

        localStorage.setItem(`ot_custom_categories_${this.currentUser}`, JSON.stringify(this.customCategories));
        console.log('💾 Catégories OT sauvegardées localement');

        if (this.currentUser) {
            try {
                const expenseCategories = localStorage.getItem(`expense_custom_categories_${this.currentUser}`);
                await this.storageService.saveCustomCategories(
                    this.currentUser,
                    this.customCategories,
                    expenseCategories ? JSON.parse(expenseCategories) : []
                );
            } catch (err) {
                console.error('⚠️ Erreur synchronisation serveur:', err);
            }
        }
    }

    getAllCategories() {
        const defaultCategories = ['Installation', 'Maintenance', 'Réparation', 'Consultation', 'Autre'];
        return [...defaultCategories, ...this.customCategories];
    }

    async render(container) {
        await this.loadCustomCategories();
        await this.otStore.loadOrders();

        // Initialiser l'utilisateur courant si nécessaire
        if (!this.currentUser) {
            await this.init();
        }

        // Vérifier le statut Pro avec le bon username
        this.activationService.setCurrentUser(this.currentUser);
        const isPro = await this.activationService.isPro();

        console.log('🔍 Statut Pro dans ot_list:', isPro, 'pour utilisateur:', this.currentUser);

        const allCategories = this.getAllCategories();

        container.innerHTML = `
            <div class="ot-list-view">
                <div class="page-header">
                    <h1>Ordres de Travail</h1>
                    <button id="add-ot-btn" class="btn btn-primary">+ Nouvel OT</button>
                </div>

                <div class="card">
                    <div class="filters">
                        <input type="text" id="search-input" class="form-input" placeholder="Rechercher...">
                        <select id="category-filter" class="form-select">
                            <option value="">Toutes catégories</option>
                            ${allCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                        </select>
                        <input type="date" id="date-from" class="form-input">
                        <input type="date" id="date-to" class="form-input">
                        <button id="clear-filters" class="btn btn-secondary">Réinitialiser</button>
                    </div>
                </div>

                ${!isPro ? `<div class="alert alert-warning">Mode DÉMO: ${this.otStore.orders.length}/15 OT utilisés</div>` : ''}

                <div class="card">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th data-sort="date">Date</th>
                                    <th data-sort="designation">Désignation</th>
                                    <th data-sort="category">Catégorie</th>
                                    <th data-sort="amount">Montant</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="ot-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div id="ot-modal" class="modal hidden">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title" id="modal-title">Nouvel Ordre de Travail</h2>
                    </div>
                    <form id="ot-form">
                        <div class="form-group">
                            <label class="form-label">Désignation *</label>
                            <input type="text" name="designation" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea name="description" class="form-textarea" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Montant (€) *</label>
                            <input type="number" name="amount" class="form-input" step="0.01" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Catégorie</label>
                            <div class="category-container">
                                <select name="category" id="category-select" class="form-select">
                                    ${allCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                                </select>
                                <button type="button" id="add-category-btn" class="btn btn-secondary" title="Ajouter une catégorie">
                                    ➕
                                </button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date</label>
                            <input type="date" name="date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="modal-footer">
                            <button type="submit" class="btn btn-primary">Enregistrer</button>
                            <button type="button" id="cancel-modal" class="btn btn-secondary">Annuler</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        this.setupEventListeners();
        this.renderTable();
    }

    setupEventListeners() {
        document.getElementById('add-ot-btn')?.addEventListener('click', () => this.openModal());

        // Bouton pour ajouter une catégorie personnalisée
        document.getElementById('add-category-btn')?.addEventListener('click', () => this.addCustomCategory());

        document.getElementById('search-input')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.renderTable();
        });
        document.getElementById('category-filter')?.addEventListener('change', (e) => {
            this.filters.category = e.target.value;
            this.renderTable();
        });
        document.getElementById('date-from')?.addEventListener('change', (e) => {
            this.filters.dateFrom = e.target.value;
            this.renderTable();
        });
        document.getElementById('date-to')?.addEventListener('change', (e) => {
            this.filters.dateTo = e.target.value;
            this.renderTable();
        });
        document.getElementById('clear-filters')?.addEventListener('click', () => {
            this.filters = {};
            document.getElementById('search-input').value = '';
            document.getElementById('category-filter').value = '';
            document.getElementById('date-from').value = '';
            document.getElementById('date-to').value = '';
            this.renderTable();
        });

        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const sortBy = th.dataset.sort;
                if (this.sortBy === sortBy) {
                    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortBy = sortBy;
                    this.sortOrder = 'asc';
                }
                this.renderTable();
            });
        });

        // Écouteur pour le formulaire
        const otForm = document.getElementById('ot-form');
        if (otForm) {
            otForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Écouteur pour le bouton annuler avec délégation d'événements
        document.body.addEventListener('click', (e) => {
            if (e.target && (e.target.id === 'cancel-modal' || e.target.closest('#cancel-modal'))) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔘 Bouton Annuler cliqué');
                this.closeModal();
            }
        });

        // Fermer avec la touche Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('ot-modal');
                if (modal && !modal.classList.contains('hidden')) {
                    this.closeModal();
                }
            }
        });

        // Fermer en cliquant sur le fond du modal
        const modal = document.getElementById('ot-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'ot-modal') {
                    this.closeModal();
                }
            });
        }
    }

    renderTable() {
        const tbody = document.getElementById('ot-table-body');
        if (!tbody) return;

        let orders = this.otStore.filterOrders(this.filters);
        orders = this.otStore.sortOrders(orders, this.sortBy, this.sortOrder);

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Aucun ordre de travail</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td>${new Date(order.date).toLocaleDateString('fr-FR')}</td>
                <td>${order.designation}</td>
                <td><span class="badge badge-success">${order.category || 'N/A'}</span></td>
                <td>${order.amount.toFixed(2)} €</td>
                <td>
                    <button class="btn-icon" data-action="edit" data-id="${order.id}">✏️</button>
                    <button class="btn-icon" data-action="delete" data-id="${order.id}">🗑️</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const id = parseInt(e.currentTarget.dataset.id);
                if (action === 'edit') this.editOrder(id);
                if (action === 'delete') this.deleteOrder(id);
            });
        });
    }

    async openModal(order = null) {
        const isPro = await this.activationService.isPro();
        if (!isPro && !order && this.otStore.orders.length >= 15) {
            alert('Limite de 15 OT atteinte en mode DÉMO. Activez la version Pro.');
            return;
        }

        const modal = document.getElementById('ot-modal');
        const form = document.getElementById('ot-form');
        const title = document.getElementById('modal-title');

        if (order) {
            title.textContent = 'Modifier l\'Ordre de Travail';
            form.elements.designation.value = order.designation;
            form.elements.description.value = order.description || '';
            form.elements.amount.value = order.amount;
            form.elements.category.value = order.category;
            form.elements.date.value = order.date.split('T')[0];
            form.dataset.editId = order.id;
        } else {
            title.textContent = 'Nouvel Ordre de Travail';
            form.reset();
            form.elements.date.value = new Date().toISOString().split('T')[0];
            delete form.dataset.editId;
        }

        modal.classList.remove('hidden');

        // Focus sur le premier champ
        setTimeout(() => {
            form.elements.designation?.focus();
        }, 100);
    }

    closeModal() {
        const modal = document.getElementById('ot-modal');
        const form = document.getElementById('ot-form');
        if (modal) modal.classList.add('hidden');
        if (form) {
            form.reset();
            delete form.dataset.editId;
        }
        console.log('✅ Modal fermé');
    }

    async handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        data.amount = parseFloat(data.amount);

        try {
            if (form.dataset.editId) {
                await this.otStore.updateOrder(parseInt(form.dataset.editId), data);
            } else {
                await this.otStore.addOrder(data);
            }
            this.closeModal();
            this.renderTable();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    editOrder(id) {
        const order = this.otStore.orders.find(o => o.id === id);
        if (order) this.openModal(order);
    }

    async deleteOrder(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cet OT ?')) {
            await this.otStore.deleteOrder(id);
            this.renderTable();
        }
    }

    async addCustomCategory() {
        const categoryName = prompt('Entrez le nom de la nouvelle catégorie :');

        if (!categoryName || categoryName.trim() === '') {
            return;
        }

        const trimmedName = categoryName.trim();
        const allCategories = this.getAllCategories();

        if (allCategories.includes(trimmedName)) {
            alert('❌ Cette catégorie existe déjà !');
            return;
        }

        this.customCategories.push(trimmedName);
        await this.saveCustomCategories();

        const select = document.getElementById('category-select');
        if (select) {
            const newOption = document.createElement('option');
            newOption.value = trimmedName;
            newOption.textContent = trimmedName;
            newOption.selected = true;
            select.appendChild(newOption);
        }

        alert(`✅ Catégorie "${trimmedName}" ajoutée avec succès !`);
    }

    destroy() {
        // Cleanup if needed
    }
}
