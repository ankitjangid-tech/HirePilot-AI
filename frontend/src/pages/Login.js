import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../services/authService";
import "../App.css";

const roleDestinations = {
  candidate: "/candidate",
  recruiter: "/recruiter",
  admin: "/admin",
};

const loginRoles = [
  {
    id: "candidate",
    label: "Candidate Login",
    badge: "Candidate",
    description:
      "Discover reviewed jobs, manage applications, and follow interview updates.",
  },
  {
    id: "recruiter",
    label: "Recruiter Login",
    badge: "Recruiter",
    description:
      "Manage your company profile, jobs, applicants, and interviews.",
  },
  {
    id: "admin",
    label: "Admin Login",
    badge: "Admin",
    description:
      "Govern access, trusted sources, discovery runs, and job review queues.",
  },
];

const friendlyLoginError = (error) => {
  const serverMessage = error.response?.data?.error;

  if (
    typeof serverMessage === "string" &&
    serverMessage.length <= 180 &&
    !serverMessage.includes("\n")
  ) {
    return serverMessage;
  }

  const status = error.response?.status;
  return status
    ? `Unable to sign in right now (HTTP ${status}). Please check your details and try again.`
    : "Unable to reach HirePilot. Confirm the backend is running and try again.";
};

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState("candidate");

  const handleLogin = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setMessage("Signing in...");

      const response = await login({ email, password });

      if (response.data.role !== selectedRole) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("recruiter_status");
        localStorage.removeItem("recruiter_status_reason");
        setMessage("");
        setError(
          `This account is not ${selectedRole === "admin" ? "an" : "a"} ${
            selectedRole
          } account.`
        );
        return;
      }

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("role", response.data.role);
      if (response.data.role === "recruiter") {
        localStorage.setItem(
          "recruiter_status",
          response.data.recruiter_status || "pending"
        );
        localStorage.setItem(
          "recruiter_status_reason",
          response.data.recruiter_status_reason || ""
        );
      } else {
        localStorage.removeItem("recruiter_status");
        localStorage.removeItem("recruiter_status_reason");
      }

      const destination = roleDestinations[response.data.role];

      if (!destination) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        setMessage("");
        setError("This account role does not have an available workspace.");
        return;
      }

      setMessage("Login successful. Opening your workspace...");
      navigate(destination, { replace: true });
    } catch (err) {
      console.log("LOGIN ERROR:", err.response?.data || err.message);
      setMessage("");
      setError(friendlyLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-role-split">
        <div className="auth-brand">
          <span>HirePilot AI</span>
          <h1>Choose your workspace</h1>
          <p>
            Select the role you intend to use, then sign in with that account.
          </p>
        </div>

        <div className="login-role-grid" aria-label="Select login role">
          {loginRoles.map((role) => (
            <button
              type="button"
              className={`login-role-card ${
                selectedRole === role.id ? "selected" : ""
              }`}
              aria-pressed={selectedRole === role.id}
              onClick={() => {
                setSelectedRole(role.id);
                setError("");
                setMessage("");
              }}
              key={role.id}
            >
              <span>{role.badge}</span>
              <strong>{role.label}</strong>
              <small>{role.description}</small>
            </button>
          ))}
        </div>

        <div className="selected-role-context" role="status">
          <span>{loginRoles.find((role) => role.id === selectedRole)?.badge}</span>
          <p>
            {loginRoles.find((role) => role.id === selectedRole)?.description}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          <label>
            Email
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <div className="auth-actions">
            <Link className="auth-link" to="/forgot-password">
              Forgot password?
            </Link>

            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading
                ? "Signing in..."
                : `Continue as ${
                    loginRoles.find((role) => role.id === selectedRole)?.badge
                  }`}
            </button>
          </div>
        </form>

        {message && <div className="auth-note" role="status">{message}</div>}
        {error && <div className="auth-error" role="alert">{error}</div>}
      </div>
    </div>
  );
}

export default Login;
