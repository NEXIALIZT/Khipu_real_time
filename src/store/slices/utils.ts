export const generateRandomId = () => Math.random().toString(36).substring(2, 8).padEnd(6, 'X').toUpperCase();
export const generateGuestName = () => `Invitado-${Math.floor(100 + Math.random() * 900)}`;
