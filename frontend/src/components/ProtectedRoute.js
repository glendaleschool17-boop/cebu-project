import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export const AdminRoute = ({ children }) => {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
};

export const GateAgentRoute = ({ children }) => {
  const { user, userProfile } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const role = userProfile?.role;
  if (role !== 'gate_agent' && role !== 'admin') return <Navigate to="/" replace />;
  return children;
};
