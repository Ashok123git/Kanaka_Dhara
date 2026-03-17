# Kanaka Dhara Backend

FastAPI backend for the WhatsApp-style ledger app.

## Testing

Tests use pytest and require a **dedicated test database** so the app/dev database is never touched or truncated.

1. **Create a separate PostgreSQL database** for tests (e.g. `kanaka_dhara_test`):
   ```bash
   createdb kanaka_dhara_test
   ```
   Or create it via your DB client using the same user/host as your app DB.

2. **Set `TEST_DATABASE_URL`** in your environment or `.env`:
   ```env
   TEST_DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/kanaka_dhara_test
   ```
   Use the same format as `DATABASE_URL` (asyncpg driver). Do **not** set it to the same database as `DATABASE_URL`.

3. **Run tests** from the backend root:
   ```bash
   cd backend
   pytest
   ```
   The test suite will create the schema in the test DB (if needed) and truncate tables before each test that needs the DB, so you get a clean state and no duplicate-key errors.

If `TEST_DATABASE_URL` is not set, pytest will exit with a message asking you to set it.
