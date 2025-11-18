import React, { useState } from 'react';
import { UserInfoOffcanvas } from './UserInfoOffcanvas';

interface UserDisplayProps {
  user: { id: number; name: string } | null | undefined;
  className?: string;
  style?: React.CSSProperties;
}

export function UserDisplay({ user, className, style }: UserDisplayProps) {
  const [showOffcanvas, setShowOffcanvas] = useState(false);

  // Handle unknown/missing user
  if (!user) {
    return <span className={className} style={style}>Unknown</span>;
  }

  return (
    <>
      <span
        className={className}
        style={{ cursor: 'pointer', textDecoration: 'underline', ...style }}
        onClick={() => setShowOffcanvas(true)}
      >
        {user.name}
      </span>
      <UserInfoOffcanvas
        show={showOffcanvas}
        onHide={() => setShowOffcanvas(false)}
        userId={user.id}
      />
    </>
  );
}

