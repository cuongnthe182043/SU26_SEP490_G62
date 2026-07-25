import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '../../src/pages/auth/LoginPage';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import * as apiClient from '../../src/services/apiClient';

vi.mock('../../src/services/apiClient', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../../src/services/storage', () => ({
  getRememberedEmail: vi.fn(() => ''),
}));

vi.mock('../../src/services/googleIdentity', () => ({
  loadGoogleIdentityScript: vi.fn().mockResolvedValue(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

function renderLogin(props) {
  return render(
    <ThemeProvider>
      <LoginPage {...props} />
    </ThemeProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('L1-AUTH-FE-01: renders login form correctly', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: /staff sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('L1-AUTH-FE-02: shows validation errors when fields are empty', async () => {
    renderLogin();
    fireEvent.blur(screen.getByLabelText(/email/i));
    fireEvent.blur(screen.getByLabelText(/^password$/i));

    await waitFor(() => {
      expect(screen.getByText('Email is required.')).toBeInTheDocument();
      expect(screen.getByText('Password is required.')).toBeInTheDocument();
    });
  });

  it('L1-AUTH-FE-03: shows validation errors for invalid email and short password', async () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'invalid-email' } });
    fireEvent.blur(screen.getByLabelText(/email/i));
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: '123' } });
    fireEvent.blur(screen.getByLabelText(/^password$/i));

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 6 characters.')).toBeInTheDocument();
    });
  });

  it('L1-AUTH-FE-04: submits valid credentials and calls API', async () => {
    const onLoginSuccess = vi.fn();
    apiClient.apiRequest.mockResolvedValueOnce({ user: { email: 'test@example.com' } });

    renderLogin({ onLoginSuccess });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(apiClient.apiRequest).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        body: { email: 'test@example.com', password: 'password123' },
      });
      expect(onLoginSuccess).toHaveBeenCalledWith({
        user: { email: 'test@example.com' },
        rememberEmail: '',
      });
    });
  });

  it('L1-AUTH-FE-05: shows error message on API failure', async () => {
    apiClient.apiRequest.mockRejectedValueOnce(new Error('Invalid credentials'));

    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('L1-AUTH-FE-06: shows retry countdown when login is rate limited', async () => {
    const rateLimitError = new Error('Too many requests');
    rateLimitError.status = 429;
    rateLimitError.retryAfterSeconds = 453;
    apiClient.apiRequest.mockRejectedValueOnce(rateLimitError);

    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Too many login attempts/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Try again in 7m 33s/i })).toBeDisabled();
    });
  });
});
