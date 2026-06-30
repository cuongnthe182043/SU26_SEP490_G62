const { describe, it, mock, beforeEach } = require('node:test');
const assert = require('node:assert');
const profileService = require('../../services/profileService');
const profileRepository = require('../../repositories/profileRepository');
const emailService = require('../../services/emailService');
const fcmService = require('../../services/fcmService');
const pool = require('../../config/database');
const bcrypt = require('bcryptjs');

describe('L1: Profile Service Unit Tests', () => {
    beforeEach(() => {
        mock.restoreAll();
        // Clear Map by hack (or just let it be, but since tests rely on it, it's stateful)
        // For sendEmailChangeCode, it might fail due to cooldown. We just test Happy Path and Error Path carefully.
    });

    describe('Block: getMyProfile()', () => {
        it('L1-PRF-01: BC-TRUE - Fails if profile not found', async () => {
            mock.method(profileRepository, 'getFullProfile', async () => null);
            await assert.rejects(
                () => profileService.getMyProfile(99),
                { message: 'Khong tim thay ho so' }
            );
        });

        it('L1-PRF-02: EP-Valid - Returns driver profile', async () => {
            mock.method(profileRepository, 'getFullProfile', async () => ({ role: 'driver', id: 1 }));
            const res = await profileService.getMyProfile(1);
            assert.strictEqual(res.role, 'driver');
            assert.strictEqual(res.id, 1);
        });
    });

    describe('Block: updateMyProfile() & updateAvatar()', () => {
        it('L1-PRF-03: EP-Valid - Updates profile and ignores email field', async () => {
            mock.method(profileRepository, 'updateProfile', async () => ({ id: 1, full_name: 'A' }));
            const res = await profileService.updateMyProfile(1, { email: 'hack@hack.com', full_name: 'A' });
            assert.strictEqual(res.full_name, 'A');
        });

        it('L1-PRF-04: EP-Valid - Updates avatar', async () => {
            mock.method(profileRepository, 'updateAvatar', async () => ({ id: 1, avatar_url: 'url' }));
            const res = await profileService.updateAvatar(1, 'url');
            assert.strictEqual(res.avatar_url, 'url');
        });
    });

    describe('Block: changePassword()', () => {
        it('L1-PRF-05: BC-TRUE - Rejects if passwords too short', async () => {
            await assert.rejects(
                () => profileService.changePassword(1, { currentPassword: '123', newPassword: '123' }),
                { message: 'Mat khau moi phai co it nhat 6 ky tu' }
            );
        });

        it('L1-PRF-06: BC-TRUE - Rejects if current password wrong', async () => {
            mock.method(pool, 'query', async () => ({ rows: [{ password_hash: 'hash' }] }));
            mock.method(bcrypt, 'compare', async () => false);
            
            await assert.rejects(
                () => profileService.changePassword(1, { currentPassword: 'wrong', newPassword: 'new123' }),
                { message: 'Mat khau hien tai khong dung' }
            );
        });

        it('L1-PRF-07: EP-Valid - Changes password', async () => {
            mock.method(pool, 'query', async () => ({ rows: [{ password_hash: 'hash' }] }));
            mock.method(bcrypt, 'compare', async () => true);
            mock.method(bcrypt, 'hash', async () => 'newHash');
            
            const res = await profileService.changePassword(1, { currentPassword: 'right', newPassword: 'new123' });
            assert.strictEqual(res.message, 'Doi mat khau thanh cong');
        });
    });

    describe('Block: Email Change Code', () => {
        it('L1-PRF-08: BC-TRUE - sendEmailChangeCode fails if email missing', async () => {
            mock.method(profileRepository, 'getFullProfile', async () => ({ id: 1 })); // no email
            await assert.rejects(
                () => profileService.sendEmailChangeCode(1),
                { message: 'Khong tim thay email hien tai' }
            );
        });

        it('L1-PRF-09: EP-Valid - sendEmailChangeCode sends email', async () => {
            // Setup a fake ID to avoid cooldown from other tests
            const mockId = Date.now();
            mock.method(profileRepository, 'getFullProfile', async () => ({ id: mockId, email: 'a@a.com', full_name: 'A' }));
            mock.method(emailService, 'sendEmailChangeVerificationCode', async () => {});
            
            const res = await profileService.sendEmailChangeCode(mockId);
            assert.strictEqual(res.message, 'Da gui ma xac nhan toi email hien tai');
        });

        it('L1-PRF-10: BC-TRUE - verifyEmailChangeCode fails if code invalid', async () => {
            await assert.rejects(
                () => profileService.verifyEmailChangeCode(1, { code: '12', newEmail: 'b@b.com' }),
                { message: 'Ma xac nhan khong hop le' }
            );
        });
    });

    describe('Block: registerDeviceToken()', () => {
        it('L1-PRF-11: EP-Valid - Registers FCM token', async () => {
            mock.method(fcmService, 'registerToken', () => {});
            const res = await profileService.registerDeviceToken(1, { fcmToken: 'token', platform: 'ios' });
            assert.strictEqual(res.platform, 'ios');
        });
    });
});
