\pset footer off
\echo === 1. actual_price = km x don gia nhom xe (tru chuyen hoan hang) ===
SELECT os.id, os.actual_distance_km AS km, vg.price_per_km, os.actual_price,
       (os.actual_price - os.actual_distance_km*vg.price_per_km) AS lech
FROM order_shipments os JOIN vehicle_groups vg ON vg.id=os.vehicle_group_id
WHERE os.actual_price IS NOT NULL AND os.returning_at IS NULL
  AND os.actual_price <> os.actual_distance_km*vg.price_per_km;

\echo === 2. phieu thu = tong actual_price + chi ho khach cua don ===
SELECT sr.id AS phieu, o.id AS don, sr.amount,
       (SELECT COALESCE(SUM(s.actual_price),0) FROM order_shipments s WHERE s.order_id=o.id) AS cuoc,
       (SELECT COALESCE(SUM(e.amount),0) FROM expenses e JOIN order_shipments s ON s.id=e.shipment_id
        WHERE s.order_id=o.id AND e.expense_type IN ('toll','parking','etc') AND e.status<>'rejected') AS chi_ho
FROM shipment_receipts sr
JOIN order_receipt_requests orr ON orr.id=sr.order_receipt_request_id
JOIN orders o ON o.id=orr.order_id
WHERE sr.amount <> (SELECT COALESCE(SUM(s.actual_price),0) FROM order_shipments s WHERE s.order_id=o.id)
                 + (SELECT COALESCE(SUM(e.amount),0) FROM expenses e JOIN order_shipments s ON s.id=e.shipment_id
                    WHERE s.order_id=o.id AND e.expense_type IN ('toll','parking','etc') AND e.status<>'rejected');

\echo === 3. KPI khop voi chuyen thuc te ===
WITH real AS (
  SELECT sc.owner_driver_id AS d, os.vehicle_group_id AS g,
         EXTRACT(MONTH FROM os.completed_at)::int AS m, EXTRACT(YEAR FROM os.completed_at)::int AS y,
         COUNT(*)::int AS c, SUM(os.actual_price) AS r
  FROM order_shipments os JOIN v_shipment_current sc ON sc.shipment_id=os.id
  WHERE os.status='completed' GROUP BY 1,2,3,4)
SELECT k.driver_id, k.month, k.completed_shipments AS kpi_chuyen, real.c AS thuc_chuyen,
       k.total_revenue AS kpi_dt, real.r AS thuc_dt
FROM kpi_records k FULL JOIN real ON real.d=k.driver_id AND real.g=k.vehicle_group_id AND real.m=k.month AND real.y=k.year
WHERE k.completed_shipments IS DISTINCT FROM real.c OR k.total_revenue IS DISTINCT FROM real.r;

\echo === 4. cong no: tong da tra <= tong no ===
SELECT d.id, d.debt_type, d.total_amount,
       COALESCE((SELECT SUM(p.amount) FROM debt_payments p WHERE p.debt_id=d.id AND p.status='confirmed'),0) AS da_tra
FROM debts d
WHERE COALESCE((SELECT SUM(p.amount) FROM debt_payments p WHERE p.debt_id=d.id AND p.status='confirmed'),0) > d.total_amount;

\echo === 5. BR-003: xe cua tai phai dung nhom xe cua chuyen ===
SELECT os.id AS chuyen, os.vehicle_group_id AS nhom_chuyen, v.vehicle_group_id AS nhom_xe_tai, sc.owner_driver_id
FROM order_shipments os JOIN v_shipment_current sc ON sc.shipment_id=os.id
JOIN drivers dr ON dr.profile_id=sc.owner_driver_id JOIN vehicles v ON v.id=dr.vehicle_id
WHERE v.vehicle_group_id <> os.vehicle_group_id;

\echo === 6. tai trong hang <= gioi han nhom xe ===
SELECT os.id, os.cargo_weight_kg, vg.max_load_weight_kg FROM order_shipments os
JOIN vehicle_groups vg ON vg.id=os.vehicle_group_id WHERE os.cargo_weight_kg > vg.max_load_weight_kg;

\echo === 7. so nhat ky: doanh thu ghi so = tong actual_price chuyen da xong ===
SELECT (SELECT COALESCE(SUM(amount),0) FROM financial_transactions WHERE event_type='shipment_revenue') AS so_sach,
       (SELECT COALESCE(SUM(actual_price),0) FROM order_shipments WHERE status='completed' AND actual_price>0) AS thuc_te;

\echo === 8. so nhat ky: chi ho khach ghi so = tong expense pass-through da duyet ===
SELECT (SELECT COALESCE(SUM(amount),0) FROM financial_transactions WHERE event_type='pass_through_cost') AS so_sach,
       (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_type IN ('toll','parking','etc') AND status='approved') AS thuc_te;

\echo === 9. moi don da xong deu co phieu thu, moi chuyen xong deu co anh giao hang ===
SELECT 'don thieu phieu thu' AS loi, o.id FROM orders o WHERE o.derived_status='completed'
  AND NOT EXISTS (SELECT 1 FROM order_receipt_requests r WHERE r.order_id=o.id)
UNION ALL
SELECT 'chuyen thieu anh', os.id::text::int FROM order_shipments os WHERE os.status='completed'
  AND NOT EXISTS (SELECT 1 FROM delivery_proofs p WHERE p.shipment_id=os.id);

\echo === 10. tong quan so luong ===
SELECT 'orders' t, count(*) n FROM orders UNION ALL SELECT 'shipments', count(*) FROM order_shipments
UNION ALL SELECT 'receipts', count(*) FROM shipment_receipts UNION ALL SELECT 'debts', count(*) FROM debts
UNION ALL SELECT 'expenses', count(*) FROM expenses UNION ALL SELECT 'ledger', count(*) FROM financial_transactions
UNION ALL SELECT 'kpi', count(*) FROM kpi_records UNION ALL SELECT 'maintenance', count(*) FROM maintenance_records
UNION ALL SELECT 'invoices', count(*) FROM invoices UNION ALL SELECT 'incidents', count(*) FROM incidents
ORDER BY 1;

\echo === 11. bang luong: total_revenue khop KPI cung ky ===
SELECT p.driver_id, p.payroll_month, p.total_revenue AS luong_dt, k.total_revenue AS kpi_dt
FROM payrolls p LEFT JOIN kpi_records k
  ON k.driver_id=p.driver_id AND k.month=p.payroll_month AND k.year=p.payroll_year
WHERE p.total_revenue IS DISTINCT FROM COALESCE(k.total_revenue,0);

\echo === 12. bang luong: net_salary > 0 va co du 2 thang cho moi tai ===
SELECT driver_id, count(*) AS so_ky, min(net_salary) AS net_min FROM payrolls GROUP BY driver_id HAVING count(*) <> 2 OR min(net_salary) <= 0;

\echo === 13. tru no khong vuot qua no con lai thuc te ===
SELECT p.driver_id, p.payroll_month, p.driver_debt_deduction,
       (SELECT COALESCE(SUM(d.total_amount),0) - COALESCE((SELECT SUM(x.amount) FROM debt_payments x
          JOIN debts dd ON dd.id=x.debt_id WHERE dd.driver_id=p.driver_id AND x.status='confirmed'),0)
        FROM debts d WHERE d.driver_id=p.driver_id AND d.debt_type='driver') AS no_con
FROM payrolls p
WHERE p.driver_debt_deduction > (SELECT COALESCE(SUM(d.total_amount),0) - COALESCE((SELECT SUM(x.amount) FROM debt_payments x
          JOIN debts dd ON dd.id=x.debt_id WHERE dd.driver_id=p.driver_id AND x.status='confirmed'),0)
        FROM debts d WHERE d.driver_id=p.driver_id AND d.debt_type='driver');
