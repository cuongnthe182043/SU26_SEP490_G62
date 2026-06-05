import React, { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../services/apiClient";
import { getRememberedEmail } from "../../services/storage";
import { loadGoogleIdentityScript } from "../../services/googleIdentity";
import "../../styles/Login.css";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(email, password) {
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
}

export default function LoginPage({ onLoginSuccess }) {
  const rememberedEmail = getRememberedEmail();
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(Boolean(rememberedEmail));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const googleButtonRef = useRef(null);
  const googleCredentialHandlerRef = useRef(async () => {});

  const googleClientId =
    import.meta.env.VITE_GG_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const syncFieldErrors = (nextEmail, nextPassword) => {
    setFieldErrors(validateCredentials(nextEmail, nextPassword));
  };

  googleCredentialHandlerRef.current = async (credential) => {
    if (!credential) {
      throw new Error("No Google credential returned.");
    }

    setGoogleLoading(true);
    setError("");

    try {
      const data = await apiRequest("/auth/google", {
        method: "POST",
        body: { credential },
      });

      const { token, user } = data;
      if (!token || !user) {
        throw new Error("Unexpected login response from server.");
      }

      onLoginSuccess?.({
        token,
        user,
        rememberEmail: remember ? user.email || "" : "",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrapGoogleButton = async () => {
      if (!googleClientId) {
        setGoogleError("Missing Google client ID in frontend environment.");
        return;
      }

      try {
        await loadGoogleIdentityScript();

        if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            try {
              await googleCredentialHandlerRef.current(response.credential);
            } catch (err) {
              setError(err.message || "Google sign-in failed.");
            }
          },
        });

        googleButtonRef.current.innerHTML = "";
        const buttonWidth = Math.max(
          280,
          Math.min(360, googleButtonRef.current.clientWidth || 360),
        );

        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          type: "standard",
          shape: "pill",
          text: "signin_with",
          width: buttonWidth,
        });

        setGoogleReady(true);
        setGoogleError("");
      } catch (err) {
        if (!cancelled) {
          setGoogleError(err.message || "Unable to load Google sign-in.");
        }
      }
    };

    bootstrapGoogleButton();

    return () => {
      cancelled = true;
    };
  }, [googleClientId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const errors = validateCredentials(email, password);
    setFieldErrors(errors);
    setTouched({ email: true, password: true });

    if (errors.email || errors.password) {
      return;
    }

    setSubmitting(true);

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: { email, password },
      });

      const { token, user } = data;
      if (!token || !user) {
        throw new Error("Unexpected login response from server.");
      }

      onLoginSuccess?.({
        token,
        user,
        rememberEmail: remember ? email : "",
      });
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const emailError = touched.email ? fieldErrors.email : "";
  const passwordError = touched.password ? fieldErrors.password : "";
  const formIsValid = !fieldErrors.email && !fieldErrors.password && email && password;
  const heroImages = [
    { src: "/anh DN 1.png", className: "hero-image hero-image-1" },
    { src: "/anh DN 2.png", className: "hero-image hero-image-2" },
    { src: "/anh DN 3.jpg", className: "hero-image hero-image-3" },
    { src: "/anh DN 4.jpg", className: "hero-image hero-image-4" },
  ];

  return (
    <main className="login-root" role="main">
      <aside className="login-left" aria-hidden="true">
        <div className="login-hero">
          <div className="login-hero-orbit">
            {heroImages.map((image) => (
              <div key={image.src} className={image.className}>
                <img src={encodeURI(image.src)} alt="" aria-hidden="true" />
              </div>
            ))}
          </div>
          <div className="login-hero-center">
            <img src="/logo.png" alt="" aria-hidden="true" />
          </div>
        </div>
      </aside>

      <section className="login-right" aria-labelledby="signin-heading">
        <div className="login-card" role="region" aria-label="Sign in">
          <img src="/logo.png" alt="LogisCount" className="login-logo" />
          <h2 id="signin-heading">Staff sign in</h2>
          <p className="login-help">
            Use a pre-provisioned account only. New users cannot register themselves.
          </p>

          <div className="google-login-block">
            <div className="google-login-label">Google Login</div>
            <div
              ref={googleButtonRef}
              className="google-button-container"
              aria-live="polite"
            />
            {!googleReady && !googleError && (
              <div className="login-help">Loading Google sign-in...</div>
            )}
            {googleError && (
              <div className="login-error" role="alert">
                {googleError}
              </div>
            )}
          </div>

          <div className="login-divider">
            <span>or sign in with email</span>
          </div>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <label className="field">
              <span className="label-text">Email</span>
              <input
                autoFocus
                aria-label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  const nextEmail = event.target.value;
                  setEmail(nextEmail);
                  if (touched.email) {
                    syncFieldErrors(nextEmail, password);
                  }
                }}
                onBlur={() => {
                  setTouched((current) => ({ ...current, email: true }));
                  syncFieldErrors(email, password);
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
                onChange={(event) => {
                  const nextPassword = event.target.value;
                  setPassword(nextPassword);
                  if (touched.password) {
                    syncFieldErrors(email, nextPassword);
                  }
                }}
                onBlur={() => {
                  setTouched((current) => ({ ...current, password: true }));
                  syncFieldErrors(email, password);
                }}
                className={passwordError ? "input-error" : ""}
                required
              />
              {passwordError && <div className="field-error">{passwordError}</div>}
            </label>

            <div className="login-row">
              <label className="remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Remember me
              </label>
              <a
                className="forgot"
                href="#"
                onClick={(event) => event.preventDefault()}
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
              disabled={submitting || !formIsValid || googleLoading}
              aria-disabled={submitting || !formIsValid || googleLoading}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
