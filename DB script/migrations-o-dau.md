# Migration đã chuyển sang `backend/migrations/`

Backend tự chạy migration lúc khởi động (`backend/migrate.js`), nên các file `.sql`
phải nằm **bên trong** thư mục backend để đi được vào Docker image — build context
của backend là `./backend`, thứ gì nằm ngoài thì `COPY` không lấy được.

- Bộ chạy:        `backend/migrate.js`
- Các file:       `backend/migrations/*.sql`
- Cách viết file: xem `backend/migrations/README.md`

`DB script.sql` vẫn ở đây — đó là file dựng DB TRẮNG, chạy tay một lần khi deploy mới.
