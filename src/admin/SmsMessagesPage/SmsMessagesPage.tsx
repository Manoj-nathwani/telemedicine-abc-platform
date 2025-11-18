import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Badge, Nav, Tab, Offcanvas, Button } from 'react-bootstrap';
import { useQuery } from 'wasp/client/operations';
import { getSmsMessages } from 'wasp/client/operations';
import { useTranslation } from 'react-i18next';
import { PageHeader, Loading, SmsMessageHistoryOffcanvas } from '../../components';
import { SendSmsModal } from '../UserManagementPage/SendSmsModal';
import { formatRelative } from '../../utils/dateTime';
import { useNavigate, useLocation } from 'react-router-dom';
import { SMS_PAGINATION_SIZE } from '../../constants';
import { ROUTES } from '../../routes';

export function SmsMessagesPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('');
    const [showSmsModal, setShowSmsModal] = useState(false);

    // Get active tab from URL or default to 'received'
    const getActiveTabFromUrl = () => {
        const searchParams = new URLSearchParams(location.search);
        const tab = searchParams.get('tab');
        return tab && ['received', 'sending', 'sent', 'failed'].includes(tab) ? tab : 'received';
    };

    const [activeTab, setActiveTab] = useState(getActiveTabFromUrl);

    // Update URL when tab changes
    const handleTabChange = (tab: string | null) => {
        const newTab = tab || 'received';
        setActiveTab(newTab);

        const searchParams = new URLSearchParams(location.search);
        searchParams.set('tab', newTab);
        navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
    };

    // Update active tab when URL changes
    useEffect(() => {
        setActiveTab(getActiveTabFromUrl());
    }, [location.search]);

    const { data: messages, isLoading, error } = useQuery(getSmsMessages, { state: activeTab });



    if (isLoading) {
        return <Loading />;
    }

    if (error) {
        return (
            <Row>
                <Col>
                    <PageHeader title={t(ROUTES.smsMessages.labelKey)} />
                    <Card className="shadow-sm">
                        <Card.Body>
                            <div className="text-center p-4 text-danger">Error loading messages: {error.message}</div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        );
    }

    return (
        <>
            <Row>
                <Col>
                    <PageHeader title={t(ROUTES.smsMessages.labelKey)}>
                        <Button
                            variant="primary"
                            onClick={() => setShowSmsModal(true)}
                        >
                            Send SMS
                        </Button>
                    </PageHeader>

                    <Tab.Container activeKey={activeTab} onSelect={handleTabChange}>
                        <Row>
                            <Col>
                                <Nav variant="pills" className="mb-4">
                                    <Nav.Item>
                                        <Nav.Link eventKey="received">
                                            Received
                                        </Nav.Link>
                                    </Nav.Item>
                                    <Nav.Item>
                                        <Nav.Link eventKey="sending">
                                            Sending
                                        </Nav.Link>
                                    </Nav.Item>
                                    <Nav.Item>
                                        <Nav.Link eventKey="sent">
                                            Sent
                                        </Nav.Link>
                                    </Nav.Item>
                                    <Nav.Item>
                                        <Nav.Link eventKey="failed">
                                            Failed
                                        </Nav.Link>
                                    </Nav.Item>
                                </Nav>

                                <Card className="shadow-sm">
                                    <Card.Body>
                                        {messages && messages.length > 0 ? (
                                            <Table responsive className="small">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: 80 }}>Time</th>
                                                        <th style={{ width: 150 }}>Phone Number</th>
                                                        <th>Message</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {messages.map((message: any) => (
                                                        <tr key={message.id}>
                                                            <td>
                                                                <small className="text-muted">
                                                                    {formatRelative(message.createdAt)}
                                                                </small>
                                                            </td>
                                                            <td className="p-0">
                                                                <button
                                                                    className="btn btn-link expand-on-hover"
                                                                    onClick={() => setSelectedPhoneNumber(message.phoneNumber)}
                                                                >
                                                                    <code>{message.phoneNumber}</code>
                                                                </button>
                                                            </td>
                                                            <td>
                                                                <div className="text-break">
                                                                    {message.body}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                {messages.length === SMS_PAGINATION_SIZE && (
                                                    <tfoot>
                                                        <tr>
                                                            <td colSpan={3} className="text-center text-muted py-3 bg-light">
                                                                <small>Showing latest {SMS_PAGINATION_SIZE} messages</small>
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </Table>
                                        ) : (
                                            <div className="text-center p-4 text-muted">
                                                <i className="bi bi-chat-dots fs-1 mb-3"></i>
                                                <p>No {activeTab} messages found.</p>
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                    </Tab.Container>
                </Col>
            </Row>

            <SmsMessageHistoryOffcanvas
                show={!!selectedPhoneNumber}
                onHide={() => setSelectedPhoneNumber('')}
                phoneNumber={selectedPhoneNumber}
            />

            <SendSmsModal
                show={showSmsModal}
                onHide={() => setShowSmsModal(false)}
            />
        </>
    );
} 