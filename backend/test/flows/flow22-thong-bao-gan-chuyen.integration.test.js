/**
 * L2-FLOW-22 — Luồng: Điều phối viên gán chuyến cho tài xế → tài xế phải nhận thông báo
 *
 * Test THEO LUỒNG, đi hết BA đường mà một chuyến có thể rơi vào tay tài xế:
 *
 *   1. Tạo đơn kèm BKS      → orderService.createOrder
 *   2. Sửa đơn để thêm BKS  → orderService.updateOrder      ← đường bị bỏ quên
 *   3. Gán tài sau khi tạo  → coordinatorService.assignOrderShipments
 *
 * Cả ba đều kết thúc bằng việc shipment mang owner_driver_id và status = 'claimed' —
 * tài xế có việc phải làm ngay. Nhưng chỉ đường (1) và (3) từng được vá báo tin;
 * đường (2) chỉ gọi notifyOrderChange, mà hàm đó bắn theo VAI TRÒ (coordinator /
 * accountant / manager) nên tài xế không nằm trong danh sách nào. Hậu quả đúng như
 * điều phối viên mô tả: "gán xong mà mobile không có thông báo gì".
 *
 * Thông báo là bằng chứng kiểm chứng được ở tầng DB (bảng notifications). Kênh
 * WebSocket và push chỉ là đường vận chuyển — không có bản ghi này thì cả hai đều
 * không có gì để gửi, nên đây là chỗ chặn đúng.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let orderService;
let coordinatorService;

const COORD_ID = 2;
const DRIVER_A = 4;
const DRIVER_B = 5;
const DRIVER_C = 6;   // để rảnh cho B3 — A và B đều đã ôm chuyến của đơn ở B1/B2

/** Ngày giao hàng hợp lệ (mai) — createOrder từ chối ngày quá khứ. */
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const listAssignNotifications = async (driverId) => {
    const { rows } = await pool.query(
        `SELECT id, title, body, entity_type, entity_id
           FROM notifications
          WHERE user_id = $1 AND type = 'TRIP_ASSIGNED'
          ORDER BY id`,
        [driverId],
    );
    return rows;
};

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    orderService = require('../../services/orderService');
    coordinatorService = require('../../services/coordinatorService');

    await pool.query(`
        TRUNCATE notifications, shipment_assignment_history, trip_stops, order_shipments, orders,
                 customers, vehicles, vehicle_groups, drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (2,'coord@test.com','hash',2),(4,'driverA@test.com','hash',4),
        (5,'driverB@test.com','hash',4),(6,'driverC@test.com','hash',4)
    `);
    await pool.query(`
        INSERT INTO profiles (id, full_name, role_id) VALUES
        (2,'Coordinator',2),(4,'Tai A',4),(5,'Tai B',4),(6,'Tai C',4)
    `);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Xe 5m2', 15000)`);
    await pool.query(`
        INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id, status) VALUES
        (1, '51E-100.01', 1, 4, 'active'), (2, '51E-100.02', 1, 5, 'active'), (3, '51E-100.03', 1, 6, 'active')
    `);
    await pool.query(`
        INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date) VALUES
        (4, 1, 1, 'DL-A', CURRENT_DATE), (5, 2, 1, 'DL-B', CURRENT_DATE), (6, 3, 1, 'DL-C', CURRENT_DATE)
    `);
});

afterAll(async () => {
    await teardown();
});

describe('L2-FLOW-22 — Điều phối gán chuyến → tài xế nhận thông báo', () => {
    let orderId;

    it('B1 — Tạo đơn kèm BKS: tài xế của xe đó nhận ngay thông báo được giao chuyến', async () => {
        const result = await orderService.createOrder(COORD_ID, {
            arrived_at: tomorrow(),
            customer_name: 'Cong ty Binh Minh', customer_phone: '0909333444',
            cargo_name: 'Hang kho', pickup_address: 'Kho Q7', delivery_address: 'KCN Tan Binh',
            payment_type: 'bank_transfer',
            trips: [
                { plate: '51E-100.01', distance: 40 },   // gán sẵn cho tài A
                { distance: 60 },                        // để trống, sẽ gán ở B2
            ],
        });
        orderId = result.order.id;

        const { rows: shipments } = await pool.query(
            'SELECT id, status FROM order_shipments WHERE order_id = $1 ORDER BY shipment_index', [orderId],
        );
        assert.strictEqual(shipments[0].status, 'claimed', 'chuyến có BKS phải claimed sẵn cho tài của xe');
        assert.strictEqual(shipments[1].status, 'available');

        const notifications = await listAssignNotifications(DRIVER_A);
        assert.strictEqual(notifications.length, 1, 'tài A phải nhận đúng 1 thông báo được giao chuyến');
        assert.strictEqual(notifications[0].entity_type, 'shipments');
        assert.strictEqual(notifications[0].entity_id, shipments[0].id, 'thông báo phải trỏ về đúng chuyến để app mở thẳng màn chuyến');

        assert.strictEqual((await listAssignNotifications(DRIVER_B)).length, 0,
            'chuyến còn trống thì chưa ai được giao — không được báo nhầm');
    });

    it('B2 — Sửa đơn để điền BKS vào chuyến còn trống: tài của xe đó phải nhận thông báo (đường bị bỏ quên)', async () => {
        // Chuyến thứ 2 của đơn tạo ở B1 đang trống (nằm trong pool). Điều phối viên mở
        // đơn ra sửa và điền BKS của tài B — đây là giao việc thật sự, không phải sửa
        // thông tin. Luật nghiệp vụ chỉ cho gán/đổi xe khi chuyến còn AVAILABLE, nên
        // đây đúng là hình dạng duy nhất của "gán tài qua màn sửa đơn".
        await orderService.updateOrder(orderId, {
            customer_name: 'Cong ty Binh Minh', customer_phone: '0909333444',
            pickup_address: 'Kho Q7', delivery_address: 'KCN Tan Binh',
            trips: [
                { plate: '51E-100.01', distance: 40 },
                { plate: '51E-100.02', distance: 60 },
            ],
            updated_by: COORD_ID,
        });

        const { rows } = await pool.query(
            `SELECT os.id, os.status, sc.owner_driver_id
               FROM order_shipments os JOIN v_shipment_current sc ON sc.shipment_id = os.id
              WHERE os.order_id = $1 ORDER BY os.shipment_index`,
            [orderId],
        );
        assert.strictEqual(rows[1].owner_driver_id, DRIVER_B, 'chuyến trống phải về tay tài của BKS vừa điền');
        assert.strictEqual(rows[1].status, 'claimed');

        const notifications = await listAssignNotifications(DRIVER_B);
        assert.strictEqual(notifications.length, 1,
            'tài B phải nhận thông báo — chuyến đã nằm trong danh sách việc của họ mà không hề hay biết');
        assert.strictEqual(notifications[0].entity_id, rows[1].id, 'thông báo phải trỏ đúng chuyến vừa giao');

        assert.strictEqual((await listAssignNotifications(DRIVER_A)).length, 1,
            'tài A đã cầm chuyến 1 từ trước — sửa đơn không được bắn lại cho họ');
    });

    it('B3 — Gán tài sau khi tạo đơn (assign-driver): tài xế nhận thông báo', async () => {
        const result = await orderService.createOrder(COORD_ID, {
            arrived_at: tomorrow(),
            customer_name: 'Khach le', pickup_address: 'Kho Q9', delivery_address: 'Bien Hoa',
            payment_type: 'bank_transfer',
            trips: [{ distance: 20 }],
        });
        const { rows: [shipment] } = await pool.query(
            'SELECT id, status FROM order_shipments WHERE order_id = $1', [result.order.id],
        );
        assert.strictEqual(shipment.status, 'available', 'chuyến không BKS phải nằm chờ trong pool');

        await coordinatorService.assignOrderShipments(
            result.order.id, { shipmentIds: [shipment.id], driverId: DRIVER_C }, COORD_ID,
        );

        const notifications = await listAssignNotifications(DRIVER_C);
        assert.strictEqual(notifications.length, 1, 'gán tài sau khi tạo đơn cũng phải báo cho tài xế');
        assert.strictEqual(notifications[0].entity_id, shipment.id);
    });

    it('B4 — Sửa đơn nhưng KHÔNG đổi tài: không được bắn lại thông báo trùng', async () => {
        const truocA = (await listAssignNotifications(DRIVER_A)).length;
        const truocB = (await listAssignNotifications(DRIVER_B)).length;

        await orderService.updateOrder(orderId, {
            customer_name: 'Cong ty Binh Minh', customer_phone: '0909333444',
            pickup_address: 'Kho Q7', delivery_address: 'KCN Tan Binh',
            // giữ nguyên hai BKS cũ, chỉ sửa giá cước chuyến 1
            trips: [
                { plate: '51E-100.01', distance: 40, price: 700000 },
                { plate: '51E-100.02', distance: 60 },
            ],
            updated_by: COORD_ID,
        });

        assert.strictEqual((await listAssignNotifications(DRIVER_A)).length, truocA);
        assert.strictEqual((await listAssignNotifications(DRIVER_B)).length, truocB,
            'tài đã biết chuyến này rồi — sửa giá không phải là giao việc mới');
    });
});
