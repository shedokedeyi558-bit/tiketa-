// Validate email
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password
export const validatePassword = (password) => {
  return password && password.length >= 8;
};

// Validate required fields
export const validateRequiredFields = (data, fields) => {
  for (const field of fields) {
    if (!data[field]) {
      return {
        valid: false,
        message: `${field} is required`,
      };
    }
  }
  return { valid: true };
};

// Validate event data
export const validateEventData = (data) => {
  const requiredFields = ['title', 'date', 'location', 'price'];
  return validateRequiredFields(data, requiredFields);
};

// Validate order data
export const validateOrderData = (data) => {
  const requiredFields = ['items', 'totalPrice'];
  return validateRequiredFields(data, requiredFields);
};
