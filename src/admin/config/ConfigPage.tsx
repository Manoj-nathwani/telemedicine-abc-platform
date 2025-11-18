import React, { useEffect, useState } from 'react';
import { Card, Alert, Button, Form, Row, Col } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { PageHeader, AutoForm } from '../../components';
import { useAction } from 'wasp/client/operations';
import { updateConfig } from 'wasp/client/operations';
import { useConfig } from '../../contexts/ConfigContext';
import {
  configFormFields,
  configToFormData,
  validateConfigUpdate,
  type ConfigUpdateData
} from './types';
import { ROUTES } from '../../routes';

const PAGE_WIDTH = 900;

export function ConfigPage() {
  const config = useConfig();
  const { t } = useTranslation();
  const updateConfigFn = useAction(updateConfig);
  const [formData, setFormData] = useState<ConfigUpdateData>({
    consultationDurationMinutes: config.consultationDurationMinutes,
    breakDurationMinutes: config.breakDurationMinutes,
    bufferTimeMinutes: config.bufferTimeMinutes,
    consultationSmsTemplates: config.consultationSmsTemplates,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setFormData(configToFormData(config));
  }, [config]);

  const handleFieldChange = (key: string, value: any) => {
    setFormData((prev: ConfigUpdateData) => ({ ...prev, [key]: value }));
  };

  const handleTemplateChange = (index: number, field: 'name' | 'body', value: string) => {
    setFormData((prev) => {
      const templates = [...prev.consultationSmsTemplates];
      templates[index] = { ...templates[index]!, [field]: value };
      return { ...prev, consultationSmsTemplates: templates };
    });
  };

  const handleAddTemplate = () => {
    setFormData((prev) => ({
      ...prev,
      consultationSmsTemplates: [...prev.consultationSmsTemplates, { name: '', body: '' }]
    }));
  };

  const handleRemoveTemplate = (index: number) => {
    setFormData((prev) => {
      // Prevent deletion if it would result in 0 templates
      if (prev.consultationSmsTemplates.length <= 1) {
        return prev;
      }
      const templates = [...prev.consultationSmsTemplates];
      templates.splice(index, 1);
      return { ...prev, consultationSmsTemplates: templates };
    });
  };

  const handleMoveTemplate = (index: number, direction: 'up' | 'down') => {
    setFormData((prev) => {
      const templates = [...prev.consultationSmsTemplates];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= templates.length) return prev;
      [templates[index], templates[newIndex]] = [templates[newIndex]!, templates[index]!];
      return { ...prev, consultationSmsTemplates: templates };
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const validatedData = validateConfigUpdate(formData);
      await updateConfigFn(validatedData);
      setSuccess('Configuration updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader title={t(ROUTES.config.labelKey)} />
      <div style={{ maxWidth: PAGE_WIDTH }}>
        {success && <Alert variant="success" dismissible onClose={() => setSuccess('')} className="mt-3">{success}</Alert>}
        {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="mt-3">{error}</Alert>}
      </div>
      <Card className="shadow-sm mt-3">
        <Card.Body style={{ maxWidth: PAGE_WIDTH }}>
          <AutoForm
            fields={configFormFields}
            values={formData}
            onChange={handleFieldChange}
            isSubmitting={loading}
          />
        </Card.Body>
      </Card>

      <Card className="shadow-sm mt-3">
        <Card.Body style={{ maxWidth: PAGE_WIDTH }}>
          <h5 className="mb-3">SMS Templates</h5>
          {formData.consultationSmsTemplates.map((template, index) => {
            const hasMultipleTemplates = formData.consultationSmsTemplates.length > 1;
            return (
              <Row key={index} className="mb-2">
                {hasMultipleTemplates && (
                  <Col xs="auto">
                    <div className="d-flex gap-1">
                      <Button
                        variant="link"
                        className="p-0 text-decoration-none my-2"
                        onClick={() => handleMoveTemplate(index, 'up')}
                        disabled={index === 0 || loading}
                        style={{ minWidth: '30px', lineHeight: '1' }}
                      >
                        ⬆️
                      </Button>
                      <Button
                        variant="link"
                        className="p-0 text-decoration-none my-2"
                        onClick={() => handleMoveTemplate(index, 'down')}
                        disabled={index === formData.consultationSmsTemplates.length - 1 || loading}
                        style={{ minWidth: '30px', lineHeight: '1' }}
                      >
                        ⬇️
                      </Button>
                    </div>
                  </Col>
                )}
                <Col xs={3}>
                  <Form.Control
                    type="text"
                    value={template.name}
                    onChange={(e) => handleTemplateChange(index, 'name', e.target.value)}
                    placeholder="Template name"
                    disabled={loading}
                  />
                </Col>
                <Col>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={template.body}
                    onChange={(e) => handleTemplateChange(index, 'body', e.target.value)}
                    placeholder="Template body (use {consultationTime} for time)"
                    disabled={loading}
                  />
                </Col>
                {hasMultipleTemplates && (
                  <Col xs="auto">
                    <Button
                      variant="link"
                      className="p-0 text-danger text-decoration-none my-2"
                      onClick={() => handleRemoveTemplate(index)}
                      disabled={loading}
                      style={{ minWidth: '30px', lineHeight: '1' }}
                    >
                      ❌
                    </Button>
                  </Col>
                )}
              </Row>
            );
          })}
          <Button variant="link" className="text-decoration-none" onClick={handleAddTemplate} disabled={loading}>
            + new template
          </Button>
        </Card.Body>
      </Card>

      <div className="mt-3" style={{ maxWidth: PAGE_WIDTH }}>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </>
  );
} 