import React from 'react';
import { useQuery } from 'wasp/client/operations';
import { Offcanvas } from 'react-bootstrap';
import { getUserById } from 'wasp/client/operations';
import { Loading } from '../Loading';
import DataField from '../DataField';
import { USER_ROLE_LABELS } from '../../auth/types';
import { format } from '../../utils/dateTime';

interface UserInfoOffcanvasProps {
  show: boolean;
  onHide: () => void;
  userId: number;
}

export function UserInfoOffcanvas({ show, onHide, userId }: UserInfoOffcanvasProps) {
  const { data: user, isLoading, error } = useQuery(getUserById, { userId });

  return (
    <Offcanvas show={show} onHide={onHide} placement="end">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>User Information</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {isLoading ? (
          <div className="text-center"><Loading /></div>
        ) : error ? (
          <div className="text-danger">Error loading user: {error.message}</div>
        ) : user ? (
          <DataField
            data={[
              ['Name', user.name],
              ['Email', user.email || '-'],
              ['Role', USER_ROLE_LABELS[user.role as keyof typeof USER_ROLE_LABELS] || user.role],
              ['Created', format(user.createdAt)]
            ]}
          />
        ) : null}
      </Offcanvas.Body>
    </Offcanvas>
  );
}

