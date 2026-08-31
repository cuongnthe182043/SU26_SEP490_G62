/**
 * Dò trùng hóa đơn — chạy trên Postgres thật.
 *
 * Test này phải chạm DB thật chứ không mock được: giá trị của nó nằm ở phần xử lý NULL
 * trong câu truy vấn. Trong SQL, `NULL = NULL` không phải TRUE mà là NULL, nên một lỗi
 * điều kiện rất dễ dẫn tới hai kết cục trái ngược mà mock không bao giờ lộ ra — hoặc
 * không bắt được gì, hoặc mọi hóa đơn viết tay thiếu số hóa đơn đều khớp lẫn nhau và
 * bị báo trùng oan hàng loạt.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let repository;

const insert = async (row) => {
    const result = await pool.query(
        `INSERT INTO receipt_extractions
            (entity_type, entity_id, image_url, image_sha256, verdict, vendor_key, invoice_no_key, receipt_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
            row.entityType ?? 'maintenance_record', row.entityId ?? 21,
            row.imageUrl ?? 'https://x/a.jpg', row.imageSha256 ?? null,
            row.verdict ?? 'passed', row.vendorKey ?? null,
            row.invoiceNoKey ?? null, row.receiptTotal ?? null,
        ],
    );
    return result.rows[0].id;
};

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    repository = require('../../repositories/receiptExtractionRepository');
});

afterAll(async () => {
    if (teardown) await teardown();
});

beforeEach(async () => {
    await pool.query('TRUNCATE receipt_extractions RESTART IDENTITY');
});

describe('findDuplicates — nhận dạng theo băm ảnh', () => {
    it('bắt được đúng một tấm ảnh gửi lại lần hai', async () => {
        const id = await insert({ imageSha256: 'hash-aaa', entityId: 21 });

        const rows = await repository.findDuplicates({ imageSha256: 'hash-aaa' });

        assert.strictEqual(rows.length, 1);
        assert.strictEqual(Number(rows[0].id), id);
    });

    it('không khớp khi băm khác nhau', async () => {
        await insert({ imageSha256: 'hash-aaa' });

        const rows = await repository.findDuplicates({ imageSha256: 'hash-bbb' });

        assert.strictEqual(rows.length, 0);
    });

    it('không khớp các dòng có băm NULL khi tra bằng băm NULL', async () => {
        // Nếu điều kiện viết thành `image_sha256 = $1` mà không chặn NULL, Postgres trả
        // NULL (không phải TRUE) nên may mắn vẫn không khớp — nhưng chỉ cần đổi sang
        // `IS NOT DISTINCT FROM` là mọi dòng thiếu băm dính hết vào nhau.
        await insert({ imageSha256: null });
        await insert({ imageSha256: null });

        const rows = await repository.findDuplicates({ imageSha256: null });

        assert.strictEqual(rows.length, 0);
    });
});

describe('findDuplicates — nhận dạng theo nội dung hóa đơn', () => {
    it('bắt được cùng tờ hóa đơn chụp lại từ góc khác (băm khác, khoá giống)', async () => {
        // Đây là ca mà băm ảnh không bắt được và là lý do tồn tại của cặp khoá này.
        const id = await insert({
            imageSha256: 'hash-goc-1', vendorKey: 'tax:0101234567', invoiceNoKey: 'HD00123', entityId: 21,
        });

        const rows = await repository.findDuplicates({
            imageSha256: 'hash-goc-2',
            vendorKey: 'tax:0101234567',
            invoiceNoKey: 'HD00123',
        });

        assert.strictEqual(rows.length, 1);
        assert.strictEqual(Number(rows[0].id), id);
        assert.strictEqual(Number(rows[0].entity_id), 21);
    });

    it('KHÔNG khớp hai hóa đơn cùng bên bán nhưng khác số', async () => {
        // Hai lần thay dầu ở cùng garage là chuyện bình thường.
        await insert({ vendorKey: 'tax:0101234567', invoiceNoKey: 'HD00123' });

        const rows = await repository.findDuplicates({
            vendorKey: 'tax:0101234567', invoiceNoKey: 'HD00999',
        });

        assert.strictEqual(rows.length, 0);
    });

    it('KHÔNG báo trùng khi cả hai hóa đơn đều không ghi số', async () => {
        // Ca nguy hiểm nhất: hóa đơn viết tay ở garage nhỏ thường không có số hóa đơn.
        // Để lọt NULL vào phép so sánh là mọi hóa đơn viết tay của cùng garage đều bị
        // coi là trùng nhau.
        await insert({ vendorKey: 'name:garagea', invoiceNoKey: null });
        await insert({ vendorKey: 'name:garagea', invoiceNoKey: null });

        const rows = await repository.findDuplicates({
            vendorKey: 'name:garagea', invoiceNoKey: null,
        });

        assert.strictEqual(rows.length, 0);
    });

    it('không tra DB khi không có khoá nào dùng được', async () => {
        await insert({ imageSha256: 'hash-aaa', vendorKey: 'name:garagea', invoiceNoKey: 'HD1' });

        const rows = await repository.findDuplicates({});

        assert.strictEqual(rows.length, 0);
    });
});

describe('findDuplicates — loại trừ', () => {
    it('bỏ qua những lần đọc đã bị từ chối', async () => {
        // Hóa đơn bị từ chối thì chưa được dùng vào đâu cả. Chặn lần nộp lại sau khi
        // tài xế chụp lại cho rõ là chặn oan.
        await insert({ imageSha256: 'hash-aaa', verdict: 'rejected' });

        const rows = await repository.findDuplicates({ imageSha256: 'hash-aaa' });

        assert.strictEqual(rows.length, 0);
    });

    it('vẫn bắt các lần đọc cần người xem hoặc lỗi đọc', async () => {
        await insert({ imageSha256: 'hash-aaa', verdict: 'needs_review' });

        const rows = await repository.findDuplicates({ imageSha256: 'hash-aaa' });

        assert.strictEqual(rows.length, 1);
    });

    it('loại trừ được chính dòng đang xét qua excludeId', async () => {
        const id = await insert({ imageSha256: 'hash-aaa' });

        assert.strictEqual((await repository.findDuplicates({ imageSha256: 'hash-aaa', excludeId: id })).length, 0);
        assert.strictEqual((await repository.findDuplicates({ imageSha256: 'hash-aaa', excludeId: null })).length, 1);
    });
});

describe('findDuplicates — phân biệt cùng khoản với khoản khác', () => {
    it('trả đủ thông tin để phân biệt trùng trong cùng khoản với dùng lại cho khoản khác', async () => {
        await insert({ imageSha256: 'hash-aaa', entityType: 'maintenance_record', entityId: 21 });
        await insert({ imageSha256: 'hash-aaa', entityType: 'expense', entityId: 77 });

        const rows = await repository.findDuplicates({ imageSha256: 'hash-aaa' });

        assert.strictEqual(rows.length, 2);
        const checks = require('../../services/receiptChecks');
        const reasons = checks.checkDuplicates(rows, { entityType: 'maintenance_record', entityId: 21 });

        // Có dòng thuộc khoản KHÁC thì đó mới là vấn đề đáng báo, không phải chuyện
        // nộp lại trong cùng một khoản.
        assert.strictEqual(reasons[0].code, 'DUPLICATE_RECEIPT');
        assert.match(reasons[0].message, /khoản chi phí #77/);
    });
});
