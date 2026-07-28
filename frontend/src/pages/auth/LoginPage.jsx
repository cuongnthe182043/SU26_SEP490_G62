import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  HeroUIProvider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@heroui/react";
import { apiRequest } from "../../services/apiClient";
import { loadGoogleIdentityScript } from "../../services/googleIdentity";
import { getRememberedEmail } from "../../services/storage";
import LoadingState from "../../components/LoadingState";
import { notify } from "../../components/shared-ui/Toast";
import ThemeToggle from "../../theme/ThemeToggle";
import Logo from "../../theme/Logo";
import { RiEyeLine, RiEyeOffLine } from "react-icons/ri";
import "../../styles/Login.css";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FieldStack({ children }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>{children}</div>;
}

function formatCooldown(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  if (minutes <= 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function getRateLimitMessage(error) {
  if (error?.status !== 429) return "";

  const retryAfterSeconds = Number(error.retryAfterSeconds || error.retry_after_seconds || 0);
  if (retryAfterSeconds > 0) {
    return `Too many login attempts. Please try again after ${formatCooldown(retryAfterSeconds)}.`;
  }

  return error.message || "Too many login attempts. Please try again later.";
}

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

function validateForgotPasswordStep(step, forgotState) {
  const errors = {};

  if (step === 1) {
    if (!forgotState.email) {
      errors.email = "Email is required.";
    } else if (!emailRegex.test(forgotState.email)) {
      errors.email = "Please enter a valid email address.";
    }
  }

  if (step === 2) {
    if (!forgotState.code) {
      errors.code = "Verification code is required.";
    } else if (forgotState.code.trim().length !== 6) {
      errors.code = "Verification code must be 6 characters.";
    }
  }

  if (step === 3) {
    if (!forgotState.newPassword) {
      errors.newPassword = "New password is required.";
    } else if (forgotState.newPassword.length < 6) {
      errors.newPassword = "Password must be at least 6 characters.";
    }

    if (!forgotState.confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (forgotState.confirmPassword !== forgotState.newPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
  }

  return errors;
}

const defaultForgotState = {
  email: "",
  code: "",
  newPassword: "",
  confirmPassword: "",
};

export default function LoginPage({ onLoginSuccess }) {
  const rememberedEmail = getRememberedEmail();
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(Boolean(rememberedEmail));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitting, setSubmitting] = useState(false);
  const [loginCooldown, setLoginCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotState, setForgotState] = useState(defaultForgotState);
  const [forgotErrors, setForgotErrors] = useState({});
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const googleButtonRef = useRef(null);
  const googleCredentialHandlerRef = useRef(async () => {});

  const googleClientId =
    import.meta.env.VITE_GG_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const syncFieldErrors = (nextEmail, nextPassword) => {
    setFieldErrors(validateCredentials(nextEmail, nextPassword));
  };

  useEffect(() => {
    if (loginCooldown <= 0) return undefined;

    const timer = window.setInterval(() => {
      setLoginCooldown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [loginCooldown]);

  useEffect(() => {
    if (forgotCooldown <= 0) return undefined;

    const timer = window.setInterval(() => {
      setForgotCooldown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [forgotCooldown]);

  const resetForgotFlow = () => {
    setForgotOpen(false);
    setForgotStep(1);
    setForgotState(defaultForgotState);
    setForgotErrors({});
    setForgotCooldown(0);
    setForgotSubmitting(false);
  };

  const updateForgotField = (key, value) => {
    setForgotState((current) => ({ ...current, [key]: value }));
    setForgotErrors((current) => ({ ...current, [key]: "" }));
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

      const { user } = data;
      if (!user) {
        throw new Error("Unexpected login response from server.");
      }

      onLoginSuccess?.({
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
              const rateLimitMessage = getRateLimitMessage(err);
              setError(rateLimitMessage || err.message || "Google sign-in failed.");
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

    if (loginCooldown > 0) {
      setError(`Too many login attempts. Please try again after ${formatCooldown(loginCooldown)}.`);
      return;
    }

    setSubmitting(true);

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: { email, password },
      });

      const { user } = data;
      if (!user) {
        throw new Error("Unexpected login response from server.");
      }

      onLoginSuccess?.({
        user,
        rememberEmail: remember ? email : "",
      });
    } catch (err) {
      const rateLimitMessage = getRateLimitMessage(err);
      if (rateLimitMessage) {
        const retryAfterSeconds = Number(err.retryAfterSeconds || err.retry_after_seconds || 0);
        setLoginCooldown(retryAfterSeconds);
        setError(rateLimitMessage);
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotRequest = async () => {
    const errors = validateForgotPasswordStep(1, forgotState);
    setForgotErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setForgotSubmitting(true);
      const data = await apiRequest("/auth/forgot-password/request", {
        method: "POST",
        body: { email: forgotState.email },
      });
      setForgotCooldown(Number(data.retry_after_seconds || 60));
      setForgotStep(2);
      notify.success(data.message || "Verification code sent.");
    } catch (err) {
      if (Number.isFinite(Number(err?.retry_after_seconds)) && Number(err.retry_after_seconds) > 0) {
        setForgotCooldown(Number(err.retry_after_seconds));
      }
      notify.error(err.message || "Unable to send verification code.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleForgotVerify = async () => {
    const errors = validateForgotPasswordStep(2, forgotState);
    setForgotErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setForgotSubmitting(true);
      const data = await apiRequest("/auth/forgot-password/verify", {
        method: "POST",
        body: {
          email: forgotState.email,
          code: forgotState.code.trim().toUpperCase(),
        },
      });
      setForgotStep(3);
      notify.success(data.message || "Verification code confirmed.");
    } catch (err) {
      notify.error(err.message || "Verification failed.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleForgotReset = async () => {
    const errors = validateForgotPasswordStep(3, forgotState);
    setForgotErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setForgotSubmitting(true);
      const data = await apiRequest("/auth/forgot-password/reset", {
        method: "POST",
        body: {
          email: forgotState.email,
          code: forgotState.code.trim().toUpperCase(),
          newPassword: forgotState.newPassword,
          confirmPassword: forgotState.confirmPassword,
        },
      });
      notify.success(data.message || "Password reset successful.");
      setEmail(forgotState.email);
      setPassword("");
      resetForgotFlow();
    } catch (err) {
      notify.error(err.message || "Unable to reset password.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const emailError = touched.email ? fieldErrors.email : "";
  const passwordError = touched.password ? fieldErrors.password : "";
  const formIsValid = !fieldErrors.email && !fieldErrors.password && email && password;
  // delay âm để 4 ảnh trải đều trên quỹ đạo ngay từ khung hình đầu
  const heroImages = [
    { src: "/anh DN 1.png", delay: "0s" },
    { src: "/anh DN 2.png", delay: "-7s" },
    { src: "/anh DN 3.jpg", delay: "-14s" },
    { src: "/anh DN 4.jpg", delay: "-21s" },
  ];

  return (
    <HeroUIProvider>
      <main
        role="main"
        className="flex min-h-screen flex-col bg-[#f4f7ff] dark:bg-[#0e1016] lg:flex-row"
      >
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle className="h-10 w-10 rounded-full border border-gray-200 dark:border-white/15 bg-white/80 dark:bg-white/10 shadow-lg backdrop-blur-md" />
        </div>

        <aside
          aria-hidden="true"
          className="relative flex min-h-[34vh] shrink-0 items-center justify-center overflow-hidden
                     bg-gradient-to-br from-[#f2f7ff] via-[#dbe7ff] to-[#bed2ff] p-[18px]
                     dark:from-[#0e1016] dark:via-[#12141d] dark:to-[#171a26]
                     sm:min-h-[42vh] sm:p-6 lg:min-h-screen lg:flex-[1.15] lg:p-8"
        >
          {/* 2 khối tròn mờ trang trí (trước là ::before/::after) */}
          <span className="pointer-events-none absolute -bottom-[120px] -left-[110px] h-[420px] w-[420px] rounded-full bg-white/20 blur-[2px] dark:bg-white/5" />
          <span className="pointer-events-none absolute -top-20 -right-[70px] h-[260px] w-[260px] rounded-full bg-white/[0.16] dark:bg-white/5" />

          <div className="login-hero relative flex aspect-square w-[min(360px,100%)] items-center justify-center sm:w-[min(440px,100%)] lg:w-[min(560px,92%)]">
            {/* 2 vòng tròn quỹ đạo */}
            <span className="pointer-events-none absolute inset-[14%] rounded-full border border-[rgba(37,60,110,0.10)] shadow-[0_18px_50px_rgba(25,40,72,0.06)] dark:border-white/10 dark:shadow-none" />
            <span className="pointer-events-none absolute inset-[28%] rounded-full border border-dashed border-[rgba(37,60,110,0.08)] dark:border-white/10" />

            {heroImages.map((image) => (
              <div
                key={image.src}
                style={{ animationDelay: image.delay }}
                className="login-orbit-item absolute top-1/2 left-1/2 overflow-hidden rounded-full border-[5px] border-white/[0.78] bg-white
                           shadow-[0_18px_40px_rgba(25,40,72,0.18)]
                           h-[clamp(70px,20vw,96px)] w-[clamp(70px,20vw,96px)]
                           sm:h-[clamp(88px,20vw,120px)] sm:w-[clamp(88px,20vw,120px)] sm:border-6
                           lg:h-[clamp(110px,18vw,160px)] lg:w-[clamp(110px,18vw,160px)] lg:border-8
                           dark:border-white/10 dark:bg-white/5"
              >
                <img src={encodeURI(image.src)} alt="" aria-hidden="true" className="block h-full w-full object-cover" />
              </div>
            ))}

            <div
              className="relative z-[3] flex shrink-0 items-center justify-center rounded-full border-[7px] border-white/[0.82] bg-white/90
                         shadow-[0_28px_70px_rgba(25,40,72,0.22)]
                         h-[clamp(112px,34vw,150px)] w-[clamp(112px,34vw,150px)]
                         sm:h-[clamp(130px,30vw,180px)] sm:w-[clamp(130px,30vw,180px)] sm:border-8
                         lg:h-[clamp(150px,22vw,210px)] lg:w-[clamp(150px,22vw,210px)] lg:border-[10px]
                         dark:border-white/10 dark:bg-white/5"
            >
              <Logo alt="" aria-hidden="true" className="block h-[78%] w-[78%] rounded-full object-contain" />
            </div>
          </div>
        </aside>

        <section
          aria-labelledby="signin-heading"
          className="flex flex-1 items-center justify-center bg-[#eef2f7] p-6 dark:bg-[#0e1016] lg:flex-[0.9]"
        >
          <div
            role="region"
            aria-label="Sign in"
            className="flex min-h-[520px] w-full max-w-[420px] flex-col justify-start rounded-[18px] bg-white p-[34px] text-center
                       shadow-[0_20px_60px_rgba(15,23,42,0.12)]
                       dark:border dark:border-white/10 dark:bg-[#161922] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]
                       lg:max-w-[460px]"
          >
            <Logo className="mx-auto mb-[18px] block h-20 w-20 rounded-full border border-gray-200 bg-white object-contain p-2 shadow-sm dark:border-white/10 dark:bg-white/5" />
            <h2 id="signin-heading" className="mb-4 text-[22px] font-bold text-[#16223b] dark:text-[#e6e8ef]">
              Staff sign in
            </h2>
            <p className="mt-3 text-[13px] leading-normal text-[#5c6b77] dark:text-[#a9afc0]">
              Use a pre-provisioned account only. New users cannot register themselves.
            </p>

            <div className="mt-2 flex flex-col items-stretch gap-2.5">
              <div className="text-left text-[13px] font-semibold text-[#2d3a4f] dark:text-[#c7ccd8]">Google Login</div>
              <div ref={googleButtonRef} className="flex min-h-12 justify-center" aria-live="polite" />
              {!googleReady && !googleError && (
                <LoadingState label="Đang tải đăng nhập Google..." size="sm" className="py-2 justify-start" />
              )}
              {googleError && (
                <div className="px-0.5 text-left text-sm text-[#b00020] dark:text-[#ff6b6b]" role="alert">
                  {googleError}
                </div>
              )}
            </div>

            <div className="my-[18px] mb-2 flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-[#7d8794] dark:text-[#8b93a5]">
              <span className="h-px flex-1 bg-[#e2e8f0] dark:bg-white/10" />
              <span className="whitespace-nowrap">or sign in with email</span>
              <span className="h-px flex-1 bg-[#e2e8f0] dark:bg-white/10" />
            </div>

            <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-[18px] text-left" noValidate>
              <Input
                autoFocus
                isRequired
                label="Email"
                labelPlacement="outside"
                type="email"
                variant="bordered"
                placeholder="you@example.com"
                value={email}
                onValueChange={(nextEmail) => {
                  setEmail(nextEmail);
                  if (touched.email) syncFieldErrors(nextEmail, password);
                }}
                onBlur={() => {
                  setTouched((current) => ({ ...current, email: true }));
                  syncFieldErrors(email, password);
                }}
                isInvalid={Boolean(emailError)}
                errorMessage={emailError}
              />

              <Input
                isRequired
                label="Password"
                labelPlacement="outside"
                variant="bordered"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onValueChange={(nextPassword) => {
                  setPassword(nextPassword);
                  if (touched.password) syncFieldErrors(email, nextPassword);
                }}
                onBlur={() => {
                  setTouched((current) => ({ ...current, password: true }));
                  syncFieldErrors(email, password);
                }}
                isInvalid={Boolean(passwordError)}
                errorMessage={passwordError}
                endContent={
                  <button
                    type="button"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-default-400 hover:text-default-600 focus:outline-none"
                  >
                    {showPassword ? <RiEyeOffLine size={18} /> : <RiEyeLine size={18} />}
                  </button>
                }
              />

              <div className="mt-1 flex items-center justify-between">
                <Checkbox size="sm" isSelected={remember} onValueChange={setRemember}>
                  <span className="text-[13px] text-[#555] dark:text-[#a9afc0]">Remember me</span>
                </Checkbox>
                <button
                  type="button"
                  className="text-[13px] text-[#1976d2] hover:underline dark:text-[#8b97ff]"
                  onClick={() => {
                    setForgotState((current) => ({ ...defaultForgotState, email }));
                    setForgotErrors({});
                    setForgotStep(1);
                    setForgotOpen(true);
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <div className="px-0.5 text-left text-sm text-[#b00020] dark:text-[#ff6b6b]" role="alert">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                color="primary"
                size="lg"
                className="mt-2 font-semibold"
                isLoading={submitting}
                isDisabled={submitting || !formIsValid || googleLoading || loginCooldown > 0}
              >
                {submitting
                  ? "Signing in..."
                  : loginCooldown > 0
                    ? `Try again in ${formatCooldown(loginCooldown)}`
                    : "Sign in"}
              </Button>
            </form>
          </div>
        </section>
      </main>

      <Modal isOpen={forgotOpen} onOpenChange={(open) => !open && resetForgotFlow()}>
        <ModalContent>
          <ModalHeader>Forgot password</ModalHeader>
          <ModalBody className="pb-6">
        {forgotStep === 1 && (
          <FieldStack>
            <p>Enter your email. If the account exists, we will send a 6-character verification code.</p>
            <Input
              type="email"
              placeholder="you@example.com"
              value={forgotState.email}
              onChange={(event) => updateForgotField("email", event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleForgotRequest()}
              isInvalid={Boolean(forgotErrors.email)}
            />
            {forgotErrors.email && <div className="mt-2 text-[13px] text-[#d14343] dark:text-[#ff8080]">{forgotErrors.email}</div>}
            <Button color="primary" fullWidth isLoading={forgotSubmitting} onPress={handleForgotRequest}>
              Send verification code
            </Button>
          </FieldStack>
        )}

        {forgotStep === 2 && (
          <FieldStack>
            <p>We sent a 6-character code to <strong>{forgotState.email}</strong>.</p>
            <Input
              placeholder="Enter verification code"
              value={forgotState.code}
              maxLength={6}
              onChange={(event) => updateForgotField("code", event.target.value.toUpperCase())}
              onKeyDown={(event) => event.key === "Enter" && handleForgotVerify()}
              isInvalid={Boolean(forgotErrors.code)}
            />
            {forgotErrors.code && <div className="mt-2 text-[13px] text-[#d14343] dark:text-[#ff8080]">{forgotErrors.code}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, width: "100%" }}>
              <Button
                isDisabled={forgotSubmitting || forgotCooldown > 0}
                onPress={handleForgotRequest}
              >
                {forgotCooldown > 0 ? `Resend after ${forgotCooldown}s` : "Resend code"}
              </Button>
              <Button color="primary" isLoading={forgotSubmitting} onPress={handleForgotVerify}>
                Verify code
              </Button>
            </div>
          </FieldStack>
        )}

        {forgotStep === 3 && (
          <FieldStack>
            <p>Enter your new password for <strong>{forgotState.email}</strong>.</p>
            <Input
              type="password"
              placeholder="New password"
              value={forgotState.newPassword}
              onChange={(event) => updateForgotField("newPassword", event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleForgotReset()}
              isInvalid={Boolean(forgotErrors.newPassword)}
            />
            {forgotErrors.newPassword && <div className="mt-2 text-[13px] text-[#d14343] dark:text-[#ff8080]">{forgotErrors.newPassword}</div>}
            <Input
              type="password"
              placeholder="Confirm new password"
              value={forgotState.confirmPassword}
              onChange={(event) => updateForgotField("confirmPassword", event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleForgotReset()}
              isInvalid={Boolean(forgotErrors.confirmPassword)}
            />
            {forgotErrors.confirmPassword && <div className="mt-2 text-[13px] text-[#d14343] dark:text-[#ff8080]">{forgotErrors.confirmPassword}</div>}
            <Button color="primary" fullWidth isLoading={forgotSubmitting} onPress={handleForgotReset}>
              Save new password
            </Button>
          </FieldStack>
        )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </HeroUIProvider>
  );
}
