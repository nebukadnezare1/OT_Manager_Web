import { StorageService } from '../services/StorageService.js';

export class ExpenseStore {
    constructor() {
        this.storage = null;
        this.expenses = [];
        this.initialized = false;
    }

    async init() {
        if (!this.initialized) {
            this.storage = new StorageService();
            await this.storage.init();

            // Récupérer l'utilisateur actuel
            const currentUserId = localStorage.getItem('currentUserId');
            if (currentUserId) {
                const users = await this.storage.getAll('users');
                const user = users.find(u => u.id === parseInt(currentUserId));
                if (user) {
                    this.storage.setCurrentUser(user.username);
                }
            }

            this.initialized = true;
        }
    }

    async loadExpenses() {
        await this.init();
        this.expenses = await this.storage.getAll('expenses');
        return this.expenses;
    }

    async addExpense(expense) {
        await this.init();
        const newExpense = {
            ...expense,
            date: expense.date || new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        const id = await this.storage.add('expenses', newExpense);
        newExpense.id = id;
        this.expenses.push(newExpense);

        // Sauvegarde automatique
        await this.storage.autoSave();

        return newExpense;
    }

    async updateExpense(id, data) {
        await this.init();
        const expense = this.expenses.find(e => e.id === id);
        if (expense) {
            Object.assign(expense, data);
            await this.storage.update('expenses', expense);

            // Sauvegarde automatique
            await this.storage.autoSave();
        }
        return expense;
    }

    async deleteExpense(id) {
        await this.init();
        await this.storage.delete('expenses', id);
        this.expenses = this.expenses.filter(e => e.id !== id);

        // Sauvegarde automatique
        await this.storage.autoSave();
    }

    filterExpenses(filters) {
        let filtered = [...this.expenses];

        if (filters.search) {
            const search = filters.search.toLowerCase();
            filtered = filtered.filter(e =>
                e.description.toLowerCase().includes(search)
            );
        }

        if (filters.category) {
            filtered = filtered.filter(e => e.category === filters.category);
        }

        if (filters.dateFrom) {
            filtered = filtered.filter(e => new Date(e.date) >= new Date(filters.dateFrom));
        }

        if (filters.dateTo) {
            filtered = filtered.filter(e => new Date(e.date) <= new Date(filters.dateTo));
        }

        return filtered;
    }

    getStatsByCategory() {
        const stats = {};
        this.expenses.forEach(expense => {
            const cat = expense.category || 'Autre';
            if (!stats[cat]) {
                stats[cat] = { count: 0, total: 0 };
            }
            stats[cat].count++;
            stats[cat].total += expense.amount;
        });
        return stats;
    }

    getMonthlyStats(year) {
        const months = Array(12).fill(0);
        this.expenses.forEach(expense => {
            const date = new Date(expense.date);
            if (date.getFullYear() === year) {
                months[date.getMonth()] += expense.amount;
            }
        });
        return months;
    }

    getTotalAmount() {
        return this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    }
}
