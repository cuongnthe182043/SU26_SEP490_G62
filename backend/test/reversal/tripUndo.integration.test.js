/**
 * Hoàn tác tầng 1 — kịch bản BẤM NHẦM có thật của tài xế.
 *
 * Không viết theo kiểu "gọi hàm A, kỳ vọng cột B" mà dựng lại đúng chuỗi thao tác một
 * tài xế làm trên điện thoại trong ngày: nhận chuyến, chạy, bấm nhầm, phát hiện, sửa,
 * chạy tiếp. Cái cần chứng minh không phải là "hàm chạy" mà là "sau khi lùi, tài xế đi
 * tiếp được và hệ thống không còn dấu vết sai nào".
 *
 * Chạy trên Postgres thật (testcontainers) vì phần lớn tính đúng đắn nằm ở SQL: khoá
 * dòng, so bằng dấu thời gian, khoá lạc quan — mock hết thì không còn gì để kiểm.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let tripService;
let tripRepository;

const DRIVER = 4;          // tài xế sở hữu chuyến
const OTHER_DRIVER = 5;    // tài xế khác, dùng để thử bấm nhầm vào chuyến người ta

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    tripService = require('../../services/tripService');
    tripRepository = require('../../repositories/tripRepository');

    await pool.query(`
        TRUNCATE activity_logs, delivery_proofs, trip_stops, shipment_assignment_history,
                 order_shipments, orders, customers, vehicles, vehicle_groups,
                 drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (2,'coord@test.com','hash',2),(4,'driver1@test.com','hash',4),(5,'driver2@test.com','hash',4)
    `);
    await pool.query(`
        INSERT INTO profiles (id, full_name, role_id) VALUES
        (2,'Điều phối',2),(4,'Tài xế Hùng',4),(5,'Tài xế Nam',4)
    `);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Xe 5m2', 15000)`);
    await pool.query(`
        INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id, status) VALUES
        (1,'51E-246.80',1,4,'active'), (2,'51E-111.22',1,5,'active')
    `);
    await pool.query(`
        INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date) VALUES
        (4,1,1,'DL-1',CURRENT_DATE), (5,2,1,'DL-2',CURRENT_DATE)
    `);
    await pool.query(`INSERT INTO customers (id, customer_type, full_name, phone) VALUES (1,'individual','Chị Lan','0912345678')`);
});

afterAll(async () => {
    await teardown();
});

/** Dựng một đơn + chuyến mới ở trạng thái available, kèm các điểm dừng. */
let seq = 0;

// Mot tai xe chi duoc giu MOT chuyen dang chay (BR-005). Moi kich ban la mot "ngay lam
// viec" rieng, nen dong so chuyen cu lai truoc khi mo chuyen moi.
const freeDriver = async (driverId) => {
    await pool.query(
        `UPDATE order_shipments os SET status = 'cancelled', cancelled_at = NOW()
         FROM v_shipment_current sc
         WHERE sc.shipment_id = os.id AND sc.owner_driver_id = $1
           AND os.status NOT IN ('completed','cancelled')`,
        [driverId],
    );
};

const newTrip = async ({ pickups = 1, deliveries = 1, driverId = DRIVER } = {}) => {
    await freeDriver(driverId);
    seq += 1;
    const orderId = 1000 + seq;
    const shipId = 2000 + seq;
    await pool.query(
        `INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type, total_estimated_price)
         VALUES ($1, 1, 2, 'Hàng gia dụng', 'bank_transfer', 1400000)`,
        [orderId],
    );
    await pool.query(
        `INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id,
                                      estimated_price, estimated_distance_km, status)
         VALUES ($1, $2, 1, 1, 1400000, 95, 'available')`,
        [shipId, orderId],
    );
    let idx = 0;
    for (let i = 0; i < pickups; i += 1) {
        idx += 1;
        await pool.query(
            `INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address)
             VALUES ($1, $2, 'pickup', $3)`,
            [shipId, idx, `Kho ${i + 1}, Q${i + 1}`],
        );
    }
    for (let i = 0; i < deliveries; i += 1) {
        idx += 1;
        await pool.query(
            `INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address)
             VALUES ($1, $2, 'delivery', $3)`,
            [shipId, idx, `Nhà khách ${i + 1}`],
        );
    }
    return shipId;
};

const readTrip = async (id) => {
    const { rows: [r] } = await pool.query(
        `SELECT status, version, claimed_at, picking_at, transit_at, arrived_at, completed_at
         FROM order_shipments WHERE id = $1`, [id]);
    return r;
};

const readStops = async (id) => {
    const { rows } = await pool.query(
        `SELECT stop_index, stop_type, arrived_at, completed_at
         FROM trip_stops WHERE shipment_id = $1 ORDER BY stop_index`, [id]);
    return rows;
};

/** Lùi mốc thời gian của một bước về quá khứ — giả lập "mãi sau mới nhớ ra". */
const ageStamp = (id, col, seconds) =>
    pool.query(`UPDATE order_shipments SET ${col} = ${col} - INTERVAL '${seconds} seconds' WHERE id = $1`, [id]);

// Mô phỏng app bấm Hoàn tác: app luôn cầm sẵn version từ màn hình đang hiển thị.
const undo = async (id, driverId) => {
    const { version } = await readTrip(id);
    return tripService.undoLastTransition(id, driverId, { expectedVersion: Number(version) });
};

const catchErr = async (fn) => {
    try { await fn(); return null; } catch (e) { return e; }
};

describe('Hoàn tác tầng 1 — tài xế bấm nhầm rồi tự sửa', () => {

    it('KB1 — bấm nhầm "Đã đến" khi còn cách 20km, hoàn tác ngay rồi chạy tiếp bình thường', async () => {
        const id = await newTrip();
        await tripService.claimTrip(id, DRIVER);
        await tripService.updateStatus(id, DRIVER, 'picking');
        await tripService.startTransit(id, DRIVER, 'http://anh/lay-hang.jpg');

        // Bấm nhầm — tay còn ướt, nút "Đã đến" nằm ngay dưới
        await tripService.updateStatus(id, DRIVER, 'arrived');
        const nhamLan = await readTrip(id);
        assert.strictEqual(nhamLan.status, 'arrived');
        assert.ok(nhamLan.arrived_at, 'phải có mốc arrived_at sau khi bấm');

        // Nhận ra ngay, bấm Hoàn tác
        const sauKhiLui = await undo(id, DRIVER);
        assert.strictEqual(sauKhiLui.status, 'transit');
        assert.strictEqual(sauKhiLui.undone_from, 'arrived');

        const trip = await readTrip(id);
        assert.strictEqual(trip.status, 'transit');
        assert.strictEqual(trip.arrived_at, null,
            'arrived_at PHẢI được xoá — để lại thì mọi báo cáo đọc cột này đều sai');
        assert.ok(trip.transit_at, 'mốc của bước trước phải còn nguyên');

        // Chạy tiếp bình thường: đến thật rồi hoàn thành
        await tripService.updateStatus(id, DRIVER, 'arrived');
        const denThat = await readTrip(id);
        assert.strictEqual(denThat.status, 'arrived');
        assert.ok(denThat.arrived_at, 'lần đến thật phải ghi lại mốc mới');
    });

    it('KB2 — mãi 3 phút sau mới nhớ ra: hết cửa sổ, hệ thống từ chối và chỉ đường khác', async () => {
        const id = await newTrip();
        await tripService.claimTrip(id, DRIVER);
        await tripService.updateStatus(id, DRIVER, 'picking');
        await tripService.startTransit(id, DRIVER, 'http://anh/lay-hang.jpg');
        await tripService.updateStatus(id, DRIVER, 'arrived');

        await ageStamp(id, 'arrived_at', 180);   // 3 phút trước

        const err = await catchErr(() => undo(id, DRIVER));
        assert.ok(err, 'phải từ chối');
        assert.match(err.message, /^WINDOW_EXPIRED:/);
        assert.match(err.message, /điều phối/, 'phải chỉ cho tài xế đường xử lý khác');

        assert.strictEqual((await readTrip(id)).status, 'arrived', 'trạng thái không được đổi');
    });

    it('KB3 — chuyến 2 điểm lấy hàng: hoàn tác KHÔNG được xoá điểm tài xế đã tự bấm xong', async () => {
        const id = await newTrip({ pickups: 2, deliveries: 1 });
        await tripService.claimTrip(id, DRIVER);
        await tripService.updateStatus(id, DRIVER, 'picking');

        // Tài xế tự bấm xong điểm lấy hàng 1 (có ảnh riêng của điểm đó)
        const stops = await pool.query(
            `SELECT id, stop_index FROM trip_stops WHERE shipment_id = $1 ORDER BY stop_index`, [id]);
        const stop1 = stops.rows[0].id;
        await tripService.completeStop(id, stop1, DRIVER, 'http://anh/diem-1.jpg');

        const truoc = await readStops(id);
        const mocDiem1 = truoc[0].completed_at;
        assert.ok(mocDiem1, 'điểm 1 phải đã xong do tài xế tự bấm');

        // Bấm nhầm "Bắt đầu vận chuyển" khi chưa lấy hàng ở điểm 2
        await tripService.startTransit(id, DRIVER, 'http://anh/nham.jpg');
        const giuaChung = await readStops(id);
        assert.ok(giuaChung[1].completed_at, 'bước transit đánh dấu xong cả điểm 2');

        // Hoàn tác
        await undo(id, DRIVER);

        const sau = await readStops(id);
        assert.deepStrictEqual(sau[0].completed_at, mocDiem1,
            'điểm tài xế TỰ bấm phải giữ nguyên mốc cũ — hoàn tác chỉ dọn phần của bước bị lùi');
        assert.strictEqual(sau[1].completed_at, null,
            'điểm do bước transit đánh dấu phải được trả về chưa xong');
        assert.strictEqual(sau[1].arrived_at, null,
            'arrived_at do bước transit đặt cũng phải được dọn');
    });

    it('KB4 — sau khi hoàn tác, ảnh lấy hàng vẫn BẮT BUỘC ở lần bấm lại (BR-013 không bị lách)', async () => {
        const id = await newTrip({ pickups: 1, deliveries: 1 });
        await tripService.claimTrip(id, DRIVER);
        await tripService.updateStatus(id, DRIVER, 'picking');

        // Lần đầu: có ảnh, đi qua được
        await tripService.startTransit(id, DRIVER, 'http://anh/lay-hang.jpg');
        assert.strictEqual((await readTrip(id)).status, 'transit');

        // Hoàn tác
        await undo(id, DRIVER);
        assert.strictEqual((await readTrip(id)).status, 'picking');

        // Bấm lại NHƯNG không gửi ảnh — phải bị chặn.
        //
        // Đây là chỗ dễ thủng nhất: startTransit bỏ qua yêu cầu ảnh khi mọi điểm lấy
        // hàng đã completed, mà chính bước transit lại đánh dấu chúng completed. Không
        // dọn mốc đó khi hoàn tác thì tài xế có đường bỏ qua ảnh bắt buộc: bấm một lần
        // với ảnh rác, hoàn tác, rồi bấm lại tay không.
        const err = await catchErr(() => tripService.startTransit(id, DRIVER, null));
        assert.ok(err, 'phải chặn');
        assert.match(err.message, /BR-013|bắt buộc/i);
    });

    it('KB5 — hai thiết bị cùng tài khoản: máy cũ giữ dữ liệu cũ, hoàn tác bị chặn bằng khoá phiên bản', async () => {
        const id = await newTrip();
        await tripService.claimTrip(id, DRIVER);
        await tripService.updateStatus(id, DRIVER, 'picking');

        // Điện thoại đọc chuyến ở đây (version cũ)
        const versionMayCu = Number((await readTrip(id)).version);

        // Máy tính bảng bấm tiếp
        await tripService.startTransit(id, DRIVER, 'http://anh/lay-hang.jpg');

        // Điện thoại giờ mới bấm Hoàn tác, vẫn gửi version cũ
        const err = await catchErr(() =>
            tripService.undoLastTransition(id, DRIVER, { expectedVersion: versionMayCu }));
        assert.ok(err, 'phải từ chối');
        assert.strictEqual(err.code, 'STALE_VERSION');
        assert.strictEqual((await readTrip(id)).status, 'transit', 'không được lùi nhầm bước');
    });

    it('KB6 — mạng lag, tài xế bấm Hoàn tác hai lần: chỉ lùi ĐÚNG một bước', async () => {
        const id = await newTrip();
        await tripService.claimTrip(id, DRIVER);
        await tripService.updateStatus(id, DRIVER, 'picking');
        await tripService.startTransit(id, DRIVER, 'http://anh/lay-hang.jpg');
        await tripService.updateStatus(id, DRIVER, 'arrived');

        // Bấm đúp: cả hai lệnh mang CÙNG một version, vì màn hình chưa kịp vẽ lại
        const { version } = await readTrip(id);
        const ketQua = await Promise.allSettled([
            tripService.undoLastTransition(id, DRIVER, { expectedVersion: Number(version) }),
            tripService.undoLastTransition(id, DRIVER, { expectedVersion: Number(version) }),
        ]);
        const thanhCong = ketQua.filter((r) => r.status === 'fulfilled');
        const thatBai = ketQua.filter((r) => r.status === 'rejected');

        const trip = await readTrip(id);
        assert.strictEqual(trip.status, 'transit',
            `chỉ được lùi một bước (arrived→transit), thực tế: ${trip.status}`);
        assert.strictEqual(thanhCong.length, 1, 'đúng một lệnh được ăn');
        assert.strictEqual(thatBai.length, 1, 'lệnh còn lại phải bị từ chối, không im lặng lùi tiếp');
        assert.ok(trip.transit_at, 'không được lùi lan sang bước trước đó');
    });

    it('KB7 — tài xế khác bấm nhầm vào chuyến không phải của mình: bị từ chối', async () => {
        const id = await newTrip();
        await tripService.claimTrip(id, DRIVER);
        await tripService.updateStatus(id, DRIVER, 'picking');

        const err = await catchErr(() => undo(id, OTHER_DRIVER));
        assert.ok(err);
        assert.match(err.message, /^FORBIDDEN:/);
        assert.strictEqual((await readTrip(id)).status, 'picking');
    });

    it('KB8 — chuyến đã hoàn thành thì tầng 1 không nhận: phải đi đường có người duyệt', async () => {
        const id = await newTrip();
        await tripService.claimTrip(id, DRIVER);
        await tripService.updateStatus(id, DRIVER, 'picking');
        await tripService.startTransit(id, DRIVER, 'http://anh/lay-hang.jpg');
        await tripService.updateStatus(id, DRIVER, 'arrived');
        await tripRepository.updateTripStatus(id, 'completed', null, DRIVER);

        const err = await catchErr(() => undo(id, DRIVER));
        assert.ok(err);
        assert.match(err.message, /^NOT_UNDOABLE:/);
    });

    it('KB9 — mỗi lần hoàn tác để lại đúng một vết trong nhật ký, có bước bị lùi và độ trễ', async () => {
        const id = await newTrip();
        await tripService.claimTrip(id, DRIVER);
        await tripService.updateStatus(id, DRIVER, 'picking');
        await undo(id, DRIVER);

        // logSafe ghi ngoài giao dịch — chờ một nhịp cho nó kịp xuống DB
        await new Promise((r) => setTimeout(r, 250));

        const { rows } = await pool.query(
            `SELECT user_id, old_data, new_data FROM activity_logs
             WHERE entity_id = $1 AND action = 'trip_status_undo'`, [id]);
        assert.strictEqual(rows.length, 1, 'đúng một vết');
        assert.strictEqual(Number(rows[0].user_id), DRIVER);
        assert.strictEqual(rows[0].old_data.status, 'picking');
        assert.strictEqual(rows[0].new_data.status, 'claimed');
        assert.strictEqual(rows[0].new_data.reversal_tier, 1);
        assert.ok(Number.isFinite(rows[0].new_data.age_ms), 'ghi lại độ trễ để đo sau này');
    });

    it('KB9b — bấm vội ba bước liền, lùi lại từng bước một cho tới đúng chỗ', async () => {
        const id = await newTrip();
        await tripService.claimTrip(id, DRIVER);

        // Tài xế vuốt nhầm cả cụm nút trong lúc xe rung
        await tripService.updateStatus(id, DRIVER, 'picking');
        await tripService.startTransit(id, DRIVER, 'http://anh/nham.jpg');
        await tripService.updateStatus(id, DRIVER, 'arrived');

        // Lùi từng bước — mỗi lần là một cú bấm CÓ CHỦ Ý sau khi màn hình đã vẽ lại,
        // khác hẳn với bấm đúp ở KB6 (cùng một version, bị chặn).
        await undo(id, DRIVER);
        assert.strictEqual((await readTrip(id)).status, 'transit');
        await undo(id, DRIVER);
        assert.strictEqual((await readTrip(id)).status, 'picking');
        await undo(id, DRIVER);

        const cuoi = await readTrip(id);
        assert.strictEqual(cuoi.status, 'claimed', 'về đúng chỗ trước khi bấm nhầm');
        assert.strictEqual(cuoi.picking_at, null);
        assert.strictEqual(cuoi.transit_at, null);
        assert.strictEqual(cuoi.arrived_at, null);
        assert.ok(cuoi.claimed_at, 'mốc nhận chuyến không bị đụng tới');

        // 'claimed' không nằm trong bảng hoàn tác — muốn trả chuyến thì dùng "Trả về pool"
        const err = await catchErr(() => undo(id, DRIVER));
        assert.match(err.message, /^NOT_UNDOABLE:/);
    });

    it('KB10b — gọi hoàn tác mà không kèm phiên bản thì bị từ chối, không đoán bừa', async () => {
        const id = await newTrip();
        await tripService.claimTrip(id, DRIVER);
        await tripService.updateStatus(id, DRIVER, 'picking');

        const err = await catchErr(() => tripService.undoLastTransition(id, DRIVER, {}));
        assert.ok(err);
        assert.match(err.message, /^VERSION_REQUIRED:/);
        assert.strictEqual((await readTrip(id)).status, 'picking');
    });

    it('KB10 — trạng thái trả về cho app đã kèm sẵn hạn hoàn tác, app không phải tự đoán', async () => {
        const id = await newTrip();
        await tripService.claimTrip(id, DRIVER);
        await tripService.updateStatus(id, DRIVER, 'picking');

        const active = await tripService.getActiveTrip(DRIVER);
        assert.strictEqual(Number(active.id), id);
        assert.strictEqual(active.can_undo, true);
        assert.strictEqual(active.undo_back_to, 'claimed');
        assert.ok(new Date(active.undo_expires_at).getTime() > Date.now(),
            'hạn phải là mốc tuyệt đối ở tương lai — app chỉ đếm ngược, không tự tính');

        await ageStamp(id, 'picking_at', 180);
        const hetHan = await tripService.getActiveTrip(DRIVER);
        assert.strictEqual(hetHan.can_undo, false, 'quá hạn thì app phải ẩn nút');
    });
});
