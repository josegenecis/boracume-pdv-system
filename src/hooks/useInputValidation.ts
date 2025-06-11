
import { useState } from 'react';
import { z } from 'zod';

export const useInputValidation = <T>(schema: z.ZodSchema<T>) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (data: any): data is T => {
    try {
      schema.parse(data);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          newErrors[path] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const validateField = (fieldName: string, value: any, fieldSchema: z.ZodSchema<any>) => {
    try {
      fieldSchema.parse(value);
      setErrors(prev => ({ ...prev, [fieldName]: '' }));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, [fieldName]: error.errors[0]?.message || 'Invalid input' }));
      }
      return false;
    }
  };

  const clearErrors = () => setErrors({});

  return { validate, validateField, errors, clearErrors };
};
