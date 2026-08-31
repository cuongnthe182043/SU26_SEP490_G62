/**
 * Ghép ba mảnh lại: đọc ảnh (AI) -> chấm luật (code thuần) -> lưu vết (DB).
 *
 * Đây là mặt tiền mà driverService/coordinatorController gọi. Ba nguyên tắc chi phối
 * toàn bộ file này:
 *
 *   1. Sự cố hạ tầng KHÔNG BAO GIỜ thành `passed`. Lớp cũ fail-open — OCR timeout thì
 *      trả valid:true — nên trong thực tế nó chỉ có hai chế độ: chặn oan người trung
 *      thực khi ảnh hơi mờ, và cho qua tất cả khi hạ tầng trục trặc. Ở đây mọi sự cố
 *      đều thành `needs_review`: vẫn không chặn tài xế, nhưng khoản đó không biến mất
 *      khỏi tầm mắt người duyệt.
 *
 *   2. Việc lưu vết không được làm hỏng luồng chính. Ghi log lỗi rồi đi tiếp.
 *
 *   3. Cùng một tấm ảnh chỉ gọi model MỘT lần. Lần đọc được lưu lại và dùng lại ở bước
 *      hoàn tất, nơi chỉ có phép đối chiếu số tiền là mới.
 */

const repository = require('../repositories/receiptExtractionRepository');
const extractor = require('./receiptVisionExtractor');
const checks = require('./receiptChecks');
const taxonomy = require('./receiptTaxonomy');

// ─── Từ điển: nạp từ DB, giữ trong bộ nhớ ────────────────────────────────────

const TAXONOMY_TTL_MS = 5 * 60 * 1000;
let cachedIndex = null;
let cachedAt = 0;

/**
 * Bảng tra từ khoá, gộp danh sách gốc trong code với phần mở rộng trong DB.
 *
 * DB hỏng thì vẫn chạy được bằng danh sách gốc — phân loại kém chính xác hơn một chút
 * còn hơn là cả tính năng ngừng hoạt động.
 */
const getKeywordIndex = async () => {
    if (cachedIndex && Date.now() - cachedAt < TAXONOMY_TTL_MS) return cachedIndex;

    let extra = [];
    try {
        extra = await repository.getExtraKeywords();
    } catch (err) {
        console.warn('[receipt] Không nạp được từ điển mở rộng, dùng danh sách gốc:', err.message);
    }

    cachedIndex = taxonomy.buildKeywordIndex(extra);
    cachedAt = Date.now();
    return cachedIndex;
};

/** Xoá cache — gọi sau khi thêm từ khoá mới để khỏi phải chờ hết TTL. */
const invalidateTaxonomyCache = () => { cachedIndex = null; cachedAt = 0; };

// ─── Kết quả khi không đọc được ──────────────────────────────────────────────

const EXTRACTION_ERROR_MESSAGE = {
    NOT_CONFIGURED: 'Chưa bật tính năng đọc hóa đơn tự động. Người duyệt vui lòng kiểm tra bằng mắt.',
    FETCH_FAILED: 'Không tải được ảnh hóa đơn để kiểm tra. Người duyệt vui lòng kiểm tra bằng mắt.',
    NOT_AN_IMAGE: 'Tệp tải lên không phải ảnh. Vui lòng chụp lại hóa đơn.',
    IMAGE_TOO_LARGE: 'Ảnh quá lớn để xử lý. Vui lòng chụp lại với dung lượng nhỏ hơn.',
    TIMEOUT: 'Quá thời gian đọc hóa đơn. Người duyệt vui lòng kiểm tra bằng mắt.',
    RATE_LIMIT: 'Hệ thống đọc hóa đơn đang quá tải. Người duyệt vui lòng kiểm tra bằng mắt.',
    SERVICE_UNAVAILABLE: 'Dịch vụ đọc hóa đơn tạm thời quá tải. Người duyệt vui lòng kiểm tra bằng mắt.',
    NETWORK: 'Không kết nối được dịch vụ đọc hóa đơn. Người duyệt vui lòng kiểm tra bằng mắt.',
    BAD_JSON: 'Không đọc được nội dung hóa đơn. Người duyệt vui lòng kiểm tra bằng mắt.',
    MODEL_ERROR: 'Không đọc được nội dung hóa đơn. Người duyệt vui lòng kiểm tra bằng mắt.',
};

// Ảnh sai loại/quá lớn là lỗi của người gửi, sửa được ngay bằng cách chụp lại → chặn.
// Còn lại là lỗi phía hệ thống, không được đổ lên đầu tài xế → đẩy cho người duyệt.
const BLOCKING_EXTRACTION_ERRORS = new Set(['NOT_AN_IMAGE', 'IMAGE_TOO_LARGE']);

const failedResult = (code, message) => {
    const blocking = BLOCKING_EXTRACTION_ERRORS.has(code);
    return {
        verdict: blocking ? 'rejected' : 'needs_review',
        reasons: [{
            code: `EXTRACTION_${code}`,
            severity: blocking ? 'error' : 'warning',
            message: message ?? EXTRACTION_ERROR_MESSAGE[code] ?? EXTRACTION_ERROR_MESSAGE.MODEL_ERROR,
        }],
        items: [],
        groups: null,
        totals: null,
        receipt_total: null,
    };
};

// ─── Đọc một ảnh ─────────────────────────────────────────────────────────────

/**
 * Lấy bản đọc của một ảnh: dùng lại bản đã lưu nếu có, không thì gọi model.
 *
 * @returns {{extraction: object|null, meta: object, error: {code: string, message: string}|null, cached: boolean}}
 */
const readReceipt = async (imageUrl, { allowCache = true } = {}) => {
    if (allowCache) {
        try {
            const previous = await repository.findLatestByImageUrl(imageUrl);
            if (previous?.raw_extraction) {
                return {
                    extraction: extractor.normalizeExtraction(previous.raw_extraction),
                    meta: {
                        provider: previous.provider,
                        model: previous.model,
                        prompt_version: previous.prompt_version,
                        image_sha256: previous.image_sha256,
                        latency_ms: 0,
                    },
                    error: null,
                    cached: true,
                };
            }
        } catch (err) {
            console.warn('[receipt] Không đọc được bản trích xuất cũ:', err.message);
        }
    }

    const result = await extractor.extractReceipt(imageUrl);
    if (!result.ok) {
        return { extraction: null, meta: result.meta, error: { code: result.code, message: result.error }, cached: false };
    }
    return { extraction: result.extraction, raw: result.raw, meta: result.meta, error: null, cached: false };
};

const persist = async (row) => {
    try {
        return await repository.saveExtraction(row);
    } catch (err) {
        console.warn('[receipt] Không lưu được vết đọc hóa đơn:', err.message);
        return null;
    }
};

/**
 * Kiểm tra MỘT ảnh hóa đơn bảo dưỡng.
 *
 * @param {string} imageUrl
 * @param {object} context  { claimedAmount, plateNumber, windowStart, windowEnd, entityType, entityId }
 */
const validateReceipt = async (imageUrl, context = {}) => {
    const { extraction, raw, meta, error, cached } = await readReceipt(imageUrl, {
        allowCache: context.allowCache !== false,
    });

    // Khoá nhận dạng tờ hóa đơn — lưu cùng bản đọc để lần sau dò trùng được.
    const identity = extraction ? checks.invoiceIdentity(extraction) : { vendorKey: null, invoiceNoKey: null };

    // Dò trùng PHẢI chạy trước khi ghi vết, nếu không nó tìm thấy chính dòng vừa ghi.
    //
    // Và chỉ dò cho lần nộp MỚI (`!cached`). Ở bước hoàn tất, bản đọc được lấy lại từ
    // vết đã ghi lúc upload — dò trùng lúc đó sẽ khớp đúng dòng của chính nó và báo
    // "ảnh đã tải lên rồi" cho mọi đợt bảo dưỡng hợp lệ. Ảnh đã qua cửa upload thì đã
    // được dò một lần rồi, không cần dò lại.
    //
    // Lỗi tra cứu không được chặn tài xế — mất một lớp kiểm tra còn hơn chặn oan.
    let duplicateMatches = [];
    if (!error && !cached && context.checkDuplicates !== false) {
        try {
            duplicateMatches = await repository.findDuplicates({
                imageSha256: meta?.image_sha256,
                vendorKey: identity.vendorKey,
                invoiceNoKey: identity.invoiceNoKey,
            });
        } catch (err) {
            console.warn('[receipt] Không dò được hóa đơn trùng:', err.message);
        }
    }

    const result = error
        ? failedResult(error.code, EXTRACTION_ERROR_MESSAGE[error.code])
        : checks.evaluateReceipt(extraction, {
            ...context,
            keywordIndex: await getKeywordIndex(),
            duplicateMatches,
        });

    // Bản đọc lấy từ cache thì đã có vết rồi, chỉ ghi thêm khi thực sự gọi model —
    // nếu không mỗi lần đối chiếu lại sinh một dòng trùng lặp.
    if (!cached) {
        await persist({
            entityType: context.entityType ?? 'maintenance_record',
            entityId: context.entityId,
            imageUrl,
            imageSha256: meta?.image_sha256,
            provider: meta?.provider,
            model: meta?.model,
            promptVersion: meta?.prompt_version,
            rawExtraction: raw ?? extraction ?? null,
            checks: result.reasons,
            verdict: error ? 'error' : result.verdict,
            claimedAmount: context.claimedAmount ?? null,
            receiptTotal: result.receipt_total,
            latencyMs: meta?.latency_ms,
            vendorKey: identity.vendorKey,
            invoiceNoKey: identity.invoiceNoKey,
        });
    }

    return {
        ...result,
        image_url: imageUrl,
        blocked: result.verdict === 'rejected',
        reject_reason: checks.firstErrorMessage(result.reasons),
    };
};

// ─── Nhiều ảnh cho một đợt bảo dưỡng ─────────────────────────────────────────

/**
 * Kiểm tra toàn bộ hóa đơn của một đợt bảo dưỡng và đối chiếu với số tiền khai.
 *
 * Việc đối chiếu số tiền phải làm ở ĐÂY chứ không phải ở từng ảnh: một đợt bảo dưỡng
 * có thể có nhiều hóa đơn rời, số khai phải khớp TỔNG các hóa đơn. Nhưng tài xế cũng
 * hay chụp cùng một hóa đơn từ vài góc, nên khớp với hóa đơn LỚN NHẤT cũng được chấp
 * nhận — chỉ so tổng thì ca thứ hai bị từ chối oan.
 */
const validateMaintenanceBills = async (billUrls, context = {}) => {
    const urls = (billUrls ?? []).filter(Boolean);
    if (urls.length === 0) {
        return { verdict: 'needs_review', reasons: [], perImage: [], receipt_total: null, blocked: false, reject_reason: null };
    }

    // Từng ảnh kiểm tra độc lập, CHƯA đối chiếu số tiền (claimedAmount = null).
    const perImage = await Promise.all(urls.map((url) => validateReceipt(url, {
        ...context,
        claimedAmount: null,
    })));

    const reasons = perImage.flatMap((item, index) => item.reasons.map((r) => ({
        ...r,
        image_index: index,
        image_url: item.image_url,
    })));

    const totals = perImage.map((item) => item.receipt_total).filter((n) => Number.isFinite(n) && n > 0);
    const sum = totals.reduce((acc, n) => acc + n, 0);
    const max = totals.length > 0 ? Math.max(...totals) : null;

    const claimed = Number(context.claimedAmount);
    if (Number.isFinite(claimed) && claimed > 0) {
        if (totals.length === 0) {
            reasons.push({
                code: 'NO_RECEIPT_TOTAL', severity: 'warning',
                message: 'Không đọc được tổng tiền trên hóa đơn nào nên chưa đối chiếu được với số đã khai.',
            });
        } else {
            // Chấm số khai với cả hai cách hiểu, lấy cách nào gần hơn để báo lỗi cho
            // đúng — nói "lệch so với tổng" khi tài xế chụp trùng ảnh là gây hiểu nhầm.
            const bySum = checks.checkClaimedAmount(claimed, sum, { subtotal: null, vat_amount: null });
            const byMax = checks.checkClaimedAmount(claimed, max, { subtotal: null, vat_amount: null });

            if (bySum.length === 0 || byMax.length === 0) {
                // khớp một trong hai cách → không thêm lý do nào
            } else {
                reasons.push(...(Math.abs(claimed - sum) <= Math.abs(claimed - max) ? bySum : byMax));
            }
        }
    }

    // Đối chiếu với lịch sử của chính chiếc xe — lớp này không nhìn vào tờ hóa đơn mà
    // nhìn vào bối cảnh, nên nó bắt được thứ mọi lớp trên bỏ lọt: một hóa đơn hoàn toàn
    // thật, số học đúng, hạng mục đúng, nhưng cao gấp mấy lần mọi lần trước của xe đó.
    if (Array.isArray(context.costHistory) && context.costHistory.length > 0) {
        const { costs, scopeLabel } = checks.pickComparableCosts(context.costHistory, context.maintenanceType);
        reasons.push(...checks.checkCostOutlier(context.claimedAmount, costs, { scopeLabel }));
    }

    const verdict = checks.resolveVerdict(reasons);
    return {
        verdict,
        reasons,
        perImage,
        receipt_total: totals.length > 0 ? sum : null,
        receipt_totals: totals,
        blocked: verdict === 'rejected',
        reject_reason: checks.firstErrorMessage(reasons),
    };
};

// ─── Màn hình duyệt của quản lý ──────────────────────────────────────────────

const REVIEW_ACTIONS = ['agree', 'override_accept', 'override_reject'];

/**
 * Dữ liệu để người duyệt nhìn thấy máy đã đọc được gì, thay vì phải căng mắt vào ảnh.
 *
 * Dòng hàng được DỰNG LẠI từ raw_extraction chứ không lưu sẵn dạng đã phân loại. Cố ý:
 * từ điển lớn lên theo thời gian, dựng lại nghĩa là những bản ghi cũ cũng được hưởng
 * phân loại mới — lưu sẵn thì chúng đóng băng ở mức hiểu biết của ngày hôm đó.
 *
 * @param {'maintenance_record'|'expense'} entityType
 * @param {number} entityId
 * @param {string} profileCode  loại chi phí, quyết định hạng mục nào là đúng chủ đề
 */
const getReceiptReview = async (entityType, entityId, profileCode = 'maintenance') => {
    const rows = await repository.listByEntity(entityType, entityId);
    if (rows.length === 0) {
        return {
            entity_type: entityType,
            entity_id: entityId,
            profile: profileCode,
            profile_label: taxonomy.getProfile(profileCode).label,
            categories: taxonomy.categoryOptions(profileCode),
            receipts: [],
            summary: { total: 0, needs_review: 0, rejected: 0, unreviewed: 0 },
        };
    }

    const keywordIndex = await getKeywordIndex();
    const profile = taxonomy.getProfile(profileCode);
    const accepted = profile.accepted ? new Set(profile.accepted) : null;

    const receipts = rows.map((row) => {
        const extraction = row.raw_extraction ? extractor.normalizeExtraction(row.raw_extraction) : null;
        const items = extraction
            ? checks.markTopicality(checks.classifyLineItems(extraction.line_items, keywordIndex), accepted)
            : [];

        const reasons = Array.isArray(row.checks) ? row.checks : [];
        return {
            id: row.id,
            image_url: row.image_url,
            verdict: row.verdict,
            errors: reasons.filter((r) => r.severity === 'error'),
            warnings: reasons.filter((r) => r.severity === 'warning'),
            vendor: extraction?.vendor ?? null,
            invoice_no: extraction?.invoice_no ?? null,
            issued_date: extraction?.issued_date ?? null,
            vehicle_plate: extraction?.vehicle_plate ?? null,
            items,
            groups: checks.summarizeGroups(items),
            totals: extraction ? {
                subtotal: extraction.subtotal,
                discount: extraction.discount,
                vat_rate: extraction.vat_rate,
                vat_amount: extraction.vat_amount,
                total: extraction.total,
            } : null,
            receipt_total: row.receipt_total === null ? null : Number(row.receipt_total),
            claimed_amount: row.claimed_amount === null ? null : Number(row.claimed_amount),
            read_by: { provider: row.provider, model: row.model, prompt_version: row.prompt_version, latency_ms: row.latency_ms },
            review: row.review_action
                ? { action: row.review_action, note: row.review_note, at: row.reviewed_at, by: row.reviewed_by_name ?? null }
                : null,
            created_at: row.created_at,
        };
    });

    return {
        entity_type: entityType,
        entity_id: entityId,
        profile: profileCode,
        profile_label: profile.label,
        // Gửi kèm danh mục để giao diện khỏi phải giữ một bản sao — bản sao lệch đi là
        // người duyệt chọn được mã mà backend sẽ lặng lẽ loại bỏ.
        categories: taxonomy.categoryOptions(profileCode),
        receipts,
        // Tổng kết nhanh để giao diện biết có cần bật cảnh báo hay không.
        summary: {
            total: receipts.length,
            needs_review: receipts.filter((r) => r.verdict === 'needs_review').length,
            rejected: receipts.filter((r) => r.verdict === 'rejected').length,
            unreviewed: receipts.filter((r) => !r.review).length,
        },
    };
};

/**
 * Ghi nhận phán quyết của người duyệt, kèm những từ khoá học được từ lần sửa này.
 *
 * Xoá cache từ điển sau khi học chỉ có tác dụng trên tiến trình hiện tại. Cloud Run
 * chạy nhiều instance nên các instance khác vẫn dùng từ điển cũ tới hết TTL (5 phút) —
 * chấp nhận được: từ khoá mới có hiệu lực trễ vài phút không gây sai lệch gì, chỉ là
 * vài hóa đơn nữa rơi vào "cần người xem".
 */
const submitReceiptReview = async (extractionId, userId, { action, note, learnKeywords } = {}) => {
    // Sửa phân loại một dòng và kết luận về cả tờ hóa đơn là HAI việc khác nhau.
    // Gộp chúng lại thì mỗi lần người duyệt sửa một chữ là hệ thống ghi luôn "đã chấp
    // nhận hóa đơn" — vết kiểm toán thành sai, và chính cột review_action là thứ dùng
    // để đo độ chính xác của máy. Nên `action` được phép vắng mặt khi chỉ dạy từ điển.
    const hasAction = action !== undefined && action !== null && action !== '';
    const hasKeywords = Array.isArray(learnKeywords) && learnKeywords.length > 0;

    if (!hasAction && !hasKeywords) {
        throw Object.assign(new Error('Cần một hành động duyệt hoặc từ khoá cần ghi nhớ'), { statusCode: 400 });
    }
    if (hasAction && !REVIEW_ACTIONS.includes(action)) {
        throw Object.assign(new Error(`Hành động duyệt không hợp lệ: ${action}`), { statusCode: 400 });
    }

    const cleanKeywords = (Array.isArray(learnKeywords) ? learnKeywords : [])
        .map((row) => ({
            keyword: taxonomy.normalize(row?.keyword),
            category: row?.category,
            item_group: row?.item_group,
        }))
        .filter((row) => row.keyword
            && taxonomy.groupOfCategory(row.category)
            && (row.item_group === taxonomy.MAINTENANCE || row.item_group === taxonomy.EXCLUDED));

    let learned = [];
    if (cleanKeywords.length > 0) {
        learned = await repository.addKeywords(cleanKeywords, userId);
        invalidateTaxonomyCache();
    }

    // Chỉ dạy từ điển, chưa kết luận gì về tờ hóa đơn — không đụng tới review_action.
    if (!hasAction) return { id: extractionId, review_action: null, learned_keywords: learned };

    const saved = await repository.saveReview(extractionId, { reviewedBy: userId, action, note });
    if (!saved) {
        throw Object.assign(new Error('Không tìm thấy bản ghi đọc hóa đơn'), { statusCode: 404 });
    }

    return { ...saved, learned_keywords: learned };
};

module.exports = {
    getKeywordIndex,
    invalidateTaxonomyCache,
    validateReceipt,
    validateMaintenanceBills,
    getReceiptReview,
    submitReceiptReview,
    REVIEW_ACTIONS,
};
