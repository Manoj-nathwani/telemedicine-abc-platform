import React from "react";

export function ConsultationSection({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function ConsultationLabel({ text }: { text: string }) {
  return <div className="text-muted small mb-2">{text}</div>;
}

type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: () => void;
};

export const ConsultationCheckbox: React.FC<CheckboxProps> = ({ label, checked, onChange }) => (
  <div className="form-check">
    <label className="form-check-label">
      <input
        className="form-check-input"
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />
      {label}
    </label>
  </div>
);
