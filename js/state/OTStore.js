import { StorageService } from '../services/StorageService.js';

export class OTStore {
    constructor() {
        this.storage = null;
        this.orders = [];
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

    async loadOrders() {
        await this.init();
        this.orders = await this.storage.getAll('orders');
        return this.orders;
    }

    async addOrder(order) {
        await this.init();
        const newOrder = {
            ...order,
            date: order.date || new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        const id = await this.storage.add('orders', newOrder);
        newOrder.id = id;
        this.orders.push(newOrder);

        // Sauvegarde automatique
        await this.storage.autoSave();

        return newOrder;
    }

    async updateOrder(id, data) {
        await this.init();
        const order = this.orders.find(o => o.id === id);
        if (order) {
            Object.assign(order, data);
            await this.storage.update('orders', order);

            // Sauvegarde automatique
            await this.storage.autoSave();
        }
        return order;
    }

    async deleteOrder(id) {
        await this.init();
        await this.storage.delete('orders', id);
        this.orders = this.orders.filter(o => o.id !== id);

        // Sauvegarde automatique
        await this.storage.autoSave();
    }

    filterOrders(filters) {
        let filtered = [...this.orders];

        if (filters.search) {
            const search = filters.search.toLowerCase();
            filtered = filtered.filter(o =>
                o.designation.toLowerCase().includes(search) ||
                (o.description && o.description.toLowerCase().includes(search))
            );
        }

        if (filters.category) {
            filtered = filtered.filter(o => o.category === filters.category);
        }

        if (filters.dateFrom) {
            filtered = filtered.filter(o => new Date(o.date) >= new Date(filters.dateFrom));
        }

        if (filters.dateTo) {
            filtered = filtered.filter(o => new Date(o.date) <= new Date(filters.dateTo));
        }

        return filtered;
    }

    sortOrders(orders, sortBy, sortOrder = 'asc') {
        return orders.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];

            if (sortBy === 'date') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }

            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }

    getStatsByCategory() {
        const stats = {};
        this.orders.forEach(order => {
            const cat = order.category || 'Autre';
            if (!stats[cat]) {
                stats[cat] = { count: 0, total: 0 };
            }
            stats[cat].count++;
            stats[cat].total += order.amount;
        });
        return stats;
    }

    getMonthlyStats(year) {
        const months = Array(12).fill(0);
        this.orders.forEach(order => {
            const date = new Date(order.date);
            if (date.getFullYear() === year) {
                months[date.getMonth()] += order.amount;
            }
        });
        return months;
    }

    getTotalAmount() {
        return this.orders.reduce((sum, order) => sum + order.amount, 0);
    }
}
