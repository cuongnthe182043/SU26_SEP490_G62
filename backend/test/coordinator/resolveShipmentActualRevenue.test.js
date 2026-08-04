/**
 * resolveShipmentActualRevenue — hàm tính doanh thu cho màn XEM TRƯỚC phiếu thu
 * (trước khi coordinator bấm Duyệt).
 *
 * Vì sao có file này: hàm này và computeReceiptAmount (hàm tính tiền THẬT lúc duyệt)
 * từng lệch nhau ở đúng một nhánh — chuyến hoàn hàng (returning_at). computeReceiptAmount
 * nhân đôi, hàm xem trước thì không, nên coordinator nhìn "Doanh thu" / "Tổng thu" ở màn
 * xem trước thấy đúng MỘT NỬA số tiền sẽ bị chốt ngay khi họ bấm Duyệt — không có gì
 * cảnh báo trước cả. Bug lọt qua vì hàm này chưa từng có test.
 */
const assert = require('node:assert');
const { resolveShipmentActualRevenue } = require('../../services/coordinatorService');

describe('resolveShipmentActualRevenue', () => {
    it('chuyến bình thường: km × đơn giá', () => {
        const revenue = resolveShipmentActualRevenue({
            actual_distance_km: 30, price_per_km: 20000,
        });
        assert.strictEqual(revenue, 600000);
    });

    it('chuyến HOÀN HÀNG (returning_at có giá trị): phải nhân đôi', () => {
        const revenue = resolveShipmentActualRevenue({
            actual_distance_km: 30, price_per_km: 20000, returning_at: new Date().toISOString(),
        });
        assert.strictEqual(revenue, 1200000, 'chuyến hoàn hàng phải x2, đúng chính bug đã xảy ra');
    });

    it('đã có actual_price (đã chốt trong DB) thì ưu tiên tuyệt đối, không tính lại theo km', () => {
        const revenue = resolveShipmentActualRevenue({
            actual_price: 999000, actual_distance_km: 30, price_per_km: 20000, returning_at: new Date().toISOString(),
        });
        assert.strictEqual(revenue, 999000);
    });

    it('giá cố định do DN chốt tay (is_price_manual) thì KHÔNG nhân đôi dù đang hoàn hàng', () => {
        const revenue = resolveShipmentActualRevenue({
            is_price_manual: true, estimated_price: 500000,
            actual_distance_km: 30, price_per_km: 20000, returning_at: new Date().toISOString(),
        });
        assert.strictEqual(revenue, 500000, 'giá DN đã tự chốt tay thì giữ nguyên, không suy diễn theo km');
    });

    it('thiếu km hoặc đơn giá thì trả 0, không NaN', () => {
        assert.strictEqual(resolveShipmentActualRevenue({ price_per_km: 20000 }), 0);
        assert.strictEqual(resolveShipmentActualRevenue({ actual_distance_km: 30 }), 0);
        assert.strictEqual(resolveShipmentActualRevenue({}), 0);
    });

    it('KHỚP với computeReceiptAmount cho cùng một chuyến hoàn hàng', () => {
        // Cùng input phải cho cùng kết quả ở cả hai hàm — đây chính là bất biến bị vỡ
        // trước khi sửa. computeReceiptAmount cần shipments dạng mảng + status hợp lệ.
        const { computeReceiptAmount } = require('../../services/coordinatorService');
        const shipment = {
            id: 1, status: 'completed', price_per_km: 20000,
            actual_distance_km: 30, returning_at: new Date().toISOString(),
            is_price_manual: false,
        };

        const preview = resolveShipmentActualRevenue(shipment);
        const real = computeReceiptAmount({ shipments: [shipment], primaryShipment: shipment });

        assert.strictEqual(preview, real.actual_income, 'xem trước và lúc duyệt phải ra cùng một số tiền');
        assert.strictEqual(preview, 1200000);
    });
});
