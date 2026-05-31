export type LoginFormErrors = {
  email?: string;
  password?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginForm(email: string, password: string): LoginFormErrors {
  const errors: LoginFormErrors = {};
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    errors.email = 'Vui l\u00f2ng nh\u1eadp email.';
  } else if (!emailPattern.test(normalizedEmail)) {
    errors.email = 'Email kh\u00f4ng \u0111\u00fang \u0111\u1ecbnh d\u1ea1ng.';
  }

  if (!password) {
    errors.password = 'Vui l\u00f2ng nh\u1eadp m\u1eadt kh\u1ea9u.';
  } else if (password.length < 6) {
    errors.password = 'M\u1eadt kh\u1ea9u ph\u1ea3i c\u00f3 \u00edt nh\u1ea5t 6 k\u00fd t\u1ef1.';
  }

  return errors;
}

export function hasLoginErrors(errors: LoginFormErrors) {
  return Boolean(errors.email || errors.password);
}
