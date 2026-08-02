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

    // Tài xế nhớ số điện thoại của mình hơn là email công ty cấp
    it.each([
        ['0901000001', 'di động 09'],
        ['0352345678', 'di động 03'],
        ['+84901000001', 'dạng quốc tế +84'],
        ['84901000001', 'dạng quốc tế không dấu +'],
        ['0901 000 001', 'có dấu cách'],
        ['0901-000-001', 'có dấu gạch'],
        ['0287654321', 'số cố định 02'],
    ])('chấp nhận số điện thoại hợp lệ: %s (%s)', (phone) => {
        const errors = validateLoginForm(phone, 'abc123');
        expect(errors.email).toBeUndefined();
    });

    it.each([
        ['0901000', 'thiếu số'],
        ['09010000012345', 'thừa số'],
        ['0101000001', 'đầu số không tồn tại'],
        ['1234567890', 'không bắt đầu bằng 0'],
    ])('từ chối số điện thoại không hợp lệ: %s (%s)', (phone) => {
        const errors = validateLoginForm(phone, 'abc123');
        expect(errors.email).toMatch(/số điện thoại không hợp lệ/i);
    });

    it('gõ toàn số mà sai thì báo lỗi số điện thoại, không báo lỗi email', () => {
        expect(validateLoginForm('0901000', 'abc123').email).toMatch(/số điện thoại/i);
        expect(validateLoginForm('notanemail', 'abc123').email).toMatch(/định dạng/i);
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
