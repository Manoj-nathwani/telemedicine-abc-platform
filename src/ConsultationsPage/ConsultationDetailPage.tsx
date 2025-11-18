import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "wasp/client/operations";
import { getConsultationWithCalls } from "wasp/client/operations";
import { PageHeader } from "../components/PageHeader";
import { Card, Col, Nav, Row } from 'react-bootstrap';
import ConsultationDetails from "./ConsultationDetails";
import { type ConsultationWithCalls } from "../consultations/types";
import { Loading } from "../components/Loading";
import { format, isSameDay, now } from "../utils/dateTime";

export function ConsultationDetailPage() {
  const { id } = useParams();

  const [activeConsultationId, setActiveConsultationId] = useState<number>(Number(id));

  const { data: consultation, isLoading, refetch } = useQuery(
    getConsultationWithCalls, { consultationId: activeConsultationId }
  );

  if (isLoading || !consultation) return <Loading />;

  const currentConsultation = consultation as ConsultationWithCalls;
  const patientConsultations = currentConsultation.patient?.consultations || [];

  return (
    <>
      <Card>
        <Card.Body>
          <Row className="g-5">
            <Col md={3} className="border-end">
              <div className="position-sticky" style={{ top: '1rem' }}>

                <PageHeader
                  className="pb-3 mb-3 border-bottom"
                  title={(
                    <div className="d-flex align-items-center text-break">
                      {currentConsultation.patient?.name || 'Unknown Patient'}
                    </div>
                  )}
                  subtitle={
                    currentConsultation.patient?.dateOfBirth
                      ? <span className="text-muted small">Born {format(currentConsultation.patient.dateOfBirth, { dateStyle: 'medium' })}</span>
                      : null
                  }
                />

                <Nav variant="pills" className="flex-column">
                  {patientConsultations.map((c: any) => (
                    <Nav.Item key={c.id}>
                      <Nav.Link
                        active={c.id === activeConsultationId}
                        onClick={() => setActiveConsultationId(c.id)}
                        className="text-center fs-5"
                      >
                        {isSameDay(c.createdAt, now())
                          ? (
                            <>
                              <div>Today</div>
                              <div className="fs-4 fw-semibold">{format(c.createdAt, { timeStyle: 'short' })}</div>
                            </>
                          )
                          : format(c.createdAt, { dateStyle: 'medium' })
                        }
                      </Nav.Link>
                    </Nav.Item>
                  ))}
                </Nav>

              </div>
            </Col>
            <Col>
              <ConsultationDetails consultation={currentConsultation} onRefetch={refetch} />
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </>
  );
} 