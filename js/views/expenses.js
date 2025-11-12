import { ExpenseStore } from '../state/ExpenseStore.js';
import { StorageService } from '../services/StorageService.js';

export default class ExpensesView {
    constructor() {
        this.expenseStore = new ExpenseStore();
        this.storageService = new StorageService();
        this.filters = {};
        this.sortBy = 'date';
        this.sortOrder = 'desc';
        this.customCategories = [];
        this.currentUser = null;
    }

    async init() {
        await this.storageService.init();
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
                if (serverCategories && serverCategories.expenseCategories) {
                    this.customCategories = serverCategories.expenseCategories;
                    localStorage.setItem(`expense_custom_categories_${this.currentUser}`, JSON.stringify(this.customCategories));
                    console.log('✅ Catégories dépenses chargées depuis le serveur:', this.customCategories);
                    return;
                }
            } catch (err) {
                console.warn('⚠️ Impossible de charger depuis le serveur, utilisation locale');
            }
        }

        const saved = localStorage.getItem(`expense_custom_categories_${this.currentUser}`);
        this.customCategories = saved ? JSON.parse(saved) : [];
        console.log('📂 Catégories dépenses locales:', this.customCategories);
    }

    async saveCustomCategories() {
        if (!this.currentUser) {
            await this.init();
        }

        localStorage.setItem(`expense_custom_categories_${this.currentUser}`, JSON.stringify(this.customCategories));
        console.log('💾 Catégories dépenses sauvegardées localement');

        if (this.currentUser) {
            try {
                const otCategories = localStorage.getItem(`ot_custom_categories_${this.currentUser}`);
                await this.storageService.saveCustomCategories(
                    this.currentUser,
                    otCategories ? JSON.parse(otCategories) : [],
                    this.customCategories
                );
            } catch (err) {
                console.error('⚠️ Erreur synchronisation serveur:', err);
            }
        }
    }

    getAllCategories() {
        const defaultCategories = ['Carburant', 'Matériel', 'Fournitures', 'Transport', 'Repas', 'Autre'];
        return [...defaultCategories, ...this.customCategories];
    }

    async render(container) {
        await this.loadCustomCategories();
        await this.expenseStore.loadExpenses();
        const allCategories = this.getAllCategories();

        container.innerHTML = `
            <div class="expenses-view">
                <div class="page-header">
                    <h1>Dépenses</h1>
                    <button id="add-expense-btn" class="btn btn-primary">+ Nouvelle Dépense</button>
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

                <div class="card">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th data-sort="date">Date</th>
                                    <th data-sort="description">Description</th>
                                    <th data-sort="category">Catégorie</th>
                                    <th data-sort="amount">Montant</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="expense-table-body"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div id="expense-modal" class="modal hidden">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title" id="modal-title">Nouvelle Dépense</h2>
                    </div>
                    <form id="expense-form">
                        <div class="form-group">
                            <label class="form-label">Description *</label>
                            <input type="text" name="description" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Montant (€) *</label>
                            <input type="number" name="amount" class="form-input" step="0.01" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Catégorie</label>
                            <div style="display: flex; gap: 0.5rem;">
                                <select name="category" id="category-select" class="form-select" style="flex: 1;">
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
                        <div class="form-group">
                            <label class="form-label">Notes</label>
                            <textarea name="notes" class="form-textarea" rows="3"></textarea>
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
        document.getElementById('add-expense-btn')?.addEventListener('click', () => this.openModal());

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

        document.getElementById('expense-form')?.addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('cancel-modal')?.addEventListener('click', () => this.closeModal());
    }

    renderTable() {
        const tbody = document.getElementById('expense-table-body');
        const totalEl = document.getElementById('total-amount');
        if (!tbody) return;

        let expenses = this.expenseStore.filterExpenses(this.filters);
        const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        if (totalEl) totalEl.textContent = `${total.toFixed(2)} €`;

        if (expenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Aucune dépense</td></tr>';
            return;
        }

        tbody.innerHTML = expenses.map(expense => `
            <tr>
                <td>${new Date(expense.date).toLocaleDateString('fr-FR')}</td>
                <td>${expense.description}</td>
                <td><span class="badge badge-danger">${expense.category || 'N/A'}</span></td>
                <td>${expense.amount.toFixed(2)} €</td>
                <td>
                    <button class="btn-icon" data-action="edit" data-id="${expense.id}">✏️</button>
                    <button class="btn-icon" data-action="delete" data-id="${expense.id}">🗑️</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const id = parseInt(e.currentTarget.dataset.id);
                if (action === 'edit') this.editExpense(id);
                if (action === 'delete') this.deleteExpense(id);
            });
        });
    }

    openModal(expense = null) {
        const modal = document.getElementById('expense-modal');
        const form = document.getElementById('expense-form');
        const title = document.getElementById('modal-title');

        if (expense) {
            title.textContent = 'Modifier la Dépense';
            form.elements.description.value = expense.description;
            form.elements.amount.value = expense.amount;
            form.elements.category.value = expense.category;
            form.elements.date.value = expense.date.split('T')[0];
            form.dataset.editId = expense.id;
        } else {
            title.textContent = 'Nouvelle Dépense';
            form.reset();
            delete form.dataset.editId;
        }

        modal.classList.remove('hidden');
    }

    closeModal() {
        document.getElementById('expense-modal').classList.add('hidden');
    }

    async handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        data.amount = parseFloat(data.amount);

        try {
            if (form.dataset.editId) {
                await this.expenseStore.updateExpense(parseInt(form.dataset.editId), data);
            } else {
                await this.expenseStore.addExpense(data);
            }
            this.closeModal();
            this.renderTable();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    editExpense(id) {
        const expense = this.expenseStore.expenses.find(e => e.id === id);
        if (expense) this.openModal(expense);
    }

    async deleteExpense(id) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
            await this.expenseStore.deleteExpense(id);
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
