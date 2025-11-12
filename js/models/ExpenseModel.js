export class ExpenseModel {
    constructor(data = {}) {
        this.id = data.id || null;
        this.description = data.description || '';
        this.amount = data.amount || 0;
        this.category = data.category || 'Autre';
        this.date = data.date || new Date().toISOString();
        this.paymentMethod = data.paymentMethod || 'card'; // card, cash, transfer
        this.receipt = data.receipt || null;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    validate() {
        const errors = [];

        if (!this.description || this.description.trim().length === 0) {
            errors.push('La description est requise');
        }

        if (!this.amount || this.amount <= 0) {
            errors.push('Le montant doit être supérieur à 0');
        }

        if (!this.date) {
            errors.push('La date est requise');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toJSON() {
        return {
            id: this.id,
            description: this.description,
            amount: this.amount,
            category: this.category,
            date: this.date,
            paymentMethod: this.paymentMethod,
            receipt: this.receipt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(json) {
        return new ExpenseModel(json);
    }
}
