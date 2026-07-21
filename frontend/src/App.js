import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import CandidateDashboard from "./pages/CandidateDashboard";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import AdminDashboard from "./pages/AdminDashboard";

const roleDestinations = {
  candidate: "/candidate",
  recruiter: "/recruiter",
  admin: "/admin",
};

function RoleRoute({ allowedRole, children }) {
  const token = localStorage.getItem("token");
  const currentRole = localStorage.getItem("role");

  if (!token || !roleDestinations[currentRole]) {
    return <Navigate to="/login" replace />;
  }

  if (currentRole !== allowedRole) {
    return <Navigate to={roleDestinations[currentRole]} replace />;
  }

  return children;
}

function HomeRedirect() {
  const token = localStorage.getItem("token");
  const currentRole = localStorage.getItem("role");

  return (
    <Navigate
      to={token && roleDestinations[currentRole] ? roleDestinations[currentRole] : "/login"}
      replace
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route
          path="/candidate"
          element={
            <RoleRoute allowedRole="candidate">
              <CandidateDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="/recruiter"
          element={
            <RoleRoute allowedRole="recruiter">
              <RecruiterDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <RoleRoute allowedRole="admin">
              <AdminDashboard />
            </RoleRoute>
          }
        />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
