# Migration

Backend **tự chạy** các file ở đây lúc khởi động (`backend/migrate.js`, gọi trong
`app.js` trước `server.listen`). Không phải chạy tay, không phải nhớ.

## Quy tắc đặt tên

```
YYYYMMDD_mo_ta_ngan.sql
```

Sắp theo tên = sắp theo thời gian, nên tên file quyết định thứ tự chạy.

## Mỗi file phải

1. **Tự bọc giao dịch** — `BEGIN;` ... `COMMIT;`
2. **Tự đăng ký** vào `schema_migrations`:
   ```sql
   INSERT INTO schema_migrations (filename)
   VALUES ('20260801_vi_du.sql')
   ON CONFLICT (filename) DO NOTHING;
   ```
3. **Chạy lại nhiều lần không hỏng** — dùng `IF NOT EXISTS`, `ON CONFLICT`,
   `DROP CONSTRAINT IF EXISTS` trước khi `ADD CONSTRAINT`
4. **Không phá dữ liệu cũ** — thêm cột thì để nullable hoặc có DEFAULT; đổi kiểu
   thì phải nghĩ tới dòng đang có

Ghi rõ ở đầu file: sửa gì, vì sao cần, và vì sao an toàn với dữ liệu cũ.

## Cơ chế chạy

- Dùng **kết nối riêng**, không mượn pool của app (pool đặt `statement_timeout = 15s`,
  migration nặng sẽ bị cắt giữa chừng)
- Giữ `pg_advisory_lock(62999)` suốt quá trình — Cloud Run bật nhiều instance cùng lúc
  thì chỉ một cái chạy, các cái khác chờ rồi vào sau thấy đã áp hết
- File nào lỗi → **container không lên** kèm log rõ tên file. Cố ý như vậy: schema sai
  mà app vẫn chạy thì lỗi 500 rải rác, khó lần ra hơn nhiều

## Tắt tạm

```
SKIP_MIGRATIONS=true
```

Chỉ dùng khi chạy cục bộ trên một DB đã biết chắc đúng schema.

## DB dựng mới

`DB script/DB script.sql` đã chứa mọi thay đổi schema và **đánh dấu sẵn** tất cả
migration là đã áp. Deploy mới chỉ cần chạy file đó, backend lên sẽ thấy không còn
gì để áp.
