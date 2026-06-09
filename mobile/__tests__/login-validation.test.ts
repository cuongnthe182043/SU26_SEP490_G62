import { validateLoginForm, hasLoginErrors } from '@/features/auth/login-validation';

describe('validateLoginForm', () => {
    it('trả về lỗi khi email và password đều rỗng', () => {
        const errors = validateLoginForm('', '');
        expect(errors.email).toBeTruthy();
        expect(errors.password).toBeTruthy();
    });

    it('trả về lỗi khi email sai format', () => {
        const errors = validateLoginForm('notanemail', 'abc123');
        expect(errors.email).toMatch(/định dạng/i);
        expect(errors.password).toBeUndefined();
    });

    it('trả về lỗi khi password dưới 6 ký tự', () => {
        const errors = validateLoginForm('driver@g62.com', '123');
        expect(errors.email).toBeUndefined();
        expect(errors.password).toMatch(/6 ký tự/i);
    });

    it('không có lỗi khi email và password hợp lệ', () => {
        const errors = validateLoginForm('driver@g62.com', 'abc123');
        expect(errors.email).toBeUndefined();
        expect(errors.password).toBeUndefined();
    });

    it('trim whitespace trước khi validate email', () => {
        const errors = validateLoginForm('  driver@g62.com  ', 'abc123');
        expect(errors.email).toBeUndefined();
    });
});

describe('hasLoginErrors', () => {
    it('trả về true khi có lỗi', () => {
        expect(hasLoginErrors({ email: 'lỗi gì đó' })).toBe(true);
        expect(hasLoginErrors({ password: 'lỗi gì đó' })).toBe(true);
    });

    it('trả về false khi không có lỗi', () => {
        expect(hasLoginErrors({})).toBe(false);
    });
});
