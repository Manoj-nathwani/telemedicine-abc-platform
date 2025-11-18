import React, { useEffect, useRef, useState } from 'react';
import { Offcanvas, Form, Button, InputGroup } from 'react-bootstrap';
import { useQuery, useAction } from 'wasp/client/operations';
import { getSmsMessagesByPhoneNumber, sendSmsMessage } from 'wasp/client/operations';
import { formatRelative } from '../../utils/dateTime';
import { Loading } from '../Loading';

interface SmsMessageHistoryOffcanvasProps {
    show: boolean;
    onHide: () => void;
    phoneNumber: string;
}

export function SmsMessageHistoryOffcanvas({ show, onHide, phoneNumber }: SmsMessageHistoryOffcanvasProps) {
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [messageBody, setMessageBody] = useState('');

    // Get messages for the selected phone number
    const { data: phoneNumberMessages, refetch } = useQuery(
        getSmsMessagesByPhoneNumber,
        { phoneNumber }, { enabled: !!phoneNumber }
    );

    const sendSmsMessageFn = useAction(sendSmsMessage);

    // Scroll to bottom of chat when messages change or offcanvas opens
    useEffect(() => {
        if (show && chatContainerRef.current && phoneNumberMessages) {
            const scrollToBottom = () => {
                if (chatContainerRef.current) {
                    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                }
            };

            // Use requestAnimationFrame to ensure DOM is ready, then scroll
            requestAnimationFrame(() => {
                // Add a small delay to ensure offcanvas is fully rendered
                setTimeout(scrollToBottom, 100);
            });
        }
    }, [show, phoneNumberMessages]);

    // Additional scroll effect when offcanvas is shown to handle transition timing
    useEffect(() => {
        if (show && phoneNumberMessages) {
            const scrollToBottom = () => {
                if (chatContainerRef.current) {
                    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                }
            };

            // Wait for offcanvas transition to complete (Bootstrap offcanvas transition is ~300ms)
            const timer = setTimeout(scrollToBottom, 350);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [show, phoneNumberMessages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageBody.trim()) return;

        try {
            await sendSmsMessageFn({ phoneNumber, body: messageBody.trim() });
            setMessageBody('');
            refetch();
        } catch (error: any) {
            alert(error.message || 'Failed to send message');
        }
    };

    return (
        <Offcanvas show={show} onHide={onHide} placement="end" size="lg">
            <Offcanvas.Header closeButton>
                <Offcanvas.Title>
                    <span>SMS History for </span>
                    <span className="small rounded-3 p-2 bg-light text-dark">{phoneNumber}</span>
                </Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body>
                {phoneNumber && (
                    <div className="d-flex flex-column h-100">
                        {phoneNumberMessages && phoneNumberMessages.length > 0 ? (
                            <div ref={chatContainerRef} className="flex-grow-1 overflow-auto mb-3">
                                {phoneNumberMessages.map((message: any) => {
                                    // Check if this is an OutgoingSmsMessage (has sentMessageId field) or SmsMessage (has direction field)
                                    const isOutgoingSmsMessage = 'sentMessageId' in message;
                                    const isIncoming = isOutgoingSmsMessage ? false : message.direction === 'incoming';
                                    const isPending = isOutgoingSmsMessage && message.success === null;
                                    const isFailed = isOutgoingSmsMessage && message.success === false;

                                    return (
                                        <div key={message.id} className={`d-flex mb-3 ${isIncoming ? 'justify-content-start' : 'justify-content-end'}`}>
                                            <div className={`d-flex flex-column ${isIncoming ? 'align-items-start' : 'align-items-end'}`} style={{ maxWidth: '70%' }}>
                                                <div className={`rounded-3 px-3 py-2 ${isIncoming ? 'bg-light text-dark' : isFailed ? 'bg-danger text-white' : 'bg-primary text-white'}`}>
                                                    <p className="mb-1">{message.body}</p>
                                                </div>
                                                <div className="d-flex align-items-center mt-1">
                                                    {isPending ? (
                                                        <div className="d-flex align-items-center">
                                                            <div className="spinner-border spinner-border-sm me-2" role="status">
                                                                <span className="visually-hidden"><Loading /></span>
                                                            </div>
                                                            <small className="text-muted">sending in progress</small>
                                                        </div>
                                                    ) : isFailed ? (
                                                        <div className="d-flex align-items-center">
                                                            <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>
                                                            <small className="text-danger">failed to send</small>
                                                        </div>
                                                    ) : (
                                                        <small className="text-muted">
                                                            {formatRelative(message.createdAt)}
                                                        </small>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center text-muted flex-grow-1 d-flex align-items-center justify-content-center mb-3">
                                <div>
                                    <i className="bi bi-chat-dots fs-1 mb-3 d-block"></i>
                                    <p>No messages found for this phone number.</p>
                                </div>
                            </div>
                        )}
                        <Form onSubmit={handleSendMessage}>
                            <InputGroup>
                                <Form.Control
                                    type="text"
                                    placeholder="Type a message..."
                                    value={messageBody}
                                    onChange={(e) => setMessageBody(e.target.value)}
                                />
                                <Button type="submit" variant="primary" disabled={!messageBody.trim()}>
                                    <i className="bi bi-send"></i>
                                </Button>
                            </InputGroup>
                        </Form>
                    </div>
                )}
            </Offcanvas.Body>
        </Offcanvas>
    );
} 