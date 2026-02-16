import React from "react";
import { Navigate } from "react-router-dom";

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: ("ADMIN" | "STUDENT")[];
}

export default function RoleRoute({
  children,
  allowedRoles,
}: RoleRouteProps) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!role || !allowedRoles.includes(role as any)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
