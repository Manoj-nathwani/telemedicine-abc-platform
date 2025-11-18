import React, { useState, useEffect } from 'react';
import { useQuery, useAction, getConsultationRequests, acceptConsultationRequest, rejectConsultationRequest } from 'wasp/client/operations';
import { Row, Col, Card, Button, Nav, Tab, Dropdown, Form } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader, Loading, ConsultationRequestTimeline } from '../components';
import { ROUTES } from '../routes';
import { ErrorMessage } from '../components/ErrorMessage';
import { useConfig } from '../contexts/ConfigContext';
import { CreateConsultationRequestModal } from './CreateConsultationRequestModal';
import { getAssignmentPreference, setAssignmentPreference as saveAssignmentPreference, type AssignmentPreference } from '../utils/localStorage';

const POLLING_INTERVAL_MS = 1_000; // 1 second in milliseconds

export function TriagePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const config = useConfig();
  const acceptConsultationRequestFn = useAction(acceptConsultationRequest);
  const rejectConsultationRequestFn = useAction(rejectConsultationRequest);

  const [actionLoading, setActionLoading] = useState<{ action: 'accept' | 'reject', id: number } | null>(null);
  const [error, setError] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Assignment preference state with localStorage persistence
  const [assignmentPreference, setAssignmentPreferenceState] = useState<AssignmentPreference>(getAssignmentPreference);

  // Wrapper to update both state and localStorage
  const setAssignmentPreference = (preference: AssignmentPreference) => {
    setAssignmentPreferenceState(preference);
    saveAssignmentPreference(preference);
  };

  // Get active tab from URL or default to 'pending'
  const getActiveTabFromUrl = () => {
    const searchParams = new URLSearchParams(location.search);
    const tab = searchParams.get('tab');
    return tab && ['pending', 'accepted', 'rejected'].includes(tab) ? tab : 'pending';
  };

  const [activeTab, setActiveTab] = useState(getActiveTabFromUrl);

  // Update URL when tab changes
  const handleTabChange = (tab: string | null) => {
    const newTab = tab || 'pending';
    setActiveTab(newTab);

    const searchParams = new URLSearchParams(location.search);
    searchParams.set('tab', newTab);
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  };

  // Update active tab when URL changes
  useEffect(() => {
    setActiveTab(getActiveTabFromUrl());
  }, [location.search]);

  // Fetch only the requests for the active tab
  const {
    data: requests,
    isLoading,
    error: queryError,
    refetch
  } = useQuery(getConsultationRequests, { status: activeTab });

  // Simple polling for real-time updates - only for pending requests
  useEffect(() => {
    if (activeTab === 'pending') {
      const interval = setInterval(refetch, POLLING_INTERVAL_MS);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [refetch, activeTab]);

  if (isLoading) return <Loading />;
  if (queryError) return <div>Error: {queryError.message}</div>;

  const handleAcceptRequest = (requestId: number, templateBody: string) => {
    setActionLoading({ action: 'accept', id: requestId });
    const assignToOnlyMe = assignmentPreference === 'assign-to-me-only';
    acceptConsultationRequestFn({
      consultationRequestId: requestId,
      templateBody,
      assignToOnlyMe
    })
      .then(() => {
        // Refetch requests after accepting
        refetch();
      })
      .catch(setError)
      .finally(() => setActionLoading(null));
  };

  const handleRejectRequest = (requestId: number) => {
    setActionLoading({ action: 'reject', id: requestId });
    rejectConsultationRequestFn({ consultationRequestId: requestId })
      .catch(setError)
      .finally(() => setActionLoading(null));
  };

  // Simplified renderRequestsList: no need for status param, use activeTab directly
  const renderRequestsList = (requests: any[]) => {
    if (!requests || requests.length === 0) {
      return (
        <Row>
          <Col xs={12}>
            <Card>
              <Card.Body className="text-center text-muted">
                <p className="mb-0">No Data</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      );
    }

    return (
      <Row>
        {requests.map((request) => (
          <Col key={request.id} xs={12} className="mb-3">
            <Card>
              <Card.Body>
                <Row className="align-items-center">

                  <Col md={8}>
                    <div className="ps-2 border-primary border-start border-3 fw-medium mb-3">{request.description}</div>
                    <ConsultationRequestTimeline
                      createdAt={request.createdAt}
                      status={request.status as 'pending' | 'accepted' | 'rejected'}
                      statusActionedAt={request.statusActionedAt}
                      statusActionedBy={request.statusActionedBy}
                      consultation={request.consultation ? {
                        id: request.consultation.id,
                        slot: {
                          startDateTime: request.consultation.slot.startDateTime,
                          user: request.consultation.slot.user
                        }
                      } : undefined}
                      phoneNumber={request.phoneNumber}
                    />
                  </Col>

                  <Col md={{ span: 3, offset: 1 }} className="text-md-end">
                    {activeTab === 'pending' && (
                      <div className="my-3">
                        {config.consultationSmsTemplates.length === 1 ? (
                          <Button
                            variant="success"
                            className="w-100 mb-2"
                            disabled={!!actionLoading}
                            onClick={() => {
                              const template = config.consultationSmsTemplates[0];
                              if (template) {
                                handleAcceptRequest(request.id, template.body);
                              }
                            }}
                          >
                            Accept Request
                          </Button>
                        ) : (
                          <Dropdown className="w-100 mb-2">
                            <Dropdown.Toggle
                              variant="success"
                              className="w-100"
                              disabled={!!actionLoading}
                            >
                              Accept Request
                            </Dropdown.Toggle>
                            <Dropdown.Menu className="w-100">
                              {config.consultationSmsTemplates.map((template, index) => (
                                <Dropdown.Item
                                  key={index}
                                  onClick={() => handleAcceptRequest(request.id, template.body)}
                                >
                                  {template.name}
                                </Dropdown.Item>
                              ))}
                            </Dropdown.Menu>
                          </Dropdown>
                        )}
                        <Button
                          variant="link"
                          className="w-100 text-danger text-decoration-none"
                          onClick={() => handleRejectRequest(request.id)}
                          disabled={!!actionLoading}
                        >
                          Reject Request
                        </Button>
                      </div>
                    )}
                  </Col>

                </Row>
              </Card.Body>
            </Card>
          </Col>
        ))
        }
      </Row >
    );
  };

  return (
    <>
      <ErrorMessage error={error} onClose={() => setError(null)} />
      <Row>
        <Col>
          <PageHeader title={t(ROUTES.triage.labelKey)}>
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Create Request
            </Button>
          </PageHeader>

          <Tab.Container activeKey={activeTab} onSelect={handleTabChange}>
            <Row>
              <Col>
                <Nav variant="pills" className="mb-4">
                  <Nav.Item>
                    <Nav.Link eventKey="pending">
                      Pending Requests
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="accepted">
                      Accepted
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="rejected">
                      Rejected
                    </Nav.Link>
                  </Nav.Item>
                </Nav>

                {activeTab === 'pending' && (
                  <div className="mb-3">
                    <Form.Select
                      value={assignmentPreference}
                      onChange={(e) => setAssignmentPreference(e.target.value as AssignmentPreference)}
                      className="w-auto d-inline-block"
                    >
                      <option value="assign-to-any-clinician">Assign to next available clinician</option>
                      <option value="assign-to-me-only">Assign to me only</option>
                    </Form.Select>
                  </div>
                )}

                {renderRequestsList(requests)}
              </Col>
            </Row>
          </Tab.Container>
        </Col>
      </Row>

      <CreateConsultationRequestModal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        onSuccess={refetch}
      />
    </>
  );
} 