const { mock } = require('../helpers/nodeTestMock');
const assert = require('node:assert');
const leaveService = require('../../services/leaveService');
const leaveRepository = require('../../repositories/leaveRepository');

// Ngày phải tính THEO HÔM NAY, không gõ cứng: createLeave chặn ngày lùi/tiến quá
// 3 tháng nên mọi ngày cố định sẽ hỏng test khi thời gian trôi qua.
const ngayVN = (lechNgay = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + lechNgay);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
};

describe('Leave Service Unit Tests (L1)', () => {
    beforeEach(() => {
        mock.restoreAll();
        // Service tra bảng lương kỳ đó đã chốt chưa — mặc định coi như chưa có,
        // test nào cần kiểm tra guard này thì tự mock đè lại.
        mock.method(leaveRepository, 'getPayrollStatus', async () => null);
    });

    it('L1-LEAVE-01: getMyLeaves - should call repository without filters', async () => {
        mock.method(leaveRepository, 'getDriverLeaves', async () => [{ id: 1 }]);
        await leaveService.getMyLeaves(2, {});
        const call = leaveRepository.getDriverLeaves.mock.calls[0];
        assert.deepStrictEqual(call.arguments[1], { month: null, year: null });
    });

    it('L1-LEAVE-02: getMyLeaves - should call repository with parsed month/year', async () => {
        mock.method(leaveRepository, 'getDriverLeaves', async () => [{ id: 1 }]);
        const result = await leaveService.getMyLeaves(2, { month: '5', year: '2025' });
        assert.strictEqual(result.length, 1);
        const call = leaveRepository.getDriverLeaves.mock.calls[0];
        assert.strictEqual(call.arguments[0], 2);
        assert.deepStrictEqual(call.arguments[1], { month: 5, year: 2025 });
    });

    it('L1-LEAVE-03: getSummary - should call repository with current month/year if not provided', async () => {
        mock.method(leaveRepository, 'getAttendanceSummary', async () => ({ working_days: 20 }));
        const result = await leaveService.getSummary(2, {});
        assert.strictEqual(result.working_days, 20);
        const call = leaveRepository.getAttendanceSummary.mock.calls[0];
        assert.strictEqual(call.arguments[1].month, new Date().getMonth() + 1);
        assert.strictEqual(call.arguments[1].year, new Date().getFullYear());
    });

    it('L1-LEAVE-04: getSummary - should call repository with explicit date', async () => {
        mock.method(leaveRepository, 'getAttendanceSummary', async () => ({ working_days: 22 }));
        await leaveService.getSummary(2, { month: '10', year: '2026' });
        const call = leaveRepository.getAttendanceSummary.mock.calls[0];
        assert.strictEqual(call.arguments[1].month, 10);
        assert.strictEqual(call.arguments[1].year, 2026);
    });

    it('L1-LEAVE-05: createLeave - should throw if missing date', async () => {
        await assert.rejects(
            leaveService.createLeave(2, { leaveType: 'paid' }),
            /Ngày nghỉ là bắt buộc/
        );
    });

    it('L1-LEAVE-06: createLeave - should throw if invalid type', async () => {
        await assert.rejects(
            leaveService.createLeave(2, { leaveDate: '2025-10-10', leaveType: 'annual' }),
            /Loại nghỉ không hợp lệ/
        );
    });

    it('L1-LEAVE-07: createLeave - should call repo if valid', async () => {
        mock.method(leaveRepository, 'createLeave', async () => ({ id: 5 }));
        const result = await leaveService.createLeave(2, { leaveDate: ngayVN(7), leaveType: 'paid', reason: 'sick' });
        assert.strictEqual(result.id, 5);
    });

    // Ngày do client gửi lên nên không tin được: đồng hồ máy sai hoặc gõ nhầm năm
    // phải bị chặn ngay ở service, đừng để lọt vào DB rồi sai lúc tính lương.
    it('L1-LEAVE-09: createLeave - chặn ngày sai định dạng', async () => {
        await assert.rejects(
            leaveService.createLeave(2, { leaveDate: '10/10/2026', leaveType: 'paid' }),
            /định dạng YYYY-MM-DD/,
        );
    });

    it('L1-LEAVE-10: createLeave - chặn ngày quá xa trong tương lai', async () => {
        await assert.rejects(
            leaveService.createLeave(2, { leaveDate: ngayVN(400), leaveType: 'paid' }),
            /trong vòng 3 tháng tới/,
        );
    });

    it('L1-LEAVE-11: createLeave - chặn ngày lùi quá xa', async () => {
        await assert.rejects(
            leaveService.createLeave(2, { leaveDate: ngayVN(-400), leaveType: 'paid' }),
            /lùi quá 3 tháng/,
        );
    });

    it('L1-LEAVE-12: createLeave - chặn đăng ký lùi vào kỳ lương đã chốt', async () => {
        mock.method(leaveRepository, 'getPayrollStatus', async () => 'approved');
        await assert.rejects(
            leaveService.createLeave(2, { leaveDate: ngayVN(-1), leaveType: 'unpaid' }),
            /đã chốt/,
        );
    });

    it('L1-LEAVE-08: deleteLeave - should call repo', async () => {
        mock.method(leaveRepository, 'deleteLeave', async () => ({ id: 1 }));
        const result = await leaveService.deleteLeave(2, 1);
        assert.strictEqual(result.id, 1);
    });
});
