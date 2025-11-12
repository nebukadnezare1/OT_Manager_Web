export const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

export const validatePhone = (phone) => {
    const re = /^[\d\s\-\+\(\)]+$/;
    return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

export const validateAmount = (amount) => {
    return !isNaN(amount) && amount > 0;
};

export const validateRequired = (value) => {
    return value && value.toString().trim().length > 0;
};

export const validatePassword = (password) => {
    return password.length >= 6;
};
