import React, { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Container, Button } from 'react-bootstrap';
import { I18nextProvider } from 'react-i18next';
import { env } from 'wasp/client';
import { Sidebar } from './Sidebar';
import { useRoutes } from './hooks/useRoutes';
import { ROUTES } from './routes';
import { BRAND_NAME } from './constants';
import { ConfigProvider } from './contexts/ConfigContext';
import { i18nInstance } from './translations/i18n';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="d-flex vh-100">
      {/* Sidebar - always shown on protected pages */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        onSidebarClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-grow-1 d-flex flex-column">
        {/* Mobile Header */}
        <div className="d-md-none bg-white border-bottom p-3">
          <div className="d-flex justify-content-between align-items-center">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setSidebarOpen(true)}
            >
              <i className="bi bi-list me-1"></i>
              Menu
            </Button>
            <Link to={ROUTES.dashboard.path} className="text-decoration-none">
              <h5 className="text-primary mb-0">{BRAND_NAME}</h5>
            </Link>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-grow-1 overflow-auto">
          <ConfigProvider>
            <Container style={{ maxWidth: 1000 }}>
              <div className="py-5">
                {children}
              </div>
            </Container>
          </ConfigProvider>
        </main>
      </div>
    </div>
  );
}

export function Root() {
  const { isAuthPage, isRoot } = useRoutes();
  const useSimpleLayout = isAuthPage;

  if (isRoot) {
    return <meta
      httpEquiv="refresh"
      content={`0;url=${env.REACT_APP_REDIRECT_URL}`}
    />
  } else if (useSimpleLayout) {
    return (
      <div className="d-flex min-vh-100">
        <div className="flex-grow-1 d-flex flex-column">
          <main className="flex-grow-1">
            <Outlet />
          </main>
        </div>
      </div>
    )
  } else {
    return (
      <I18nextProvider i18n={i18nInstance}>
        <ProtectedLayout>
          <Outlet />
        </ProtectedLayout>
      </I18nextProvider>
    );
  }

} 