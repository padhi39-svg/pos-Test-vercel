-- Add missing indexes for foreign keys and commonly filtered columns
-- These dramatically improve JOIN and WHERE performance

-- barang_units: frequently joined on barang_id
CREATE INDEX IF NOT EXISTS idx_barang_units_barang_id ON barang_units (barang_id);

-- barang_prices: frequently joined on barang_id
CREATE INDEX IF NOT EXISTS idx_barang_prices_barang_id ON barang_prices (barang_id);
CREATE INDEX IF NOT EXISTS idx_barang_prices_barang_effective ON barang_prices (barang_id, effective_date DESC);

-- barang_recipes: used in reports
CREATE INDEX IF NOT EXISTS idx_barang_recipes_barang_id ON barang_recipes (barang_id);
CREATE INDEX IF NOT EXISTS idx_barang_recipes_ingredient_id ON barang_recipes (ingredient_id);

-- master_barang FK columns: used in LEFT JOINs
CREATE INDEX IF NOT EXISTS idx_master_barang_kategori ON master_barang (kategori_id);
CREATE INDEX IF NOT EXISTS idx_master_barang_spesifikasi ON master_barang (spesifikasi_id);
CREATE INDEX IF NOT EXISTS idx_master_barang_merk ON master_barang (merk_id);

-- master_ingredient: used in recipes
CREATE INDEX IF NOT EXISTS idx_master_ingredient_kategori ON master_ingredient (kategori_id);

-- master_customer: filtered by isdelete
CREATE INDEX IF NOT EXISTS idx_master_customer_isdelete ON master_customer (isdelete);
CREATE INDEX IF NOT EXISTS idx_master_customer_jenis ON master_customer (jenis_customer_id);

-- master_supplier: filtered by isdelete, searched by code/name
CREATE INDEX IF NOT EXISTS idx_master_supplier_isdelete ON master_supplier (isdelete);
CREATE INDEX IF NOT EXISTS idx_master_supplier_name ON master_supplier (name);
CREATE INDEX IF NOT EXISTS idx_master_supplier_code ON master_supplier (code);

-- transaction_items: joined on barang_id in reports
CREATE INDEX IF NOT EXISTS idx_transaction_items_barang_id ON transaction_items (barang_id);

-- transactions: filtered by customer_id
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions (customer_id);

-- purchases: filtered by void, status, period
CREATE INDEX IF NOT EXISTS idx_purchases_void ON purchases (void);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases (status);
CREATE INDEX IF NOT EXISTS idx_purchases_period_id ON purchases (period_id);

-- purchase_items: joined on barang_id
CREATE INDEX IF NOT EXISTS idx_purchase_items_barang_id ON purchase_items (barang_id);

-- stock_movements: queried by reference in stock card
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements (reference_type, reference_id);

-- stock_balance: filtered by warehouse_id alone
CREATE INDEX IF NOT EXISTS idx_stock_balance_warehouse ON stock_balance (warehouse_id);

-- stock_usage_items: joined on usage_id
CREATE INDEX IF NOT EXISTS idx_stock_usage_items_usage ON stock_usage_items (usage_id);

-- stock_opname_items: joined on opname_id
CREATE INDEX IF NOT EXISTS idx_stock_opname_items_opname ON stock_opname_items (opname_id);

-- stock_transfer_items: joined on transfer_id
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON stock_transfer_items (transfer_id);

-- gl_journal_lines: joined on journal_id
CREATE INDEX IF NOT EXISTS idx_gl_journal_lines_journal ON gl_journal_lines (journal_id);

-- sales_order_items: joined on sales_order_id
CREATE INDEX IF NOT EXISTS idx_sales_order_items_so ON sales_order_items (sales_order_id);

-- resto_temp_order_items: joined on temp_order_id
CREATE INDEX IF NOT EXISTS idx_resto_temp_order_items_temp ON resto_temp_order_items (temp_order_id);

-- cashbank_transaction_lines: joined on trans_id
CREATE INDEX IF NOT EXISTS idx_cb_transaction_lines_trans ON cashbank_transaction_lines (trans_id);

-- master_paket_detail: joined on barang_id
CREATE INDEX IF NOT EXISTS idx_master_paket_detail_barang ON master_paket_detail (barang_id);

-- manufaktur_detail: joined on barang_id
CREATE INDEX IF NOT EXISTS idx_manufaktur_detail_barang ON manufaktur_detail (barang_id);
