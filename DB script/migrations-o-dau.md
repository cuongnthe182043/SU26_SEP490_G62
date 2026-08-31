# Migration đã chuyển sang `backend/migrations/`

Backend tự chạy migration lúc khởi động (`backend/migrate.js`), nên các file `.sql`
phải nằm **bên trong** thư mục backend để đi được vào Docker image — build context
của backend là `./backend`, thứ gì nằm ngoài thì `COPY` không lấy được.

- Bộ chạy:        `backend/migrate.js`
- Các file:       `backend/migrations/*.sql`
- Cách viết file: xem `backend/migrations/README.md`

`DB script.sql` vẫn ở đây — đó là file dựng DB TRẮNG, chạy tay một lần khi deploy mới.

## Chỉ có MỘT file schema

`DB script.sql` (có dấu cách) là bản duy nhất được coi là đúng — `docker-compose.yml`,
`backend/test/helpers/testDb.js` và `SETUP.md` đều trỏ vào nó. Đừng commit thêm bản
xuất schema nào khác vào thư mục này: đã từng có `DB_script.sql` nằm cạnh, không ai
tham chiếu, và cứ thế cũ đi cho tới lúc ai đó mở nhầm rồi dựng ra một DB thiếu bảng.
Cần ảnh chụp schema tại một thời điểm thì lấy từ git: `git show <commit>:'DB script/DB script.sql'`.
