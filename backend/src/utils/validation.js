// Utilidades de validación y manejo de datos seguros

/**
 * Convierte un valor a número de forma segura, retornando null si no es válido
 */
export const safeNumber = (value, defaultValue = null) => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
};

/**
 * Convierte un valor a entero de forma segura
 */
export const safeInt = (value, defaultValue = null) => {
  const num = safeNumber(value);
  if (num === null) return defaultValue;
  return Math.floor(num);
};

/**
 * Valida que un ID sea un número positivo
 */
export const validateId = (id, fieldName = 'ID') => {
  const num = safeInt(id);
  if (num === null || num <= 0) {
    throw new Error(`${fieldName} debe ser un número positivo`);
  }
  return num;
};

/**
 * Valida formato de email básico
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    throw new Error('Email es requerido');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Formato de email inválido');
  }
  return email.trim().toLowerCase();
};

/**
 * Valida formato de matrícula
 */
export const validateMatricula = (matricula) => {
  if (!matricula || typeof matricula !== 'string') {
    throw new Error('Matrícula es requerida');
  }
  const trimmed = matricula.trim();
  if (trimmed.length === 0) {
    throw new Error('Matrícula no puede estar vacía');
  }
  return trimmed;
};

/**
 * Valida que un string no esté vacío
 */
export const validateNonEmptyString = (value, fieldName = 'Valor') => {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} es requerido`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} no puede estar vacío`);
  }
  return trimmed;
};

/**
 * Valida que un valor esté en un array de opciones permitidas
 */
export const validateEnum = (value, allowedValues, fieldName = 'Valor') => {
  if (!allowedValues.includes(value)) {
    throw new Error(`${fieldName} debe ser uno de: ${allowedValues.join(', ')}`);
  }
  return value;
};

/**
 * Realiza división de forma segura, evitando división por cero
 */
export const safeDivision = (numerator, denominator, defaultValue = 0) => {
  const num = safeNumber(numerator, 0);
  const den = safeNumber(denominator, 0);
  if (den === 0) return defaultValue;
  return num / den;
};

/**
 * Calcula promedio de forma segura, manejando arrays vacíos y valores nulos
 */
export const safeAverage = (values, defaultValue = null) => {
  if (!Array.isArray(values) || values.length === 0) {
    return defaultValue;
  }
  const validNumbers = values
    .map(v => safeNumber(v))
    .filter(n => n !== null);
  
  if (validNumbers.length === 0) {
    return defaultValue;
  }
  
  const sum = validNumbers.reduce((acc, val) => acc + val, 0);
  return sum / validNumbers.length;
};

/**
 * Valida que un array no esté vacío
 */
export const validateNonEmptyArray = (array, fieldName = 'Array') => {
  if (!Array.isArray(array)) {
    throw new Error(`${fieldName} debe ser un array`);
  }
  if (array.length === 0) {
    throw new Error(`${fieldName} no puede estar vacío`);
  }
  return array;
};

/**
 * Obtiene valor de objeto de forma segura con optional chaining
 */
export const safeGet = (obj, path, defaultValue = null) => {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === null || result === undefined) {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result === null || result === undefined ? defaultValue : result;
};

/**
 * Valida parámetros requeridos en un objeto
 */
export const validateRequiredParams = (params, requiredFields) => {
  const missing = requiredFields.filter(field => {
    const value = params[field];
    return value === null || value === undefined || value === '';
  });
  
  if (missing.length > 0) {
    throw new Error(`Faltan parámetros requeridos: ${missing.join(', ')}`);
  }
  
  return true;
};
