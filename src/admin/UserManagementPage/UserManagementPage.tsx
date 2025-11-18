import React, { useState } from 'react';
import { useQuery, useAction, getUsers, updateUserRole, resendInvitation, updateUserAvailabilityEnabled } from 'wasp/client/operations';
import { Row, Col, Card, Button, Table, Alert, Form } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { PageHeader, UserDisplay, Loading } from '../../components';
import { UserRole } from '../../auth/types';
import { InviteUserModal } from '../InviteUserModal';
import { ROUTES } from '../../routes';

export function UserManagementPage() {
  const { data: users, isLoading, error, refetch } = useQuery(getUsers);
  const { t } = useTranslation();
  const updateUserRoleFn = useAction(updateUserRole);
  const updateUserAvailabilityEnabledFn = useAction(updateUserAvailabilityEnabled);
  const resendInvitationFn = useAction(resendInvitation);

  const [showModal, setShowModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [availabilityUpdatingId, setAvailabilityUpdatingId] = useState<number | null>(null);

  const handleShowModal = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleUserCreated = () => {
    setSuccessMsg('User invited successfully! They will receive an email to set their password.');
    refetch();
  };



  const handleRoleChange = async (userId: number, newRole: string) => {
    setUpdatingId(userId);
    try {
      await updateUserRoleFn({ userId, role: newRole as UserRole });
      setSuccessMsg('User role updated successfully.');
      refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to update user role.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResendInvitation = async (userId: number) => {
    setResendingId(userId);
    try {
      await resendInvitationFn({ userId });
      setSuccessMsg('Invitation email sent successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to send invitation email.');
    } finally {
      setResendingId(null);
    }
  };

  const handleAvailabilityToggle = async (userId: number, enabled: boolean) => {
    setAvailabilityUpdatingId(userId);
    try {
      await updateUserAvailabilityEnabledFn({ userId, canHaveAvailability: enabled });
      setSuccessMsg('Availability permissions updated successfully.');
      refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to update availability permissions.');
    } finally {
      setAvailabilityUpdatingId(null);
    }
  };

  if (isLoading) return <Loading />;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <>
      <Row>
        <Col>
          <PageHeader title={t(ROUTES.userManagement.labelKey)}>
            <Button variant="primary" onClick={handleShowModal}>
              <i className="bi bi-plus-circle me-2"></i>
              Invite User
            </Button>
          </PageHeader>

          {successMsg && (
            <Alert variant="success" dismissible onClose={() => setSuccessMsg('')}>
              {successMsg}
            </Alert>
          )}

          <Card className="shadow-sm">
            <Card.Body>
              <Table responsive bordered className="mb-0 align-middle small">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Availability</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={5}><Loading /></td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={5}>No users found.</td></tr>
                  ) : (
                    users.map((user: any) => (
                      <tr key={user.id}>
                        <td><UserDisplay user={user} /></td>
                        <td>{user.email || '-'}</td>
                        <td>
                          {Object.values(UserRole).includes(user.role as UserRole) ? (
                            <Form.Select
                              size="sm"
                              value={user.role}
                              disabled={updatingId === user.id}
                              onChange={e => handleRoleChange(user.id, e.target.value)}
                            >
                              {Object.values(UserRole).map(role => (
                                <option key={role} value={role}>
                                  {role.charAt(0).toUpperCase() + role.slice(1)}
                                </option>
                              ))}
                            </Form.Select>
                          ) : (
                            <span className="text-muted text-capitalize">{user.role}</span>
                          )}
                        </td>
                        <td>
                          <Form.Check
                            type="switch"
                            id={`availability-${user.id}`}
                            label={(user.canHaveAvailability ?? true) ? 'Enabled' : 'Disabled'}
                            checked={user.canHaveAvailability ?? true}
                            disabled={availabilityUpdatingId === user.id || user.role === 'system'}
                            onChange={e => handleAvailabilityToggle(user.id, e.target.checked)}
                          />
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handleResendInvitation(user.id)}
                              disabled={resendingId === user.id}
                            >
                              <i className="bi bi-envelope me-2"></i>
                              {resendingId === user.id ? 'Sending...' : 'Resend Invitation'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <InviteUserModal
        show={showModal}
        onHide={handleCloseModal}
        onSuccess={handleUserCreated}
      />
    </>
  );
} 