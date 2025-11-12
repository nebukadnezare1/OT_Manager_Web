import { OTStore } from '../state/OTStore.js';
import { ExpenseStore } from '../state/ExpenseStore.js';
import { PDFService } from '../services/PDFService.js';

export default class ReportsView {
    constructor() {
        this.otStore = new OTStore();
        this.expenseStore = new ExpenseStore();
        this.pdfService = new PDFService();
    }

    async render(container) {
        await this.otStore.loadOrders();
        await this.expenseStore.loadExpenses();

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        container.innerHTML = `
            <div class="reports-view">
                <div class="page-header">
                    <h1>Rapports</h1>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Rapport Mensuel OT</h3>
                    </div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="form-label">Mois</label>
                            <input type="month" id="ot-month" class="form-input" value="${currentYear}-${String(currentMonth).padStart(2, '0')}">
                        </div>
                        <button id="generate-ot-report" class="btn btn-primary">📄 Générer PDF</button>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Rapport Mensuel Dépenses</h3>
                    </div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="form-label">Mois</label>
                            <input type="month" id="expense-month" class="form-input" value="${currentYear}-${String(currentMonth).padStart(2, '0')}">
                        </div>
                        <button id="generate-expense-report" class="btn btn-primary">📄 Générer PDF</button>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Bilan Mensuel</h3>
                    </div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="form-label">Mois</label>
                            <input type="month" id="monthly-balance-month" class="form-input" value="${currentYear}-${String(currentMonth).padStart(2, '0')}">
                        </div>
                        <button id="generate-monthly-balance" class="btn btn-primary">📄 Générer PDF</button>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Bilan Annuel</h3>
                    </div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="form-label">Année</label>
                            <input type="number" id="balance-year" class="form-input" value="${currentYear}" min="2000" max="${currentYear + 10}">
                        </div>
                        <button id="generate-balance-report" class="btn btn-primary">📄 Générer PDF</button>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Aperçu Rapide</h3>
                    </div>
                    <div class="card-body">
                        <div id="quick-stats"></div>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        this.renderQuickStats();
    }

    setupEventListeners() {
        document.getElementById('generate-ot-report')?.addEventListener('click', () => {
            this.generateOTReport();
        });

        document.getElementById('generate-expense-report')?.addEventListener('click', () => {
            this.generateExpenseReport();
        });

        document.getElementById('generate-balance-report')?.addEventListener('click', () => {
            this.generateBalanceReport();
        });

        document.getElementById('generate-monthly-balance')?.addEventListener('click', () => {
            this.generateMonthlyBalanceReport();
        });
    }

    async generateOTReport() {
        const monthInput = document.getElementById('ot-month').value;
        const [year, month] = monthInput.split('-').map(Number);

        const orders = this.otStore.orders.filter(ot => {
            const date = new Date(ot.date);
            return date.getFullYear() === year && date.getMonth() + 1 === month;
        });

        if (orders.length === 0) {
            alert('Aucun ordre de travail pour cette période');
            return;
        }

        // Configurer PDFService avec l'utilisateur actuel
        const currentUserId = localStorage.getItem('currentUserId');
        const users = await this.otStore.storage.getAll('users');
        const user = users.find(u => u.id === parseInt(currentUserId));
        if (user) {
            this.pdfService.setCurrentUser(user.username);
        }

        await this.pdfService.generateMonthlyReport(orders, month, year);
    }

    async generateExpenseReport() {
        const monthInput = document.getElementById('expense-month').value;
        const [year, month] = monthInput.split('-').map(Number);

        const expenses = this.expenseStore.expenses.filter(exp => {
            const date = new Date(exp.date);
            return date.getFullYear() === year && date.getMonth() + 1 === month;
        });

        if (expenses.length === 0) {
            alert('Aucune dépense pour cette période');
            return;
        }

        // Configurer PDFService avec l'utilisateur actuel
        const currentUserId = localStorage.getItem('currentUserId');
        const users = await this.otStore.storage.getAll('users');
        const user = users.find(u => u.id === parseInt(currentUserId));
        if (user) {
            this.pdfService.setCurrentUser(user.username);
        }

        await this.pdfService.generateExpenseReport(expenses, month, year);
    }

    async generateBalanceReport() {
        try {
            const year = document.getElementById('balance-year').value;

            if (!year) {
                alert('Veuillez sélectionner une année');
                return;
            }

            console.log('🔍 Génération du bilan pour l\'année:', year);

            // Configurer PDFService avec l'utilisateur actuel
            const currentUserId = localStorage.getItem('currentUserId');
            const users = await this.otStore.storage.getAll('users');
            const user = users.find(u => u.id === parseInt(currentUserId));
            if (user) {
                this.pdfService.setCurrentUser(user.username);
                console.log('👤 PDFService configuré pour:', user.username);
            }

            const yearOrders = this.otStore.orders.filter(ot => {
                return new Date(ot.date).getFullYear() == year;
            });

            const yearExpenses = this.expenseStore.expenses.filter(exp => {
                return new Date(exp.date).getFullYear() == year;
            });

            console.log(`📊 Données trouvées pour ${year}:`);
            console.log('- Ordres de travail:', yearOrders.length);
            console.log('- Dépenses:', yearExpenses.length);

            if (yearOrders.length === 0 && yearExpenses.length === 0) {
                alert('Aucune donnée trouvée pour cette année');
                return;
            }

            // Vérifier que jsPDF est disponible
            if (!window.jspdf) {
                throw new Error('Bibliothèque jsPDF non chargée');
            }

            await this.pdfService.generateBalanceReport(yearOrders, yearExpenses, year);

        } catch (error) {
            console.error('❌ Erreur dans generateBalanceReport:', error);
            alert('Erreur lors de la génération du bilan : ' + error.message);
        }
    }

    async generateMonthlyBalanceReport() {
        const monthInput = document.getElementById('monthly-balance-month').value;
        const [year, month] = monthInput.split('-').map(Number);

        const orders = this.otStore.orders.filter(ot => {
            const date = new Date(ot.date);
            return date.getFullYear() === year && date.getMonth() + 1 === month;
        });

        const expenses = this.expenseStore.expenses.filter(exp => {
            const date = new Date(exp.date);
            return date.getFullYear() === year && date.getMonth() + 1 === month;
        });

        if (orders.length === 0 && expenses.length === 0) {
            alert('Aucune donnée pour cette période');
            return;
        }

        // Configurer PDFService avec l'utilisateur actuel
        const currentUserId = localStorage.getItem('currentUserId');
        const users = await this.otStore.storage.getAll('users');
        const user = users.find(u => u.id === parseInt(currentUserId));
        if (user) {
            this.pdfService.setCurrentUser(user.username);
        }

        await this.pdfService.generateMonthlyBalanceReport(orders, expenses, month, year);
    }

    renderQuickStats() {
        const container = document.getElementById('quick-stats');
        const currentYear = new Date().getFullYear();

        const yearOrders = this.otStore.orders.filter(ot =>
            new Date(ot.date).getFullYear() === currentYear
        );
        const yearExpenses = this.expenseStore.expenses.filter(exp =>
            new Date(exp.date).getFullYear() === currentYear
        );

        const totalRevenue = yearOrders.reduce((sum, ot) => sum + ot.amount, 0);
        const totalExpenses = yearExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const balance = totalRevenue - totalExpenses;

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-label">Revenus ${currentYear}</div>
                    <div class="stat-value">${totalRevenue.toFixed(2)} €</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Dépenses ${currentYear}</div>
                    <div class="stat-value">${totalExpenses.toFixed(2)} €</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Solde ${currentYear}</div>
                    <div class="stat-value" style="color: ${balance >= 0 ? '#10b981' : '#ef4444'}">${balance.toFixed(2)} €</div>
                </div>
            </div>
        `;
    }

    destroy() {
        // Cleanup if needed
    }
}
