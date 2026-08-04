const XLSX = require('xlsx');
const pool = require('../config/database');
const orderRepository = require('../repositories/orderRepository');
const expenseRepository = require('../repositories/expenseRepository');
const incidentRepository = require('../repositories/incidentRepository');
const coordinatorRepository = require('../repositories/coordinatorRepository');
const notificationGateway = require('./notificationGateway');
const { SHIPMENT_STATUS } = require('../constants/tripConstants');
const { ALLOWED_EXPENSE_TYPES: VALID_EXPENSE_TYPES, PASS_THROUGH_EXPENSE_TYPES } = require('../constants/expenseConstants');
const financialLedgerRepository = require('../repositories/financialLedgerRepository');
const { normalizeVietnamPhone } = require('../utils/phone');

const COLUMN_ALIASES = {
  date: [
  'ngày',
  'ngày tháng năm',
  'ngày, tháng, năm',
  'ngay thang nam',
  'date'
],
  checkIn: ['chấm công', 'cham cong', 'check in', 'checkin'],
  plate: ['bks', 'biển số', 'bien so', 'plate'],
  driver: ['lái xe', 'lai xe', 'driver'],
  customer: ['khách hàng', 'khach hang', 'customer'],
  customerPhone: ['sđt', 'sdt', 'số điện thoại', 'so dien thoai', 'phone', 'customer phone'],
  route: ['hành trình', 'hanh trinh', 'route'],
  distance: ['quãng đường', 'quang duong', 'distance'],
  fare: ['cước xe', 'cuoc xe', 'fare'],
  ticket: ['vé', 've', 'ticket'],
  paid: ['kh đã thanh toán', 'kh da thanh toan', 'paid'],
  driverIncome: ['lái xe thu/chi', 'lai xe thu/chi', 'driver income'],
  fuel: ['đổ dầu', 'do dau', 'fuel'],
  advance: ['ứng lương', 'ung luong', 'advance'],
  note: ['ghi chú', 'ghi chu', 'note'],
  revenue1: ['doanh thu 1', 'doanh thu', 'revenue'],
  revenue2: ['doanh thu 2', 'revenue 2'],
};

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/đ/g, 'd')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s/.-]/g, '');

const buildHeaderMap = (headerRow) => {
  const map = new Map();
  headerRow.forEach((cell, index) => {
    const normalized = normalizeKey(cell);
    if (normalized) map.set(normalized, index);
  });
  return map;
};

const getHeaderIndex = (headerMap, aliases) => {
  for (const alias of aliases) {
    const index = headerMap.get(normalizeKey(alias));
    if (index !== undefined) return index;
  }
  return undefined;
};

const extractValue = (row, headerMap, aliases) => {
  const index = getHeaderIndex(headerMap, aliases);
  return index !== undefined ? row[index] ?? '' : '';
};

const extractRouteValue = (row, headerMap) => {
  const routeIndex = getHeaderIndex(headerMap, COLUMN_ALIASES.route);
  if (routeIndex === undefined) return '';

  const nextKnownIndex = Array.from(headerMap.values())
    .filter((index) => index > routeIndex)
    .sort((a, b) => a - b)[0] ?? row.length;

  return row
    .slice(routeIndex, nextKnownIndex)
    .map((value) => safeTrim(value))
    .filter(Boolean)
    .join(' ');
};

const parseSpreadsheet = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('File Excel không có sheet nào');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) return [];

  const headerMap = buildHeaderMap(rows[0]);
  return rows.slice(1)
    .filter((row) => row.some((value) => String(value).trim() !== ''))
    .map((row) => ({
      date: extractValue(row, headerMap, COLUMN_ALIASES.date),
      checkIn: extractValue(row, headerMap, COLUMN_ALIASES.checkIn),
      plate: extractValue(row, headerMap, COLUMN_ALIASES.plate),
      driver: extractValue(row, headerMap, COLUMN_ALIASES.driver),
      customer: extractValue(row, headerMap, COLUMN_ALIASES.customer),
      customerPhone: extractValue(row, headerMap, COLUMN_ALIASES.customerPhone),
      route: extractRouteValue(row, headerMap),
      distance: extractValue(row, headerMap, COLUMN_ALIASES.distance),
      fare: extractValue(row, headerMap, COLUMN_ALIASES.fare),
      ticket: extractValue(row, headerMap, COLUMN_ALIASES.ticket),
      paid: extractValue(row, headerMap, COLUMN_ALIASES.paid),
      driverIncome: extractValue(row, headerMap, COLUMN_ALIASES.driverIncome),
      fuel: extractValue(row, headerMap, COLUMN_ALIASES.fuel),
      advance: extractValue(row, headerMap, COLUMN_ALIASES.advance),
      note: extractValue(row, headerMap, COLUMN_ALIASES.note),
      revenue1: extractValue(row, headerMap, COLUMN_ALIASES.revenue1),
      revenue2: extractValue(row, headerMap, COLUMN_ALIASES.revenue2),
    }));
};

const safeTrim = (value) => String(value ?? '').trim();
// (normalizePhone bên dưới dùng chuẩn hoá SĐT VN dùng chung)

const normalizeText = (value) => safeTrim(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/đ/g, 'd')
  .replace(/[\u0300-\u036f]/g, '');

const normalizePhone = (value) => normalizeVietnamPhone(value);

const isLeaveNote = (value) => normalizeText(value) === 'nghi';

const parseExcelDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const isoLike = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoLike) return text;

  const slashLike = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashLike) {
    const [, day, month, year] = slashLike;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const normalizeNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const cleanStr = String(value)
    .replace(/đ/g, '')
    .replace(/d/g, '')
    .replace(/\s/g, '')
    .trim();
  let parsedStr = cleanStr;
  if ((cleanStr.match(/\./g) || []).length > 1) {
    parsedStr = cleanStr.replace(/\./g, '');
  } else if (cleanStr.includes('.') && cleanStr.includes(',')) {
    if (cleanStr.indexOf(',') < cleanStr.indexOf('.')) {
      parsedStr = cleanStr.replace(/,/g, '');
    } else {
      parsedStr = cleanStr.replace(/\./g, '').replace(/,/g, '.');
    }
  } else if (cleanStr.includes(',')) {
    if ((cleanStr.match(/,/g) || []).length > 1) {
      parsedStr = cleanStr.replace(/,/g, '');
    } else {
      const parts = cleanStr.split(',');
      if (parts[1].length === 3) {
        parsedStr = cleanStr.replace(/,/g, '');
      } else {
        parsedStr = cleanStr.replace(/,/g, '.');
      }
    }
  }
  const numericValue = Number(parsedStr);
  if (Number.isNaN(numericValue)) return null;
  return numericValue;
};

const parseRoute = (routeStr) => {
  const route = safeTrim(routeStr);
  if (!route) return { pickupAddress: 'Chưa xác định', deliveryAddress: 'Chưa xác định' };
  const parts = route.split(/ - |-/);
  if (parts.length >= 2) {
    return {
      pickupAddress: parts[0].trim(),
      deliveryAddress: parts[1].trim()
    };
  }
  return {
    pickupAddress: route,
    deliveryAddress: route
  };
};

const listVehicleGroups = async () => orderRepository.listCoordinatorVehicleGroups();

const listPartners = async () => orderRepository.listCoordinatorPartners();

const getIncidents = async ({ status = null, severityLevel = null, search = '', sort = 'newest', page = 1, limit = 10 } = {}) => {
  return incidentRepository.getCoordinatorIncidents({ status, severityLevel, search, sort, page, limit });
};

const importExcel = async (userId, fileBuffer) => {
  if (!fileBuffer) throw new Error('Thiếu file Excel');
  const rows = parseSpreadsheet(fileBuffer);
  if (!rows.length) return { rows: [] };

  let dbClient = null;
  const createdOrders = [];

  try {
    dbClient = await pool.connect();
    await dbClient.query('BEGIN');

    const defaultVehicleGroupId = await orderRepository.getDefaultVehicleGroupId(dbClient);
    if (!defaultVehicleGroupId) {
      throw new Error('Chưa có nhóm xe trong hệ thống');
    }

    for (const row of rows) {
      const date = parseExcelDate(row.date);
      const plate = safeTrim(row.plate);
      const driverName = safeTrim(row.driver);
      const customerName = safeTrim(row.customer);
      const customerPhone = normalizePhone(row.customerPhone);
      const route = safeTrim(row.route);
      const distanceValue = normalizeNumber(row.distance);
      let fare = 0;
      const note = safeTrim(row.note);

      if (isLeaveNote(note)) {
        continue;
      }

      if (!date) {
        throw new Error('Ngày tháng năm là bắt buộc trong file Excel');
      }
      if (distanceValue === null || distanceValue <= 0) {
        throw new Error('Quãng đường là bắt buộc trong file Excel để tính cước');
      }

      const { pickupAddress, deliveryAddress } = parseRoute(route);

      let customer = null;
      if (customerPhone) {
        customer = await orderRepository.findOrCreateCustomer(
          dbClient,
          customerName,
          customerPhone,
          normalizePhone,
          safeTrim,
        );
      } else if (customerName) {
        customer = await orderRepository.findCustomerByName(dbClient, customerName);
      }

      const vehicle = plate ? await orderRepository.getVehicleByPlate(dbClient, plate) : null;
      if (plate && !vehicle) {
        throw new Error(`BKS ${plate} không tồn tại trong hệ thống`);
      }
      if (vehicle?.vehicle_status && vehicle.vehicle_status !== 'active') {
        throw new Error(`Xe ${plate} hiện không sẵn sàng cho vận hành (trạng thái: ${vehicle.vehicle_status})`);
      }

      const finalDriverId = null;
      const finalVehicleId = vehicle?.id ?? null;
      const finalVehicleGroupId = vehicle?.vehicle_group_id ?? defaultVehicleGroupId;
      const vehicleGroup = await orderRepository.getVehicleGroupById(dbClient, finalVehicleGroupId);
      if (distanceValue !== null && vehicleGroup) {
        fare = distanceValue * Number(vehicleGroup.price_per_km || 0);
      }

      const shipmentStatus = SHIPMENT_STATUS.AVAILABLE;

      const notes = [
        plate ? `BKS: ${plate}` : '',
        driverName ? `Lái xe: ${driverName}` : '',
        note,
      ].filter(Boolean).join(' | ');

      const result = await orderRepository.importOrderWithShipment({
        client: dbClient,
        userId,
        orderData: {
          customer_id: customer?.id ?? null,
          cargo_name: route || `${pickupAddress} - ${deliveryAddress}`,
          cargo_weight_kg: null,
          pickup_address: pickupAddress,
          delivery_address: deliveryAddress,
          estimated_price: fare || 0,
          payment_type: 'cash',
          customer_name: customerName,
          customer_phone: customerPhone,
          notes,
        },
        shipmentData: {
          owner_driver_id: finalDriverId,
          vehicle_id: finalVehicleId,
          vehicle_group_id: finalVehicleGroupId,
          pickup_address: pickupAddress,
          delivery_address: deliveryAddress,
          cargo_name: route || `${pickupAddress} - ${deliveryAddress}`,
          cargo_weight_kg: null,
          estimated_price: fare || 0,
          estimated_distance_km: distanceValue,
          arrived_at: date,
          plate_number: vehicle?.plate_number || plate,
          status: shipmentStatus,
          payment_type: 'cash',
          notes,
        },
      });

      createdOrders.push(result.order);
    }

    await dbClient.query('COMMIT');
    return { rows: createdOrders };
  } catch (err) {
    if (dbClient) {
      await dbClient.query('ROLLBACK');
    }
    throw err;
  } finally {
    dbClient?.release?.();
  }
};

// ─── Receipt Request Management ───────────────────────────────────────────────

// toll, parking, etc: khách chịu (pass-through). fuel/repair: công ty chịu.

// Chỉ dùng để HIỂN THỊ xem trước (chưa chốt) — phải khớp với logic tính tiền
// thật trong computeReceiptAmount, nếu không coordinator sẽ thấy số "gợi ý" sai
// (VD: giá công ty đã sửa tay nhưng preview lại hiện theo km × đơn giá).
const resolveShipmentActualRevenue = (shipment = {}) => {
    const actualPrice = Number(shipment.actual_price);
    if (Number.isFinite(actualPrice) && actualPrice > 0) {
        return actualPrice;
    }

    // Giá cố định do DN chốt tay → luôn hiện đúng giá đó, bất kể km.
    if (shipment.is_price_manual === true) {
        const manualPrice = Number(shipment.estimated_price);
        return Number.isFinite(manualPrice) && manualPrice > 0 ? manualPrice : 0;
    }

    const actualKm = Number(shipment.actual_distance_km ?? shipment.actual_km ?? 0);
    const pricePerKm = Number(shipment.price_per_km || 0);
    if (actualKm <= 0 || pricePerKm <= 0) return 0;

    // Chuyến hoàn hàng (returning_at có giá trị) chạy CẢ HAI CHIỀU nên tính GẤP ĐÔI —
    // phải khớp đúng logic thật trong computeReceiptAmount. Thiếu nhánh này, dòng
    // "Doanh thu" từng chuyến và "Tổng thu" ở màn xem trước hiện đúng MỘT NỬA số tiền
    // sẽ thực sự bị chốt khi coordinator bấm Duyệt.
    return shipment.returning_at ? actualKm * pricePerKm * 2 : actualKm * pricePerKm;
};

const normalizeAmount = (value, fieldLabel = 'Số tiền') => {
    const amount = Number(value);
    if (!amount || Number.isNaN(amount) || amount <= 0) {
        throw new Error(`${fieldLabel} phải lớn hơn 0`);
    }
    return amount;
};

const normalizeExpenses = (expenses = []) => {
    if (!Array.isArray(expenses)) throw new Error('Danh sách chi phí không hợp lệ');

    return expenses.map((expense, index) => {
        const expenseType = String(expense?.expense_type ?? expense?.expenseType ?? '').trim();
        if (!VALID_EXPENSE_TYPES.includes(expenseType)) {
            throw new Error(`Loại chi phí #${index + 1} không hợp lệ`);
        }

        const shipmentIdRaw = expense?.shipment_id ?? expense?.shipmentId ?? null;
        const shipmentId = shipmentIdRaw === null || shipmentIdRaw === undefined || shipmentIdRaw === ''
            ? null
            : Number(shipmentIdRaw);
        if (shipmentId !== null && (!Number.isInteger(shipmentId) || shipmentId <= 0)) {
            throw new Error(`Chuyến xe cho chi phí #${index + 1} không hợp lệ`);
        }

        return {
            expense_type: expenseType,
            amount: normalizeAmount(expense?.amount, `Số tiền chi phí #${index + 1}`),
            description: String(expense?.description ?? '').trim() || null,
            shipment_id: shipmentId,
        };
    });
};

const getOrderShipmentsForReceipt = async (db, orderId) => {
    const rawShipments = await coordinatorRepository.getOrderShipments(db, orderId);

    const shipments = [];
    for (const shipment of rawShipments) {
        const expenses = await expenseRepository.getShipmentExpenses(shipment.id);
        // Tính cả 'pending' lẫn 'approved', chỉ bỏ 'rejected'. Chi phí tài xế khai KHÔNG
        // cần một bước duyệt riêng: phát hành phiếu thu CHÍNH LÀ hành động duyệt
        // (autoApproveOrderExpenses trong approveReceiptRequest). Khoản 'pending' vì thế
        // chắc chắn nằm trong phiếu, nên màn xem trước phải hiện đúng con số đó — lọc bỏ
        // pending sẽ khiến coordinator xem 0đ rồi chốt ra số khác.
        const countableExpenses = expenses.filter((expense) => expense.status !== 'rejected');
        const totalExpenses = countableExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        const passThroughExpenses = countableExpenses.reduce((sum, expense) => (
            PASS_THROUGH_EXPENSE_TYPES.has(String(expense.expense_type || '').trim())
                ? sum + Number(expense.amount || 0)
                : sum
        ), 0);
        const pickupStops = shipment.stops.filter((stop) => stop.stop_type === 'pickup');
        const deliveryStop = shipment.stops.find((stop) => stop.stop_type === 'delivery') ?? null;
        const actualKm = shipment.actual_distance_km ?? shipment.estimated_distance_km;
        const resolvedRevenue = resolveShipmentActualRevenue({
            ...shipment,
            actual_km: actualKm,
        });

        shipments.push({
            ...shipment,
            actual_km: actualKm,
            actual_revenue: resolvedRevenue,
            expenses,
            total_expenses: totalExpenses,
            total_pass_through_expenses: passThroughExpenses,
            pickup_address: pickupStops[0]?.address || null,
            pickup_addresses: pickupStops,
            delivery_address: deliveryStop?.address || null,
            delivery_contact_name: deliveryStop?.contact_name || null,
            delivery_contact_phone: deliveryStop?.contact_phone || null,
        });
    }

    return shipments;
};

const sumShipmentActualRevenue = (shipments = []) => shipments.reduce((sum, shipment) => (
    sum + Number(shipment.actual_revenue ?? shipment.actual_price ?? 0)
), 0);

const sumPassThroughExpenses = (shipments = []) => shipments.reduce((sum, shipment) => (
    sum + Number(shipment.total_pass_through_expenses || 0)
), 0);

const resolvePrimaryReceiptShipment = (shipments, driverId) => {
    if (!Array.isArray(shipments) || shipments.length === 0) return null;
    return shipments.find((shipment) => Number(shipment.owner_driver_id) === Number(driverId))
        || shipments[0];
};

const getShipmentPricingSnapshot = async (db, requestId) => {
    const request = await coordinatorRepository.getReceiptRequestPricingHeader(db, requestId);
    if (!request) return null;

    const shipments = await getOrderShipmentsForReceipt(db, request.order_id);
    const primaryShipment = resolvePrimaryReceiptShipment(shipments, request.driver_id);

    return {
        ...request,
        shipments,
        primaryShipment,
    };
};

const computeReceiptAmount = (pricingSnapshot) => {
    const shipments = Array.isArray(pricingSnapshot?.shipments) ? pricingSnapshot.shipments : [];
    if (shipments.length === 0) throw new Error('Không thể lấy cấu hình giá cho đơn hàng');

    const shipmentBreakdown = shipments.map((shipment) => {
        const status = String(shipment.status || '').toLowerCase();
        const pricePerKm = Number(shipment.price_per_km || 0);
        const isPriceManual = shipment.is_price_manual === true;
        const estimatedPrice = Number(shipment.estimated_price);

        // Đơn giá CỐ ĐỊNH do DN chốt tay → giữ nguyên estimated_price, KHÔNG tính lại
        // theo km — bất kể tài xế nhập bao nhiêu km, giá công ty sửa luôn thắng tuyệt đối.
        if (isPriceManual) {
            if (!Number.isFinite(estimatedPrice) || estimatedPrice <= 0) {
                throw new Error(`Chuyến #${shipment.id} là giá cố định nhưng chưa có giá cước hợp lệ`);
            }
            const manualKm = shipment.actual_distance_km ?? shipment.estimated_distance_km;
            return {
                shipment_id: shipment.id,
                actual_km: Number.isFinite(Number(manualKm)) ? Number(manualKm) : 0,
                price_per_km: pricePerKm,
                actual_income: estimatedPrice,
                is_price_manual: true,
            };
        }

        // Chuyến đã hủy/thất bại → không phát sinh doanh thu, không đòi hỏi km.
        if (status === 'cancelled' || status === 'failed') {
            return {
                shipment_id: shipment.id,
                actual_km: 0,
                price_per_km: pricePerKm,
                actual_income: 0,
                is_price_manual: false,
            };
        }

        // Chuyến phải HOÀN HÀNG (returning_at có giá trị — kể cả khi đã sang
        // 'completed' vì hàng đã về kho): tài chạy CẢ HAI CHIỀU nên tính GẤP ĐÔI cước.
        // Khách từ chối nhận thì chịu cả lượt đi lẫn lượt về; doanh thu/KPI của tài
        // cũng lấy từ đúng con số này nên sổ sách khớp, không phát sinh khoản bù.
        if (shipment.returning_at) {
            const returnKm = shipment.actual_distance_km;
            if (returnKm === null || returnKm === undefined || Number.isNaN(Number(returnKm)) || Number(returnKm) <= 0) {
                throw new Error(`Chuyến #${shipment.id} chưa có số km thực tế (tài xế chưa khai báo) — không thể chốt phiếu thu`);
            }
            if (!pricePerKm || pricePerKm <= 0) {
                throw new Error(`Chuyến #${shipment.id} chưa có đơn giá xe hợp lệ để tính thu nhập thực tế`);
            }
            return {
                shipment_id: shipment.id,
                actual_km: Number(returnKm),
                price_per_km: pricePerKm,
                actual_income: Number(returnKm) * pricePerKm * 2,
                is_price_manual: false,
                is_returned: true,
            };
        }

        // Đơn giá TỰ TÍNH theo km × đơn giá nhóm xe — BẮT BUỘC phải là km THẬT của
        // chính chuyến đó (actual_distance_km), KHÔNG được lặng lẽ dùng km ước tính
        // lúc tạo đơn thay thế. Nếu chuyến này chưa có km thật (tài xế của chuyến đó
        // chưa khai báo), chặn hẳn việc chốt phiếu thu thay vì tính sai.
        const actualKm = shipment.actual_distance_km;
        if (actualKm === null || actualKm === undefined || Number.isNaN(Number(actualKm)) || Number(actualKm) <= 0) {
            throw new Error(`Chuyến #${shipment.id} chưa có số km thực tế (tài xế chuyến đó chưa khai báo) — không thể chốt phiếu thu`);
        }
        if (!pricePerKm || Number.isNaN(pricePerKm) || pricePerKm <= 0) {
            throw new Error(`Chuyến #${shipment.id} chưa có đơn giá xe hợp lệ để tính thu nhập thực tế`);
        }

        return {
            shipment_id: shipment.id,
            actual_km: Number(actualKm),
            price_per_km: pricePerKm,
            actual_income: Number(actualKm) * pricePerKm,
            is_price_manual: false,
        };
    });

    const totalActualKm = shipmentBreakdown.reduce((sum, item) => sum + item.actual_km, 0);
    const totalActualIncome = shipmentBreakdown.reduce((sum, item) => sum + item.actual_income, 0);
    const prepaidAmount = Math.max(Number(pricingSnapshot?.prepaid_amount || 0), 0);
    const primaryShipment = pricingSnapshot?.primaryShipment ?? null;
    const primaryBreakdown = primaryShipment
        ? shipmentBreakdown.find((item) => Number(item.shipment_id) === Number(primaryShipment.id)) ?? shipmentBreakdown[0]
        : shipmentBreakdown[0];
    const remainingAmount = Math.max(totalActualIncome - prepaidAmount, 0);

    return {
        shipment_id: primaryBreakdown?.shipment_id ?? null,
        actual_km: totalActualKm,
        price_per_km: primaryBreakdown?.price_per_km ?? 0,
        actual_income: totalActualIncome,
        gross_amount: totalActualIncome,
        prepaid_amount: prepaidAmount,
        remaining_amount: remainingAmount,
        shipment_breakdown: shipmentBreakdown,
    };
};

const broadcastCoordinatorReceiptRequestChange = (action, requestId, orderId) => {
    notificationGateway.broadcastToRole('coordinator', {
        type: 'coordinator.receipt_requests.changed',
        action,
        requestId,
        orderId,
    });
};

// GET danh sách yêu cầu phiếu thu (mặc định: pending + processing)
const getReceiptRequests = async ({
    status = null,
    kind = 'all',
    search = '',
    dateFrom = '',
    dateTo = '',
    sort = null,
    page = 1,
    limit = 10,
} = {}) => {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const normalizedPage = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum;
    const normalizedLimit = isNaN(limitNum) || limitNum < 1 ? 10 : limitNum;
    const offset = (normalizedPage - 1) * normalizedLimit;

    const conditions = [];
    const params = [];

    const normalizedStatus = String(status || '').trim().toLowerCase();
    const normalizedKind = String(kind || 'all').trim().toLowerCase();
    const normalizedSearch = String(search || '').trim();

    if (normalizedStatus && normalizedStatus !== 'all') {
        params.push(normalizedStatus);
        conditions.push(`rr.status = $${params.length}`);
    } else if (normalizedKind === 'requests') {
        conditions.push(`rr.status IN ('pending', 'processing')`);
    } else if (normalizedKind === 'receipts') {
        conditions.push(`rr.status = 'approved'`);
    } else if (normalizedKind === 'rejected') {
        conditions.push(`rr.status = 'rejected'`);
    }

    if (normalizedSearch) {
        params.push(`%${normalizedSearch}%`);
        conditions.push(`(
            CAST(rr.id AS TEXT) ILIKE $${params.length}
            OR CAST(rr.order_id AS TEXT) ILIKE $${params.length}
            OR COALESCE(p.full_name, '') ILIKE $${params.length}
            OR COALESCE(c.full_name, '') ILIKE $${params.length}
            OR COALESCE(c.phone, '') ILIKE $${params.length}
            OR COALESCE(primary_vehicle.plate_number, '') ILIKE $${params.length}
            OR COALESCE(rr.status, '') ILIKE $${params.length}
        )`);
    }

    if (dateFrom) {
        params.push(dateFrom);
        conditions.push(`DATE(COALESCE(sr.collected_at, rr.processed_at, rr.requested_at)) >= $${params.length}`);
    }

    if (dateTo) {
        params.push(dateTo);
        conditions.push(`DATE(COALESCE(sr.collected_at, rr.processed_at, rr.requested_at)) <= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows, total } = await coordinatorRepository.listReceiptRequests({
        where, params, limit: normalizedLimit, offset, sort,
    });

    return {
        requests: rows,
        pagination: {
            page: normalizedPage,
            limit: normalizedLimit,
            total,
            totalPages: Math.max(1, Math.ceil(total / normalizedLimit)),
        }
    };
};

const getReceiptRequestDetail = async (requestId) => {
    const row = await coordinatorRepository.getReceiptRequestHeader(requestId);
    if (!row) throw new Error('Yêu cầu phiếu thu không tồn tại');

    const shipments = await getOrderShipmentsForReceipt(pool, row.order_id);
    const primaryShipment = resolvePrimaryReceiptShipment(shipments, row.driver_id);
    const computed = computeReceiptAmount({ shipments, primaryShipment });

    const expenses = shipments.flatMap((shipment) => shipment.expenses || []);
    const totalExpenses = shipments.reduce((sum, shipment) => sum + Number(shipment.total_expenses || 0), 0);
    const totalActualPrice = sumShipmentActualRevenue(shipments);
    const totalPassThroughExpenses = sumPassThroughExpenses(shipments);
    const finalPrice = totalActualPrice + totalPassThroughExpenses;
    const prepaidAmount = Math.max(Number(row.order_prepaid_amount || 0), 0);
    const remainingReceiptAmount = Math.max(finalPrice - prepaidAmount, 0);

    return {
        request: {
            id: row.id,
            order_id: row.order_id,
            shipment_id: primaryShipment?.id ?? null,
            driver_id: row.driver_id,
            driver_name: row.driver_name,
            status: row.status,
            requested_at: row.requested_at,
            processed_at: row.processed_at,
            coordinator_notes: row.coordinator_notes,
            plate_number: primaryShipment?.plate_number || null,
        },
        customer: {
            id: row.customer_id,
            full_name: row.customer_name,
            phone: row.customer_phone,
            company_name: row.customer_company,
            address: row.customer_address,
        },
        order: {
            id: row.order_id,
            cargo_name: row.cargo_name,
            cargo_weight_kg: row.cargo_weight_kg,
            notes: row.order_notes,
            total_actual_price: totalActualPrice,
            final_price: finalPrice,
            prepaid_amount: prepaidAmount,
        },
        shipment: primaryShipment,
        shipments,
        expenses,
        summary: {
            total_actual_distance_km: computed.actual_km,
            total_actual_price: totalActualPrice,
            total_expenses: totalExpenses,
            total_pass_through_expenses: totalPassThroughExpenses,
            final_price: finalPrice,
            prepaid_amount: prepaidAmount,
            remaining_receipt_amount: remainingReceiptAmount,
            shipment_count: shipments.length,
            shipment_breakdown: computed.shipment_breakdown,
        },
    };
};

// POST approve — chốt actual income/expenses + cập nhật request status
const approveReceiptRequest = async (requestId, coordinatorId, { notes, expenses = [], priceOverride } = {}) => {
    const normalizedExpenses = normalizeExpenses(expenses);

    const req = await coordinatorRepository.getReceiptRequestForApproval(requestId);
    if (!req) throw new Error('Yêu cầu phiếu thu không tồn tại');
    if (req.status === 'approved') throw new Error('Yêu cầu này đã được duyệt rồi');
    if (req.status === 'rejected') throw new Error('Yêu cầu này đã bị từ chối');

    // Chặn chốt phiếu thu khi tiền trả trước chưa được xác nhận — vì phiếu thu trừ prepaid vào
    // số phải thu; nếu prepaid chưa chắc đã về thì dễ thu thiếu (hoặc thu dư nếu bỏ trừ).
    const prepaidState = await orderRepository.getOrderPrepaidState(req.order_id);
    if (prepaidState?.prepaid_status === 'pending' && Number(prepaidState.prepaid_amount || 0) > 0) {
        throw new Error('Đơn có tiền trả trước chưa được xác nhận. Vui lòng xác nhận tiền trả trước trước khi chốt phiếu thu.');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Khóa hàng yêu cầu phiếu thu rồi ĐỌC LẠI trạng thái NGAY TRONG giao dịch.
        // Hai lần kiểm tra ở trên chạy ngoài transaction nên là check-then-act: điều
        // phối bấm duyệt nhiều lần (mạng lag, spam nút) thì mọi request đều đọc được
        // status='pending' trước khi ai kịp commit → sinh ra nhiều phiếu thu cho cùng
        // một đơn, nhân đôi doanh thu trên sổ. FOR UPDATE khiến các request xếp hàng:
        // cái đầu tiên commit xong, các cái sau đọc thấy 'approved' và bị chặn.
        const lockedReq = await client.query(
            `SELECT status FROM order_receipt_requests WHERE id = $1 FOR UPDATE`,
            [requestId],
        );
        if (!lockedReq.rows[0]) {
            await client.query('ROLLBACK');
            throw new Error('Yêu cầu phiếu thu không tồn tại');
        }
        if (lockedReq.rows[0].status === 'approved') {
            await client.query('ROLLBACK');
            throw new Error('Yêu cầu này đã được duyệt rồi');
        }
        if (lockedReq.rows[0].status === 'rejected') {
            await client.query('ROLLBACK');
            throw new Error('Yêu cầu này đã bị từ chối');
        }

        // Duyệt các chi phí tài xế còn 'pending' của đơn NGAY ĐẦU giao dịch. Chi phí đi
        // vào phiếu thu không cần một bước duyệt riêng của manager/coordinator: phát hành
        // phiếu thu chính là lúc chúng được duyệt.
        //
        // Trước đây bước này nằm ở CUỐI, nên phải chặn cứng việc chốt phiếu khi đơn còn
        // khoản chi hộ khách 'pending' (nếu không thì khoản đó có thể bị tính vào tiền
        // khách rồi sau lại bị từ chối → tài xế đã ứng tiền thật mà không được hoàn).
        // Duyệt ngay từ đầu khiến tình huống đó không còn tồn tại: mọi khoản không bị
        // 'rejected' đều được duyệt và ghi nợ hoàn cho tài xế (reimbursement_status =
        // 'pending') trong CÙNG giao dịch với số tiền phiếu thu.
        //
        // Lưu ý: snapshot bên dưới đọc expenses qua pool (ngoài giao dịch) nên KHÔNG
        // thấy thay đổi này; việc tính đúng số tiền dựa vào bộ lọc "khác 'rejected'"
        // trong getOrderShipmentsForReceipt, không dựa vào thứ tự hai câu lệnh.
        await coordinatorRepository.autoApproveOrderExpenses(client, coordinatorId, req.order_id);

        const pricingSnapshot = await getShipmentPricingSnapshot(client, requestId);
        const targetShipment = pricingSnapshot?.primaryShipment;
        if (!targetShipment) throw new Error('Không tìm thấy chuyến xe để tạo phiếu thu');

        const requestActualKm = Number(req.actual_km);
        if (Number.isFinite(requestActualKm) && requestActualKm > 0) {
            await coordinatorRepository.updateShipmentActualDistance(client, targetShipment.id, requestActualKm);

            targetShipment.actual_distance_km = requestActualKm;
            const matchedShipment = pricingSnapshot?.shipments?.find(
                (shipment) => Number(shipment.id) === Number(targetShipment.id),
            );
            if (matchedShipment) {
                matchedShipment.actual_distance_km = requestActualKm;
            }
        }
        const computed = computeReceiptAmount(pricingSnapshot);

        // Đơn giá/km × actual_km chỉ là gợi ý — coordinator có thể chốt giá cước khác cho
        // đúng chuyến đang duyệt (không đụng các chuyến khác trong đơn multi-driver).
        const normalizedOverride = Number(priceOverride);
        if (Number.isFinite(normalizedOverride) && normalizedOverride > 0) {
            const targetBreakdown = computed.shipment_breakdown.find(
                (item) => Number(item.shipment_id) === Number(targetShipment.id),
            );
            if (targetBreakdown) {
                const diff = normalizedOverride - targetBreakdown.actual_income;
                targetBreakdown.actual_income = normalizedOverride;
                computed.actual_income += diff;
                computed.gross_amount += diff;
                computed.remaining_amount = Math.max(computed.actual_income - computed.prepaid_amount, 0);
            }
        }

        const validShipmentIds = new Set((pricingSnapshot?.shipments || []).map((shipment) => Number(shipment.id)));

        for (const expense of normalizedExpenses) {
            const expenseShipmentId = expense.shipment_id ?? targetShipment.id;
            if (!validShipmentIds.has(Number(expenseShipmentId))) {
                throw new Error('Chi phí có chuyến xe không thuộc đơn hàng này');
            }
            const expenseVehicleId = pricingSnapshot.shipments.find((shipment) => Number(shipment.id) === Number(expenseShipmentId))?.vehicle_id ?? null;
            // Không ghi sổ ở đây — tiền tài đã ứng, chờ hoàn (cấn trừ nợ TH2 hoặc qua lương TH1)
            await coordinatorRepository.insertApprovedExpense(client, {
                shipmentId: expenseShipmentId,
                vehicleId: expenseVehicleId,
                coordinatorId,
                expenseType: expense.expense_type,
                amount: expense.amount,
                description: expense.description,
            });
        }

        for (const shipmentSummary of computed.shipment_breakdown) {
            await coordinatorRepository.updateShipmentActualPrice(client, shipmentSummary.shipment_id, shipmentSummary.actual_income);
            // Ghi sổ doanh thu chuyến khi actual_price được chốt chính thức
            await financialLedgerRepository.insertTransaction(client, {
                eventType: 'shipment_revenue',
                debitAccount: '131', creditAccount: '511',
                amount: shipmentSummary.actual_income,
                description: `Doanh thu chuyến #${shipmentSummary.shipment_id} — đơn #${req.order_id}`,
                refType: 'shipment', refId: shipmentSummary.shipment_id, actorId: coordinatorId,
            });
        }

        // Cập nhật trạng thái request → approved
        await coordinatorRepository.markReceiptRequestApproved(client, { coordinatorId, requestId, notes });

        // Tạo phiếu thu để driver xem — payment_type = NULL cho đến khi driver xác nhận
        // Tổng khách phải trả = cước (km × đơn giá − trả trước) + chi hộ khách (toll/parking/etc)
        // Chi phí công ty chịu (fuel/repair) KHÔNG cộng vào tiền khách.
        const snapshotPassThrough = sumPassThroughExpenses(pricingSnapshot.shipments);
        const coordinatorPassThrough = normalizedExpenses.reduce((sum, expense) => (
            PASS_THROUGH_EXPENSE_TYPES.has(expense.expense_type) ? sum + Number(expense.amount) : sum
        ), 0);
        const totalAmount = computed.remaining_amount + snapshotPassThrough + coordinatorPassThrough;
        await coordinatorRepository.insertShipmentReceipt(client, {
            shipmentId: targetShipment.id, amount: totalAmount, driverId: req.driver_id,
            notes, requestId, coordinatorId,
        });

        await client.query('COMMIT');

        // Recalculate KPI cho tất cả driver trong đơn sau khi actual_price được chốt (BR-026)
        const shipmentIds = computed.shipment_breakdown.map((s) => s.shipment_id);
        if (shipmentIds.length > 0) {
            coordinatorRepository.getShipmentOwnersForKpi(shipmentIds).then((rows) => {
                const kpiService = require('./kpiService');
                rows.forEach(({ owner_driver_id, completed_at }) => {
                    kpiService.recalculateAfterCompletion(owner_driver_id, new Date(completed_at || Date.now()));
                });
            }).catch(() => {});
        }

        // Notify driver
        const notificationService = require('./notificationService');
        notificationService.createForUser(req.driver_id, {
            title: 'Phiếu thu đã được tạo',
            message: `Coordinator đã tạo phiếu thu cho đơn #${req.order_id}.`,
            type: 'RECEIPT_APPROVED',
            entityType: 'orders',
            entityId: req.order_id,
        }, { displayMode: 'alert' }).catch(() => {});

        broadcastCoordinatorReceiptRequestChange('approved', requestId, req.order_id);
        const detail = await getReceiptRequestDetail(requestId);
        return {
            total_actual_price: detail.summary.total_actual_price,
            total_expenses: detail.summary.total_expenses,
            final_price: detail.summary.final_price,
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// POST reject — từ chối yêu cầu phiếu thu
const rejectReceiptRequest = async (requestId, coordinatorId, { notes } = {}) => {
    const req = await coordinatorRepository.getReceiptRequestById(requestId);
    if (!req) throw new Error('Yêu cầu phiếu thu không tồn tại');
    if (req.status === 'approved') throw new Error('Yêu cầu này đã được duyệt rồi');
    if (req.status === 'rejected') throw new Error('Yêu cầu này đã bị từ chối rồi');

    // rowCount = 0 nghĩa là yêu cầu vừa bị request khác xử lý xong trong lúc mình
    // đang chạy — dừng ở đây, đừng gửi thông báo trùng cho tài xế.
    const changed = await coordinatorRepository.rejectReceiptRequestRow(coordinatorId, notes, requestId);
    if (!changed) throw new Error('Yêu cầu này đã được xử lý rồi');

    const notificationService = require('./notificationService');
    notificationService.createForUser(req.driver_id, {
        title: 'Yêu cầu phiếu thu bị từ chối',
        message: `Yêu cầu phiếu thu cho đơn #${req.order_id} bị từ chối${notes ? `: ${notes}` : ''}.`,
        type: 'RECEIPT_REJECTED',
        entityType: 'orders',
        entityId: req.order_id,
    }, { displayMode: 'alert' }).catch(() => {});

    broadcastCoordinatorReceiptRequestChange('rejected', requestId, req.order_id);
    return { success: true };
};

// Chuyến chưa hoàn thành/hủy — cho phép Coordinator/Manager chủ động hủy
const CANCELLABLE_STATUSES = [
    SHIPMENT_STATUS.AVAILABLE,
    SHIPMENT_STATUS.CLAIMED,
    SHIPMENT_STATUS.PICKING,
    SHIPMENT_STATUS.TRANSIT,
    SHIPMENT_STATUS.ARRIVED,
    SHIPMENT_STATUS.RETURNING,
    SHIPMENT_STATUS.FAILED,
];

// Hủy 1 trip cụ thể (khác cancelOrder — chỉ hủy 1 shipment, giữ nguyên các shipment khác cùng order)
const cancelShipment = async (shipmentId, reason, actorId) => {
    const tripRepository = require('../repositories/tripRepository');
    const notificationService = require('./notificationService');

    if (!reason?.trim()) throw new Error('Lý do hủy chuyến là bắt buộc');

    const shipment = await tripRepository.getTripById(shipmentId);
    if (!shipment) throw new Error('Chuyến không tồn tại');
    if (!CANCELLABLE_STATUSES.includes(shipment.status)) {
        throw new Error('Chuyến đã hoàn thành hoặc đã hủy, không thể hủy thêm');
    }

    const updated = await tripRepository.updateTripStatus(shipmentId, SHIPMENT_STATUS.CANCELLED, reason.trim(), actorId);
    if (!updated) throw new Error('Không thể hủy chuyến');

    if (shipment.owner_driver_id) {
        // Đây là NGUỒN DUY NHẤT của popup thông báo hủy (displayMode 'alert' → mobile
        // tự bung alert ở bất kỳ màn nào tài đang mở). Event WS trip.cancelled bên
        // dưới chỉ lo điều hướng, KHÔNG bung alert nữa — trước đây cả hai cùng bung
        // thì showAlert của ui-provider chỉ giữ được 1 alert nên cái đến sau ghi đè
        // cái trước, tài xế thấy nội dung khác nhau tuỳ frame nào về trước.
        notificationService.createForUser(shipment.owner_driver_id, {
            title: 'Chuyến đã bị Điều phối viên hủy',
            message: `Chuyến #${shipmentId} đã bị hủy. Lý do: ${reason.trim()}`,
            type: 'TRIP_CANCELLED',
            entityType: 'shipments',
            entityId: shipmentId,
        }, { displayMode: 'alert' }).catch(() => {});

        // Tài xế có thể đang mở màn chuyến — cần đẩy realtime để app thoát ra
        // trang chủ ngay, nếu không tài vẫn bấm cập nhật trạng thái rồi ăn lỗi
        // "không thể chuyển trạng thái từ cancelled".
        try {
            notificationGateway.broadcastToUser(shipment.owner_driver_id, {
                type: 'trip.cancelled',
                shipmentId: Number(shipmentId),
                orderId: shipment.order_id ?? null,
                reason: reason.trim(),
            });
        } catch { /* realtime failure must not abort the cancellation */ }
    }

    return updated;
};

// Điều chuyển tài xế/xe thủ công cho 1 trip — KHÔNG qua Incident, KHÔNG chia doanh thu
// (chỉ áp dụng khi chưa lấy hàng; nếu đã lấy hàng cần dùng luồng Incident để chia doanh thu công bằng)
const reassignShipment = async (shipmentId, { toDriverId }, actorId) => {
    const tripRepository = require('../repositories/tripRepository');
    const driverRepository = require('../repositories/driverRepository');
    const notificationService = require('./notificationService');

    const parsedToDriverId = Number(toDriverId);
    if (!parsedToDriverId) throw new Error('Tài xế thay thế là bắt buộc');

    const shipment = await tripRepository.getTripById(shipmentId);
    if (!shipment) throw new Error('Chuyến không tồn tại');
    if (!shipment.owner_driver_id) {
        throw new Error('Chuyến chưa có tài xế nhận — không thể điều chuyển, chỉ có thể chờ tài xế claim');
    }
    if (Number(shipment.owner_driver_id) === parsedToDriverId) {
        throw new Error('Tài xế thay thế phải khác tài xế đang giữ chuyến');
    }
    if (shipment.pickup_completed_at) {
        throw new Error('Chuyến đã lấy hàng — vui lòng dùng luồng Sự cố (Incident) để điều chuyển kèm chia doanh thu công bằng');
    }

    const toDriver = (await driverRepository.getAllDrivers()).find((d) => Number(d.id) === parsedToDriverId);
    if (!toDriver) throw new Error('Tài xế thay thế không tồn tại');
    if (!toDriver.vehicle_id) throw new Error('Tài xế thay thế chưa được gán xe');

    const fromDriverId = Number(shipment.owner_driver_id);
    const reassigned = await tripRepository.reassignShipmentAfterIncident(shipmentId, {
        incidentId: null,
        fromDriverId,
        toDriverId: parsedToDriverId,
        toVehicleId: Number(toDriver.vehicle_id),
        changedBy: actorId,
        changeReason: 'manual_reassign',
        note: 'Điều phối viên/Quản lý chủ động điều chuyển (ngoài luồng sự cố)',
    });

    notificationService.createForUser(fromDriverId, {
        title: 'Chuyến của bạn đã được điều chuyển',
        message: `Chuyến #${shipmentId} đã được điều chuyển cho tài xế khác.`,
        type: 'TRIP_ASSIGNED',
        entityType: 'shipments',
        entityId: shipmentId,
    }, { displayMode: 'alert' }).catch(() => {});

    notificationService.createForUser(parsedToDriverId, {
        title: 'Bạn được điều chuyển 1 chuyến mới',
        message: `Bạn đã được phân công tiếp quản chuyến #${shipmentId}.`,
        type: 'TRIP_ASSIGNED',
        entityType: 'shipments',
        entityId: shipmentId,
    }, { displayMode: 'alert' }).catch(() => {});

    return reassigned;
};

// Coordinator xử lý chuyến giao thất bại: liên hệ khách rồi chọn giao lại hoặc
// hoàn hàng, kèm chốt khách có phải trả tiền hay không.
const resolveFailedShipment = async (shipmentId, { action }, actorId) => {
    const tripRepository = require('../repositories/tripRepository');
    const incidentRepository = require('../repositories/incidentRepository');
    const notificationService = require('./notificationService');

    const parsedId = Number(shipmentId);
    if (!parsedId) throw new Error('Chuyến không hợp lệ');
    if (!['redeliver', 'return'].includes(action)) {
        throw new Error('action phải là "redeliver" (giao lại) hoặc "return" (hoàn hàng)');
    }

    const shipment = await tripRepository.getTripById(parsedId);
    if (!shipment) throw new Error('Chuyến không tồn tại');

    let updated;
    try {
        updated = await tripRepository.resolveFailedShipment({
            shipmentId: parsedId,
            action,
            coordinatorId: Number(actorId),
        });
    } catch (err) {
        if (err.message === 'SHIPMENT_NOT_FOUND') throw new Error('Chuyến không tồn tại');
        if (err.message === 'NOT_FAILED') throw new Error('Chỉ xử lý được chuyến đang ở trạng thái giao thất bại');
        throw err;
    }

    // Đóng luôn sự cố 'customer_refusal' đã sinh khi tài báo thất bại — coordinator
    // xử lý ở màn Sự cố nên sự cố phải khép lại cùng lúc, không để treo 'open'.
    try {
        await incidentRepository.resolveOpenIncidentForShipment(parsedId, {
            resolvedBy: Number(actorId),
            resolution: action === 'redeliver'
                ? 'Điều phối viên cho giao lại sau khi giao thất bại'
                : 'Điều phối viên cho hoàn hàng về điểm lấy — chuyến tính gấp đôi cước',
        });
    } catch { /* không đóng được sự cố thì vẫn giữ nguyên kết quả xử lý chuyến */ }

    if (shipment.owner_driver_id) {
        notificationService.createForUser(shipment.owner_driver_id, {
            title: action === 'redeliver' ? 'Giao lại chuyến' : 'Chuyển sang hoàn hàng',
            message: action === 'redeliver'
                ? `Điều phối viên đã liên hệ khách — chuyến #${parsedId} được giao lại. Hãy tiếp tục đến điểm giao.`
                : `Chuyến #${parsedId} chuyển sang hoàn hàng. Chuyến này được tính GẤP ĐÔI cước vì bạn chạy cả hai chiều. Hãy chở hàng về điểm lấy và chụp ảnh xác nhận khi trả hàng.`,
            type: 'TRIP_STATUS_UPDATED',
            entityType: 'shipments',
            entityId: parsedId,
        }, { displayMode: 'alert' }).catch(() => {});

        try {
            notificationGateway.broadcastToUser(shipment.owner_driver_id, {
                type: 'trip.failed_resolved',
                shipmentId: parsedId,
                action,
                status: updated.status,
            });
        } catch { /* realtime failure must not abort the resolution */ }
    }

    return updated;
};

// Coordinator gán trước nhiều chuyến của CÙNG một đơn cho một tài xế.
// Ràng buộc nghiệp vụ: chỉ trong cùng đơn. Tài đang vướng đơn khác thì không gán được.
const assignOrderShipments = async (orderId, { shipmentIds, driverId }, actorId) => {
    const tripRepository = require('../repositories/tripRepository');
    const driverRepository = require('../repositories/driverRepository');
    const notificationService = require('./notificationService');

    const parsedOrderId = Number(orderId);
    const parsedDriverId = Number(driverId);
    if (!parsedOrderId) throw new Error('Đơn hàng không hợp lệ');
    if (!parsedDriverId) throw new Error('Tài xế là bắt buộc');

    const ids = Array.isArray(shipmentIds) ? shipmentIds.map(Number).filter(Boolean) : [];
    if (ids.length === 0) throw new Error('Phải chọn ít nhất 1 chuyến để gán');
    const uniqueIds = [...new Set(ids)];

    const driver = (await driverRepository.getAllDrivers()).find((d) => Number(d.id) === parsedDriverId);
    if (!driver) throw new Error('Tài xế không tồn tại');
    if (!driver.vehicle_id) throw new Error('Tài xế chưa được gán xe');

    // Cùng ràng buộc như khi tài tự nhận chuyến: chưa xong nghĩa vụ phiếu thu của
    // chuyến trước thì không được nhận việc mới — nếu bỏ ở đây thì coordinator gán
    // tay trở thành đường lách guard đó.
    const pendingReceipt = await tripRepository.getPendingReceiptOrder(parsedDriverId);
    if (pendingReceipt) {
        throw new Error(
            `Tài xế còn chuyến #${pendingReceipt.shipment_id} (đơn #${pendingReceipt.order_id}) chưa nhập km thực tế / chưa gửi yêu cầu tạo phiếu thu. Không thể gán chuyến mới.`,
        );
    }

    let result;
    try {
        result = await tripRepository.assignOrderShipmentsToDriver({
            orderId: parsedOrderId,
            shipmentIds: uniqueIds,
            driverId: parsedDriverId,
            vehicleId: Number(driver.vehicle_id),
            coordinatorId: Number(actorId),
        });
    } catch (err) {
        const messages = {
            ORDER_NOT_FOUND: 'Đơn hàng không tồn tại hoặc chưa có chuyến nào',
            SHIPMENT_NOT_IN_ORDER: 'Có chuyến không thuộc đơn hàng này',
            SHIPMENT_NOT_ASSIGNABLE: 'Có chuyến đã được tài xế khác nhận hoặc đã bắt đầu chạy — hãy tải lại danh sách',
            VEHICLE_GROUP_MISMATCH: 'Xe của tài xế không thuộc nhóm xe mà chuyến yêu cầu',
            OTHER_ORDER_ACTIVE: `Tài xế đang có chuyến thuộc đơn #${err.conflictingOrderId} — chỉ gán được nhiều chuyến trong cùng một đơn`,
            VEHICLE_BUSY_OTHER_ORDER: `Xe của tài xế đang chạy chuyến thuộc đơn #${err.conflictingOrderId}`,
        };
        if (messages[err.message]) throw new Error(messages[err.message]);
        throw err;
    }

    const count = result.assignedShipmentIds.length;
    notificationService.createForUser(parsedDriverId, {
        title: count > 1 ? `Bạn được giao ${count} chuyến trong đơn #${parsedOrderId}` : 'Bạn được giao 1 chuyến mới',
        message: count > 1
            ? `Điều phối viên đã giao ${count} chuyến của đơn #${parsedOrderId} cho bạn. Chạy xong chuyến này thì chuyến tiếp theo sẽ tự mở.`
            : `Điều phối viên đã giao chuyến #${result.assignedShipmentIds[0]} (đơn #${parsedOrderId}) cho bạn.`,
        type: 'TRIP_ASSIGNED',
        entityType: 'shipments',
        entityId: result.activatedShipmentId ?? result.assignedShipmentIds[0],
    }, { displayMode: 'alert' }).catch(() => {});

    try {
        notificationGateway.broadcastToUser(parsedDriverId, {
            type: 'trip.assigned',
            orderId: parsedOrderId,
            shipmentIds: result.assignedShipmentIds,
            activatedShipmentId: result.activatedShipmentId,
        });
    } catch { /* realtime failure must not abort the assignment */ }

    return result;
};

// Tổng quan cho Coordinator — số đơn/trip đang xử lý, sự cố mở, phiếu thu/chi phí chờ duyệt
const getDashboard = async () => {
    const overview = await coordinatorRepository.getDashboardStats();
    const recentIncidents = await incidentRepository.getCoordinatorIncidents({ status: 'open', page: 1, limit: 5 });

    return {
        overview,
        recent_incidents: recentIncidents.incidents,
    };
};

module.exports = {
  importExcel,
  listVehicleGroups,
  listPartners,
  getIncidents,
  getReceiptRequests,
  getReceiptRequestDetail,
  approveReceiptRequest,
  computeReceiptAmount,
  resolveShipmentActualRevenue,
    rejectReceiptRequest,
    cancelShipment,
    reassignShipment,
    assignOrderShipments,
    resolveFailedShipment,
    getDashboard,
};
