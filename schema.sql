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
