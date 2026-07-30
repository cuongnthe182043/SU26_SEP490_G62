# Migration — quy tắc để không mất dữ liệu cũ

## Vấn đề của cách làm trước đây

`DB script.sql` là script **tạo mới toàn bộ** (`CREATE TABLE`). Chạy nó lên một DB
đang có dữ liệu là hỏng: hoặc lỗi "relation already exists", hoặc nếu ai đó thêm
`DROP` vào thì **xoá sạch dữ liệu thật**.

Trước đây nhóm viết file `migration_*.sql` rời, chạy tay, gộp vào `DB script.sql`
rồi **xoá file migration đi** (lịch sử git có 7 file đã bị xoá như vậy). Hệ quả:

- Không cách nào biết một DB đã áp migration nào → không dám chạy lại, cũng không
  dám bỏ qua.
- Người mới pull code chỉ thấy `DB script.sql` đã có cột mới, nhưng DB của họ thì
  chưa, và **không còn file nào để chạy**. Đúng tình huống đã xảy ra với 4 cột
  `return_charge_type` / `return_fee` / `failed_resolved_by` / `failed_resolved_at`
  (commit c978349) — xem `20260730_return_flow.sql`.

## Quy tắc

**1. Mỗi thay đổi schema = 1 file trong `DB script/migrations/`, KHÔNG BAO GIỜ xoá.**

Tên file: `YYYYMMDD_mo_ta_ngan.sql`. File cũ là bằng chứng lịch sử — xoá đi là mất
khả năng cập nhật các DB đang chạy.

**2. Vẫn cập nhật `DB script.sql` song song.**

`DB script.sql` = ảnh chụp schema hiện tại, dùng để dựng DB mới từ đầu.
`migrations/` = đường đi từ schema cũ lên schema hiện tại, dùng cho DB đã có data.
Hai thứ này phải luôn khớp nhau.

**3. Mọi migration phải idempotent — chạy 2 lần không lỗi.**

```sql
ALTER TABLE t ADD COLUMN IF NOT EXISTS c TEXT;
CREATE TABLE IF NOT EXISTS t2 (...);
CREATE INDEX IF NOT EXISTS i ON t(c);
```

`ADD CONSTRAINT` không có `IF NOT EXISTS` → phải bọc trong `DO $$ ... $$`:

```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ten_constraint') THEN
    ALTER TABLE t ADD CONSTRAINT ten_constraint CHECK (...);
  END IF;
END $$;
```

**4. Mỗi migration tự ghi tên mình vào `schema_migrations`.**

Dòng cuối mỗi file:

```sql
INSERT INTO schema_migrations (filename) VALUES ('20260730_return_flow.sql')
ON CONFLICT (filename) DO NOTHING;
```

Kiểm tra DB đang ở đâu:

```sql
SELECT filename, applied_at FROM schema_migrations ORDER BY filename;
```

**5. Bọc trong transaction.**

Postgres cho DDL trong transaction. Mở `BEGIN;` cuối `COMMIT;` — nửa đường lỗi thì
rollback sạch, không để schema dở dang.

**6. Thêm cột NOT NULL vào bảng đã có dữ liệu: làm 3 bước.**

`ADD COLUMN x NOT NULL` sẽ lỗi vì các dòng cũ không có giá trị. Cách an toàn:

```sql
ALTER TABLE t ADD COLUMN IF NOT EXISTS x TEXT;          -- 1. cho phép NULL
UPDATE t SET x = 'gia_tri_mac_dinh' WHERE x IS NULL;    -- 2. điền dữ liệu cũ
ALTER TABLE t ALTER COLUMN x SET NOT NULL;              -- 3. mới siết
```

Hoặc gọn hơn nếu có giá trị mặc định hợp lý:
`ADD COLUMN IF NOT EXISTS x TEXT NOT NULL DEFAULT 'y'`.

**7. Đổi tên / xoá cột: đừng làm một nhịp.**

Xoá cột là mất dữ liệu không lấy lại được, và code cũ đang chạy vẫn đọc cột đó.
Làm 2 đợt: đợt này thêm cột mới + copy dữ liệu + sửa code đọc cột mới; deploy xong
chạy ổn định rồi đợt sau mới `DROP COLUMN`.

**8. Trước khi chạy trên DB thật: backup + diễn tập.**

```bash
# 1. backup
docker exec su26_sep490_g62-db-1 pg_dump -U postgres -d SEP490 -Fc -f /tmp/pre.dump
docker cp su26_sep490_g62-db-1:/tmp/pre.dump ./pre.dump

# 2. diễn tập trên bản copy — KHÔNG chạy thẳng lên DB thật
docker exec su26_sep490_g62-db-1 psql -U postgres -c "CREATE DATABASE rehearsal TEMPLATE SEP490"
docker exec -i su26_sep490_g62-db-1 psql -U postgres -d rehearsal -v ON_ERROR_STOP=1 \
  < "DB script/migrations/YYYYMMDD_xxx.sql"

# 3. đối chiếu số dòng trước/sau: KHÔNG được hụt
docker exec su26_sep490_g62-db-1 psql -U postgres -d rehearsal -c \
  "SELECT count(*) FROM order_shipments"

# 4. ổn thì chạy lên thật, xong xoá bản diễn tập
docker exec su26_sep490_g62-db-1 psql -U postgres -c "DROP DATABASE rehearsal"
```

`TEMPLATE SEP490` copy nguyên DB thật nên diễn tập đúng trên dữ liệu thật mà không
chạm vào bản gốc. Yêu cầu không có kết nối nào đang mở tới `SEP490` (tắt backend
trước: `docker compose stop backend`).

**9. `-v ON_ERROR_STOP=1` là bắt buộc.**

Không có nó, `psql` gặp lỗi vẫn chạy tiếp các câu sau → schema nửa vời mà tưởng là
thành công.

## Sau khi migration lên DB thật

Chạy `DB script/tools/verify_seed.sql` để đối chiếu lại tính nhất quán dữ liệu
(13 phép kiểm tra: tiền cước, phiếu thu, KPI, công nợ, sổ nhật ký, bảng lương).
