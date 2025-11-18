import React from 'react';
import { Form, Button, Badge } from 'react-bootstrap';
import { FormFieldRenderer, isFieldFilled } from './FormFieldRenderer';

export type FormFieldConfig = {
  key: string;
  label: string;
  type: 'number' | 'text' | 'email' | 'textarea' | 'select' | 'dateSelects' | 'checkboxes' | 'custom';
  min?: number;
  max?: number;
  description?: string;
  rows?: number;
  options?: { value: string; label: string }[];
  checks?: string[];
  disabled?: boolean;
  customRender?: (field: FormFieldConfig, values: Record<string, any>, onChange: (key: string, value: any) => void) => React.ReactNode;
};

type AutoFormProps = {
  fields: readonly FormFieldConfig[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  errors?: Record<string, string>;
  progressive?: boolean;
  onSubmit?: (() => void | Promise<void>) | undefined;
  isSubmitting?: boolean;
  submitLabel?: string;
  numberFields?: boolean;
};

export function AutoForm({ fields, values, onChange, errors, progressive = false, onSubmit, isSubmitting = false, submitLabel = "Save", numberFields = false }: AutoFormProps) {
  // Progressive mode: determine current field index
  const getCurrentFieldIndex = () => {
    if (!progressive) return fields.length;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (!field) continue;

      const value = values[field.key];

      if (!isFieldFilled(field, value, values)) {
        return i;
      }
    }
    return fields.length;
  };

  const currentFieldIndex = getCurrentFieldIndex();

  return (
    <div>
      {
        fields.map((field, index) => {
          const isCurrentOrPrevious = index <= currentFieldIndex;
          const opacity = progressive && !isCurrentOrPrevious ? 'opacity-25' : '';
          const isDisabled = progressive && !isCurrentOrPrevious;

          return (
            <Form.Group
              key={field.key}
              className={`mb-4 ${opacity}`}
            >
              <Form.Label>
                {numberFields && <Badge bg="primary" className="me-2">{index + 1}</Badge>}
                {field.label}
              </Form.Label>
              {field.type === 'custom' && field.customRender ? (
                field.customRender(field, values, onChange)
              ) : (
                <FormFieldRenderer
                  field={{ ...field, disabled: field.disabled || isDisabled }}
                  value={values[field.key]}
                  onChange={(value) => onChange(field.key, value)}
                  error={errors?.[field.key] || undefined}
                />
              )}
              {field.description && (
                <div className="mt-1 mb-2 small text-muted">
                  <Form.Text>{field.description}</Form.Text>
                </div>
              )}
              {errors?.[field.key] && (
                <Form.Control.Feedback type="invalid" className="d-block">
                  {errors[field.key]}
                </Form.Control.Feedback>
              )}
            </Form.Group>
          );
        })
      }

      {/* Show submit button if onSubmit is provided */}
      {onSubmit && (
        <div className={`mt-4 ${progressive && currentFieldIndex < fields.length ? 'opacity-25' : ''}`}>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={isSubmitting || (progressive && currentFieldIndex < fields.length)}
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </div>
      )}
    </div >
  );
}