# SU26_SEP490_G62

## Docker setup

This project includes Docker support for the backend, frontend, and PostgreSQL database.

### Files added

- `Dockerfile` in `backend/`
- `Dockerfile` in `frontend/`
- `docker-compose.yml` in the project root
- `backend/.dockerignore`
- `frontend/.dockerignore`
- updated `backend/.env.example`

### Run with Docker

1. Copy the backend example env file:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Start the stack:
   ```bash
   docker compose up --build
   ```
3. Open the frontend:
   - `http://localhost:4173`
4. Backend API is available at:
   - `http://localhost:9999`

### Notes

- The backend connects to the database service using `DB_HOST=db`.
- PostgreSQL will automatically execute `DB script/DB script.sql` and `DB script/seed.sql` on initial database creation.
- If the DB volume already exists, the init scripts will not rerun unless you remove the volume first.
- To recreate the database and reapply the scripts, run:
  ```bash
  docker compose down -v
  docker compose up --build
  ```
- The frontend uses `VITE_API_BASE_URL=http://localhost:9999`.
- If you want to use a different database name or credentials, update `backend/.env` before starting.
