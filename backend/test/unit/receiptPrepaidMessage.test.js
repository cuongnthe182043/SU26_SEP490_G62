/**
 * L1 Unit Test — câu báo khi tài xế đóng phiếu thu 0đ (tripController.recordReceiptCollection)
 *
 * Phiếu 0đ có hai lý do nói hai chuyện khác nhau với tài xế:
 *   - khách ứng trước đủ/DƯ: không thu thêm; phần dư CÔNG TY hoàn qua Kế toán (phiếu hoàn
 *     tạo sẵn lúc điều phối duyệt) — tài không tự trả tiền lại cho khách;
 *   - hàng hư hại: không phát sinh khoản phải thu nào.
 */
jest.mock('../../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../config/logger', () => ({
    warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../services/tripService');

const tripService = require('../../services/tripService');
const tripController = require('../../controllers/tripController');

const call = async (result) => {
    tripService.recordReceiptCollection.mockResolvedValue(result);
    const req = { params: { orrId: '12' }, body: { payment_type: 'client_credit' }, user: { userId: 5 } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await tripController.recordReceiptCollection(req, res);
    return res.json.mock.calls[0][0];
};

it('khách trả trước DƯ → nêu số trả trước, số phải trả, phần dư công ty hoàn', async () => {
    const body = await call({ nothingToCollect: true, prepaidAmount: 5_000_000, prepaidRefundDue: 1_500_000 });

    expect(body.message).toContain('Khách đã trả trước 5.000.000');
    expect(body.message).toContain('nhiều hơn số phải trả 3.500.000');
    expect(body.message).toContain('Phần dư 1.500.000đ công ty sẽ hoàn lại cho khách qua Kế toán');
    expect(body.message).toContain('bạn không cần trả lại tiền cho khách');
    expect(body).toMatchObject({ nothingToCollect: true, prepaidRefundDue: 1_500_000 });
});

it('khách trả trước VỪA ĐỦ → không nhắc hoàn tiền', async () => {
    const body = await call({ nothingToCollect: true, prepaidAmount: 3_000_000, prepaidRefundDue: 0 });
    expect(body.message).toContain('Khách đã trả trước đủ 3.000.000');
    expect(body.message).not.toContain('hoàn');
});

it('phiếu 0đ không do trả trước (hàng hư hại) → câu chung, không nhắc trả trước', async () => {
    const body = await call({ nothingToCollect: true, prepaidAmount: 0, prepaidRefundDue: 0 });
    expect(body.message).toBe('Đã đóng phiếu thu 0đ — không phát sinh khoản phải thu nào.');
});

it('phiếu có tiền thu bình thường → giữ câu cũ', async () => {
    const body = await call({ nothingToCollect: false, prepaidAmount: 1_000_000, prepaidRefundDue: 0 });
    expect(body.message).toBe('Đã ghi nhận thanh toán phiếu thu');
});
