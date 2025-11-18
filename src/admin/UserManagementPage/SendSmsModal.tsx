import React, { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { useAction, sendSmsMessage } from 'wasp/client/operations';
import { z } from 'zod';

const smsSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required').regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format'),
  body: z.string().min(1, 'Message is required').max(160, 'Message must be 160 characters or less')
});

interface SendSmsModalProps {
  show: boolean;
  onHide: () => void;
}

export function SendSmsModal({ show, onHide }: SendSmsModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendSmsMessageFn = useAction(sendSmsMessage);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const validatedData = smsSchema.parse({ phoneNumber, body: message });
      await sendSmsMessageFn(validatedData);
      
      // Reset form and close modal
      setPhoneNumber('');
      setMessage('');
      onHide();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0]?.message || 'Validation error');
      } else {
        setError(err.message || 'Failed to send SMS message');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setPhoneNumber('');
      setMessage('');
      setError(null);
      onHide();
    }
  };

  return (
    <Modal show={show} onHide={handleClose} backdrop={isSubmitting ? 'static' : true}>
      <Modal.Header closeButton={!isSubmitting}>
        <Modal.Title>Send SMS Message</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form.Group className="mb-3">
            <Form.Label>Phone Number</Form.Label>
            <Form.Control
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter phone number"
              required
              disabled={isSubmitting}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Message</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message"
              required
              disabled={isSubmitting}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send Message'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
} 