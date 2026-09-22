/**
 * Những việc dây chuyền quét làm mà KHÔNG ai cần tới — mỗi việc là vài trăm ms tới vài
 * giây trong lúc tài xế đứng chờ.
 *
 * Log máy chủ thật (20/9) là lý do có file này: một request "Hoàn thành bảo dưỡng" bị app
 * bỏ ở giây thứ 30, phần lớn thời gian nằm ở những việc không sinh ra kết quả nào.
 */
const assert = require('node:assert');
const { mock } = require('../helpers/nodeTestMock');

const imagePipeline = require('../../services/receiptImagePipeline');
const ocrScanner = require('../../services/receiptOcrScanner');
const extractor = require('../../services/receiptVisionExtractor');
const repository = require('../../repositories/receiptExtractionRepository');
const receiptService = require('../../services/receiptValidationService');

const CLOUD_URL = 'https://res.cloudinary.com/demo/image/upload/v1/g62/bill.jpg';

const anhGia = Buffer.from('anh-gia-du-lon'.repeat(400));

/** fetch giả: ghi lại các URL được gọi, trả ảnh sau `delay` ms. */
const stubFetch = (delay = 10) => {
    const calls = [];
    global.fetch = jest.fn(async (url) => {
        calls.push(String(url));
        await new Promise((resolve) => { setTimeout(resolve, delay); });
        return {
            ok: true,
            headers: { get: (h) => (h === 'content-type' ? 'image/jpeg' : String(anhGia.length)) },
            arrayBuffer: async () => anhGia,
        };
    });
    return calls;
};

describe('Tải ảnh: một lượt tải cho cả hai kênh đọc', () => {
    let savedFetch;
    beforeEach(() => { savedFetch = global.fetch; });
    afterEach(() => { global.fetch = savedFetch; });

    it('chỉ tải đúng biến thể cho model — không còn biến thể riêng cho OCR', async () => {
        // Trước đây mỗi lượt quét tải thêm một ảnh 2000px xám/tương phản/làm nét cho
        // Tesseract: tệp nặng nhất của cả lượt, một ảnh dẫn xuất Cloudinary nữa phải sinh,
        // và đo lại thì còn làm OCR đọc kém hơn ảnh thường (xem receiptImagePipeline).
        const calls = stubFetch();

        const loaded = await imagePipeline.loadImage(CLOUD_URL);

        assert.deepStrictEqual(calls, [imagePipeline.visionUrl(CLOUD_URL)]);
        assert.ok(Buffer.isBuffer(loaded.vision.buffer), 'OCR quét trên chính buffer này');
        assert.strictEqual(loaded.ocr, undefined);
    });
});

describe('Dây chuyền đưa cho OCR đúng ảnh đã tải cho model', () => {
    const loaded = () => ({
        ok: true,
        vision: { buffer: Buffer.from('anh-that'), base64: 'ZmFrZQ==', mimeType: 'image/jpeg', sha256: 'sha', bytes: 1000 },
        quality: { bytes: 1000, width: 1600, height: 2000, format: 'jpeg', reasons: [] },
    });

    beforeEach(() => {
        mock.method(repository, 'saveExtraction', async () => null);
        mock.method(repository, 'getExtraKeywords', async () => []);
        mock.method(repository, 'findDuplicates', async () => []);
        mock.method(extractor, 'extractReceipt', async () => ({
            ok: false, code: 'TIMEOUT', error: 'hết giờ', meta: { provider: 'google' },
        }));
    });
    afterEach(() => mock.restoreAll());

    it('OCR quét CÙNG buffer với model, ảnh chỉ được tải một lần', async () => {
        const image = loaded();
        const load = mock.method(imagePipeline, 'loadImage', async () => image);
        const scan = mock.method(ocrScanner, 'scanImage', async () => ({ ok: false, code: 'OCR_DISABLED' }));

        await receiptService.runPipeline(CLOUD_URL, { profile: 'maintenance' });

        assert.strictEqual(load.mock.callCount(), 1);
        assert.strictEqual(scan.mock.calls[0].arguments[0], image.vision.buffer);
    });

    it('OCR tắt thì kênh OCR trả lời ngay, không kéo theo lượt tải nào', async () => {
        const saved = process.env.RECEIPT_OCR_ENABLED;
        process.env.RECEIPT_OCR_ENABLED = 'false';
        try {
            const load = mock.method(imagePipeline, 'loadImage', async () => loaded());

            const result = await receiptService.runPipeline(CLOUD_URL, { profile: 'maintenance' });

            assert.strictEqual(load.mock.callCount(), 1);
            assert.strictEqual(result.ocr.code, 'OCR_DISABLED');
        } finally {
            if (saved === undefined) delete process.env.RECEIPT_OCR_ENABLED;
            else process.env.RECEIPT_OCR_ENABLED = saved;
        }
    });
});
