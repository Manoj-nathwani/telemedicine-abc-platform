import React from 'react';
import { ForgotPasswordForm } from 'wasp/client/auth';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from './AuthLayout';
import { ROUTES } from '../routes';
import { authAppearance } from './appearance';

export function RequestPasswordResetPage() {
  const { t } = useTranslation();

  return (
    <AuthLayout>
      <ForgotPasswordForm appearance={authAppearance} />
      
      <div className="text-center mt-4">
        <div className="text-muted small">
          {t('auth.rememberPassword')}{' '}
          <Link 
            to={ROUTES.login.path}
            className="text-primary text-decoration-none fw-medium"
          >
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
} 