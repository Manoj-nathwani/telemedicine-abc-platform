import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from '../utils/dateTime';
import { UserDisplay } from './UserDisplay/UserDisplay';
import { SmsMessageHistoryOffcanvas } from './SmsMessageHistory';
import { getConsultationUrl } from '../routes';

type TimelineItem = {
  timestamp: Date;
  content: React.ReactNode;
};

type ConsultationRequestTimelineProps = {
  createdAt: Date;
  status: 'pending' | 'accepted' | 'rejected';
  statusActionedAt?: Date | null | undefined;
  statusActionedBy?: { id: number; name: string } | null | undefined;
  consultation?: {
    id: number;
    slot: {
      startDateTime: Date;
      user: { id: number; name: string };
    };
  } | null | undefined;
  phoneNumber?: string;
};

function BulletPoint({ content }: { content: React.ReactNode }) {
  return (
    <div className="d-flex align-items-center">
      <div className="text-primary fw-bold me-2">•</div>
      <div className="text-muted small">{content}</div>
    </div>
  );
}

export function ConsultationRequestTimeline({
  createdAt,
  status,
  statusActionedAt,
  statusActionedBy,
  consultation,
  phoneNumber
}: ConsultationRequestTimelineProps) {
  const [showSmsHistory, setShowSmsHistory] = useState(false);
  const navigate = useNavigate();

  const firstItemContent = phoneNumber ? (
    <>
      Consultation Requested by{' '}
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setShowSmsHistory(true);
        }}
        className="text-primary text-decoration-underline"
      >
        {phoneNumber}
      </a>
    </>
  ) : (
    'Consultation Requested'
  );

  const items: TimelineItem[] = [
    {
      timestamp: createdAt,
      content: firstItemContent
    }
  ];

  if (statusActionedAt && statusActionedBy && (status === 'accepted' || status === 'rejected')) {
    items.push({
      timestamp: statusActionedAt,
      content: (
        <>
          Request {status === 'accepted' ? 'accepted' : 'rejected'} by <UserDisplay user={statusActionedBy} />
        </>
      )
    });
  }

  if (consultation?.slot) {
    items.push({
      timestamp: consultation.slot.startDateTime,
      content: (
        <>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate(getConsultationUrl(consultation.id));
            }}
            className="text-primary text-decoration-underline"
          >
            Consultation #{consultation.id}
          </a>
          {' '}with <UserDisplay user={consultation.slot.user} />
        </>
      )
    });
  }

  return (
    <>
      {items.map(({ timestamp, content }, index) => (
        <BulletPoint
          key={index}
          content={<>{format(timestamp)} - {content}</>}
        />
      ))}
      {phoneNumber && (
        <SmsMessageHistoryOffcanvas
          show={showSmsHistory}
          onHide={() => setShowSmsHistory(false)}
          phoneNumber={phoneNumber}
        />
      )}
    </>
  );
}

