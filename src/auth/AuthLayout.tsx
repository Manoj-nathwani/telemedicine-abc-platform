import React from 'react';
import { Card } from 'react-bootstrap';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      className="d-flex align-items-center justify-content-center vh-100"
      style={{
        // This is to offset Root.tsx's py-5
        marginTop: '-3rem', marginBottom: '-3rem'
      }}
    >
      <Card className="shadow-sm" style={{ maxWidth: 400 }}>
        <Card.Body>
          {children}
        </Card.Body>
      </Card>
    </div>
  );
} 