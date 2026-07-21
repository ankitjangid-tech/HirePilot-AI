import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../services/authService";
import "../App.css";

const roleDestinations = {
  candidate: "/candidate",
  recruiter: "/recruiter",
  admin: "/admin",
};

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

  const handleLogin = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setMessage("Signing in...");

      const response = await login({ email, password });

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
      <div className="auth-card">
        <div className="auth-brand">
          <span>HirePilot AI</span>
          <h1>Welcome back</h1>
          <p>
            Sign in to continue to your Candidate Workspace, Recruiter
            Workspace, or Admin Control Panel.
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
              {loading ? "Signing in..." : "Login"}
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
