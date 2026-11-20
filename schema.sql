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
CREATE TABLE IF NOT EXISTS orders (
 id UUID PRIMARY KEY, buyer_id BIGINT NOT NULL REFERENCES users(id), recipient VARCHAR(120) NOT NULL,
 phone VARCHAR(30) NOT NULL, region VARCHAR(80) NOT NULL, district VARCHAR(100) NOT NULL,
 address TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', payment_method VARCHAR(20) NOT NULL DEFAULT 'cod',
 subtotal INTEGER NOT NULL, delivery_fee INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'new' CHECK(status IN ('new','accepted','packing','handed_over','in_transit','delivered','cancelled')),
 tracking_number VARCHAR(100), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, created_at DESC);
CREATE TABLE IF NOT EXISTS order_items (
 id BIGSERIAL PRIMARY KEY, order_id UUID NOT NULL REFERENCES orders(id), product_id BIGINT NOT NULL REFERENCES products(id),
 seller_id BIGINT REFERENCES users(id), title VARCHAR(180) NOT NULL, image_url TEXT NOT NULL,
 price INTEGER NOT NULL, quantity INTEGER NOT NULL, fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'new'
 CHECK(fulfillment_status IN ('new','packing','ready'))
);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items (seller_id, id DESC);
CREATE TABLE IF NOT EXISTS favorites (
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 PRIMARY KEY (user_id, product_id)
);
