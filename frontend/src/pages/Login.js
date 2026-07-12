import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../services/authService";
import "../App.css";

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

      setMessage("Login successful");

      if (response.data.role === "candidate") {
        navigate("/");
      } else if (response.data.role === "recruiter") {
        navigate("/recruiter");
      } else if (response.data.role === "admin") {
        navigate("/admin");
      } else {
        setError("Unsupported account role");
      }
    } catch (err) {
      console.log("LOGIN ERROR:", err.response?.data || err.message);
      setMessage("");
      setError(err.response?.data?.error || "Login failed");
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
          <p>Login to continue to your recruitment workspace.</p>
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

        {message && <div className="auth-note">{message}</div>}
        {error && <div className="auth-error">{error}</div>}
      </div>
    </div>
  );
}

export default Login;
