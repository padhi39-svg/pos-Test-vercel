CREATE TABLE "level_permissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "level_permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"level_id" integer NOT NULL,
	"menu_code" text NOT NULL,
	"permission_code" text NOT NULL,
	"allowed" integer DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "level_permissions_legacy" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "level_permissions_legacy_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"level_id" integer NOT NULL,
	"menu_code" text NOT NULL,
	"can_create" integer DEFAULT 0,
	"can_edit" integer DEFAULT 0,
	"can_view" integer DEFAULT 1,
	"can_delete" integer DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "master_permissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0,
	"isdelete" integer DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "master_permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "menu_permissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "menu_permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"menu_code" text NOT NULL,
	"permission_code" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "barang_prices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "barang_prices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"barang_id" integer NOT NULL,
	"unit_id" integer,
	"price" double precision DEFAULT 0 NOT NULL,
	"effective_date" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "barang_recipes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "barang_recipes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"barang_id" integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	"quantity" double precision NOT NULL,
	"unit" text NOT NULL,
	"notes" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "barang_units" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "barang_units_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"barang_id" integer NOT NULL,
	"name" text NOT NULL,
	"ratio" double precision DEFAULT 1,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "master_barang" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_barang_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kategori_id" integer,
	"spesifikasi_id" integer,
	"merk_id" integer,
	"hpp" double precision DEFAULT 0,
	"jenis" integer DEFAULT 1,
	"aktif" integer DEFAULT 1,
	"tampil_menu" integer DEFAULT 0,
	"photo_url" text,
	"isdelete" integer DEFAULT 0,
	"account_id" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "master_barang_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "master_ingredient" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_ingredient_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kategori_id" integer,
	"unit" text NOT NULL,
	"hpp" double precision DEFAULT 0,
	"stock_minimum" double precision DEFAULT 0,
	"stock_current" double precision DEFAULT 0,
	"isdelete" integer DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "master_ingredient_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "master_customer" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_customer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"npwp" text,
	"discount_percent" double precision DEFAULT 0,
	"term" integer DEFAULT 0,
	"isdelete" integer DEFAULT 0,
	"account_id" integer,
	"kode_int" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "master_customer_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "master_supplier" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_supplier_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"npwp" text,
	"discount_percent" double precision DEFAULT 0,
	"term" integer DEFAULT 0,
	"isdelete" integer DEFAULT 0,
	"account_id" integer,
	"kode_int" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "master_supplier_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "master_kategori" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_kategori_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"isdelete" integer DEFAULT 0,
	"print_target" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "master_kategori_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "master_level_manager" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_level_manager_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"isdelete" integer DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	"user_create" integer,
	"user_edit" integer,
	CONSTRAINT "master_level_manager_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "master_merk" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_merk_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"isdelete" integer DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "master_merk_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "master_periode" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_periode_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"is_active" integer DEFAULT 0,
	"isdelete" integer DEFAULT 0,
	"status_buku" text DEFAULT 'OPEN',
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "master_periode_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "master_spesifikasi" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_spesifikasi_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"isdelete" integer DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "master_spesifikasi_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "master_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text,
	"name" text,
	"level_id" integer,
	"aktif" integer DEFAULT 1,
	"is_active" integer DEFAULT 1,
	"isdelete" integer DEFAULT 0,
	"email" text,
	"password_hash" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "master_users_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "transaction_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transaction_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"transaction_id" integer NOT NULL,
	"barang_id" integer NOT NULL,
	"barang_code" text NOT NULL,
	"barang_name" text NOT NULL,
	"quantity" double precision NOT NULL,
	"unit_name" text DEFAULT 'PCS',
	"unit_ratio" integer DEFAULT 1,
	"unit_price" double precision NOT NULL,
	"discount_percent" double precision DEFAULT 0,
	"discount_amount" double precision DEFAULT 0,
	"total_price" double precision NOT NULL,
	"unit_price_include_tax" double precision,
	"paket_id" integer,
	"disc1_percent" double precision DEFAULT 0,
	"disc1_amount" double precision DEFAULT 0,
	"disc2_percent" double precision DEFAULT 0,
	"disc2_amount" double precision DEFAULT 0,
	"disc3_percent" double precision DEFAULT 0,
	"disc3_amount" double precision DEFAULT 0,
	"gross_amount" double precision DEFAULT 0,
	"net_amount" double precision DEFAULT 0,
	"disc_nominal" double precision DEFAULT 0,
	"bonus_barang_id" integer,
	"bonus_name" text,
	"bonus_qty" double precision DEFAULT 0,
	"bonus_unit" text,
	"bonus_unit_ratio" double precision DEFAULT 1,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "transaction_payments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transaction_payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"transaction_id" integer NOT NULL,
	"method" text NOT NULL,
	"amount" double precision NOT NULL,
	"bank_id" integer,
	"card_number" text,
	"notes" text,
	"change_amount" double precision DEFAULT 0,
	"account_id" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"transaction_number" text NOT NULL,
	"customer_id" integer,
	"customer_name" text,
	"customer_code" text,
	"subtotal" double precision NOT NULL,
	"discount_percent" double precision DEFAULT 0,
	"discount_amount" double precision DEFAULT 0,
	"service_charge_percent" double precision DEFAULT 0,
	"service_charge_amount" double precision DEFAULT 0,
	"total" double precision NOT NULL,
	"payment_method" text DEFAULT 'cash',
	"payment_amount" double precision,
	"change_amount" double precision DEFAULT 0,
	"status" text DEFAULT 'completed',
	"card_number" text,
	"total_discount" double precision DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "transactions_transaction_number_unique" UNIQUE("transaction_number")
);
--> statement-breakpoint
CREATE TABLE "account_mappings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "account_mappings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"map_group" text NOT NULL,
	"map_key" text NOT NULL,
	"account_id" integer NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"level" integer DEFAULT 1 NOT NULL,
	"is_header" integer DEFAULT 0 NOT NULL,
	"normal_balance" text NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"is_cash" integer DEFAULT 0 NOT NULL,
	"is_bank_account" integer DEFAULT 0 NOT NULL,
	"is_control_account" integer DEFAULT 0 NOT NULL,
	"posting_allowed" integer DEFAULT 1 NOT NULL,
	"currency" text DEFAULT 'IDR',
	"golongan" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fiscal_corrections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fiscal_corrections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"year" integer NOT NULL,
	"type" text NOT NULL,
	"account_name" text NOT NULL,
	"account_code" text,
	"amount" double precision DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "fiscal_settings" (
	"year" integer PRIMARY KEY NOT NULL,
	"omzet" double precision DEFAULT 0 NOT NULL,
	"pph25" double precision DEFAULT 0 NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "journal_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entry_date" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" integer,
	"source_number" text,
	"account_code" text NOT NULL,
	"account_name" text DEFAULT '',
	"debit" double precision DEFAULT 0 NOT NULL,
	"credit" double precision DEFAULT 0 NOT NULL,
	"description" text DEFAULT '',
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "master_banks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_banks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bank_name" text NOT NULL,
	"owner_name" text,
	"account_number" text NOT NULL,
	"account_id" integer,
	"isdelete" integer DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "memorial_journal_details" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "memorial_journal_details_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"memorial_journal_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"account_id" integer,
	"account_code" text,
	"notes" text,
	"debit" double precision DEFAULT 0 NOT NULL,
	"credit" double precision DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "memorial_journals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "memorial_journals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"journal_number" text NOT NULL,
	"journal_date" text NOT NULL,
	"notes" text,
	"total_debit" double precision DEFAULT 0 NOT NULL,
	"total_credit" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"voided_at" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "memorial_journals_journal_number_unique" UNIQUE("journal_number")
);
--> statement-breakpoint
CREATE TABLE "report_snapshot_cache" (
	"report_type" text NOT NULL,
	"period_id" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" text,
	CONSTRAINT "report_snapshot_cache_report_type_period_id_pk" PRIMARY KEY("report_type","period_id")
);
--> statement-breakpoint
CREATE TABLE "barang_monthly_hpp" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "barang_monthly_hpp_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"barang_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"hpp" double precision DEFAULT 0 NOT NULL,
	"avg_cost" double precision DEFAULT 0 NOT NULL,
	"calculated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "stock_balance" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_balance_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ingredient_id" integer,
	"warehouse_id" integer,
	"quantity" double precision DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ingredient_id" integer NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" double precision NOT NULL,
	"unit" text NOT NULL,
	"reference_type" text,
	"reference_id" integer,
	"notes" text,
	"warehouse_id" integer,
	"transaction_date" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "stock_period_snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_period_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"periode_id" integer NOT NULL,
	"barang_id" integer NOT NULL,
	"qty_base_unit" double precision DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "floors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "floors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"level_no" integer,
	"is_active" integer DEFAULT 1,
	"isdelete" integer DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "floors_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "master_meja" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_meja_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"floor_id" integer,
	"zone" text,
	"capacity" integer DEFAULT 2,
	"is_active" integer DEFAULT 1,
	"is_mergeable" integer DEFAULT 1,
	"is_smoking" integer DEFAULT 0,
	"notes" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "master_meja_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "reservation_tables" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reservation_tables_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reservation_id" integer NOT NULL,
	"table_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reservations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text NOT NULL,
	"customer_name" text,
	"phone" text,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"pax" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"dp_amount" double precision,
	"dp_paid" integer DEFAULT 0,
	"notes" text,
	"transfer_name" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "reservations_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "settings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"setting_key" text NOT NULL,
	"setting_value" text,
	"setting_group" text,
	"description" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "user_barang_jenis" (
	"user_id" integer NOT NULL,
	"jenis" integer NOT NULL,
	CONSTRAINT "user_barang_jenis_user_id_jenis_pk" PRIMARY KEY("user_id","jenis")
);
--> statement-breakpoint
CREATE TABLE "manufaktur" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "manufaktur_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nomor" text NOT NULL,
	"tanggal" text NOT NULL,
	"barang_id" integer NOT NULL,
	"barang_code" text,
	"barang_name" text,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"warehouse_id" integer DEFAULT 1 NOT NULL,
	"hpp_sebelum" double precision DEFAULT 0,
	"hpp_sesudah" double precision DEFAULT 0,
	"total_biaya_bahan" double precision DEFAULT 0,
	"total_biaya_lain" double precision DEFAULT 0,
	"total_biaya" double precision DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	"user_create" integer,
	"user_edit" integer,
	"user_approve" integer,
	"approved_at" text,
	CONSTRAINT "manufaktur_nomor_unique" UNIQUE("nomor")
);
--> statement-breakpoint
CREATE TABLE "manufaktur_biaya" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "manufaktur_biaya_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"manufaktur_id" integer NOT NULL,
	"account_id" integer,
	"account_code" text,
	"account_name" text,
	"notes" text,
	"debit" double precision DEFAULT 0 NOT NULL,
	"credit" double precision DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "manufaktur_detail" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "manufaktur_detail_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"manufaktur_id" integer NOT NULL,
	"barang_id" integer NOT NULL,
	"barang_code" text,
	"barang_name" text,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"hpp_satuan" double precision DEFAULT 0,
	"total_hpp" double precision DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "master_paket" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_paket_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kode" text NOT NULL,
	"nama" text NOT NULL,
	"harga_jual" double precision DEFAULT 0 NOT NULL,
	"aktif" integer DEFAULT 1 NOT NULL,
	"isdelete" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	"user_create" integer,
	"user_edit" integer,
	CONSTRAINT "master_paket_kode_unique" UNIQUE("kode")
);
--> statement-breakpoint
CREATE TABLE "master_paket_detail" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_paket_detail_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"paket_id" integer NOT NULL,
	"barang_id" integer NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "cashier_closing" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cashier_closing_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tanggal" text NOT NULL,
	"user_id" integer NOT NULL,
	"user_name" text,
	"total_penjualan" double precision DEFAULT 0 NOT NULL,
	"total_tunai" double precision DEFAULT 0 NOT NULL,
	"total_transfer" double precision DEFAULT 0 NOT NULL,
	"total_kembalian" double precision DEFAULT 0 NOT NULL,
	"tunai_di_kasir" double precision DEFAULT 0 NOT NULL,
	"selisih_tunai" double precision DEFAULT 0 NOT NULL,
	"jumlah_transaksi" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE "barang_prices" ADD CONSTRAINT "barang_prices_barang_id_master_barang_id_fk" FOREIGN KEY ("barang_id") REFERENCES "public"."master_barang"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barang_prices" ADD CONSTRAINT "barang_prices_unit_id_barang_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."barang_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barang_recipes" ADD CONSTRAINT "barang_recipes_barang_id_master_barang_id_fk" FOREIGN KEY ("barang_id") REFERENCES "public"."master_barang"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barang_recipes" ADD CONSTRAINT "barang_recipes_ingredient_id_master_barang_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."master_barang"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barang_units" ADD CONSTRAINT "barang_units_barang_id_master_barang_id_fk" FOREIGN KEY ("barang_id") REFERENCES "public"."master_barang"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_barang" ADD CONSTRAINT "master_barang_kategori_id_master_kategori_id_fk" FOREIGN KEY ("kategori_id") REFERENCES "public"."master_kategori"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_barang" ADD CONSTRAINT "master_barang_spesifikasi_id_master_spesifikasi_id_fk" FOREIGN KEY ("spesifikasi_id") REFERENCES "public"."master_spesifikasi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_barang" ADD CONSTRAINT "master_barang_merk_id_master_merk_id_fk" FOREIGN KEY ("merk_id") REFERENCES "public"."master_merk"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_ingredient" ADD CONSTRAINT "master_ingredient_kategori_id_master_kategori_id_fk" FOREIGN KEY ("kategori_id") REFERENCES "public"."master_kategori"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_barang_id_master_barang_id_fk" FOREIGN KEY ("barang_id") REFERENCES "public"."master_barang"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_payments" ADD CONSTRAINT "transaction_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_master_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."master_customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorial_journal_details" ADD CONSTRAINT "memorial_journal_details_memorial_journal_id_memorial_journals_id_fk" FOREIGN KEY ("memorial_journal_id") REFERENCES "public"."memorial_journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorial_journal_details" ADD CONSTRAINT "memorial_journal_details_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barang_monthly_hpp" ADD CONSTRAINT "barang_monthly_hpp_barang_id_master_barang_id_fk" FOREIGN KEY ("barang_id") REFERENCES "public"."master_barang"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_period_snapshots" ADD CONSTRAINT "stock_period_snapshots_periode_id_master_periode_id_fk" FOREIGN KEY ("periode_id") REFERENCES "public"."master_periode"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_period_snapshots" ADD CONSTRAINT "stock_period_snapshots_barang_id_master_barang_id_fk" FOREIGN KEY ("barang_id") REFERENCES "public"."master_barang"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_meja" ADD CONSTRAINT "master_meja_floor_id_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_tables" ADD CONSTRAINT "reservation_tables_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_tables" ADD CONSTRAINT "reservation_tables_table_id_master_meja_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."master_meja"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufaktur" ADD CONSTRAINT "manufaktur_barang_id_master_barang_id_fk" FOREIGN KEY ("barang_id") REFERENCES "public"."master_barang"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufaktur_biaya" ADD CONSTRAINT "manufaktur_biaya_manufaktur_id_manufaktur_id_fk" FOREIGN KEY ("manufaktur_id") REFERENCES "public"."manufaktur"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufaktur_detail" ADD CONSTRAINT "manufaktur_detail_manufaktur_id_manufaktur_id_fk" FOREIGN KEY ("manufaktur_id") REFERENCES "public"."manufaktur"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manufaktur_detail" ADD CONSTRAINT "manufaktur_detail_barang_id_master_barang_id_fk" FOREIGN KEY ("barang_id") REFERENCES "public"."master_barang"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_paket_detail" ADD CONSTRAINT "master_paket_detail_paket_id_master_paket_id_fk" FOREIGN KEY ("paket_id") REFERENCES "public"."master_paket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_paket_detail" ADD CONSTRAINT "master_paket_detail_barang_id_master_barang_id_fk" FOREIGN KEY ("barang_id") REFERENCES "public"."master_barang"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "uq_level_permissions" ON "level_permissions" USING btree ("level_id","menu_code","permission_code");--> statement-breakpoint
CREATE INDEX "uq_level_permissions_legacy" ON "level_permissions_legacy" USING btree ("level_id","menu_code");--> statement-breakpoint
CREATE INDEX "uq_menu_permissions" ON "menu_permissions" USING btree ("menu_code","permission_code");--> statement-breakpoint
CREATE INDEX "idx_sessions_token" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_master_barang_code" ON "master_barang" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_master_barang_jenis" ON "master_barang" USING btree ("jenis");--> statement-breakpoint
CREATE INDEX "idx_master_barang_aktif" ON "master_barang" USING btree ("aktif");--> statement-breakpoint
CREATE INDEX "idx_master_barang_tampil_menu" ON "master_barang" USING btree ("tampil_menu");--> statement-breakpoint
CREATE INDEX "idx_master_ingredient_code" ON "master_ingredient" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_master_customer_code" ON "master_customer" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_master_kategori_code" ON "master_kategori" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_master_merk_code" ON "master_merk" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_master_periode_code" ON "master_periode" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_master_periode_status_buku" ON "master_periode" USING btree ("status_buku");--> statement-breakpoint
CREATE INDEX "idx_master_spesifikasi_code" ON "master_spesifikasi" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_master_users_email" ON "master_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_master_users_aktif" ON "master_users" USING btree ("aktif");--> statement-breakpoint
CREATE INDEX "idx_transaction_items_transaction" ON "transaction_items" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_payments_transaction" ON "transaction_payments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_payments_method" ON "transaction_payments" USING btree ("method");--> statement-breakpoint
CREATE INDEX "idx_transactions_number" ON "transactions" USING btree ("transaction_number");--> statement-breakpoint
CREATE INDEX "idx_transactions_date" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_account_mappings" ON "account_mappings" USING btree ("map_group","map_key");--> statement-breakpoint
CREATE INDEX "idx_account_mappings_group" ON "account_mappings" USING btree ("map_group");--> statement-breakpoint
CREATE INDEX "idx_account_mappings_key" ON "account_mappings" USING btree ("map_key");--> statement-breakpoint
CREATE INDEX "idx_accounts_code" ON "accounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_accounts_parent" ON "accounts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_accounts_golongan" ON "accounts" USING btree ("golongan");--> statement-breakpoint
CREATE INDEX "idx_fiscal_corrections_year" ON "fiscal_corrections" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_je_date" ON "journal_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE INDEX "idx_je_account" ON "journal_entries" USING btree ("account_code");--> statement-breakpoint
CREATE INDEX "idx_je_source" ON "journal_entries" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "idx_master_banks_bank_name" ON "master_banks" USING btree ("bank_name");--> statement-breakpoint
CREATE INDEX "idx_master_banks_isdelete" ON "master_banks" USING btree ("isdelete");--> statement-breakpoint
CREATE INDEX "idx_memorial_journal_details_journal" ON "memorial_journal_details" USING btree ("memorial_journal_id");--> statement-breakpoint
CREATE INDEX "idx_memorial_journal_details_account_code" ON "memorial_journal_details" USING btree ("account_code");--> statement-breakpoint
CREATE INDEX "idx_memorial_journals_number" ON "memorial_journals" USING btree ("journal_number");--> statement-breakpoint
CREATE INDEX "idx_memorial_journals_date" ON "memorial_journals" USING btree ("journal_date");--> statement-breakpoint
CREATE INDEX "idx_memorial_journals_status" ON "memorial_journals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_barang_monthly_hpp" ON "barang_monthly_hpp" USING btree ("barang_id","year","month");--> statement-breakpoint
CREATE INDEX "idx_barang_monthly_hpp_barang" ON "barang_monthly_hpp" USING btree ("barang_id");--> statement-breakpoint
CREATE INDEX "idx_barang_monthly_hpp_date" ON "barang_monthly_hpp" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "idx_stock_balance_item_wh" ON "stock_balance" USING btree ("ingredient_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_stock_movements_ingredient" ON "stock_movements" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "idx_stock_movements_date" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_stock_movements_item_wh_date" ON "stock_movements" USING btree ("ingredient_id","warehouse_id","transaction_date","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_stock_snapshot_periode_barang" ON "stock_period_snapshots" USING btree ("periode_id","barang_id");--> statement-breakpoint
CREATE INDEX "idx_stock_snapshot_periode" ON "stock_period_snapshots" USING btree ("periode_id");--> statement-breakpoint
CREATE INDEX "idx_stock_snapshot_barang" ON "stock_period_snapshots" USING btree ("barang_id");--> statement-breakpoint
CREATE INDEX "idx_floors_code" ON "floors" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_master_meja_code" ON "master_meja" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_master_meja_floor" ON "master_meja" USING btree ("floor_id");--> statement-breakpoint
CREATE INDEX "idx_reservation_tables_res" ON "reservation_tables" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "idx_reservation_tables_table" ON "reservation_tables" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "idx_reservations_date" ON "reservations" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_reservations_status" ON "reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_barang_jenis_user" ON "user_barang_jenis" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_manufaktur_tanggal" ON "manufaktur" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "idx_manufaktur_barang" ON "manufaktur" USING btree ("barang_id");--> statement-breakpoint
CREATE INDEX "idx_manufaktur_status" ON "manufaktur" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_manufaktur_biaya_mf" ON "manufaktur_biaya" USING btree ("manufaktur_id");--> statement-breakpoint
CREATE INDEX "idx_manufaktur_detail_mf" ON "manufaktur_detail" USING btree ("manufaktur_id");--> statement-breakpoint
CREATE INDEX "idx_master_paket_detail_paket" ON "master_paket_detail" USING btree ("paket_id");--> statement-breakpoint
CREATE INDEX "idx_cashier_closing_tanggal" ON "cashier_closing" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "idx_cashier_closing_user" ON "cashier_closing" USING btree ("user_id");