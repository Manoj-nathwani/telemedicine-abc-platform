import React from 'react';

interface CardTitleProps {
  title: React.ReactNode;
  className?: string;
}

export function CardTitle({ title, className = '' }: CardTitleProps) {
  return (
    <h5 className={`mb-1 ${className}`}>
      {title}
    </h5>
  );
} 