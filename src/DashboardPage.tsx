import { Navigate } from "react-router-dom";
import { ROUTES } from './routes';

export const DashboardPage = () => {
  return <Navigate to={ROUTES.consultations.path} replace />;
}; 