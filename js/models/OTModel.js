export class OTModel {
    constructor(data = {}) {
        this.id = data.id || null;
        this.designation = data.designation || '';
        this.description = data.description || '';
        this.amount = data.amount || 0;
        this.category = data.category || 'Autre';
        this.date = data.date || new Date().toISOString();
        this.status = data.status || 'pending'; // pending, completed, cancelled
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    validate() {
        const errors = [];

        if (!this.designation || this.designation.trim().length === 0) {
            errors.push('La désignation est requise');
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
            designation: this.designation,
            description: this.description,
            amount: this.amount,
            category: this.category,
            date: this.date,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(json) {
        return new OTModel(json);
    }
}
