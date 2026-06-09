const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');

const profileRepository = require('../../repositories/profileRepository');
const bcrypt = require('bcryptjs');
const emailService = require('../../services/emailService');

const adminService = require('../../services/adminService');
const { AdminError } = adminService;

describe('Admin Service', () => {

    afterEach(() => {
        mock.restoreAll();
    });

    describe('getAllUsers', () => {
        it('L1-AS-01 [EP-Valid] (FE-06 / UC-03): getAllUsers - should return a list of multiple users', async () => {

            const mockUsers = [{ id: 1, email: 'user1@example.com' }, { id: 2, email: 'user2@example.com' }];
            mock.method(profileRepository, 'getAllUsers', async () => mockUsers);

            const result = await adminService.getAllUsers();

            assert.deepStrictEqual(result, mockUsers);
        });

        it('L1-AS-02 [BVA-Min] (FE-06 / UC-03): getAllUsers - should return an empty array if no users exist', async () => {

            mock.method(profileRepository, 'getAllUsers', async () => []);

            const result = await adminService.getAllUsers();

            assert.deepStrictEqual(result, []);
        });

        it('L1-AS-03 [BVA-Min+1] (FE-06 / UC-03): getAllUsers - should return exactly one user', async () => {

            const mockUser = [{ id: 1, email: 'alone@example.com' }];
            mock.method(profileRepository, 'getAllUsers', async () => mockUser);

            const result = await adminService.getAllUsers();

            assert.deepStrictEqual(result, mockUser);
        });

        it('L1-AS-04 [EP-Invalid] (FE-06 / UC-03): getAllUsers - should propagate database connection error', async () => {

            mock.method(profileRepository, 'getAllUsers', async () => { throw new Error('Connection Error'); });

            await assert.rejects(() => adminService.getAllUsers(), { message: 'Connection Error' });
        });

        it('L1-AS-05 [EP-Invalid] (FE-06 / UC-03): getAllUsers - should propagate database timeout error', async () => {

            mock.method(profileRepository, 'getAllUsers', async () => { throw new Error('Timeout Error'); });

            await assert.rejects(() => adminService.getAllUsers(), { message: 'Timeout Error' });
        });

        it('L1-AS-06 [Guard-FALSE] (FE-06 / UC-03): getAllUsers - should return null if repository behaves unexpectedly', async () => {

            mock.method(profileRepository, 'getAllUsers', async () => null);

            const result = await adminService.getAllUsers();

            assert.strictEqual(result, null);
        });

        it('L1-AS-07 [EP-Invalid] (FE-06 / UC-03): getAllUsers - should propagate generic server crash', async () => {

            mock.method(profileRepository, 'getAllUsers', async () => { throw new Error('Crash'); });

            await assert.rejects(() => adminService.getAllUsers(), { message: 'Crash' });
        });
    });

    describe('createUser', () => {
        beforeEach(() => {
            mock.method(bcrypt, 'genSalt', async () => 'somesalt');
            mock.method(bcrypt, 'hash', async () => 'hashedpassword');
            mock.method(emailService, 'sendWelcomeEmail', async () => {});
        });

        it('L1-AS-08 [EP-Valid] (FE-06 / UC-03): createUser - should create user with all fields successfully', async () => {

            mock.method(profileRepository, 'getRoleIdByName', async () => 1);
            mock.method(profileRepository, 'getAccountByEmail', async () => null);
            mock.method(profileRepository, 'adminCreateUser', async () => 100);

            const newId = await adminService.createUser('test@example.com', 'Full Name', '0123456789', 'admin');

            assert.strictEqual(newId, 100);
            assert.strictEqual(emailService.sendWelcomeEmail.mock.calls.length, 1);
        });

        it('L1-AS-09 [BVA-Min] (FE-06 / UC-03): createUser - should create user with missing name and phone fallback', async () => {

            mock.method(profileRepository, 'getRoleIdByName', async () => 1);
            mock.method(profileRepository, 'getAccountByEmail', async () => null);
            mock.method(profileRepository, 'adminCreateUser', async () => 101);

            const newId = await adminService.createUser('test2@example.com', undefined, undefined, 'admin');

            assert.strictEqual(newId, 101);
            const createArgs = profileRepository.adminCreateUser.mock.calls[0].arguments;
            assert.strictEqual(createArgs[3], '');
            assert.strictEqual(createArgs[4], null);
        });

        it('L1-AS-10 [Guard-FALSE] (FE-06 / UC-03): createUser - should throw 400 if email is missing', async () => {

            await assert.rejects(
                () => adminService.createUser('', 'Name', '123', 'admin'),
                (err) => err instanceof AdminError && err.status === 400 && err.message === 'Thiếu thông tin bắt buộc (email, role).'
            );
        });

        it('L1-AS-11 [Guard-FALSE] (FE-06 / UC-03): createUser - should throw 400 if role is missing', async () => {

            await assert.rejects(
                () => adminService.createUser('test@test.com', 'Name', '123', ''),
                (err) => err instanceof AdminError && err.status === 400 && err.message === 'Thiếu thông tin bắt buộc (email, role).'
            );
        });

        it('L1-AS-12 [EP-Invalid] (FE-06 / UC-03): createUser - should throw 400 if role is invalid', async () => {

            mock.method(profileRepository, 'getRoleIdByName', async () => null);

            await assert.rejects(
                () => adminService.createUser('test@test.com', 'Name', '123', 'invalid'),
                (err) => err instanceof AdminError && err.status === 400 && err.message === 'Vai trò không hợp lệ.'
            );
        });

        it('L1-AS-13 [EP-Invalid] (FE-06 / UC-03): createUser - should throw 409 if email already exists', async () => {

            mock.method(profileRepository, 'getRoleIdByName', async () => 1);
            mock.method(profileRepository, 'getAccountByEmail', async () => ({ id: 1 }));

            await assert.rejects(
                () => adminService.createUser('existing@test.com', 'Name', '123', 'admin'),
                (err) => err instanceof AdminError && err.status === 409 && err.message === 'Email đã tồn tại.'
            );
        });

        it('L1-AS-14 [EP-Invalid] (FE-06 / UC-03): createUser - should throw 409 on DB duplicate code 23505', async () => {

            mock.method(profileRepository, 'getRoleIdByName', async () => 1);
            mock.method(profileRepository, 'getAccountByEmail', async () => null);
            const error = new Error('Dup'); error.code = '23505';
            mock.method(profileRepository, 'adminCreateUser', async () => { throw error; });

            await assert.rejects(
                () => adminService.createUser('new@test.com', 'Name', '123', 'admin'),
                (err) => err instanceof AdminError && err.status === 409 && err.message === 'Số điện thoại hoặc Email đã tồn tại.'
            );
        });
    });

    describe('updateUser', () => {
        it('L1-AS-15 [EP-Valid] (FE-06 / UC-04): updateUser - should update user with all valid fields', async () => {

            mock.method(profileRepository, 'getRoleIdByName', async () => 2);
            mock.method(profileRepository, 'adminUpdateUser', async () => {});

            await adminService.updateUser(1, 'Updated', '999', 'manager');

            const updateArgs = profileRepository.adminUpdateUser.mock.calls[0].arguments;
            assert.deepStrictEqual(updateArgs[1], { full_name: 'Updated', phone: '999' });
        });

        it('L1-AS-16 [BVA-Min] (FE-06 / UC-04): updateUser - should update user with undefined name and phone', async () => {

            mock.method(profileRepository, 'getRoleIdByName', async () => 2);
            mock.method(profileRepository, 'adminUpdateUser', async () => {});

            await adminService.updateUser(1, undefined, undefined, 'manager');

            const updateArgs = profileRepository.adminUpdateUser.mock.calls[0].arguments;
            assert.deepStrictEqual(updateArgs[1], { full_name: undefined, phone: undefined });
        });

        it('L1-AS-17 [Guard-FALSE] (FE-06 / UC-04): updateUser - should throw 400 if role is missing', async () => {

            await assert.rejects(
                () => adminService.updateUser(1, 'Updated', '999', undefined),
                (err) => err instanceof AdminError && err.status === 400 && err.message === 'Vai trò không được để trống.'
            );
        });

        it('L1-AS-18 [Guard-FALSE] (FE-06 / UC-04): updateUser - should throw 400 if role is empty string', async () => {

            await assert.rejects(
                () => adminService.updateUser(1, 'Updated', '999', ''),
                (err) => err instanceof AdminError && err.status === 400 && err.message === 'Vai trò không được để trống.'
            );
        });

        it('L1-AS-19 [EP-Invalid] (FE-06 / UC-04): updateUser - should throw 400 if role is invalid', async () => {

            mock.method(profileRepository, 'getRoleIdByName', async () => null);

            await assert.rejects(
                () => adminService.updateUser(1, 'Updated', '999', 'ghost'),
                (err) => err instanceof AdminError && err.status === 400 && err.message === 'Vai trò không hợp lệ.'
            );
        });

        it('L1-AS-20 [EP-Invalid] (FE-06 / UC-04): updateUser - should throw 409 on DB duplicate code 23505', async () => {

            mock.method(profileRepository, 'getRoleIdByName', async () => 2);
            const error = new Error('Dup'); error.code = '23505';
            mock.method(profileRepository, 'adminUpdateUser', async () => { throw error; });

            await assert.rejects(
                () => adminService.updateUser(1, 'Updated', '999', 'manager'),
                (err) => err instanceof AdminError && err.status === 409 && err.message === 'Số điện thoại đã tồn tại.'
            );
        });

        it('L1-AS-21 [EP-Invalid] (FE-06 / UC-04): updateUser - should propagate generic DB errors', async () => {

            mock.method(profileRepository, 'getRoleIdByName', async () => 2);
            mock.method(profileRepository, 'adminUpdateUser', async () => { throw new Error('DB Down'); });

            await assert.rejects(
                () => adminService.updateUser(1, 'Updated', '999', 'manager'),
                { message: 'DB Down' }
            );
        });
    });

    describe('toggleUserStatus', () => {
        it('L1-AS-22 [State-Valid] (FE-06 / UC-05): toggleUserStatus - should successfully lock account by passing false', async () => {

            mock.method(profileRepository, 'adminToggleUserStatus', async () => {});

            await adminService.toggleUserStatus(2, false, 1);

            const args = profileRepository.adminToggleUserStatus.mock.calls[0].arguments;
            assert.strictEqual(args[0], 2);
            assert.strictEqual(args[1], false);
        });

        it('L1-AS-23 [State-Valid] (FE-06 / UC-05): toggleUserStatus - should successfully unlock account by passing true', async () => {

            mock.method(profileRepository, 'adminToggleUserStatus', async () => {});

            await adminService.toggleUserStatus(2, true, 1);

            const args = profileRepository.adminToggleUserStatus.mock.calls[0].arguments;
            assert.strictEqual(args[1], true);
        });

        it('L1-AS-24 [Guard-FALSE] (FE-06 / UC-05): toggleUserStatus - should throw 400 if current user attempts to lock themselves', async () => {

            await assert.rejects(
                () => adminService.toggleUserStatus(1, false, 1),
                (err) => err instanceof AdminError && err.status === 400 && err.message === 'Không thể tự khoá tài khoản của chính mình.'
            );
        });

        it('L1-AS-25 [EP-Invalid] (FE-06 / UC-05): toggleUserStatus - should throw 400 if current user attempts to lock themselves with string ID', async () => {

            await assert.rejects(
                () => adminService.toggleUserStatus('1', false, 1),
                (err) => err instanceof AdminError && err.status === 400 && err.message === 'Không thể tự khoá tài khoản của chính mình.'
            );
        });

        it('L1-AS-26 [Guard-FALSE] (FE-06 / UC-05): toggleUserStatus - should throw 400 if is_active is undefined', async () => {

            await assert.rejects(
                () => adminService.toggleUserStatus(2, undefined, 1),
                (err) => err instanceof AdminError && err.status === 400 && err.message === 'Thiếu is_active.'
            );
        });

        it('L1-AS-27 [EP-Invalid] (FE-06 / UC-05): toggleUserStatus - should propagate generic DB errors', async () => {

            mock.method(profileRepository, 'adminToggleUserStatus', async () => { throw new Error('DB Error'); });

            await assert.rejects(
                () => adminService.toggleUserStatus(2, false, 1),
                { message: 'DB Error' }
            );
        });

        it('L1-AS-28 [EP-Invalid] (FE-06 / UC-05): toggleUserStatus - should propagate DB timeout errors', async () => {

            mock.method(profileRepository, 'adminToggleUserStatus', async () => { throw new Error('Timeout Error'); });

            await assert.rejects(
                () => adminService.toggleUserStatus(2, false, 1),
                { message: 'Timeout Error' }
            );
        });
    });
});
