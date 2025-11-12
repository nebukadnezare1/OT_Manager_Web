import { OTStore } from '../state/OTStore.js';
import { ExpenseStore } from '../state/ExpenseStore.js';
import { ChartService } from '../services/ChartService.js';
import { ActivationService } from '../services/ActivationService.js';

export default class HomeView {
    constructor() {
        this.otStore = new OTStore();
        this.expenseStore = new ExpenseStore();
        this.chartService = new ChartService();
        this.activationService = new ActivationService();
        this.charts = [];
    }

    async render(container) {
        await this.otStore.loadOrders();
        await this.expenseStore.loadExpenses();

        // Vérifier le statut Pro
        const currentUserId = localStorage.getItem('currentUserId');
        const users = await this.otStore.storage.getAll('users');
        const user = users.find(u => u.id === parseInt(currentUserId));
        if (user) {
            this.activationService.setCurrentUser(user.username);
        }
        const isPro = await this.activationService.isPro();

        const totalRevenue = this.otStore.getTotalAmount();
        const totalExpenses = this.expenseStore.getTotalAmount();
        const balance = totalRevenue - totalExpenses;
        const orderCount = this.otStore.orders.length;

        container.innerHTML = `
            <div class="home-view">
                <div class="page-header">
                    <h1>Tableau de Bord ${isPro ? '💎' : ''}</h1>
                    ${isPro ? '<span class="pro-badge">Version Pro</span>' : '<span class="demo-badge">Version Démo</span>'}
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card" style="background: linear-gradient(135deg, #333 0%, #555 50%);">
                        <div class="stat-label">Revenus Totaux</div>
                        <div class="stat-value">${totalRevenue.toFixed(2)} €</div>
                        <div class="stat-subtitle">${orderCount} OT</div>
                    </div>
                    
                    <div class="stat-card" style="background: linear-gradient(135deg, #333 0%, #555 70%);">
                        <div class="stat-label">Dépenses Totales</div>
                        <div class="stat-value">${totalExpenses.toFixed(2)} €</div>
                        <div class="stat-subtitle">${this.expenseStore.expenses.length} dépenses</div>
                    </div>
                    
                    <div class="stat-card" style="background: linear-gradient(135deg, #333 0%, #555 100%);">
                        <div class="stat-label">Solde</div>
                        <div class="stat-value">${balance.toFixed(2)} €</div>
                        <div class="stat-subtitle">${balance >= 0 ? 'Positif' : 'Négatif'}</div>
                    </div>
                </div>

                <div class="dashboard-grid">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Revenus par Catégorie</h3>
                        </div>
                        <div class="card-body">
                            <canvas id="revenue-chart"></canvas>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Dépenses par Catégorie</h3>
                        </div>
                        <div class="card-body">
                            <canvas id="expense-chart"></canvas>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Évolution Mensuelle</h3>
                        </div>
                        <div class="card-body">
                            <canvas id="monthly-chart"></canvas>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Derniers OT</h3>
                        </div>
                        <div class="card-body">
                            <div id="recent-orders"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.renderCharts();
        this.renderRecentOrders();
    }

    renderCharts() {
        const otStats = this.otStore.getStatsByCategory();
        const expenseStats = this.expenseStore.getStatsByCategory();
        const year = new Date().getFullYear();
        const monthlyRevenue = this.otStore.getMonthlyStats(year);
        const monthlyExpenses = this.expenseStore.getMonthlyStats(year);

        // Revenue pie chart
        const revenueCanvas = document.getElementById('revenue-chart');
        if (revenueCanvas && Object.keys(otStats).length > 0) {
            const labels = Object.keys(otStats);
            const data = labels.map(cat => otStats[cat].total);
            this.charts.push(this.chartService.createPieChart(revenueCanvas, data, labels));
        }

        // Expense pie chart
        const expenseCanvas = document.getElementById('expense-chart');
        if (expenseCanvas && Object.keys(expenseStats).length > 0) {
            const labels = Object.keys(expenseStats);
            const data = labels.map(cat => expenseStats[cat].total);
            this.charts.push(this.chartService.createPieChart(expenseCanvas, data, labels));
        }

        // Monthly line chart
        const monthlyCanvas = document.getElementById('monthly-chart');
        if (monthlyCanvas) {
            const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
            const ctx = monthlyCanvas.getContext('2d');
            this.charts.push(new Chart(ctx, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Revenus',
                        data: monthlyRevenue,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Dépenses',
                        data: monthlyExpenses,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            }));
        }
    }

    renderRecentOrders() {
        const container = document.getElementById('recent-orders');
        const recent = this.otStore.orders
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        if (recent.length === 0) {
            container.innerHTML = '<p class="text-muted">Aucun ordre de travail</p>';
            return;
        }

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Désignation</th>
                        <th>Montant</th>
                    </tr>
                </thead>
                <tbody>
                    ${recent.map(order => `
                        <tr>
                            <td>${new Date(order.date).toLocaleDateString('fr-FR')}</td>
                            <td>${order.designation}</td>
                            <td>${order.amount.toFixed(2)} €</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    destroy() {
        this.charts.forEach(chart => this.chartService.destroy(chart));
        this.charts = [];
    }
}
