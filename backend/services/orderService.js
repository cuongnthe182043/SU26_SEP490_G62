const XLSX = require('xlsx');
const pool = require('../config/database');
const orderRepository = require('../repositories/orderRepository');
const { SHIPMENT_STATUS } = require('../constants/tripConstants');

const normalizeNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const numericValue = Number(String(value).replace(/,/g, '').trim());
    if (Number.isNaN(numericValue)) throw new Error('Số tiền hoặc khối lượng không hợp lệ');
    return numericValue;
};

const safeTrim = (value) => String(value ?? '').trim();
const normalizeText = (value) => safeTrim(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const isLeaveNote = (value) => normalizeText(value) === 'nghi';
const normalizePhone = (value) => safeTrim(value).replace(/[^\d+]/g, '');

const normalizeDateInput = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }

    const text = safeTrim(value);
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

const isBeforeToday = (dateText) => {
    if (!dateText) return false;
    const inputDate = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(inputDate.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return inputDate < today;
};

const buildNotes = ({ date, checkIn, plate, driverName, customerName, customerPhone, pickupAddress, deliveryAddress, notes }) => {
    return [
        date ? `Ngày: ${date}` : '',
        checkIn ? `Chấm công: ${checkIn}` : '',
        plate ? `BKS: ${plate}` : '',
        driverName ? `Lái xe: ${driverName}` : '',
        customerName ? `Khách hàng: ${customerName}` : '',
        customerPhone ? `SĐT: ${customerPhone}` : '',
        pickupAddress ? `Điểm lấy hàng: ${pickupAddress}` : '',
        deliveryAddress ? `Điểm giao hàng: ${deliveryAddress}` : '',
        notes ? safeTrim(notes) : '',
    ].filter(Boolean).join(' | ') || null;
};

const parseRoute = (routeStr) => {
    const route = safeTrim(routeStr);
    if (!route) return { pickupAddress: '', deliveryAddress: '' };
    const parts = route.split(/\s+-\s+|-/);
    if (parts.length >= 2) {
        return {
            pickupAddress: parts[0].trim(),
            deliveryAddress: parts.slice(1).join(' - ').trim(),
        };
    }
    return { pickupAddress: route, deliveryAddress: route };
};

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

const findOrCreateCustomer = async (client, customerName, customerPhone) => {
    return orderRepository.findOrCreateCustomer(client, customerName, customerPhone, normalizePhone, safeTrim);
};

const listOrders = async () => {
    return orderRepository.listOrders();
};

const createOrder = async (userId, payload) => {
    const {
        date,
        check_in,
        plate,
        driver_id,
        customer_name,
        customer_phone,
        cargo_name,
        cargo_weight_kg,
        vehicle_group_id,
        pickup_address,
        delivery_address,
        estimated_price,
        notes,
    } = payload;

    if (!pickup_address || !delivery_address) {
        throw new Error('Thiếu thông tin bắt buộc');
    }

    const finalEstimatedPrice = (estimated_price === undefined || estimated_price === null || estimated_price === '') ? 0 : estimated_price;

    const normalizedDate = normalizeDateInput(date);
    if (normalizedDate && isBeforeToday(normalizedDate)) {
        throw new Error('Ngày không được trước hôm nay');
    }

    const normalizedWeight = normalizeNumber(cargo_weight_kg);
    const normalizedPrice = normalizeNumber(finalEstimatedPrice);
    const normalizedDriverId = driver_id ? Number(driver_id) : null;
    let dbClient = null;

    try {
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');
        const customer = await findOrCreateCustomer(dbClient, customer_name, customer_phone);
        const driver = normalizedDriverId ? await orderRepository.getDriverById(dbClient, normalizedDriverId) : await orderRepository.getDriverByPlate(dbClient, plate);

        if (driver_id && !driver) {
            throw new Error('Tài xế không tồn tại');
        }

        if (plate && !driver) {
            throw new Error('BKS không tồn tại hoặc chưa được gán cho tài xế');
        }

        if (driver?.vehicle_id && driver?.vehicle_status !== 'active') {
            throw new Error(`Xe gắn với tài xế hiện không sẵn sàng cho điều phối (trạng thái: ${driver.vehicle_status})`);
        }

        if (plate && driver && driver.plate_number && driver.plate_number !== safeTrim(plate)) {
            throw new Error('BKS không khớp với tài xế đã chọn');
        }

        if (normalizedDriverId && plate && driver?.plate_number && driver.plate_number !== safeTrim(plate)) {
            throw new Error('Chọn BKS hoặc tài xế chưa khớp');
        }

        const finalDriverId = driver?.id ?? null;
        const finalVehicleId = driver?.vehicle_status === 'active' ? driver?.vehicle_id ?? null : null;
        const defaultVehicleGroupId = await orderRepository.getDefaultVehicleGroupId(dbClient);
        const finalVehicleGroupId = vehicle_group_id ? Number(vehicle_group_id) : driver?.vehicle_group_id ?? defaultVehicleGroupId;

        if (!finalVehicleGroupId) {
            throw new Error('Chưa có nhóm xe trong hệ thống');
        }

        if (finalDriverId) {
            const activeTrip = await dbClient.query(
                `SELECT id FROM order_shipments 
                 WHERE owner_driver_id = $1 
                   AND status IN ('claimed','picking','loaded','transit','arrived','returning')
                 LIMIT 1`,
                [finalDriverId]
            );
            if (activeTrip.rows[0]) {
                throw new Error('Tài xế đang có chuyến đi khác chưa hoàn thành');
            }
        }

        const shipmentStatus = finalDriverId ? SHIPMENT_STATUS.CLAIMED : SHIPMENT_STATUS.AVAILABLE;

        const orderNotes = safeTrim(notes) || buildNotes({
            date: normalizedDate,
            checkIn: check_in,
            plate: driver?.plate_number || plate,
            driverName: driver?.full_name,
            customerName: customer_name,
            customerPhone: customer_phone,
            pickupAddress: pickup_address,
            deliveryAddress: delivery_address,
            notes,
        });

        const result = await orderRepository.createOrderWithShipment({
            client: dbClient,
            userId,
            orderData: {
                customer_id: customer?.id ?? null,
                cargo_name: safeTrim(cargo_name) || `${safeTrim(pickup_address)} - ${safeTrim(delivery_address)}`,
                cargo_weight_kg: normalizedWeight,
                pickup_address: safeTrim(pickup_address),
                delivery_address: safeTrim(delivery_address),
                estimated_price: normalizedPrice,
                status: shipmentStatus,
                payment_type: payload.payment_type,
                notes: orderNotes,
            },
            shipmentData: {
                vehicle_group_id: finalVehicleGroupId,
                owner_driver_id: finalDriverId,
                vehicle_id: finalVehicleId,
                pickup_address: safeTrim(pickup_address),
                delivery_address: safeTrim(delivery_address),
                cargo_name: safeTrim(cargo_name) || `${safeTrim(pickup_address)} - ${safeTrim(delivery_address)}`,
                cargo_weight_kg: normalizedWeight,
                estimated_price: normalizedPrice,
                status: shipmentStatus,
                payment_type: payload.payment_type,
                notes: orderNotes,
            },
            assignmentData: finalDriverId && finalVehicleId ? {
                driver_id: finalDriverId,
                vehicle_id: finalVehicleId,
                assigned_by: userId,
            } : null,
        });

        await dbClient.query('COMMIT');
        return result;
    } catch (err) {
        if (dbClient) {
            await dbClient.query('ROLLBACK');
        }
        throw err;
    } finally {
        dbClient?.release?.();
    }
};

const importOrdersFromExcel = async (userId, fileBuffer) => {
    if (!fileBuffer) throw new Error('Thiếu file Excel');

    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('File Excel không có sheet nào');

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) return [];

    let dbClient = null;
    const createdOrders = [];

    try {
        dbClient = await pool.connect();
        await dbClient.query('BEGIN');

        for (const row of rows) {
            const date = parseExcelDate(row['Ngày'] ?? row.date);
            const checkIn = safeTrim(row['Chấm công'] ?? row.checkIn);
            const plate = safeTrim(row['BKS'] ?? row.plate);
            const driverName = safeTrim(row['Lái xe'] ?? row.driver);
            const customerName = safeTrim(row['Khách hàng'] ?? row.customer_name);
            const customerPhone = normalizePhone(row['SĐT'] ?? row.phone);
            const route = safeTrim(row['Hành trình'] ?? row.route);
            const routeAddresses = parseRoute(route);
            const pickupAddress = safeTrim(row['Điểm lấy hàng'] ?? row.pickup_address) || routeAddresses.pickupAddress;
            const deliveryAddress = safeTrim(row['Điểm giao hàng'] ?? row.delivery_address) || routeAddresses.deliveryAddress;
            const estimatedPrice = normalizeNumber(row['Cước xe'] ?? row.fare);
            const cargoWeight = normalizeNumber(row['Khối lượng'] ?? row.cargo_weight_kg);
            const note = safeTrim(row['Ghi chú'] ?? row.notes ?? row.note);

            if (isLeaveNote(note)) {
                continue;
            }

            const missing = [];
            if (!date) missing.push('Ngày');
            if (!checkIn) missing.push('Chấm công');
            if (!plate) missing.push('BKS');
            if (!driverName) missing.push('Tài xế');
            if (!pickupAddress) missing.push('Điểm lấy hàng');
            if (!deliveryAddress) missing.push('Điểm giao hàng');
            if (estimatedPrice === null) missing.push('Cước xe');
            if (missing.length > 0) {
                throw new Error(`Thiếu thông tin bắt buộc trong file Excel: ${missing.join(', ')}`);
            }

            const customer = await findOrCreateCustomer(dbClient, customerName, customerPhone);
            const defaultVehicleGroupId = await orderRepository.getDefaultVehicleGroupId(dbClient);
            if (!defaultVehicleGroupId) {
                throw new Error('Chưa có nhóm xe trong hệ thống');
            }
            const driver = await orderRepository.findOrCreateDriverWithVehicle(dbClient, {
                driverName,
                plateNumber: plate,
                vehicleGroupId: defaultVehicleGroupId,
            });
            if (driver?.vehicle_id && driver?.vehicle_status !== 'active') {
                throw new Error(`Xe ${plate} hiện không sẵn sàng cho vận hành (trạng thái: ${driver.vehicle_status})`);
            }
            const finalDriverId = driver?.id ?? null;
            const finalVehicleId = driver?.vehicle_status === 'active' ? driver?.vehicle_id ?? null : null;
            const finalVehicleGroupId = driver?.vehicle_group_id ?? defaultVehicleGroupId;
            const shipmentStatus = finalDriverId ? SHIPMENT_STATUS.COMPLETED : SHIPMENT_STATUS.AVAILABLE;

            const notes = [
                `Ngày: ${date}`,
                `Chấm công: ${checkIn}`,
                `BKS: ${plate}`,
                `Lái xe: ${driverName}`,
                customerName ? `Khách hàng: ${customerName}` : '',
                customerPhone ? `SĐT: ${customerPhone}` : '',
                route ? `Hành trình: ${route}` : `Hành trình: ${pickupAddress} - ${deliveryAddress}`,
                estimatedPrice !== null ? `Cước xe: ${estimatedPrice}` : '',
                row['Doanh thu'] ? `Doanh thu: ${safeTrim(row['Doanh thu'])}` : '',
                note,
            ].filter(Boolean).join(' | ');

            const result = await orderRepository.importOrderWithShipment({
                client: dbClient,
                userId,
                orderData: {
                    customer_id: customer?.id ?? null,
                    cargo_name: route || `${pickupAddress} - ${deliveryAddress}`,
                    cargo_weight_kg: cargoWeight,
                    pickup_address: pickupAddress,
                    delivery_address: deliveryAddress,
                    estimated_price: estimatedPrice,
                    notes,
                    status: shipmentStatus,
                },
                shipmentData: {
                    pickup_address: pickupAddress,
                    delivery_address: deliveryAddress,
                    cargo_weight_kg: cargoWeight,
                    estimated_price: estimatedPrice,
                    notes,
                    vehicle_group_id: finalVehicleGroupId,
                    owner_driver_id: finalDriverId,
                    vehicle_id: finalVehicleId,
                    status: shipmentStatus,
                },
            });

            createdOrders.push(result);
        }

        await dbClient.query('COMMIT');
        return createdOrders;
    } catch (err) {
        if (dbClient) {
            await dbClient.query('ROLLBACK');
        }
        throw err;
    } finally {
        dbClient?.release?.();
    }
};

const updateOrder = async (orderId, payload) => {
    const {
        customer_name,
        customer_phone,
        cargo_name,
        cargo_weight_kg,
        pickup_address,
        delivery_address,
        estimated_price,
        notes,
        date,
        plate,
        driver_id,
        vehicle_group_id,
    } = payload;

    return orderRepository.updateOrder(orderId, {
        customer_name,
        customer_phone,
        cargo_name,
        cargo_weight_kg,
        pickup_address,
        delivery_address,
        estimated_price,
        notes,
        date,
        plate,
        driver_id,
        vehicle_group_id,
    }, normalizeNumber, safeTrim, normalizePhone);
};

const cancelOrder = async (orderId, reason) => {
    return orderRepository.cancelOrder(orderId, safeTrim(reason) || 'Coordinator cancelled order');
};

module.exports = { listOrders, createOrder, importOrdersFromExcel, updateOrder, cancelOrder };
