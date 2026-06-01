import React, { useState } from "react";
import "../styles/Login.css";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitting, setSubmitting] = useState(false);

  const validateFields = () => {
    const errors = { email: "", password: "" };
    if (!email) {
      errors.email = "Email is required.";
    } else if (!emailRegex.test(email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }

    return errors;
  };

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:9999";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const errors = validateFields();
    setFieldErrors(errors);
    setTouched({ email: true, password: true });

    if (errors.email || errors.password) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid email or password.");
      }

      const { token, user } = data;
      if (!token || !user) {
        throw new Error("Unexpected login response from server.");
      }

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      if (remember) localStorage.setItem("rememberEmail", email);
      if (onLoginSuccess) await onLoginSuccess(user);
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const emailError = touched.email ? fieldErrors.email : "";
  const passwordError = touched.password ? fieldErrors.password : "";
  const formIsValid =
    !fieldErrors.email && !fieldErrors.password && email && password;

  return (
    <main className="login-root" role="main">
      <aside className="login-left" aria-hidden="true"></aside>

      <section className="login-right" aria-labelledby="signin-heading">
        <div className="login-card" role="region" aria-label="Sign in">
          <img src="/logo.png" alt="LogisCount" className="login-logo" />
          <h2 id="signin-heading">Staff sign in</h2>
          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <label className="field">
              <span className="label-text">Email</span>
              <input
                autoFocus
                aria-label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (touched.email) {
                    setFieldErrors(validateFields());
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, email: true }));
                  setFieldErrors(validateFields());
                }}
                className={emailError ? "input-error" : ""}
                required
              />
              {emailError && <div className="field-error">{emailError}</div>}
            </label>

            <label className="field">
              <span className="label-text">Password</span>
              <input
                aria-label="Password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (touched.password) {
                    setFieldErrors(validateFields());
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, password: true }));
                  setFieldErrors(validateFields());
                }}
                className={passwordError ? "input-error" : ""}
                required
              />
              {passwordError && (
                <div className="field-error">{passwordError}</div>
              )}
            </label>

            <div className="login-row">
              <label className="remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember me
              </label>
              <a
                className="forgot"
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                Forgot?
              </a>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-btn"
              disabled={submitting || !formIsValid}
              aria-disabled={submitting || !formIsValid}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
