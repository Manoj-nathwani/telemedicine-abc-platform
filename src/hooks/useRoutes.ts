import { useLocation, matchPath } from 'react-router-dom';
import { 
  ROUTES, 
  getAuthenticatedRoutes,
  getAuthRoutes,
  type RouteConfig 
} from '../routes';

export function useRoutes() {
  const location = useLocation();

  const isActive = (path: string): boolean => {
    // Exact match for root path
    if (path === '/') {
      return location.pathname === '/';
    }

    // Exact match for dashboard path
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }

    // For other paths, check if the current path starts with the given path
    // This handles parameterized routes like /consultations/:id
    return location.pathname.startsWith(path);
  };

  const getCurrentRoute = (): RouteConfig | undefined => {
    // Use React Router's matchPath to find the matching route
    // This handles trailing slashes the same way React Router does
    return Object.values(ROUTES).find(route => {
      const match = matchPath(
        { path: route.path, end: true },
        location.pathname
      );
      return match !== null;
    });
  };

  const isAuthPage = (): boolean => {
    const currentRoute = getCurrentRoute();
    return currentRoute?.isAuthPage || false;
  };


  const requiresAuth = (): boolean => {
    const currentRoute = getCurrentRoute();
    return currentRoute?.requiresAuth || false;
  };

  return {
    // Current route info
    currentPath: location.pathname,
    currentRoute: getCurrentRoute(),
    isActive,
    
    // Route type checks
    isRoot: location.pathname === '/',
    isAuthPage: isAuthPage(),
    requiresAuth: requiresAuth(),
    
    // Route collections
    authenticatedRoutes: getAuthenticatedRoutes(),
    authRoutes: getAuthRoutes(),
    allRoutes: ROUTES,
    
    // Utility functions
    getCurrentRoute,
  };
} 