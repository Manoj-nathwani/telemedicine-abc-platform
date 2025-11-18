import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Row, Col, Button, ListGroup, ListGroupItem, Card } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { format, isPast, isSameDay, isAfter, now } from '../utils/dateTime';
import { EditAvailabilityOffcanvas } from '../components/EditAvailabilityOffcanvas/EditAvailabilityOffcanvas';
import { DatePageWrapper, Loading } from '../components';
import type { Slot } from '@prisma/client';
import { getConsultationUrl, ROUTES } from '../routes';
import { useQuery, getSlotsByDate } from 'wasp/client/operations';
import { useAuth } from 'wasp/client/auth';

export function ConsultationListPage() {
  const { t } = useTranslation();
  const { data: user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  if (!user) return <Loading />;

  const canHaveAvailability = user.canHaveAvailability ?? true;

  if (!canHaveAvailability) {
    return (
      <div className="fs-3 text-muted">
        <div>Your account does not have availability enabled,</div>
        <div>Please contact an administrator if you believe this is an error.</div>
      </div>
    );
  }

  const handleAddAvailability = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <Row>
      <Col>
        <DatePageWrapper title={t(ROUTES.consultations.labelKey)}>
          {({ currentDate, getDateString }) => {
            const { data: slots, isLoading: slotsLoading, error: slotsError } = useQuery(getSlotsByDate, {
              date: getDateString()
            });

            const isLoading = slotsLoading;
            const error = slotsError;

            if (isLoading) return <Loading />;
            if (error) return <div>Error: {error.message}</div>;

            // Use the slots directly since they're already filtered by date
            let todaySlots = (slots as (Slot & {
              consultation: {
                id: number;
                status: string;
                consultationRequest: {
                  description: string;
                };
              } | null;
            })[]) || [];

            // Hide past slots that never had a consultation
            todaySlots = todaySlots.filter(slotItem => {
              // Always show slots with a consultation
              if (slotItem.consultation) return true;
              // Hide unbooked slots in the past
              return !isPast(slotItem.startDateTime);
            });

            return (
              <>
                {/* Consultations and Slots List */}
                <ListGroup>
                  {todaySlots.length === 0 ? (
                    <ListGroupItem className="d-flex justify-content-center align-items-center py-4 px-4">
                      <span className="text-muted">No availability set for this day</span>
                    </ListGroupItem>
                  ) : (
                    todaySlots.map((slotItem) => (
                      slotItem.consultation ? (
                        <Link
                          to={getConsultationUrl(slotItem.consultation.id)}
                          key={slotItem.id}
                          className="list-group-item d-flex align-items-center py-4 px-4 text-decoration-none expand-on-hover"
                          style={{ color: 'inherit' }}
                        >
                          <div className="me-4">
                            <span className="fw-bold text-primary fs-5">{format(slotItem.startDateTime, { timeStyle: 'short' })}</span>
                          </div>
                          <div className="fs-6 flex-grow-1">{slotItem.consultation.consultationRequest.description}</div>
                        </Link>
                      ) : (
                        <ListGroupItem
                          key={slotItem.id}
                          className="d-flex align-items-center py-4 px-4"
                        >
                          <div className="me-4">
                            <span className="fw-bold text-primary fs-5">{format(slotItem.startDateTime, { timeStyle: 'short' })}</span>
                          </div>
                          <div className="fs-6 flex-grow-1">
                            <span className="badge bg-primary">Available</span>
                          </div>
                        </ListGroupItem>
                      )
                    ))
                  )}

                  {/* Edit Availability Option */}
                  {(isSameDay(currentDate, now()) || isAfter(currentDate, now())) && (
                    <ListGroupItem className="d-flex justify-content-center align-items-center py-4 px-4">
                      <Button
                        variant="link"
                        className="px-4 py-2 text-decoration-none"
                        onClick={handleAddAvailability}
                      >Edit availability</Button>
                    </ListGroupItem>
                  )}
                </ListGroup>

                <EditAvailabilityOffcanvas
                  show={showModal}
                  onHide={handleCloseModal}
                  currentDate={currentDate}
                  userId={user.id}
                />
              </>
            );
          }}
        </DatePageWrapper>
      </Col>
    </Row>
  );
} 