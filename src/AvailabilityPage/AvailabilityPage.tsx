import React, { useState } from 'react';
import { useQuery } from 'wasp/client/operations';
import { getAvailabilityGrid } from 'wasp/client/operations';
import { Row, Col, Table, Card, Button, Badge } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useAuth } from 'wasp/client/auth';
import { DatePageWrapper, Loading } from '../components';
import { EditAvailabilityOffcanvas } from '../components/EditAvailabilityOffcanvas/EditAvailabilityOffcanvas';
import { toTimeInput, now, isPast, isSameDay } from '../utils/dateTime';
import { getConsultationStatusFromCalls } from '../consultations/types';
import { getConsultationUrl, ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { isAdmin } from '../utils/auth/client';

export function AvailabilityPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: user } = useAuth();
  const [showEditOffcanvas, setShowEditOffcanvas] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined);

  if (!user) return <Loading />;

  const userIsAdmin = isAdmin(user);

  const handleEditAvailability = (userId: number) => {
    setSelectedUserId(userId);
    setShowEditOffcanvas(true);
  };

  const handleEditSuccess = () => {
    // Refetch the availability data
    window.location.reload();
  };

  const getCellContent = (userSlot: any, userItem: any, viewedDate: Date) => {
    const cellStyle = { width: '120px' };

    if (!userSlot) {
      return <td key={userItem.id} className="bg-light text-muted text-center" style={cellStyle}>-</td>;
    }

    if (userSlot.consultation) {
      const { color: statusColor } = getConsultationStatusFromCalls(userSlot.consultation?.calls || []);
      return (
        <td key={userItem.id} className={`text-center bg-${statusColor}`} style={cellStyle}>
          <Button
            variant="link"
            className="text-dark expand-on-hover"
            onClick={() => navigate(getConsultationUrl(userSlot.consultation.id))}
          >
            Consultation #{userSlot.consultation.id}
          </Button>
        </td>
      );
    }

    // Slot exists but no consultation - only mark as expired if viewing today and slot is in the past
    const isViewingToday = isSameDay(viewedDate, now());
    const isExpired = isViewingToday && isPast(userSlot.startDateTime);
    return (
      <td key={userItem.id} className={`text-center bg-${isExpired ? 'secondary' : 'success'}-subtle`} style={cellStyle}>
        {isExpired ? 'Expired' : 'Available'}
      </td>
    );
  };

  return (
    <Row>
      <Col>
        <DatePageWrapper title={t(ROUTES.availability.labelKey)}>
          {({ getDateString, currentDate: dateFromWrapper }) => {
            const { data: availabilityData, isLoading, error } = useQuery(getAvailabilityGrid, {
              date: getDateString()
            });

            if (isLoading) return <Loading />;
            if (error) return <div>Error: {error.message}</div>;

            const users = availabilityData?.users || [];
            const slots = availabilityData?.slots || [];

            // Use centralized dateTime.ts for robust UTC time parsing/formatting
            const periods = new Map();
            slots.forEach((s: any) => {
              const startTime = toTimeInput(s.startDateTime);
              const endTime = toTimeInput(s.endDateTime);
              const slotId = `${startTime}-${endTime}`;
              if (!periods.has(slotId)) {
                periods.set(slotId, { slotId, startTime, endTime, period: `${startTime} - ${endTime}` });
              }
            });
            const allTimeSlots = Array.from(periods.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));

            const findUserSlot = (userId: number, slotId: string) =>
              slots.find((s: any) => {
                const startTime = toTimeInput(s.startDateTime);
                const endTime = toTimeInput(s.endDateTime);
                const key = `${startTime}-${endTime}`;
                return s.user.id === userId && key === slotId;
              });

            return (
              <>
                <Card className="shadow-sm">
                  <Card.Body>
                    <Table responsive bordered className="mb-0 small">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '150px' }}>Time Slot</th>
                          {users.map((userItem: any) => (
                            <th key={userItem.id} className="text-center p-0 align-top" style={{ width: '120px' }}>
                              <div className="">
                                <div className="mt-2">{userItem.name}</div>
                                {(userIsAdmin || userItem.id === user.id) && (
                                  <Button
                                    variant="link"
                                    className="px-3 py-1 small text-decoration-none expand-on-hover"
                                    onClick={() => handleEditAvailability(userItem.id)}
                                  >
                                    Edit Availability
                                  </Button>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allTimeSlots.length === 0 ? (
                          <tr>
                            <td colSpan={users.length + 1} className="text-center text-muted py-4">
                              No availability for this day
                            </td>
                          </tr>
                        ) : (
                          allTimeSlots.map((slot) => (
                            <tr key={slot.slotId}>
                              <td className="text-muted">{slot.period}</td>
                              {users.map((userItem: any) => {
                                const userSlot = findUserSlot(userItem.id, slot.slotId);
                                return getCellContent(userSlot, userItem, dateFromWrapper);
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>

                {showEditOffcanvas && selectedUserId !== undefined && (
                  <EditAvailabilityOffcanvas
                    show={showEditOffcanvas}
                    onHide={() => setShowEditOffcanvas(false)}
                    currentDate={dateFromWrapper}
                    userId={selectedUserId}
                    onSuccess={handleEditSuccess}
                  />
                )}
              </>
            );
          }}
        </DatePageWrapper>
      </Col>
    </Row>
  );
} 