export const filterByDate = (items, dateFrom, dateTo) => {
    return items.filter(item => {
        const itemDate = new Date(item.date);
        const from = dateFrom ? new Date(dateFrom) : null;
        const to = dateTo ? new Date(dateTo) : null;

        if (from && itemDate < from) return false;
        if (to && itemDate > to) return false;
        return true;
    });
};

export const filterByCategory = (items, category) => {
    if (!category) return items;
    return items.filter(item => item.category === category);
};

export const filterBySearch = (items, searchTerm, fields = ['designation', 'description']) => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();

    return items.filter(item => {
        return fields.some(field => {
            const value = item[field];
            return value && value.toString().toLowerCase().includes(term);
        });
    });
};

export const sortItems = (items, sortBy, sortOrder = 'asc') => {
    return [...items].sort((a, b) => {
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
};
