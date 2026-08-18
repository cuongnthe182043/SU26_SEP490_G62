/**
 * Cuộc đua khi xoay (rotate) refresh token.
 *
 * Vì sao có test này: sau ~15 phút idle, access-token cookie hết hạn và mọi thứ trên client
 * cùng phát hiện một lượt — request người dùng vừa bấm, hai WebSocket reconnect, các tab khác
 * đang mở. Chúng gửi /auth/refresh song song với CÙNG một refresh token cũ. Trước đây lời gọi
 * tới sau nhận 401 "revoked", và controller phản hồi kèm lệnh xoá cookie refresh_token —
 * xoá đúng token MỚI mà lời gọi thắng vừa cấp. Phiên mất sạch refresh token, người dùng phải
 * F5 thủ công (access token vừa được cấp mới nên reload lại chạy được, che mất lỗi thật).
 *
 * Test khoá hai hành vi: (1) service có cửa sổ ân hạn cho bản sao của cuộc đua,
 * (2) controller không xoá cookie khi thất bại chỉ vì đua.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'TEST_SECRET_REFRESH_RACE';

const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

// Kho refresh token trong bộ nhớ, mô phỏng đúng ngữ nghĩa SQL của authRepository —
// đặc biệt là COALESCE($2, replaced_by_token_id) và COALESCE(revoked_at, NOW()).
const mockRefreshTokens = new Map();
const mockAccounts = new Map();

jest.mock('../../repositories/authRepository', () => ({
    ensureRefreshTokenTable: async () => {},
    insertRefreshToken: async ({ tokenId, userId, tokenHash, expiresAt }) => {
        mockRefreshTokens.set(tokenId, {
            token_id: tokenId,
            user_id: userId,
            token_hash: tokenHash,
            expires_at: expiresAt,
            revoked_at: null,
            replaced_by_token_id: null,
        });
    },
    revokeRefreshToken: async (tokenId, replacedByTokenId = null) => {
        const row = mockRefreshTokens.get(tokenId);
        if (!row) return;
        row.revoked_at = row.revoked_at ?? new Date();
        row.replaced_by_token_id = replacedByTokenId ?? row.replaced_by_token_id;
    },
    getRefreshTokenById: async (tokenId) => {
        const row = mockRefreshTokens.get(tokenId);
        return row ? { ...row } : null;
    },
}));

jest.mock('../../repositories/profileRepository', () => ({
    getAccountById: async (id) => mockAccounts.get(Number(id)) ?? null,
    getProfileByAccountId: async () => ({ full_name: 'Nguoi Dung Test', phone: null, avatar_url: null, role_id: 3 }),
}));

jest.mock('../../config/logger', () => ({
    info: () => {}, warn: () => {}, error: () => {}, debug: () => {},
}));

const authService = require('../../services/authService');
const authController = require('../../controllers/authController');

const USER_ID = 42;
const REFRESH_SECRET = `${process.env.JWT_SECRET}_refresh`;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Phát một refresh token hợp lệ y như issueSession làm, nhưng không cần chạy qua login.
const seedRefreshToken = () => {
    const tokenId = crypto.randomUUID();
    const token = jwt.sign(
        { userId: USER_ID, email: 'test@example.com', role: 'driver', tokenType: 'refresh', tokenId },
        REFRESH_SECRET,
        { expiresIn: '7d' },
    );

    mockRefreshTokens.set(tokenId, {
        token_id: tokenId,
        user_id: USER_ID,
        token_hash: hashToken(token),
        expires_at: new Date(Date.now() + authService.REFRESH_TOKEN_TTL_MS),
        revoked_at: null,
        replaced_by_token_id: null,
    });

    return { tokenId, token };
};

const tokenIdOf = (rawToken) => jwt.verify(rawToken, REFRESH_SECRET).tokenId;

// Đẩy thời điểm revoke lùi lại quá cửa sổ ân hạn, thay cho việc phải chờ thật.
const ageRevocationBeyondGrace = (tokenId) => {
    const row = mockRefreshTokens.get(tokenId);
    row.revoked_at = new Date(Date.now() - authService.REFRESH_ROTATION_GRACE_MS - 1000);
};

beforeEach(() => {
    mockRefreshTokens.clear();
    mockAccounts.clear();
    mockAccounts.set(USER_ID, {
        id: USER_ID, email: 'test@example.com', role: 'driver', role_id: 3, is_active: true,
    });
});

describe('authService.refreshSession — cửa sổ ân hạn khi rotate', () => {
    it('G62-BE-RT01: gửi lại token vừa bị xoay (trong ân hạn) vẫn nhận được phiên hợp lệ', async () => {
        const { token } = seedRefreshToken();

        const winner = await authService.refreshSession(token);
        // Lời gọi thua cuộc: đã cầm token cũ trên tay từ trước khi winner kịp xoay.
        const loser = await authService.refreshSession(token);

        expect(winner.accessToken).toBeTruthy();
        expect(loser.accessToken).toBeTruthy();
        expect(loser.refreshToken).toBeTruthy();
        expect(loser.user.id).toBe(USER_ID);
    });

    it('G62-BE-RT02: bản sao của cuộc đua KHÔNG vô hiệu hoá token mà lời gọi thắng vừa cấp', async () => {
        const { tokenId: originalId, token } = seedRefreshToken();

        const winner = await authService.refreshSession(token);
        const winnerTokenId = tokenIdOf(winner.refreshToken);

        await authService.refreshSession(token);

        // Token của winner vẫn sống — client thắng cuộc đang cầm nó trong cookie jar.
        expect(mockRefreshTokens.get(winnerTokenId).revoked_at).toBeNull();
        // Mắt xích tới bản thay thế không bị ghi đè, nên lần gửi lại thứ ba vẫn nhận ra cuộc đua.
        expect(mockRefreshTokens.get(originalId).replaced_by_token_id).toBe(winnerTokenId);
    });

    it('G62-BE-RT03: hai lời gọi thật sự song song đều thành công', async () => {
        const { token } = seedRefreshToken();

        const results = await Promise.all([
            authService.refreshSession(token),
            authService.refreshSession(token),
        ]);

        expect(results.every((r) => Boolean(r.accessToken && r.refreshToken))).toBe(true);
    });

    it('G62-BE-RT04: gửi lại token đã xoay SAU cửa sổ ân hạn thì bị từ chối', async () => {
        const { tokenId, token } = seedRefreshToken();

        await authService.refreshSession(token);
        ageRevocationBeyondGrace(tokenId);

        await expect(authService.refreshSession(token)).rejects.toMatchObject({
            status: 401,
            code: 'REFRESH_TOKEN_REVOKED',
        });
    });

    it('G62-BE-RT05: token bị thu hồi do logout (không phải do xoay) bị từ chối ngay', async () => {
        const { token } = seedRefreshToken();

        await authService.revokeRefreshToken(token);

        // Không có replaced_by_token_id ⇒ không phải cuộc đua ⇒ ân hạn không áp dụng.
        await expect(authService.refreshSession(token)).rejects.toMatchObject({
            status: 401,
            code: 'REFRESH_TOKEN_REVOKED',
        });
    });

    it('G62-BE-RT06: ân hạn không áp dụng khi bản thay thế cũng đã bị thu hồi', async () => {
        const { token } = seedRefreshToken();

        const winner = await authService.refreshSession(token);
        // Người dùng đăng xuất bằng token mới ⇒ cả chuỗi phải chết theo.
        await authService.revokeRefreshToken(winner.refreshToken);

        await expect(authService.refreshSession(token)).rejects.toMatchObject({
            status: 401,
            code: 'REFRESH_TOKEN_REVOKED',
        });
    });

    it('G62-BE-RT07: token khác trùng tokenId nhưng lệch hash vẫn bị chặn', async () => {
        const { tokenId } = seedRefreshToken();
        // Cùng tokenId nhưng nội dung khác ⇒ chuỗi JWT khác ⇒ hash không khớp bản đã lưu.
        const forged = jwt.sign(
            { userId: USER_ID, email: 'attacker@example.com', role: 'manager', tokenType: 'refresh', tokenId },
            REFRESH_SECRET,
            { expiresIn: '7d' },
        );

        await expect(authService.refreshSession(forged)).rejects.toMatchObject({
            status: 401,
            code: 'REFRESH_TOKEN_MISMATCH',
        });
    });
});

describe('POST /auth/refresh — dọn cookie có chọn lọc', () => {
    const buildApp = () => {
        const app = express();
        app.use(express.json());
        app.post('/auth/refresh', authController.refresh);
        return app;
    };

    const clearsRefreshCookie = (res) => (res.headers['set-cookie'] ?? []).some(
        (cookie) => cookie.startsWith('refresh_token=;') || /refresh_token=;/.test(cookie),
    );

    it('G62-BE-RT08: thất bại vì đua (token đã xoay) KHÔNG xoá cookie refresh_token', async () => {
        const { tokenId, token } = seedRefreshToken();
        await authService.refreshSession(token);
        ageRevocationBeyondGrace(tokenId);

        const res = await request(buildApp())
            .post('/auth/refresh')
            .set('Cookie', [`refresh_token=${token}`]);

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('REFRESH_TOKEN_REVOKED');
        // Cookie jar lúc này đang giữ token MỚI của lời gọi thắng — xoá là mất phiên.
        expect(clearsRefreshCookie(res)).toBe(false);
    });

    it('G62-BE-RT09: cuộc đua trong ân hạn trả 200 và cấp lại cookie', async () => {
        const { token } = seedRefreshToken();
        await authService.refreshSession(token);

        const res = await request(buildApp())
            .post('/auth/refresh')
            .set('Cookie', [`refresh_token=${token}`]);

        expect(res.status).toBe(200);
        expect(clearsRefreshCookie(res)).toBe(false);
        expect((res.headers['set-cookie'] ?? []).some((c) => c.startsWith('auth_token='))).toBe(true);
    });

    it('G62-BE-RT10: không có refresh token thì vẫn dọn cookie như cũ', async () => {
        const res = await request(buildApp()).post('/auth/refresh');

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('REFRESH_TOKEN_MISSING');
        expect(clearsRefreshCookie(res)).toBe(true);
    });

    it('G62-BE-RT11: refresh token hết hạn thì vẫn dọn cookie như cũ', async () => {
        const { tokenId, token } = seedRefreshToken();
        mockRefreshTokens.get(tokenId).expires_at = new Date(Date.now() - 1000);

        const res = await request(buildApp())
            .post('/auth/refresh')
            .set('Cookie', [`refresh_token=${token}`]);

        expect(res.status).toBe(401);
        expect(res.body.code).toBe('REFRESH_TOKEN_EXPIRED');
        expect(clearsRefreshCookie(res)).toBe(true);
    });
});
