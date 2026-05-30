Backend module

Run:

1. Install dependencies

```
npm install
```

2. Start in development (uses nodemon)

```
npm start
```

The `start` script uses `nodemon app.js`.

Environment:

- Copy `backend/.env.example` to `backend/.env` and fill your PostgreSQL (EDB) credentials.
- The app loads environment variables via `dotenv` at startup.
