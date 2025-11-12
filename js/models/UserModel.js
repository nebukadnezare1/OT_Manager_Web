export class UserModel {
    constructor(data = {}) {
        this.id = data.id || null;
        this.username = data.username || '';
        this.email = data.email || '';
        this.password = data.password || '';
        this.role = data.role || 'user'; // user, admin
        this.createdAt = data.createdAt || new Date().toISOString();
        this.lastLogin = data.lastLogin || null;
    }

    validate() {
        const errors = [];

        if (!this.username || this.username.trim().length < 3) {
            errors.push('Le nom d\'utilisateur doit contenir au moins 3 caractères');
        }

        if (!this.email || !this.isValidEmail(this.email)) {
            errors.push('L\'email est invalide');
        }

        if (!this.password || this.password.length < 6) {
            errors.push('Le mot de passe doit contenir au moins 6 caractères');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    toJSON() {
        return {
            id: this.id,
            username: this.username,
            email: this.email,
            password: this.password,
            role: this.role,
            createdAt: this.createdAt,
            lastLogin: this.lastLogin
        };
    }

    toSafeJSON() {
        const json = this.toJSON();
        delete json.password;
        return json;
    }

    static fromJSON(json) {
        return new UserModel(json);
    }
}
