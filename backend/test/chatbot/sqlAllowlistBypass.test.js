/**
 * Lớp allowlist của chatbot Text-to-SQL — chống lách bằng cú pháp.
 *
 * BỐI CẢNH: chatbot để người dùng hỏi bằng tiếng Việt, LLM sinh ra SQL, hệ thống chạy SQL
 * đó. Nội dung câu hỏi là dữ liệu KHÔNG TIN CẬY, nên câu SQL sinh ra cũng không tin cậy —
 * prompt injection có thể lái LLM viết ra bất cứ thứ gì. Lớp allowlist view là thứ duy
 * nhất ngăn chatbot đọc bảng gốc (accounts.password_hash, PII của khách...).
 *
 * BUG ĐÃ XẢY RA: extractTables tìm tên bảng bằng regex `(from|join)\s+([a-z_]...)`. Bốn
 * cách viết dưới đây đều làm regex TRƯỢT HOÀN TOÀN, trong khi Postgres vẫn chạy bình
 * thường và trả về dữ liệu:
 *
 *     SELECT email, password_hash FROM"accounts"      ← không có khoảng trắng
 *     SELECT email FROM "accounts"                    ← có khoảng trắng, nhưng " chặn [a-z_]
 *     SELECT email FROM/**\/accounts                  ← chú thích khối chen giữa
 *     SELECT email FROM--x\naccounts                  ← chú thích dòng chen giữa
 *
 * Đã kiểm chứng trên Postgres thật: tài khoản role 'driver' đọc được TOÀN BỘ bảng accounts
 * kèm hash mật khẩu. Transaction READ ONLY chặn được ghi nhưng không chặn đọc.
 *
 * Hai lớp vá: bỏ chú thích trước khi kiểm, và cấm hẳn định danh nháy kép (mọi view trong
 * allowlist đều là tên thường nên câu hợp lệ không bao giờ cần đến nháy kép).
 */
const assert = require('node:assert');
const { validateSelect, getAllowedViews, stripSqlComments } = require('../../repositories/chatbotSqlRunner');

const DRIVER = getAllowedViews('driver');
const COORD = getAllowedViews('coordinator');

const chan = (sql, allowed = DRIVER) => {
    const r = validateSelect(sql, allowed);
    assert.strictEqual(r.ok, false, `PHẢI CHẶN nhưng lại cho qua: ${sql}`);
    return r.reason;
};
const lot = (sql, allowed = DRIVER) => {
    const r = validateSelect(sql, allowed);
    assert.strictEqual(r.ok, true, `PHẢI CHO QUA nhưng bị chặn (${r.reason}): ${sql}`);
};

describe('chatbot SQL — không được đọc bảng gốc bằng mẹo cú pháp', () => {
    it('nháy kép không khoảng trắng: FROM"accounts"', () => {
        chan('SELECT email, password_hash FROM"accounts"');
    });

    it('nháy kép có khoảng trắng: FROM "accounts"', () => {
        chan('SELECT email FROM "accounts"');
    });

    it('JOIN cũng phải chặn, không chỉ FROM', () => {
        chan('SELECT a.email FROM v_chatbot_my_kpi k JOIN"accounts" a ON true');
    });

    it('nháy kép trong subquery', () => {
        chan('SELECT 1 FROM v_chatbot_my_kpi WHERE 1 = (SELECT count(*) FROM"accounts")');
    });

    it('chú thích khối chen giữa FROM và tên bảng', () => {
        chan('SELECT email FROM/**/accounts');
    });

    it('chú thích dòng chen giữa FROM và tên bảng', () => {
        chan('SELECT email FROM--bo qua\naccounts');
    });

    it('chú thích khối LỒNG NHAU (Postgres cho phép lồng)', () => {
        chan('SELECT email FROM/* ngoai /* trong */ van la chu thich */accounts');
    });

    it('bảng gốc viết thẳng vẫn bị chặn (hành vi cũ không được hỏng)', () => {
        chan('SELECT email FROM accounts');
    });

    it('schema-qualified vẫn bị chặn', () => {
        chan('SELECT email FROM public.accounts');
    });

    it('view của role KHÁC không dùng được — driver không đọc được bảng lương toàn công ty', () => {
        chan('SELECT * FROM v_chatbot_payrolls');
    });

    it('coordinator không đọc được view tài chính', () => {
        chan('SELECT * FROM v_chatbot_debts', COORD);
    });
});

describe('chatbot SQL — câu hợp lệ vẫn phải chạy được', () => {
    it('view được phép', () => {
        lot('SELECT * FROM v_chatbot_my_kpi');
    });

    it('WITH + CTE, tên CTE không bị nhầm là bảng lạ', () => {
        lot('WITH t AS (SELECT * FROM v_chatbot_my_kpi) SELECT * FROM t');
    });

    it('JOIN hai view được phép', () => {
        lot('SELECT * FROM v_chatbot_my_shipments s JOIN v_chatbot_vehicle_groups g ON true');
    });

    it('chuỗi dữ liệu chứa "--" KHÔNG được coi là chú thích', () => {
        // Nếu bộ bỏ chú thích không bám nháy đơn, câu này bị cắt cụt từ giữa chuỗi và
        // biến thành SQL sai cú pháp — một câu hỏi hợp lệ của người dùng tự nhiên lỗi.
        lot("SELECT * FROM v_chatbot_my_kpi WHERE 'a--b' = 'a--b'");
    });

    it('chuỗi dữ liệu chứa "/*" cũng vậy', () => {
        lot("SELECT * FROM v_chatbot_my_kpi WHERE 'a/*b' <> ''");
    });

    it('nháy đơn escape kiểu SQL (hai dấu nháy liền) không làm lệch bộ quét', () => {
        lot("SELECT * FROM v_chatbot_my_kpi WHERE 'it''s' <> ''");
    });
});

describe('stripSqlComments — giữ nguyên phần dữ liệu', () => {
    it('bỏ chú thích dòng nhưng giữ chuỗi', () => {
        const out = stripSqlComments("SELECT 'a--b' FROM t -- ghi chu\n");
        assert.ok(out.includes("'a--b'"), 'chuỗi dữ liệu phải còn nguyên');
        assert.ok(!out.includes('ghi chu'), 'chú thích phải bị bỏ');
    });

    it('chú thích được thay bằng khoảng trắng, không dán hai token vào nhau', () => {
        // 'FROM/**/accounts' mà thay chú thích bằng chuỗi rỗng sẽ thành 'FROMaccounts'
        // — một từ mới, và \bfrom\b không còn khớp ⇒ lại trượt như cũ.
        const out = stripSqlComments('SELECT 1 FROM/**/accounts');
        assert.ok(/\bfrom\b/i.test(out), 'FROM phải còn là một từ riêng');
        assert.ok(/\baccounts\b/i.test(out), 'tên bảng phải còn là một từ riêng');
    });
});
