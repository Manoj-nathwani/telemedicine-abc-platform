import React from 'react';
import { Row, Col } from 'react-bootstrap';

interface PageHeaderProps {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  onTitleClick?: () => void;
}

export function PageHeader({ title, subtitle, children, className = 'mb-3', onTitleClick }: PageHeaderProps) {
  const isCentered = className.includes('text-center');

  return (
    <Row className={className}>
      <Col className={`d-flex align-items-center ${isCentered ? 'justify-content-center' : 'justify-content-between'}`}>
        <Col className={isCentered ? 'text-center' : ''}>
          <h1 className="h2 mb-0 text-primary">
            {onTitleClick ? (
              <span
                onClick={onTitleClick}
                style={{ cursor: 'pointer' }}
                className="text-primary"
              >
                {title}
              </span>
            ) : (
              title
            )}
          </h1>
          {subtitle !== null && (
            <p className="text-muted mb-0 mt-2">
              {subtitle}
            </p>
          )}
        </Col>
        {children && !isCentered && (
          <Col xs="auto" className="d-flex gap-2 align-items-center">
            {children}
          </Col>
        )}
      </Col>
      {children && isCentered && (
        <Row className="justify-content-center mt-3">
          <Col xs="auto">
            {children}
          </Col>
        </Row>
      )}
    </Row>
  );
} 