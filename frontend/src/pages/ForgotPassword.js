import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../services/authService";
import "../App.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setMessage("Sending reset link...");

      const response = await forgotPassword(email);

      setMessage(response.data.message || "Password reset email sent");
    } catch (err) {
      console.log("FORGOT PASSWORD ERROR:", err.response?.data || err.message);
      setMessage("");
      setError(err.response?.data?.error || "Unable to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span>HirePilot AI</span>
          <h1>Reset your password</h1>
          <p>Enter your registered email and we will send a reset link.</p>
        </div>

        <form className="auth-form" onSubmit={handleForgotPassword}>
          <label>
            Email
            <input
              type="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <div className="auth-actions">
            <Link className="auth-link" to="/login">
              Back to login
            </Link>

            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </div>
        </form>

        {message && <div className="auth-success">{message}</div>}
        {error && <div className="auth-error">{error}</div>}
      </div>
    </div>
  );
}

export default ForgotPassword;
