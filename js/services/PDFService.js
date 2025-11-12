import { CompanyService } from './CompanyService.js';

export class PDFService {
    constructor() {
        this.companyService = new CompanyService();
        this.companyInfo = this.getCompanyInfo();
        this.currentUser = null; // Ajouter le stockage du nom d'utilisateur
    }

    // ---- Initialisation ----
    setCurrentUser(username) {
        this.currentUser = username; // Sauvegarder le username
        this.companyService.setCurrentUser(username);
        this.companyInfo = this.getCompanyInfo();
        console.log('PDFService configuré pour:', username, 'Infos société:', this.companyInfo);
    }

    getCompanyInfo() {
        return this.companyService.getCompanyInfo() || {};
    }

    // ---- Rapport Mensuel ----
    async generateMonthlyReport(orders, month, year) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        this.addModernHeader(doc, `OT Mois - ${month}/${year}`);
        this.addModernCompanyInfo(doc);

        const pageWidth = doc.internal.pageSize.getWidth();
        const rectWidth = 170;
        const rectX = (pageWidth - rectWidth) / 2;

        let y = 90;
        const total = orders.reduce((s, o) => s + o.amount, 0);

        // Section titre
        doc.setFillColor(240, 245, 255);
        doc.rect(rectX, y - 8, rectWidth, 10, 'F');
        doc.setFontSize(14).setFont(undefined, 'bold').setTextColor(30, 58, 138);
        doc.text('ORDRES DE TRAVAIL', pageWidth / 2, y, { align: 'center' });
        y += 15;

        // En-têtes du tableau
        doc.setFillColor(30, 58, 138);
        doc.rect(rectX, y - 5, rectWidth, 7, 'F');
        doc.setFontSize(10).setFont(undefined, 'bold').setTextColor(255, 255, 255);
        doc.text('N°', rectX + 5, y);
        doc.text('Désignation', rectX + 20, y);
        doc.text('Catégorie', rectX + 85, y); // Nouvelle colonne pour la catégorie
        doc.text('Montant (€)', rectX + rectWidth - 5, y, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y += 10;

        // Contenu du tableau
        orders.forEach((o, i) => {
            if (y > 270) {
                this.addModernFooter(doc);
                doc.addPage();
                this.addModernHeader(doc, `Rapport Mensuel - ${month}/${year}`);
                y = 60;
            }
            if (i % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(rectX, y - 4, rectWidth, 6, 'F');
            }
            doc.setFontSize(9).setFont(undefined, 'normal');
            doc.text(`${i + 1}`, rectX + 5, y);
            doc.text(o.designation || '-', rectX + 20, y);
            doc.text(o.category || '-', rectX + 85, y); // Affichage de la catégorie
            doc.text(`${o.amount?.toFixed(2) || '0.00'}`, rectX + rectWidth - 5, y, { align: 'right' });
            y += 7;
        });

        // Total
        y += 10;
        doc.setFillColor(240, 245, 255);
        doc.rect(rectX, y - 4, rectWidth, 8, 'F');
        doc.setFontSize(11).setFont(undefined, 'bold').setTextColor(30, 58, 138);
        doc.text(`TOTAL: ${total.toFixed(2)} €`, rectX + rectWidth - 5, y + 2, { align: 'right' });

        this.addModernFooter(doc);

        const filename = this.currentUser
            ? `${this.currentUser}_OT_${month}_${year}.pdf`
            : `OT_${month}_${year}.pdf`;
        doc.save(filename);
    }

    // ---- Rapport Dépenses ----
    async generateExpenseReport(expenses, month, year) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        this.addModernHeader(doc, `Dépenses Mois - ${month}/${year}`);
        this.addModernCompanyInfo(doc);

        const pageWidth = doc.internal.pageSize.getWidth();
        const rectWidth = 170;
        const rectX = (pageWidth - rectWidth) / 2;

        let y = 90;
        const total = expenses.reduce((s, e) => s + e.amount, 0);

        // Section titre
        doc.setFillColor(255, 240, 245);
        doc.rect(rectX, y - 8, rectWidth, 10, 'F');
        doc.setFontSize(14).setFont(undefined, 'bold').setTextColor(136, 19, 55);
        doc.text('DÉPENSES', pageWidth / 2, y, { align: 'center' });
        y += 15;

        // En-têtes du tableau
        doc.setFillColor(136, 19, 55);
        doc.rect(rectX, y - 5, rectWidth, 7, 'F');
        doc.setFontSize(10).setFont(undefined, 'bold').setTextColor(255, 255, 255);
        doc.text('N°', rectX + 5, y);
        doc.text('Description', rectX + 20, y);
        doc.text('Catégorie', rectX + 85, y); // Nouvelle colonne pour la catégorie
        doc.text('Montant (€)', rectX + rectWidth - 5, y, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y += 10;

        // Contenu
        expenses.forEach((e, i) => {
            if (y > 270) {
                this.addModernFooter(doc);
                doc.addPage();
                this.addModernHeader(doc, `Rapport Dépenses - ${month}/${year}`);
                y = 60;
            }
            if (i % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(rectX, y - 4, rectWidth, 6, 'F');
            }
            doc.setFontSize(9).setFont(undefined, 'normal');
            doc.text(`${i + 1}`, rectX + 5, y);
            doc.text(e.description || '-', rectX + 20, y);
            doc.text(e.category || '-', rectX + 85, y); // Affichage de la catégorie
            doc.text(`${e.amount?.toFixed(2) || '0.00'}`, rectX + rectWidth - 5, y, { align: 'right' });
            y += 7;
        });

        // Total
        y += 10;
        doc.setFillColor(255, 240, 245);
        doc.rect(rectX, y - 4, rectWidth, 8, 'F');
        doc.setFontSize(11).setFont(undefined, 'bold').setTextColor(136, 19, 55);
        doc.text(`TOTAL: ${total.toFixed(2)} €`, rectX + rectWidth - 5, y + 2, { align: 'right' });

        this.addModernFooter(doc);

        const filename = this.currentUser
            ? `${this.currentUser}_Depenses_${month}_${year}.pdf`
            : `Depenses_${month}_${year}.pdf`;
        doc.save(filename);
    }

    // ---- Bilan Annuel ----
    async generateBalanceReport(orders, expenses, year) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        this.addModernHeader(doc, `Bilan Année ${year}`);
        this.addModernCompanyInfo(doc);

        const totalRev = orders.reduce((s, o) => s + o.amount, 0);
        const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
        const solde = totalRev - totalExp;

        const pageWidth = doc.internal.pageSize.getWidth();
        const rectWidth = 170;
        const rectX = (pageWidth - rectWidth) / 2;

        let y = 90;

        // Carte de résumé financier centrée
        doc.setFillColor(240, 255, 244);
        doc.setDrawColor(34, 197, 94);
        doc.setLineWidth(0.5);

        const boxHeight = 48;
        doc.roundedRect(rectX, y - 8, rectWidth, boxHeight, 3, 3, 'F');
        doc.roundedRect(rectX, y - 8, rectWidth, boxHeight, 3, 3, 'S');

        // Titre
        doc.setFontSize(14).setFont(undefined, 'bold').setTextColor(22, 101, 52);
        doc.text('RÉSUMÉ FINANCIER', rectX + 10, y + 5);
        y += 13;

        // Contenu
        doc.setFontSize(11).setFont(undefined, 'normal').setTextColor(0, 0, 0);
        doc.text(`Revenus (OT): ${totalRev.toFixed(2)} €`, rectX + 10, y);
        y += 7;
        doc.text(`Dépenses: ${totalExp.toFixed(2)} €`, rectX + 10, y);
        y += 8;

        // Ligne séparatrice
        doc.setDrawColor(200, 200, 200);
        doc.line(rectX + 10, y, rectX + rectWidth - 10, y);
        y += 8;

        // Solde
        doc.setFontSize(12).setFont(undefined, 'bold');
        const soldeColor = solde >= 0 ? [22, 101, 52] : [185, 28, 28];
        doc.setTextColor(...soldeColor);
        doc.text(`SOLDE: ${solde.toFixed(2)} €`, rectX + 10, y + 2);

        this.addModernFooter(doc);

        const filename = this.currentUser
            ? `${this.currentUser}_Bilan_${year}.pdf`
            : `Bilan_${year}.pdf`;
        doc.save(filename);
    }

    // ---- NOUVEAU : Bilan Mensuel ----
    async generateMonthlyBalanceReport(orders, expenses, month, year) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        this.addModernHeader(doc, `Bilan Mois - ${month}/${year}`);
        this.addModernCompanyInfo(doc);

        const totalRev = orders.reduce((s, o) => s + o.amount, 0);
        const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
        const solde = totalRev - totalExp;

        const pageWidth = doc.internal.pageSize.getWidth();
        const rectWidth = 170;
        const rectX = (pageWidth - rectWidth) / 2;
        const spacing = 15; // Espacement uniforme entre les cadres
        const boxHeight = 50; // Hauteur uniforme pour tous les cadres

        let y = 90;

        // --- CADRE 1 : Résumé Financier ---
        doc.setFillColor(240, 255, 244);
        doc.setDrawColor(34, 197, 94);
        doc.setLineWidth(0.5);
        doc.roundedRect(rectX, y, rectWidth, boxHeight, 3, 3, 'F');
        doc.roundedRect(rectX, y, rectWidth, boxHeight, 3, 3, 'S');

        // Titre centré
        doc.setFontSize(14).setFont(undefined, 'bold').setTextColor(22, 101, 52);
        doc.text('RÉSUMÉ FINANCIER', pageWidth / 2, y + 12, { align: 'center' });

        // Nombre d'éléments
        doc.setFontSize(9).setFont(undefined, 'normal').setTextColor(100, 100, 100);
        doc.text(`${orders.length} ordres de travail`, rectX + 15, y + 24);
        doc.text(`${expenses.length} dépenses`, rectX + 95, y + 24);

        // Revenus
        doc.setFontSize(11).setFont(undefined, 'bold').setTextColor(0, 0, 0);
        doc.text('Revenus:', rectX + 15, y + 35);
        doc.setTextColor(22, 101, 52);
        doc.text(`${totalRev.toFixed(2)} €`, rectX + rectWidth - 15, y + 35, { align: 'right' });

        // Dépenses
        doc.setTextColor(0, 0, 0);
        doc.text('Dépenses:', rectX + 15, y + 43);
        doc.setTextColor(136, 19, 55);
        doc.text(`${totalExp.toFixed(2)} €`, rectX + rectWidth - 15, y + 43, { align: 'right' });

        y += boxHeight + spacing;

        // --- CADRE 2 : Ligne séparatrice ---
        doc.setFillColor(249, 250, 251);
        doc.setDrawColor(209, 213, 219);
        doc.setLineWidth(0.5);
        doc.roundedRect(rectX, y, rectWidth, 5, 2, 2, 'FD');

        y += 5 + spacing;

        // --- CADRE 3 : Solde ---
        const soldeColor = solde >= 0 ? [240, 255, 244] : [254, 242, 242];
        const soldeBorderColor = solde >= 0 ? [34, 197, 94] : [239, 68, 68];
        const soldeTextColor = solde >= 0 ? [22, 101, 52] : [185, 28, 28];

        doc.setFillColor(...soldeColor);
        doc.setDrawColor(...soldeBorderColor);
        doc.setLineWidth(0.5);
        doc.roundedRect(rectX, y, rectWidth, 20, 3, 3, 'FD');

        // Texte du solde centré verticalement et horizontalement
        doc.setFontSize(16).setFont(undefined, 'bold');
        doc.setTextColor(...soldeTextColor);
        doc.text('SOLDE:', rectX + 15, y + 13);
        doc.text(`${solde.toFixed(2)} €`, rectX + rectWidth - 15, y + 13, { align: 'right' });

        this.addModernFooter(doc);

        // Nom du fichier
        const filename = this.currentUser
            ? `${this.currentUser}_Bilan_Mensuel_${month}_${year}.pdf`
            : `Bilan_Mensuel_${month}_${year}.pdf`;
        doc.save(filename);
    }


    // ---- En-tête moderne ----
    addModernHeader(doc, title) {
        const info = this.companyInfo || {};
        const name = info.name || 'Votre Société';
        const pageWidth = doc.internal.pageSize.width;
        const bannerHeight = 45;
        const start = [30, 58, 138];
        const end = [59, 130, 246];

        for (let i = 0; i < bannerHeight; i++) {
            const ratio = i / bannerHeight;
            const r = Math.round(start[0] + (end[0] - start[0]) * ratio);
            const g = Math.round(start[1] + (end[1] - start[1]) * ratio);
            const b = Math.round(start[2] + (end[2] - start[2]) * ratio);
            doc.setFillColor(r, g, b);
            doc.rect(0, i, pageWidth, 1, 'F');
        }

        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(18);
        doc.text(name, pageWidth / 2, 22, { align: 'center' });
        doc.setFontSize(12).setFont(undefined, 'normal');
        doc.text(title, pageWidth / 2, 34, { align: 'center' });
        doc.setFontSize(8);
        doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - 20, 40, { align: 'right' });
        doc.setTextColor(0, 0, 0);
    }

    // ---- Infos société ----
    addModernCompanyInfo(doc) {
        const c = this.companyInfo || {};
        if (!c.name && !c.email && !c.phone) return;

        const pageWidth = doc.internal.pageSize.getWidth();
        const rectWidth = 170;
        const rectX = (pageWidth - rectWidth) / 2;
        let y = 60;

        doc.setFillColor(249, 250, 251);
        doc.setDrawColor(209, 213, 219);
        doc.roundedRect(rectX, y - 8, rectWidth, 28, 2, 2, 'F');
        doc.roundedRect(rectX, y - 8, rectWidth, 28, 2, 2, 'S');

        doc.setFontSize(10).setFont(undefined, 'bold').setTextColor(30, 58, 138);
        doc.text(c.name || 'Société', rectX + 5, y + 3);

        doc.setFontSize(8).setFont(undefined, 'normal').setTextColor(75, 85, 99);
        y += 8;
        const lines = [
            c.address,
            c.phone ? `Tél: ${c.phone}` : null,
            c.email ? `Email: ${c.email}` : null,
            c.siret ? `SIRET: ${c.siret}` : null,
            c.tva ? `TVA: ${c.tva}` : null
        ].filter(Boolean);

        lines.forEach(line => {
            doc.text(line, rectX + 7, y);
            y += 4;
        });
    }

    // ---- Pied de page ----
    addModernFooter(doc) {
        const c = this.companyInfo || {};
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const w = doc.internal.pageSize.width;
            const h = doc.internal.pageSize.height;
            doc.setDrawColor(226, 232, 240);
            doc.line(20, h - 20, w - 20, h - 20);
            doc.setFontSize(8).setTextColor(107, 114, 128);
            doc.text(`${c.name || ''} - Page ${i}/${pageCount}`, w / 2, h - 12, { align: 'center' });
        }
        doc.setTextColor(0, 0, 0);
    }
}
