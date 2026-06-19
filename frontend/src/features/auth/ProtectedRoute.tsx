import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { getAccessToken, getPostLoginPath, getStoredUser } from './session';
import { RoleCode } from './types';

type ProtectedRouteProps = {
  children: ReactNode;
  role?: RoleCode;
};

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const token = getAccessToken();
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (role && !user.roles.includes(role)) {
    return <Navigate to={getPostLoginPath(user.roles)} replace />;
  }

  return children;
}
