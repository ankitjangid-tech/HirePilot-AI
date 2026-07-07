import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { resetPassword } from "../services/authService";
import "../App.css";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (event) => {
    event.preventDefault();

    if (newPassword.length < 6) {
      setMessage("");
      setError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("");
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("Updating password...");

      const response = await resetPassword(token, newPassword);

      setMessage(response.data.message || "Password reset successful");

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (err) {
      console.log("RESET PASSWORD ERROR:", err.response?.data || err.message);
      setMessage("");
      setError(err.response?.data?.error || "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span>HirePilot AI</span>
          <h1>Create new password</h1>
          <p>Set a new password for your HirePilot account.</p>
        </div>

        <form className="auth-form" onSubmit={handleResetPassword}>
          <label>
            New Password
            <input
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>

          <label>
            Confirm Password
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>

          <div className="auth-actions">
            <Link className="auth-link" to="/login">
              Back to login
            </Link>

            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Updating..." : "Reset Password"}
            </button>
          </div>
        </form>

        {message && <div className="auth-success">{message}</div>}
        {error && <div className="auth-error">{error}</div>}
      </div>
    </div>
  );
}

export default ResetPassword;
