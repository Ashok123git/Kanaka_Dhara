-- Kanaka Dhara: architecture-aligned PostgreSQL schema
-- Users: identity only (id, phone, created_at, updated_at). No wholesaler_id.
-- Wholesalers: linked from wholesalers.user_id → users.id (one-to-one, FK + UNIQUE).
-- All timestamps UTC (TIMESTAMPTZ). Run on fresh DB or after 001.
-- Usage: psql $DATABASE_URL -f db/migrations/versions/002_architecture_schema.sql

-- =============================================================================
-- 1. USERS (auth/identity only)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_users_phone ON users (phone);

-- =============================================================================
-- 2. OTP VERIFICATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS otp_verifications (
    id VARCHAR(36) PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    otp_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45) NULL
);

CREATE INDEX IF NOT EXISTS ix_otp_verifications_phone ON otp_verifications (phone);
CREATE INDEX IF NOT EXISTS ix_otp_verifications_phone_expires ON otp_verifications (phone, expires_at);

-- =============================================================================
-- 3. WHOLESALERS (linked via user_id → users.id, one-to-one)
-- =============================================================================
CREATE TABLE IF NOT EXISTS wholesalers (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    shop_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    gst_number VARCHAR(50) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_wholesalers_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_wholesalers_user_id UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS ix_wholesalers_user_id ON wholesalers (user_id);

-- =============================================================================
-- 4. REFRESH TOKENS (optional)
-- =============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_refresh_tokens_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id ON refresh_tokens (user_id);

-- =============================================================================
-- 5. DOMAIN: CONTACTS (multi-tenant by wholesaler_id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS contacts (
    id VARCHAR(36) PRIMARY KEY,
    wholesaler_id VARCHAR(36) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('customer', 'supplier')),
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) NULL,
    city VARCHAR(100) NULL,
    address TEXT NULL,
    gst_number VARCHAR(50) NULL,
    business_type VARCHAR(100) NULL,
    notes TEXT NULL,
    balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    last_activity TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_contacts_wholesaler_id FOREIGN KEY (wholesaler_id) REFERENCES wholesalers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_contacts_wholesaler_type ON contacts (wholesaler_id, type);

-- =============================================================================
-- 6. ORDERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) PRIMARY KEY,
    contact_id VARCHAR(36) NOT NULL,
    wholesaler_id VARCHAR(36) NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    total_value DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    returned_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_orders_contact_id FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_wholesaler_id FOREIGN KEY (wholesaler_id) REFERENCES wholesalers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_orders_wholesaler_contact ON orders (wholesaler_id, contact_id);

-- =============================================================================
-- 7. TRANSACTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(36) PRIMARY KEY,
    contact_id VARCHAR(36) NOT NULL,
    wholesaler_id VARCHAR(36) NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN (
        'sale', 'purchase', 'payment', 'receipt', 'credit_note', 'debit_note',
        'opening_balance', 'adjustment'
    )),
    date DATE NOT NULL,
    order_id VARCHAR(36) NULL,
    amount DECIMAL(15,2) NOT NULL,
    notes TEXT NULL,
    payment_mode VARCHAR(50) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_transactions_contact_id FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    CONSTRAINT fk_transactions_wholesaler_id FOREIGN KEY (wholesaler_id) REFERENCES wholesalers(id) ON DELETE CASCADE,
    CONSTRAINT fk_transactions_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_transactions_wholesaler_contact ON transactions (wholesaler_id, contact_id);

-- =============================================================================
-- 8. TRANSACTION ATTACHMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS transaction_attachments (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(36) NOT NULL,
    file_path VARCHAR(500) NULL,
    storage_key VARCHAR(500) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_transaction_attachments_transaction_id FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_transaction_attachments_transaction_id ON transaction_attachments (transaction_id);

-- =============================================================================
-- Upgrade from 001: if you already ran 001_otp_and_users.sql, run the following
-- to add new columns (skip if tables were created by this file).
-- =============================================================================
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- ALTER TABLE wholesalers ADD COLUMN IF NOT EXISTS shop_name VARCHAR(255);
-- ALTER TABLE wholesalers ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);
-- ALTER TABLE wholesalers ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);
-- ALTER TABLE wholesalers ADD COLUMN IF NOT EXISTS address TEXT;
-- ALTER TABLE wholesalers ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50) NULL;
-- ALTER TABLE wholesalers ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
-- ALTER TABLE wholesalers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ NULL;
-- ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45) NULL;
