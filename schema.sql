CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, full_name VARCHAR(100) NOT NULL, email VARCHAR(200) NOT NULL UNIQUE,
 phone VARCHAR(30), password_hash TEXT NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'buyer'
 CHECK (role IN ('buyer','seller','admin')), seller_status VARCHAR(20) NOT NULL DEFAULT 'none'
 CHECK (seller_status IN ('none','pending','approved','rejected')), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS products (
 id BIGSERIAL PRIMARY KEY, seller_id BIGINT REFERENCES users(id), name VARCHAR(180) NOT NULL,
 description TEXT NOT NULL DEFAULT '', category VARCHAR(40) NOT NULL, price INTEGER NOT NULL CHECK(price > 0),
 old_price INTEGER, stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0), image_url TEXT NOT NULL DEFAULT '',
 status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','rejected','archived')),
 badge VARCHAR(40) NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_catalog ON products (status, category, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products (seller_id, created_at DESC);
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_mode VARCHAR(20) NOT NULL DEFAULT 'tracked';
ALTER TABLE products ADD COLUMN IF NOT EXISTS restock_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_products_feed ON products(status,id DESC);
CREATE INDEX IF NOT EXISTS idx_products_category_feed ON products(status,category,id DESC);
CREATE INDEX IF NOT EXISTS idx_products_price_feed ON products(status,price,id DESC);
CREATE INDEX IF NOT EXISTS idx_products_category_price_feed ON products(status,category,price,id DESC);
CREATE INDEX IF NOT EXISTS idx_products_popular_feed ON products(status,sold_count DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_products_seller_feed ON products(seller_id,id DESC);
CREATE TABLE IF NOT EXISTS orders (
 id UUID PRIMARY KEY, buyer_id BIGINT NOT NULL REFERENCES users(id), recipient VARCHAR(120) NOT NULL,
 phone VARCHAR(30) NOT NULL, region VARCHAR(80) NOT NULL, district VARCHAR(100) NOT NULL,
 address TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', payment_method VARCHAR(20) NOT NULL DEFAULT 'cod',
 subtotal INTEGER NOT NULL, delivery_fee INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'new' CHECK(status IN ('new','accepted','packing','handed_over','in_transit','delivered','cancelled')),
 tracking_number VARCHAR(100), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK(status IN ('awaiting_payment','new','accepted','packing','handed_over','in_transit','delivered','cancelled'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_checkout_key ON orders(buyer_id,checkout_key) WHERE checkout_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, created_at DESC);
CREATE TABLE IF NOT EXISTS order_items (
 id BIGSERIAL PRIMARY KEY, order_id UUID NOT NULL REFERENCES orders(id), product_id BIGINT NOT NULL REFERENCES products(id),
 seller_id BIGINT REFERENCES users(id), title VARCHAR(180) NOT NULL, image_url TEXT NOT NULL,
 price INTEGER NOT NULL, quantity INTEGER NOT NULL, fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'new'
 CHECK(fulfillment_status IN ('new','packing','ready'))
);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items (seller_id, id DESC);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id BIGINT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_label VARCHAR(100) NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_order_items_product_order ON order_items(product_id,order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON order_items(order_id,product_id);
CREATE TABLE IF NOT EXISTS favorites (
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 PRIMARY KEY (user_id, product_id)
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS external_links JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS card_background TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS detail_background TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS specifications JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_count INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS product_subcategories (
 id BIGSERIAL PRIMARY KEY, category VARCHAR(40) NOT NULL,
 name VARCHAR(80) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(category,name)
);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON product_subcategories(category,name);
INSERT INTO product_subcategories(category,name) VALUES
 ('aksessuar','Sumkalar'),('aksessuar','Taqinchoqlar'),('aksessuar','Soat va ko‘zoynaklar'),
 ('moda','Ayollar kiyimi'),('moda','Erkaklar kiyimi'),('moda','Poyabzal'),
 ('elektronika','Telefon aksessuarlari'),('elektronika','Maishiy texnika'),
 ('uy','Oshxona'),('uy','Dekor'),('uy','Yoritish'),
 ('gozallik','Parvarish'),('gozallik','Atirlar'),
 ('bolalar','Kiyimlar'),('bolalar','O‘yinchoqlar'),
 ('sport','Sport anjomlari'),('sport','Sayohat buyumlari')
 ON CONFLICT(category,name) DO NOTHING;
CREATE TABLE IF NOT EXISTS product_variants (
 id BIGSERIAL PRIMARY KEY, product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 label VARCHAR(100) NOT NULL, sku VARCHAR(80) NOT NULL DEFAULT '',
 price INTEGER NOT NULL CHECK(price >= 1000), stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
 image_url TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT true,
 position INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id,active,position,id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(product_id,lower(sku)) WHERE sku<>'' AND active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_seller_sku ON products(coalesce(seller_id,0),lower(sku)) WHERE sku<>'' AND status!='archived';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='order_items_variant_id_fkey') THEN
  ALTER TABLE order_items ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY(variant_id) REFERENCES product_variants(id);
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_stock_mode_check') THEN
  ALTER TABLE products ADD CONSTRAINT products_stock_mode_check CHECK(stock_mode IN ('tracked','replenishable'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_restock_days_check') THEN
  ALTER TABLE products ADD CONSTRAINT products_restock_days_check CHECK(restock_days BETWEEN 1 AND 90);
 END IF;
END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS personalization_enabled BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS product_events (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
 kind VARCHAR(12) NOT NULL CHECK(kind IN ('search','view','dwell','cart')),
 query VARCHAR(80) NOT NULL DEFAULT '', duration_seconds INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_events_user_time ON product_events(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_time ON product_events(created_at);
CREATE TABLE IF NOT EXISTS seller_follows (
 buyer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 seller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(buyer_id,seller_id)
);
CREATE INDEX IF NOT EXISTS idx_seller_follows_seller ON seller_follows(seller_id);
CREATE TABLE IF NOT EXISTS site_settings (
 key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_by BIGINT REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS settings_audit (
 id BIGSERIAL PRIMARY KEY, actor_id BIGINT REFERENCES users(id), changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 old_value JSONB NOT NULL, new_value JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS site_assets (
 id UUID PRIMARY KEY, owner_id BIGINT REFERENCES users(id), mime VARCHAR(20) NOT NULL,
 bytes BYTEA NOT NULL, size_bytes INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_site_assets_created ON site_assets(created_at DESC);
CREATE TABLE IF NOT EXISTS payment_transactions (
 id BIGSERIAL PRIMARY KEY, gateway VARCHAR(12) NOT NULL CHECK(gateway IN ('payme','click')),
 gateway_id VARCHAR(120) NOT NULL, order_id UUID NOT NULL REFERENCES orders(id),
 amount INTEGER NOT NULL, state INTEGER NOT NULL, create_time BIGINT NOT NULL, perform_time BIGINT NOT NULL DEFAULT 0,
 cancel_time BIGINT NOT NULL DEFAULT 0, reason INTEGER,
 UNIQUE(gateway,gateway_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_order ON payment_transactions(order_id,gateway);
CREATE TABLE IF NOT EXISTS shipment_events (
 id BIGSERIAL PRIMARY KEY, order_id UUID NOT NULL REFERENCES orders(id),
 source VARCHAR(24) NOT NULL CHECK(source IN ('admin','buyer','uzpost')),
 status VARCHAR(24) NOT NULL, tracking_number VARCHAR(100),
 external_id VARCHAR(120), occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(order_id,source,external_id)
);
CREATE INDEX IF NOT EXISTS idx_shipment_events_order ON shipment_events(order_id,recorded_at DESC);

-- Verified identity is separate from editable delivery/profile telephone.
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_phone VARCHAR(13);
CREATE UNIQUE INDEX IF NOT EXISTS users_verified_phone_unique ON users(verified_phone) WHERE verified_phone IS NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_permissions JSONB NOT NULL DEFAULT '["all"]'::jsonb;

CREATE TABLE IF NOT EXISTS phone_otps (
 phone VARCHAR(12) NOT NULL,
 purpose VARCHAR(20) NOT NULL DEFAULT 'register',
 digest CHAR(64) NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY (phone, purpose)
);
ALTER TABLE phone_otps ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) NOT NULL DEFAULT 'register';
ALTER TABLE phone_otps ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
DO $$ BEGIN
 IF EXISTS (
  SELECT 1 FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'phone_otps' AND c.contype = 'p' AND array_length(c.conkey, 1) = 1
 ) THEN
  ALTER TABLE phone_otps DROP CONSTRAINT phone_otps_pkey;
  ALTER TABLE phone_otps ADD PRIMARY KEY (phone, purpose);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'phone_otps_purpose_check') THEN
  ALTER TABLE phone_otps ADD CONSTRAINT phone_otps_purpose_check CHECK(purpose IN ('register','reset','bind','change_phone'));
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS sms_requests (
 id BIGSERIAL PRIMARY KEY, phone VARCHAR(12) NOT NULL, ip TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sms_requests ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) NOT NULL DEFAULT 'register';
ALTER TABLE sms_requests ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'sent';
ALTER TABLE sms_requests ADD COLUMN IF NOT EXISTS provider_id VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE sms_requests ADD COLUMN IF NOT EXISTS cost_units INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS sms_requests_phone_time ON sms_requests(phone,created_at DESC);
CREATE INDEX IF NOT EXISTS sms_requests_ip_time ON sms_requests(ip,created_at DESC);
CREATE INDEX IF NOT EXISTS sms_requests_time ON sms_requests(created_at);

CREATE TABLE IF NOT EXISTS user_sessions (
 id UUID PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash CHAR(64) NOT NULL UNIQUE,
 user_agent VARCHAR(240) NOT NULL DEFAULT '',
 device_label VARCHAR(80) NOT NULL DEFAULT '',
 ip VARCHAR(64) NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, revoked_at, expires_at DESC);

CREATE TABLE IF NOT EXISTS auth_attempts (
 id BIGSERIAL PRIMARY KEY,
 kind VARCHAR(24) NOT NULL,
 identifier VARCHAR(200) NOT NULL,
 ip VARCHAR(64) NOT NULL DEFAULT '',
 success BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_lookup ON auth_attempts(kind, identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip ON auth_attempts(ip, created_at DESC);

CREATE TABLE IF NOT EXISTS security_events (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
 event_type VARCHAR(48) NOT NULL,
 severity VARCHAR(16) NOT NULL DEFAULT 'info' CHECK(severity IN ('info','warning','high','critical')),
 ip VARCHAR(64) NOT NULL DEFAULT '',
 user_agent VARCHAR(240) NOT NULL DEFAULT '',
 details JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_events_time ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
 id BIGSERIAL PRIMARY KEY,
 actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
 action VARCHAR(64) NOT NULL,
 target_type VARCHAR(40) NOT NULL DEFAULT '',
 target_id VARCHAR(80) NOT NULL DEFAULT '',
 ip VARCHAR(64) NOT NULL DEFAULT '',
 details JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);

-- Buyer, Seller, Admin & Marketplace features (additive)
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_products_rating_feed ON products(status, rating_avg DESC, id DESC);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code VARCHAR(32);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(24) NOT NULL DEFAULT 'courier';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_branch_id VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_branch_label VARCHAR(200);

CREATE TABLE IF NOT EXISTS cart_items (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 variant_id BIGINT REFERENCES product_variants(id) ON DELETE CASCADE,
 qty INTEGER NOT NULL DEFAULT 1 CHECK(qty BETWEEN 1 AND 20),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_unique ON cart_items(user_id, product_id, coalesce(variant_id, 0));

CREATE TABLE IF NOT EXISTS product_reviews (
 id BIGSERIAL PRIMARY KEY,
 product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
 rating SMALLINT NOT NULL CHECK(rating BETWEEN 1 AND 5),
 comment VARCHAR(1000) NOT NULL DEFAULT '',
 verified_purchase BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(product_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS promo_codes (
 id BIGSERIAL PRIMARY KEY,
 code VARCHAR(32) NOT NULL UNIQUE,
 seller_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
 discount_type VARCHAR(16) NOT NULL CHECK(discount_type IN ('percent','fixed')),
 discount_value INTEGER NOT NULL CHECK(discount_value > 0),
 min_order INTEGER NOT NULL DEFAULT 0,
 max_discount INTEGER,
 usage_limit INTEGER,
 used_count INTEGER NOT NULL DEFAULT 0,
 starts_at TIMESTAMPTZ,
 expires_at TIMESTAMPTZ,
 active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(active, code);

CREATE TABLE IF NOT EXISTS return_requests (
 id BIGSERIAL PRIMARY KEY,
 order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 buyer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 reason VARCHAR(400) NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','refunded')),
 resolution_note VARCHAR(400) NOT NULL DEFAULT '',
 reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(order_id)
);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind VARCHAR(32) NOT NULL DEFAULT 'info',
 title VARCHAR(140) NOT NULL,
 body VARCHAR(400) NOT NULL DEFAULT '',
 href VARCHAR(200) NOT NULL DEFAULT '',
 is_read BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
