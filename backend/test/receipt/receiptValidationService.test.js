const { mock } = require('../helpers/nodeTestMock');
const assert = require('node:assert');

const repository = require('../../repositories/receiptExtractionRepository');
const extractor = require('../../services/receiptVisionExtractor');
const service = require('../../services/receiptValidationService');

/** Hóa đơn bảo dưỡng tối thiểu nhưng tự khớp số học, với tổng cho trước. */
const billWithTotal = (total) => ({
    is_document: true,
    doc_type: 'invoice',
    vendor: { name: 'Garage Thành Công', tax_code: null, address: null, phone: null },
    invoice_no: 'HD-1',
    issued_date: null,
    vehicle_plate: null,
    currency: 'VND',
    line_items: [
        { raw_name: 'Thay nhớt động cơ', quantity: 1, unit: 'lần', unit_price: total, line_total: total, category: 'engine_oil' },
    ],
    subtotal: total,
    discount: 0,
    vat_rate: null,
    vat_amount: null,
    total,
    unreadable_fields: [],
});

const okResult = (total) => ({
    ok: true,
    extraction: billWithTotal(total),
    raw: billWithTotal(total),
    meta: { provider: 'google', model: 'test', prompt_version: 'v1', image_sha256: 'abc', latency_ms: 10 },
});

describe('receiptValidationService', () => {
    beforeEach(() => {
        service.invalidateTaxonomyCache();
        mock.method(repository, 'getExtraKeywords', async () => []);
        mock.method(repository, 'saveExtraction', async () => ({ id: 1 }));
        mock.method(repository, 'findLatestByImageUrl', async () => null);
    });

    afterEach(() => {
        mock.restoreAll();
        service.invalidateTaxonomyCache();
    });

    it('chấp nhận khi số khai khớp TỔNG của nhiều hóa đơn rời', async () => {
        const totals = { 'a.jpg': 300_000, 'b.jpg': 500_000 };
        mock.method(extractor, 'extractReceipt', async (url) => okResult(totals[url]));

        const result = await service.validateMaintenanceBills(['a.jpg', 'b.jpg'], { claimedAmount: 800_000 });

        assert.strictEqual(result.verdict, 'passed');
        assert.strictEqual(result.blocked, false);
    });

    it('chấp nhận khi số khai khớp hóa đơn LỚN NHẤT — tài xế chụp trùng nhiều góc', async () => {
        // Chỉ so tổng thì ca này bị từ chối oan: cùng một hóa đơn 500k chụp hai lần
        // sẽ cộng thành 1 triệu.
        mock.method(extractor, 'extractReceipt', async () => okResult(500_000));

        const result = await service.validateMaintenanceBills(['a.jpg', 'b.jpg'], { claimedAmount: 500_000 });

        assert.strictEqual(result.verdict, 'passed');
    });

    it('từ chối khi số khai không khớp cả tổng lẫn hóa đơn lớn nhất', async () => {
        mock.method(extractor, 'extractReceipt', async () => okResult(200_000));

        const result = await service.validateMaintenanceBills(['a.jpg'], { claimedAmount: 5_000_000 });

        assert.strictEqual(result.verdict, 'rejected');
        assert.strictEqual(result.blocked, true);
        assert.match(result.reject_reason, /5\.000\.000đ/);
    });

    it('sự cố phía hệ thống thành needs_review chứ không phải passed', async () => {
        // Đây là chỗ hỏng cốt lõi của lớp cũ: OCR timeout thì trả valid = true, tức là
        // không còn ai nhìn lại khoản đó nữa.
        mock.method(extractor, 'extractReceipt', async () => ({
            ok: false, code: 'TIMEOUT', error: 'Quá thời gian đọc hóa đơn',
            meta: { provider: 'google', model: 'test', prompt_version: 'v1', image_sha256: null, latency_ms: 30_000 },
        }));

        const result = await service.validateMaintenanceBills(['a.jpg'], { claimedAmount: 5_000_000 });

        assert.strictEqual(result.verdict, 'needs_review');
        assert.strictEqual(result.blocked, false);
        assert.ok(result.reasons.some((r) => r.code === 'EXTRACTION_TIMEOUT'));
    });

    it('chặn khi lỗi là do người gửi và sửa được ngay bằng cách chụp lại', async () => {
        mock.method(extractor, 'extractReceipt', async () => ({
            ok: false, code: 'NOT_AN_IMAGE', error: 'Tệp tải về không phải ảnh',
            meta: { provider: 'google', model: 'test', prompt_version: 'v1', image_sha256: null, latency_ms: 5 },
        }));

        const result = await service.validateMaintenanceBills(['a.pdf'], { claimedAmount: 100_000 });

        assert.strictEqual(result.verdict, 'rejected');
        assert.strictEqual(result.blocked, true);
    });

    it('dùng lại bản đọc đã lưu thay vì gọi model lần hai', async () => {
        // Tài xế up ảnh (đọc lần 1) rồi mới nhập tiền và bấm hoàn tất. Cùng tấm ảnh thì
        // kết quả đọc không đổi — gọi lại model chỉ tốn tiền và thời gian.
        mock.method(repository, 'findLatestByImageUrl', async () => ({
            id: 9, image_url: 'a.jpg', image_sha256: 'abc',
            raw_extraction: billWithTotal(450_000),
            verdict: 'passed', receipt_total: 450_000,
            provider: 'google', model: 'test', prompt_version: 'v1',
        }));
        const spy = mock.method(extractor, 'extractReceipt', async () => okResult(450_000));

        const result = await service.validateMaintenanceBills(['a.jpg'], { claimedAmount: 450_000 });

        assert.strictEqual(result.verdict, 'passed');
        assert.strictEqual(spy.mock.calls.length, 0);
        // Đọc lại từ cache thì không được ghi thêm một dòng lưu vết trùng lặp.
        assert.strictEqual(repository.saveExtraction.mock.calls.length, 0);
    });

    it('không làm hỏng luồng chính khi không ghi được vết', async () => {
        mock.method(repository, 'saveExtraction', async () => { throw new Error('DB down'); });
        mock.method(extractor, 'extractReceipt', async () => okResult(450_000));

        const result = await service.validateMaintenanceBills(['a.jpg'], { claimedAmount: 450_000 });

        assert.strictEqual(result.verdict, 'passed');
    });

    it('vẫn chạy được bằng từ điển gốc khi không nạp được phần mở rộng', async () => {
        mock.method(repository, 'getExtraKeywords', async () => { throw new Error('DB down'); });
        mock.method(extractor, 'extractReceipt', async () => okResult(450_000));

        const result = await service.validateMaintenanceBills(['a.jpg'], { claimedAmount: 450_000 });

        assert.strictEqual(result.verdict, 'passed');
    });
});

describe('receiptValidationService — chống dùng lại hóa đơn', () => {
    beforeEach(() => {
        service.invalidateTaxonomyCache();
        mock.method(repository, 'getExtraKeywords', async () => []);
        mock.method(repository, 'saveExtraction', async () => ({ id: 1 }));
        mock.method(repository, 'findLatestByImageUrl', async () => null);
    });

    afterEach(() => {
        mock.restoreAll();
        service.invalidateTaxonomyCache();
    });

    it('chặn ảnh mới khi hóa đơn đó đã dùng cho đợt khác', () => {
        mock.method(extractor, 'extractReceipt', async () => okResult(450_000));
        mock.method(repository, 'findDuplicates', async () => ([
            { id: 5, entity_type: 'maintenance_record', entity_id: 99, created_at: '2026-08-01' },
        ]));

        return service.validateReceipt('a.jpg', {
            claimedAmount: 450_000, entityType: 'maintenance_record', entityId: 21, allowCache: false,
        }).then((result) => {
            assert.strictEqual(result.verdict, 'rejected');
            assert.match(result.reject_reason, /đợt bảo dưỡng #99/);
        });
    });

    it('KHÔNG dò trùng khi đọc lại từ vết đã ghi', async () => {
        // Cạm bẫy: ở bước hoàn tất, bản đọc lấy từ vết ghi lúc upload. Dò trùng lúc đó
        // sẽ khớp đúng dòng của chính nó và chặn mọi đợt bảo dưỡng hợp lệ.
        mock.method(repository, 'findLatestByImageUrl', async () => ({
            id: 9, image_url: 'a.jpg', image_sha256: 'abc',
            raw_extraction: billWithTotal(450_000),
            verdict: 'passed', receipt_total: 450_000,
            provider: 'google', model: 'test', prompt_version: 'v1',
        }));
        const dupSpy = mock.method(repository, 'findDuplicates', async () => ([
            { id: 9, entity_type: 'maintenance_record', entity_id: 21 },
        ]));

        const result = await service.validateMaintenanceBills(['a.jpg'], {
            claimedAmount: 450_000, entityType: 'maintenance_record', entityId: 21,
        });

        assert.strictEqual(result.verdict, 'passed');
        assert.strictEqual(dupSpy.mock.calls.length, 0);
    });

    it('không chặn tài xế khi việc dò trùng lỗi', async () => {
        mock.method(extractor, 'extractReceipt', async () => okResult(450_000));
        mock.method(repository, 'findDuplicates', async () => { throw new Error('DB down'); });

        const result = await service.validateReceipt('a.jpg', {
            claimedAmount: 450_000, entityType: 'maintenance_record', entityId: 21, allowCache: false,
        });

        assert.strictEqual(result.verdict, 'passed');
    });

    it('lưu khoá nhận dạng cùng bản đọc để lần sau dò được', async () => {
        mock.method(extractor, 'extractReceipt', async () => okResult(450_000));
        mock.method(repository, 'findDuplicates', async () => []);

        await service.validateReceipt('a.jpg', {
            claimedAmount: 450_000, entityType: 'maintenance_record', entityId: 21, allowCache: false,
        });

        const saved = repository.saveExtraction.mock.calls[0].arguments[0];
        assert.strictEqual(saved.vendorKey, 'name:garagethanhcong');
        assert.strictEqual(saved.invoiceNoKey, 'HD1');
    });
});
