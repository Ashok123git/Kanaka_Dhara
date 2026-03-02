# Database schema (architecture-aligned)

PostgreSQL schema for Kanaka Dhara. Timestamps use UTC (`TIMESTAMPTZ`). All IDs are UUIDs (VARCHAR(36)).

## Users and wholesalers

- **users**: Authentication and identity only. Columns: `id`, `phone` (unique, indexed), `created_at`, `updated_at`. No `wholesaler_id` or business fields.
- **wholesalers**: Business profile linked to a user. Link is **wholesalers.user_id → users.id** (FK + UNIQUE for one-to-one). Columns: `id`, `user_id`, `shop_name`, `owner_name`, `mobile`, `address`, `gst_number` (nullable), `status`, `created_at`, `updated_at`.

So: one user may have at most one wholesaler; the FK and unique constraint live on `wholesalers.user_id`.

## Other tables

- **otp_verifications**: `phone`, `otp_hash`, `expires_at`, `used_at` (nullable), `created_at`, `ip_address` (nullable). Index on `(phone, expires_at)`.
- **refresh_tokens**: Optional; `user_id` → users, `token_hash`, `expires_at`, `revoked_at`.
- **contacts**: Per-wholesaler (multi-tenant); `wholesaler_id` → wholesalers, `type` (customer/supplier), name, mobile, address, balance, etc.
- **orders**: `contact_id`, `wholesaler_id`, order_number, date, totals, `status` (open/closed).
- **transactions**: `contact_id`, `wholesaler_id`, `type`, `date`, `order_id` (nullable), amount, notes, payment_mode.
- **transaction_attachments**: `transaction_id` → transactions, `file_path` or `storage_key`.

## Migrations

- `versions/001_otp_and_users.sql`: Legacy; minimal users, wholesalers, otp_verifications.
- `versions/002_architecture_schema.sql`: Full architecture schema (users, otp_verifications, wholesalers, refresh_tokens, contacts, orders, transactions, transaction_attachments). Use on fresh DB or run the commented ALTER section if upgrading from 001.

Application startup also runs `Base.metadata.create_all()` for dev; prefer running migration SQL in production.
