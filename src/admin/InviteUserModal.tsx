import React, { useState } from 'react';
import { useAction, createUser } from 'wasp/client/operations';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { UserRole } from '../auth/types';

interface InviteUserModalProps {
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
}

export function InviteUserModal({ show, onHide, onSuccess }: InviteUserModalProps) {
  const createUserFn = useAction(createUser);
  
  const [form, setForm] = useState<{ name: string; email: string; role: UserRole }>({ 
    name: '', 
    email: '', 
    role: UserRole.clinician 
  });
  const [formError, setFormError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCloseModal = () => {
    setForm({ name: '', email: '', role: UserRole.clinician });
    setFormError('');
    onHide();
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError('');
    try {
      await createUserFn(form);
      onSuccess();
      handleCloseModal();
    } catch (err: any) {
      setFormError(err.message || 'Failed to invite user.');
    }
  };

  return (
    <Modal show={show} onHide={handleCloseModal} centered>
      <Modal.Header closeButton>
        <Modal.Title>Invite New User</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleCreateUser}>
        <Modal.Body>
          {formError && <Alert variant="danger">{formError}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control
              name="name"
              value={form.name}
              onChange={handleInputChange}
              placeholder="Full name"
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control
              name="email"
              type="email"
              value={form.email}
              onChange={handleInputChange}
              placeholder="user@email.com"
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Role</Form.Label>
            <Form.Select name="role" value={form.role} onChange={handleSelectChange}>
              {Object.values(UserRole).map(role => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <div className="text-muted small">
            The user will receive an invitation email to set their password and can then log in.
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
          <Button variant="primary" type="submit">Invite</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
} 