import React from 'react';
import { LoginForm } from 'wasp/client/auth';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from './AuthLayout';
import { ROUTES } from '../routes';
import { authAppearance } from './appearance';

export function LoginPage() {
  const { t } = useTranslation();

  return (
    <AuthLayout>
      <LoginForm appearance={authAppearance} />
      
      <div className="text-center mt-4">
        <Link
          to={ROUTES.requestPasswordReset.path}
          className="d-block text-primary text-decoration-none small"
        >
          {t('auth.forgotPassword')}
        </Link>
      </div>
    </AuthLayout>
  );
} 