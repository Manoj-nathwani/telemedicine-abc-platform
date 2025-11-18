import React, { useState } from 'react';
import { useAction, createConsultationRequest } from 'wasp/client/operations';
import { Modal, Form, Button, Alert } from 'react-bootstrap';

interface CreateConsultationRequestModalProps {
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
}

export function CreateConsultationRequestModal({ show, onHide, onSuccess }: CreateConsultationRequestModalProps) {
  const createConsultationRequestFn = useAction(createConsultationRequest);
  const [formData, setFormData] = useState({ phoneNumber: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createConsultationRequestFn({
        phoneNumber: formData.phoneNumber,
        message: formData.message
      });

      // Reset form and close modal
      setFormData({ phoneNumber: '', message: '' });
      onHide();
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to create consultation request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Create Consultation Request</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          )}
          <Form.Group className="mb-3">
            <Form.Label>Phone Number</Form.Label>
            <Form.Control
              type="tel"
              placeholder="Enter phone number"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              required={process.env.NODE_ENV === 'production'}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Message</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              placeholder="Enter consultation request message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              required={process.env.NODE_ENV === 'production'}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Request'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
