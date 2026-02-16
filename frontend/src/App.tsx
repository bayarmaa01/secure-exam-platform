import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";
import RoleRoute from "./components/RoleRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* ADMIN */}
      <Route
        path="/admin"
        element={
          <RoleRoute allowedRoles={["ADMIN"]}>
            <AdminDashboard />
          </RoleRoute>
        }
      />

      {/* STUDENT */}
      <Route
        path="/student"
        element={
          <RoleRoute allowedRoles={["STUDENT"]}>
            <StudentDashboard />
          </RoleRoute>
        }
      />

      <Route path="/unauthorized" element={<div>403 – Unauthorized</div>} />
    </Routes>
  );
}
