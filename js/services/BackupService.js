export class BackupService {
    constructor(storageService) {
        this.storage = storageService;
    }

    async exportData() {
        const orders = await this.storage.getAll('orders');
        const expenses = await this.storage.getAll('expenses');

        const backup = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            data: {
                orders,
                expenses
            }
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const date = new Date();
        const filename = `OT_Backup_${date.getMonth() + 1}-${date.getFullYear()}.json`;

        // ---------- Sauvegarde locale (téléchargement) ----------
        if (window.saveAs) {
            window.saveAs(blob, filename);
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }

        // ---------- Sauvegarde NAS via Flask ----------
        try {
            const text = await blob.text();
            const jsonContent = JSON.parse(text);
            const result = await backupToServer(filename, jsonContent);
            console.log('Sauvegarde NAS terminée :', result);
        } catch (err) {
            console.error('Erreur lors de la sauvegarde NAS :', err);
        }
    }


    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const backup = JSON.parse(e.target.result);

                    if (!backup.version || !backup.data) {
                        throw new Error('Format de sauvegarde invalide');
                    }

                    const existingOrders = await this.storage.getAll('orders');
                    const existingExpenses = await this.storage.getAll('expenses');

                    const existingOrderIds = new Set(existingOrders.map(o => o.id));
                    const existingExpenseIds = new Set(existingExpenses.map(e => e.id));

                    let importedOrders = 0;
                    let importedExpenses = 0;

                    for (const order of backup.data.orders) {
                        if (!existingOrderIds.has(order.id)) {
                            await this.storage.add('orders', order);
                            importedOrders++;
                        }
                    }

                    for (const expense of backup.data.expenses) {
                        if (!existingExpenseIds.has(expense.id)) {
                            await this.storage.add('expenses', expense);
                            importedExpenses++;
                        }
                    }

                    resolve({ importedOrders, importedExpenses });
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
            reader.readAsText(file);
        });
    }

    async clearAllData() {
        await this.storage.clear('orders');
        await this.storage.clear('expenses');
    }
}

// ---------- Sauvegarde sur le serveur Flask ----------
export async function backupToServer(filename, backup) {
    try {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: filename,
                content: backup  // le même objet que tu exportes localement
            })
        });

        const result = await response.json();
        console.log('Backup vers serveur NAS:', result);
        return result;
    } catch (error) {
        console.error('Erreur lors du backup NAS:', error);
        return { error: error.message };
    }
}

