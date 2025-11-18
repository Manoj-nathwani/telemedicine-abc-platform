import React, { useState, useEffect } from 'react';
import { logout } from 'wasp/client/auth';
import { useQuery } from 'wasp/client/operations';
import { Link } from 'react-router-dom';
import { Nav, Button, Offcanvas, Row, Col } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { ROUTES } from './routes';
import { useRoutes } from './hooks/useRoutes';
import { BRAND_NAME } from './constants';
import { LanguageSelector, Loading, UserDisplay } from './components';
import { getUser } from 'wasp/client/operations';
import { isAdmin } from './utils/auth/client';
import { format, now } from './utils/dateTime';
import './Sidebar.scss';

interface SidebarProps {
  sidebarOpen: boolean;
  onSidebarClose: () => void;
}

const sidebarNavigation = [
  { route: ROUTES.consultations, icon: <i className="bi bi-calendar-week"></i> },
  { route: ROUTES.triage, icon: <i className="bi bi-funnel"></i> },
  { route: ROUTES.patients, icon: <i className="bi bi-people-fill"></i> },
  { route: ROUTES.availability, icon: <i className="bi bi-calendar-check"></i> },
  { route: ROUTES.profile, icon: <i className="bi bi-person"></i> }
];

const adminNavigation = [
  { route: ROUTES.userManagement, icon: <i className="bi bi-people"></i> },
  { route: ROUTES.smsMessages, icon: <i className="bi bi-chat-dots"></i> },
  { route: ROUTES.auditLogs, icon: <i className="bi bi-shield-check"></i> },
  { route: ROUTES.config, icon: <i className="bi bi-gear"></i> }
];

export function Sidebar({ sidebarOpen, onSidebarClose }: SidebarProps) {
  const { data: user } = useQuery(getUser);
  const { isActive } = useRoutes();
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(now());

  // Update current time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(now());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return <Loading />;

  const userIsAdmin = isAdmin(user);

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="p-3 border-bottom">
        <Link to={ROUTES.dashboard.path} className="text-decoration-none">
          <h5 className="text-primary mb-0">{BRAND_NAME}</h5>
        </Link>
      </div>

      {/* Navigation */}
      <Nav className="flex-column flex-grow-1 p-3">
        {sidebarNavigation.map(({ route, icon }) => (
          <Nav.Item key={route.path} className="mb-1">
            <Nav.Link
              as={Link}
              to={route.path}
              className={`d-flex align-items-center ${isActive(route.path) ? 'active' : ''}`}
            >
              <span className="me-2">{icon}</span>
              {t(route.labelKey)}
            </Nav.Link>
          </Nav.Item>
        ))}

        {/* Admin Navigation */}
        {userIsAdmin && (
          <>
            <hr className="my-3" />
            <div className="text-muted small mb-2 px-3">{t('sidebar.administration')}</div>
            {adminNavigation.map(({ route, icon }) => (
              <Nav.Item key={route.path} className="mb-1">
                <Nav.Link
                  as={Link}
                  to={route.path}
                  className={`d-flex align-items-center ${isActive(route.path) ? 'active' : ''}`}
                >
                  <span className="me-2">{icon}</span>
                  {t(route.labelKey)}
                </Nav.Link>
              </Nav.Item>
            ))}
          </>
        )}
      </Nav>

      {/* User Section */}
      <div className="p-3 border-top mt-auto">
        <div>
          <div className="text-muted small mb-2 d-flex flex-column gap-" style={{ fontSize: '0.75rem' }}>
            <div><UserDisplay user={user} /></div>
            <div>{user.email}</div>
            <div>{format(currentTime)}</div>
          </div>
          <Row className="g-2">
            <Col xs={6}>
              <LanguageSelector className="w-100" />
            </Col>
            <Col xs={6}>
              <Button variant="outline-danger" size="sm" onClick={logout} className="w-100">
                {t('sidebar.logout')}
              </Button>
            </Col>
          </Row>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div id="Sidebar" className="d-none d-md-flex flex-column bg-white border-end h-100" style={{ width: 280 }}>
        {sidebarContent}
      </div>

      {/* Mobile Sidebar */}
      <Offcanvas
        show={sidebarOpen}
        onHide={onSidebarClose}
        placement="start"
        className="d-md-none"
        style={{ width: 280 }}
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>{t('sidebar.menu')}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-0">
          {sidebarContent}
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}