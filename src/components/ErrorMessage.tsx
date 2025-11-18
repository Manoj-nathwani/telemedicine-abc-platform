import React from 'react';
import { Modal } from 'react-bootstrap';
import { ERROR_CODES, AppErrorCode } from '../utils/errorCodes';

function isAppErrorCode(code: any): code is AppErrorCode {
  return typeof code === 'string' && code in ERROR_CODES;
}

interface ErrorMessageProps {
  error: any;
  onClose: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error, onClose }) => {
  if (!error) return null;

  const code = error.data.data.code as AppErrorCode;
  if (!code) throw new Error('ErrorMessage: error code is missing');
  if (!isAppErrorCode(code)) throw new Error(`ErrorMessage: unknown error code: ${code}`);

  const errorInfo = ERROR_CODES[code];
  return (
    <Modal show={!!error} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>{errorInfo.message}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{errorInfo.description}</Modal.Body>
    </Modal>
  );
}; 