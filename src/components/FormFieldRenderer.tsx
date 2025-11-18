import React from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select';
import { now, getYear } from '../utils/dateTime';
import { FormFieldConfig } from './AutoForm';

// Helper function to check if a field has a value
export function isFieldFilled(field: FormFieldConfig, value: any, allValues?: Record<string, any>): boolean {
  switch (field.type) {
    case 'checkboxes':
      if (!Array.isArray(value)) return false;
      // If field has checks defined, all checks must be selected
      if (field.checks && field.checks.length > 0) {
        return value.length === field.checks.length;
      }
      // Otherwise, just check if any checkboxes are selected
      return value.length > 0;
    case 'dateSelects':
      if (!value) return false;
      const parts = value.split('-');
      return parts.length === 3 && parts.every((part: string) => part && part.trim() !== '');
    case 'custom':
      // For patient selection field, check both selectedPatientId and pendingPatientName
      if (field.key === 'selectedPatientId' && allValues) {
        return allValues.selectedPatientId !== null || allValues.pendingPatientName !== null;
      }
      return value !== '' && value !== null && value !== undefined;
    default:
      return value !== '' && value !== null && value !== undefined;
  }
}

// Helper function to validate a field's value
export function validateField(field: FormFieldConfig, value: any, allValues?: Record<string, any>): string | undefined {
  // Check if required field is empty
  if (!isFieldFilled(field, value, allValues)) {
    return `${field.label} is required`;
  }

  // Type-specific validation
  switch (field.type) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address';
      }
      break;
    
    case 'number':
      if (field.min !== undefined && value < field.min) {
        return `Value must be at least ${field.min}`;
      }
      if (field.max !== undefined && value > field.max) {
        return `Value must be at most ${field.max}`;
      }
      break;

    case 'checkboxes':
      // If field has checks defined, all checks must be selected
      if (field.checks && field.checks.length > 0) {
        const allChecked = field.checks.every(check => value.includes(check));
        if (!allChecked) {
          return `All ${field.label.toLowerCase()} must be completed`;
        }
      }
      break;
  }

  return undefined;
}

// Helper function to validate all fields in a form
export function validateForm(fields: readonly FormFieldConfig[], values: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {};
  
  for (const field of fields) {
    const error = validateField(field, values[field.key], values);
    if (error) {
      errors[field.key] = error;
    }
  }
  
  return errors;
}

// Helper function to check if all fields in a form are filled
export function areAllFieldsFilled(fields: readonly FormFieldConfig[], values: Record<string, any>): boolean {
  return fields.every(field => isFieldFilled(field, values[field.key], values));
}

type FormFieldRendererProps = {
  field: FormFieldConfig;
  value: any;
  onChange: (value: any) => void;
  error: string | undefined;
};

const dateSelectOptions = {
  days: Array.from({ length: 31 }, (_, i) => i + 1).map(day => ({
    value: day.toString().padStart(2, '0'),
    label: day.toString()
  })),
  months: [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" }
  ],
  years: Array.from({ length: 100 }, (_, i) => getYear(now()) - i).map(year => ({
    value: year.toString(),
    label: year.toString()
  }))
};

export function FormFieldRenderer({ field, value, onChange, error }: FormFieldRendererProps) {
  switch (field.type) {
    case 'custom':
      // For custom fields, we need to provide all values and the full onChange function
      // This is a special case where the component handles everything
      return null;

    case 'textarea':
      return (
        <Form.Control
          as="textarea"
          rows={field.rows || 4}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          isInvalid={!!error}
          disabled={field.disabled || false}
          className={field.disabled ? "bg-light" : ""}
          required
        />
      );

    case 'select':
      return (
        <Form.Select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          isInvalid={!!error}
          disabled={field.disabled || false}
          className={`w-auto ${field.disabled ? "bg-light" : ""}`}
          required
        >
          {field.options?.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Form.Select>
      );

    case 'dateSelects':
      const dateValue = value || '';
      const dateParts = dateValue.split('-');
      
      const createDateSelect = (type: 'year' | 'month' | 'day', index: number) => {
        const options = dateSelectOptions[type === 'year' ? 'years' : type === 'month' ? 'months' : 'days'];
        const selectValue = dateParts[index];
        const placeholder = type.charAt(0).toUpperCase() + type.slice(1);
        
        const getValue = () => {
          if (!selectValue) return null;
          if (type === 'month') {
            return { value: selectValue, label: options.find(opt => opt.value === selectValue)?.label };
          }
          return { value: selectValue, label: selectValue };
        };
        
        const handleChange = (option: any) => {
          const newParts = [...dateParts];
          newParts[index] = option?.value || '';
          onChange(newParts.join('-'));
        };
        
        return (
          <Select
            key={type}
            placeholder={placeholder}
            value={getValue()}
            onChange={handleChange}
            options={options}
            isSearchable
            isDisabled={field.disabled}
            className={error ? "border-danger" : ""}
            components={{
              IndicatorSeparator: () => null
            }}
          />
        );
      };
      
      return (
        <>
          <div className="d-flex gap-2">
            {createDateSelect('day', 2)}
            {createDateSelect('month', 1)}
            {createDateSelect('year', 0)}
          </div>
          {error && (
            <div className="invalid-feedback d-block">
              {error}
            </div>
          )}
        </>
      );

    case 'checkboxes':
      const checkedValues = value || [];
      return (
        <>
          {field.checks?.map((check, i) => (
            <div key={i} className="form-check mb-2">
              <input
                type="checkbox"
                className={`form-check-input ${error ? "border-danger" : ""}`}
                id={`${field.key}-${i}`}
                checked={checkedValues.includes(check)}
                disabled={field.disabled || false}
                onChange={() => {
                  const newChecks = checkedValues.includes(check)
                    ? checkedValues.filter((v: string) => v !== check)
                    : [...checkedValues, check];
                  onChange(newChecks);
                }}
              />
              <label className="form-check-label" htmlFor={`${field.key}-${i}`}>
                {check}
              </label>
            </div>
          ))}
          {error && (
            <div className="invalid-feedback d-block">
              {error}
            </div>
          )}
        </>
      );

    case 'number':
    case 'text':
    case 'email':
      return (
        <Form.Control
          type={field.type}
          min={field.min}
          max={field.max}
          value={value || ''}
          onChange={(e) => {
            const val = field.type === 'number' ? Number(e.target.value) : e.target.value;
            onChange(val);
          }}
          isInvalid={!!error}
          disabled={field.disabled || false}
          className={field.disabled ? "bg-light" : ""}
          required
        />
      );

    default:
      return null;
  }
}