import { useState, useCallback } from 'react';

export const useFormValidation = (rules = {}) => {
  const [errors, setErrors] = useState({});

  const validate = useCallback((formData) => {
    const newErrors = {};

    Object.entries(rules).forEach(([field, fieldRules]) => {
      const value = formData[field];

      for (const rule of fieldRules) {
        if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
          newErrors[field] = rule.message || `${field} is required`;
          break;
        }
        if (rule.minLength && value && value.length < rule.minLength) {
          newErrors[field] = rule.message || `${field} must be at least ${rule.minLength} characters`;
          break;
        }
        if (rule.pattern && value && !rule.pattern.test(value)) {
          newErrors[field] = rule.message || `${field} is invalid`;
          break;
        }
        if (rule.min !== undefined && value !== '' && Number(value) < rule.min) {
          newErrors[field] = rule.message || `${field} must be at least ${rule.min}`;
          break;
        }
        if (rule.max !== undefined && value !== '' && Number(value) > rule.max) {
          newErrors[field] = rule.message || `${field} must be at most ${rule.max}`;
          break;
        }
        if (rule.custom && !rule.custom(value, formData)) {
          newErrors[field] = rule.message || `${field} is invalid`;
          break;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [rules]);

  const clearError = useCallback((field) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  return { errors, validate, clearError, setErrors };
};
