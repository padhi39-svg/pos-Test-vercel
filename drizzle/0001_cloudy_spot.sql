CREATE TABLE "ingredient_units" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ingredient_units_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ingredient_id" integer NOT NULL,
	"name" text NOT NULL,
	"ratio" double precision DEFAULT 1,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "level_manager" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "level_manager_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "master_gudang" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_gudang_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" integer DEFAULT 1,
	"isdelete" integer DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "master_gudang_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "master_sales" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "master_sales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text,
	"name" text,
	"user_id" integer,
	"phone" text,
	"email" text,
	"ktp" text,
	"aktif" integer DEFAULT 1,
	"isdelete" integer DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "master_sales_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "stock_balance_by_warehouse" (
	"barang_id" integer,
	"warehouse_id" integer,
	"qty" double precision DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "stock_balance_by_warehouse_barang_id_warehouse_id_pk" PRIMARY KEY("barang_id","warehouse_id")
);
--> statement-breakpoint
CREATE TABLE "stock_balance_monthly" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_balance_monthly_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"barang_id" integer NOT NULL,
	"warehouse_id" integer DEFAULT 1,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"quantity" double precision DEFAULT 0,
	"avg_cost" double precision DEFAULT 0,
	"total_cost" double precision DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "stock_opname" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_opname_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text,
	"tdate" text,
	"warehouse_id" integer,
	"notes" text,
	"status" text DEFAULT 'draft',
	"assignees" text,
	"period_id" integer,
	"user_create" integer,
	"user_edit" integer,
	"user_void" integer,
	"void" integer DEFAULT 0,
	"void_reason" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "stock_opname_counts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_opname_counts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"session_id" integer,
	"opname_id" integer,
	"barang_id" integer,
	"qty" double precision,
	"unit_id" integer,
	"unit_ratio" double precision,
	"qty_base" double precision,
	"method" text,
	"notes" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "stock_opname_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_opname_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"opname_id" integer,
	"barang_id" integer,
	"system_qty" double precision DEFAULT 0,
	"count_qty" double precision,
	"variance_qty" double precision,
	"unit_id_default" integer,
	"notes" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "stock_opname_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_opname_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"opname_id" integer,
	"token" text,
	"assignee" text,
	"status" text DEFAULT 'open',
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_transfer_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"transfer_id" integer,
	"barang_id" integer,
	"qty" double precision DEFAULT 0,
	"unit_id" integer,
	"unit_name" text,
	"unit_ratio" double precision DEFAULT 1,
	"qty_total" double precision DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_transfers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text,
	"tdate" text,
	"from_warehouse_id" integer,
	"to_warehouse_id" integer,
	"notes" text,
	"void" integer DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"period_id" integer,
	"user_void" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "stock_transfers_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "stock_usage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text,
	"tdate" text,
	"warehouse_id" integer,
	"notes" text,
	"status" text DEFAULT 'draft',
	"void" integer DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"period_id" integer,
	"user_void" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "stock_usage_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_usage_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"usage_id" integer,
	"barang_id" integer,
	"qty" double precision,
	"unit_id" integer,
	"unit_ratio" double precision,
	"qty_total" double precision,
	"cogs_unit" double precision DEFAULT 0,
	"cogs_total" double precision DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text,
	"name" text NOT NULL,
	"email" text,
	"role" text DEFAULT 'staff' NOT NULL,
	"password_hash" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"isdelete" integer DEFAULT 0 NOT NULL,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "users_code_unique" UNIQUE("code"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ap_advance_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ap_advance_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"advance_id" integer NOT NULL,
	"account_id" integer,
	"account_code" text,
	"account_name" text,
	"notes" text,
	"nominal" double precision DEFAULT 0,
	"ap_advance_id" integer,
	"line_no" integer DEFAULT 0 NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "ap_advances" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ap_advances_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kode_nota" text NOT NULL,
	"tanggal" text NOT NULL,
	"supplier_id" integer,
	"supplier_code" text,
	"supplier_name" text,
	"notes" text,
	"total" double precision DEFAULT 0,
	"status" text DEFAULT 'active' NOT NULL,
	"purchase_id" integer,
	"period_id" integer DEFAULT 1 NOT NULL,
	"total_amount" double precision DEFAULT 0 NOT NULL,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "ap_advances_kode_nota_unique" UNIQUE("kode_nota")
);
--> statement-breakpoint
CREATE TABLE "ap_ledger" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ap_ledger_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doc_type" text,
	"doc_id" integer,
	"supplier_id" integer,
	"trans_date" text,
	"description" text,
	"debit" double precision DEFAULT 0,
	"credit" double precision DEFAULT 0,
	"balance" double precision DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "ap_opening_balances" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ap_opening_balances_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kode_nota" text NOT NULL,
	"tanggal" text NOT NULL,
	"supplier_id" integer,
	"supplier_code" text,
	"supplier_name" text,
	"nominal" double precision DEFAULT 0,
	"period_id" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "ap_opening_balances_kode_nota_unique" UNIQUE("kode_nota")
);
--> statement-breakpoint
CREATE TABLE "ap_payment_extras" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ap_payment_extras_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"payment_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"notes" text,
	"debit" double precision DEFAULT 0,
	"credit" double precision DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "ap_payment_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ap_payment_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"payment_id" integer NOT NULL,
	"reference_doc_type" text,
	"reference_id" integer,
	"applied_amount" double precision DEFAULT 0,
	"source_type" text,
	"source_id" integer DEFAULT 0,
	"invoice_number" text,
	"due_amount" double precision DEFAULT 0,
	"pay_amount" double precision DEFAULT 0,
	"remarks" text,
	"purchase_id" integer DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "ap_payment_methods" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ap_payment_methods_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"payment_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"amount" double precision NOT NULL,
	"notes" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "ap_payments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ap_payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"payment_number" text,
	"payment_date" text,
	"supplier_id" integer,
	"method" text,
	"amount" double precision DEFAULT 0,
	"notes" text,
	"period_id" integer,
	"subtotal" double precision DEFAULT 0,
	"total" double precision DEFAULT 0,
	"status" text DEFAULT 'active',
	"user_create" integer,
	"user_update" integer,
	"user_edit" integer,
	"void" integer DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "ap_payments_payment_number_unique" UNIQUE("payment_number")
);
--> statement-breakpoint
CREATE TABLE "ar_advance_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ar_advance_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"advance_id" integer NOT NULL,
	"account_id" integer,
	"account_code" text,
	"account_name" text,
	"notes" text,
	"nominal" double precision DEFAULT 0,
	"ar_advance_id" integer,
	"line_no" integer DEFAULT 0 NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "ar_advances" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ar_advances_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kode_nota" text NOT NULL,
	"tanggal" text NOT NULL,
	"customer_id" integer,
	"customer_code" text,
	"customer_name" text,
	"notes" text,
	"total" double precision DEFAULT 0,
	"status" text DEFAULT 'active' NOT NULL,
	"total_amount" double precision DEFAULT 0 NOT NULL,
	"period_id" integer DEFAULT 1 NOT NULL,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "ar_advances_kode_nota_unique" UNIQUE("kode_nota")
);
--> statement-breakpoint
CREATE TABLE "ar_ledger" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ar_ledger_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doc_type" text,
	"doc_id" integer,
	"customer_id" integer,
	"trans_date" text,
	"description" text,
	"debit" double precision DEFAULT 0,
	"credit" double precision DEFAULT 0,
	"balance" double precision DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "ar_opening_balances" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ar_opening_balances_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kode_nota" text NOT NULL,
	"tanggal" text NOT NULL,
	"customer_id" integer,
	"customer_code" text,
	"customer_name" text,
	"nominal" double precision DEFAULT 0,
	"period_id" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "ar_opening_balances_kode_nota_unique" UNIQUE("kode_nota")
);
--> statement-breakpoint
CREATE TABLE "ar_payment_extras" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ar_payment_extras_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"payment_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"account_code" text,
	"account_name" text,
	"notes" text,
	"debit" double precision DEFAULT 0,
	"credit" double precision DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "ar_payment_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ar_payment_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"payment_id" integer NOT NULL,
	"sale_id" integer NOT NULL,
	"invoice_number" text,
	"due_amount" double precision DEFAULT 0,
	"pay_amount" double precision DEFAULT 0,
	"remarks" text,
	"source_type" text,
	"source_id" integer DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "ar_payment_methods" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ar_payment_methods_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"payment_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"account_code" text,
	"account_name" text,
	"amount" double precision DEFAULT 0,
	"notes" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "ar_payments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ar_payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"payment_number" text NOT NULL,
	"payment_date" text NOT NULL,
	"customer_id" integer NOT NULL,
	"customer_name" text,
	"period_id" integer NOT NULL,
	"status" text DEFAULT 'active',
	"subtotal" double precision DEFAULT 0,
	"total" double precision DEFAULT 0,
	"notes" text,
	"user_create" integer,
	"user_update" integer,
	"user_edit" integer,
	"void" integer DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "ar_payments_payment_number_unique" UNIQUE("payment_number")
);
--> statement-breakpoint
CREATE TABLE "ar_receipt_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ar_receipt_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"receipt_id" integer NOT NULL,
	"reference_doc_type" text,
	"reference_id" integer,
	"applied_amount" double precision DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "ar_receipts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ar_receipts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"receipt_number" text,
	"receipt_date" text,
	"customer_id" integer,
	"method" text,
	"amount" double precision DEFAULT 0,
	"notes" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "ar_receipts_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"purchase_id" integer NOT NULL,
	"barang_id" integer,
	"quantity" double precision DEFAULT 0,
	"unit_name" text,
	"unit_ratio" double precision DEFAULT 1,
	"unit_price" double precision DEFAULT 0,
	"discount_percent" double precision DEFAULT 0,
	"discount_amount" double precision DEFAULT 0,
	"total_price" double precision DEFAULT 0,
	"po_item_id" integer,
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
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"po_id" integer NOT NULL,
	"barang_id" integer,
	"barang_code" text,
	"barang_name" text,
	"quantity" double precision DEFAULT 0,
	"unit_name" text,
	"unit_ratio" double precision DEFAULT 1,
	"unit_price" double precision DEFAULT 0,
	"discount_percent" double precision DEFAULT 0,
	"discount_amount" double precision DEFAULT 0,
	"total_price" double precision DEFAULT 0,
	"received_qty" double precision DEFAULT 0,
	"received_qty_base" double precision DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"po_number" text,
	"supplier_id" integer,
	"supplier_name" text,
	"order_date" text,
	"expected_date" text,
	"subtotal" double precision DEFAULT 0,
	"discount_percent" double precision DEFAULT 0,
	"discount_amount" double precision DEFAULT 0,
	"ppn_percent" double precision DEFAULT 0,
	"ppn_amount" double precision DEFAULT 0,
	"total" double precision DEFAULT 0,
	"status" text DEFAULT 'draft',
	"notes" text,
	"period_id" integer,
	"po_status" text DEFAULT 'outstanding',
	"doc_status" text DEFAULT 'active',
	"void" integer DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"realisasi_manual" integer DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "purchase_request_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_request_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_id" integer NOT NULL,
	"barang_id" integer,
	"barang_code" text,
	"barang_name" text,
	"quantity" double precision DEFAULT 0,
	"unit_name" text,
	"unit_ratio" double precision DEFAULT 1,
	"notes" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_number" text,
	"request_date" text,
	"expected_date" text,
	"period_id" integer,
	"requester_id" integer,
	"requester_name" text,
	"notes" text,
	"status" text DEFAULT 'draft',
	"void" integer DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "purchase_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"purchase_number" text,
	"po_id" integer,
	"supplier_id" integer,
	"purchase_date" text,
	"invoice_number" text,
	"period_id" integer,
	"expected_date" text,
	"subtotal" double precision DEFAULT 0,
	"discount_percent" double precision DEFAULT 0,
	"discount_amount" double precision DEFAULT 0,
	"ppn_percent" double precision DEFAULT 0,
	"ppn_amount" double precision DEFAULT 0,
	"total" double precision DEFAULT 0,
	"payment_status" text DEFAULT 'unpaid',
	"paid_amount" double precision DEFAULT 0,
	"status" text DEFAULT 'active',
	"void" integer DEFAULT 0,
	"notes" text,
	"warehouse_id" integer DEFAULT 1,
	"user_create" integer,
	"user_edit" integer,
	"is_return" integer DEFAULT 0,
	"dp_amount" double precision DEFAULT 0,
	"total_discount" double precision DEFAULT 0,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "purchases_purchase_number_unique" UNIQUE("purchase_number")
);
--> statement-breakpoint
CREATE TABLE "cash_mutation_details" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_mutation_details_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cash_mutation_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"account_id" integer NOT NULL,
	"account_code" text NOT NULL,
	"notes" text DEFAULT '',
	"amount" double precision DEFAULT 0 NOT NULL,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "cash_mutations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_mutations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"mutation_number" text NOT NULL,
	"mutation_date" text NOT NULL,
	"cash_account_id" integer NOT NULL,
	"cash_account_code" text NOT NULL,
	"mutation_type" text NOT NULL,
	"notes" text DEFAULT '',
	"total_amount" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"user_create" integer,
	"user_update" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "cash_opening_balances" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cash_opening_balances_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"account_id" integer NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"balance_date" text NOT NULL,
	"notes" text DEFAULT '',
	"is_default" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "cashbank_accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cashbank_accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text,
	"name" text,
	"type" text,
	"currency" text,
	"is_active" integer DEFAULT 1,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "cashbank_accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "cashbank_transaction_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cashbank_transaction_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"trans_id" integer NOT NULL,
	"description" text,
	"amount" double precision DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "cashbank_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cashbank_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"trans_number" text,
	"trans_date" text,
	"account_id" integer,
	"direction" text,
	"amount" double precision DEFAULT 0,
	"reference_type" text,
	"reference_id" integer,
	"notes" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "cashbank_transactions_trans_number_unique" UNIQUE("trans_number")
);
--> statement-breakpoint
CREATE TABLE "akun_saldo_bulanan" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "akun_saldo_bulanan_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"account_code" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"saldo_akhir" double precision DEFAULT 0 NOT NULL,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "client_settings" (
	"device_id" text NOT NULL,
	"setting_group" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"user_create" integer,
	"user_edit" integer,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "client_settings_pk" PRIMARY KEY("device_id","setting_group","setting_key")
);
--> statement-breakpoint
CREATE TABLE "gl_journal" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "gl_journal_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"journal_number" text,
	"journal_date" text,
	"description" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "gl_journal_journal_number_unique" UNIQUE("journal_number")
);
--> statement-breakpoint
CREATE TABLE "gl_journal_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "gl_journal_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"journal_id" integer NOT NULL,
	"account_code" text,
	"account_name" text,
	"debit" double precision DEFAULT 0,
	"credit" double precision DEFAULT 0,
	"notes" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "SO" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "SO_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text,
	"tdate" text,
	"warehouse_id" integer,
	"notes" text,
	"approved" integer DEFAULT 0,
	"period_id" integer,
	"void" integer DEFAULT 0,
	"dso_id" integer,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "SODetail" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "SODetail_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"so_id" integer NOT NULL,
	"barang_id" integer NOT NULL,
	"system_qty" double precision DEFAULT 0,
	"count_qty" double precision,
	"variance_qty" double precision,
	"unit_id_default" integer,
	"notes" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "pos_table_locks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pos_table_locks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"table_id" integer NOT NULL,
	"device_id" text NOT NULL,
	"locked_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "resto_table_locks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resto_table_locks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"table_id" integer NOT NULL,
	"device_id" text NOT NULL,
	"user_id" integer,
	"user_name" text,
	"locked_at" text DEFAULT CURRENT_TIMESTAMP,
	"expires_at" text,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "resto_temp_order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resto_temp_order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"temp_order_id" integer NOT NULL,
	"barang_id" integer NOT NULL,
	"barang_code" text NOT NULL,
	"barang_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" double precision NOT NULL,
	"total_price" double precision NOT NULL,
	"modifier" text,
	"kategori_id" integer,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "resto_temp_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resto_temp_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"table_id" integer NOT NULL,
	"customer_id" integer,
	"customer_name" text,
	"waiter_id" integer,
	"waiter_name" text,
	"guest_count" integer DEFAULT 1,
	"status" text DEFAULT 'open',
	"notes" text,
	"void" integer DEFAULT 0,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "sales_order" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_order_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"so_number" text,
	"so_date" text NOT NULL,
	"customer_id" integer,
	"warehouse_id" integer,
	"sales_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" double precision DEFAULT 0 NOT NULL,
	"discount_percent" double precision DEFAULT 0 NOT NULL,
	"discount_amount" double precision DEFAULT 0 NOT NULL,
	"ppn_percent" double precision DEFAULT 0 NOT NULL,
	"ppn_amount" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"price_include_tax" integer DEFAULT 0 NOT NULL,
	"tax_rate_percent" double precision DEFAULT 11 NOT NULL,
	"is_fully_invoiced" integer DEFAULT 0 NOT NULL,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "sales_order_so_number_unique" UNIQUE("so_number")
);
--> statement-breakpoint
CREATE TABLE "sales_order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sales_order_id" integer NOT NULL,
	"barang_id" integer NOT NULL,
	"barang_name" text,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"unit_name" text,
	"unit_ratio" double precision DEFAULT 1 NOT NULL,
	"unit_price" double precision DEFAULT 0 NOT NULL,
	"discount_percent" double precision DEFAULT 0 NOT NULL,
	"discon_total" double precision DEFAULT 0 NOT NULL,
	"total_price" double precision DEFAULT 0 NOT NULL,
	"user_create" integer,
	"user_edit" integer,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE "stock_opname_counts" ADD CONSTRAINT "stock_opname_counts_session_id_stock_opname_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."stock_opname_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_counts" ADD CONSTRAINT "stock_opname_counts_opname_id_stock_opname_id_fk" FOREIGN KEY ("opname_id") REFERENCES "public"."stock_opname"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_opname_id_stock_opname_id_fk" FOREIGN KEY ("opname_id") REFERENCES "public"."stock_opname"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_opname_id_stock_opname_id_fk" FOREIGN KEY ("opname_id") REFERENCES "public"."stock_opname"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transfer_id_stock_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_usage_items" ADD CONSTRAINT "stock_usage_items_usage_id_stock_usage_id_fk" FOREIGN KEY ("usage_id") REFERENCES "public"."stock_usage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_payment_extras" ADD CONSTRAINT "ap_payment_extras_payment_id_ap_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."ap_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_payment_items" ADD CONSTRAINT "ap_payment_items_payment_id_ap_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."ap_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_payment_methods" ADD CONSTRAINT "ap_payment_methods_payment_id_ap_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."ap_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_payment_extras" ADD CONSTRAINT "ar_payment_extras_payment_id_ar_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."ar_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_payment_items" ADD CONSTRAINT "ar_payment_items_payment_id_ar_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."ar_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_payment_methods" ADD CONSTRAINT "ar_payment_methods_payment_id_ar_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."ar_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_receipt_items" ADD CONSTRAINT "ar_receipt_items_receipt_id_ar_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."ar_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_request_id_purchase_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_mutation_details" ADD CONSTRAINT "cash_mutation_details_cash_mutation_id_cash_mutations_id_fk" FOREIGN KEY ("cash_mutation_id") REFERENCES "public"."cash_mutations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbank_transaction_lines" ADD CONSTRAINT "cashbank_transaction_lines_trans_id_cashbank_transactions_id_fk" FOREIGN KEY ("trans_id") REFERENCES "public"."cashbank_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_journal_id_gl_journal_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."gl_journal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SODetail" ADD CONSTRAINT "SODetail_so_id_SO_id_fk" FOREIGN KEY ("so_id") REFERENCES "public"."SO"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resto_temp_order_items" ADD CONSTRAINT "resto_temp_order_items_temp_order_id_resto_temp_orders_id_fk" FOREIGN KEY ("temp_order_id") REFERENCES "public"."resto_temp_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_gudang_active" ON "master_gudang" USING btree ("is_active","isdelete");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_stock_balance_monthly" ON "stock_balance_monthly" USING btree ("barang_id","warehouse_id","year","month");--> statement-breakpoint
CREATE INDEX "idx_stock_opname_period" ON "stock_opname" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "idx_stock_transfers_period" ON "stock_transfers" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "idx_stock_usage_period" ON "stock_usage" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "idx_users_code" ON "users" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_isdelete" ON "users" USING btree ("isdelete");--> statement-breakpoint
CREATE INDEX "idx_ap_adv_lines_acc" ON "ap_advance_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_ap_adv_lines_hdr" ON "ap_advance_lines" USING btree ("ap_advance_id");--> statement-breakpoint
CREATE INDEX "idx_ap_adv_supplier" ON "ap_advances" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_ap_adv_tanggal" ON "ap_advances" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "idx_ap_ledger_supplier" ON "ap_ledger" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_ap_ledger_doc" ON "ap_ledger" USING btree ("doc_type","doc_id");--> statement-breakpoint
CREATE INDEX "idx_ap_opening_supplier" ON "ap_opening_balances" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_ap_opening_period" ON "ap_opening_balances" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "idx_ap_payment_items_payment" ON "ap_payment_items" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_ap_payments_supplier" ON "ap_payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_ar_adv_lines_acc" ON "ar_advance_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_ar_adv_lines_hdr" ON "ar_advance_lines" USING btree ("ar_advance_id");--> statement-breakpoint
CREATE INDEX "idx_ar_adv_customer" ON "ar_advances" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_ar_adv_tanggal" ON "ar_advances" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "idx_ar_ledger_customer" ON "ar_ledger" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_ar_ledger_doc" ON "ar_ledger" USING btree ("doc_type","doc_id");--> statement-breakpoint
CREATE INDEX "idx_ar_opening_customer" ON "ar_opening_balances" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_ar_opening_period" ON "ar_opening_balances" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "idx_ar_payment_items_payment" ON "ar_payment_items" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_ar_payment_items_sale" ON "ar_payment_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_ar_payment_methods_payment" ON "ar_payment_methods" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_ar_payments_customer" ON "ar_payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_ar_payments_period" ON "ar_payments" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_items_purchase" ON "purchase_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "idx_po_items_po" ON "purchase_order_items" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_supplier" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_date" ON "purchase_orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "idx_purchases_supplier" ON "purchases" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_purchases_date" ON "purchases" USING btree ("purchase_date");--> statement-breakpoint
CREATE INDEX "idx_purchases_period" ON "purchases" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "idx_cmd_hdr" ON "cash_mutation_details" USING btree ("cash_mutation_id");--> statement-breakpoint
CREATE INDEX "idx_cmd_acc" ON "cash_mutation_details" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cash_mutations_number" ON "cash_mutations" USING btree ("mutation_number");--> statement-breakpoint
CREATE INDEX "idx_cm_cash_acc" ON "cash_mutations" USING btree ("cash_account_id");--> statement-breakpoint
CREATE INDEX "idx_cm_date" ON "cash_mutations" USING btree ("mutation_date");--> statement-breakpoint
CREATE INDEX "idx_cash_opening_account" ON "cash_opening_balances" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_cash_opening_status" ON "cash_opening_balances" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_akun_saldo_bulanan" ON "akun_saldo_bulanan" USING btree ("account_code","year","month");--> statement-breakpoint
CREATE INDEX "idx_so_number" ON "SO" USING btree ("number");--> statement-breakpoint
CREATE INDEX "idx_so_date" ON "SO" USING btree ("tdate");--> statement-breakpoint
CREATE INDEX "idx_so_approved" ON "SO" USING btree ("approved");--> statement-breakpoint
CREATE INDEX "idx_so_period_wh" ON "SO" USING btree ("period_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_sodetail_so_id" ON "SODetail" USING btree ("so_id");--> statement-breakpoint
CREATE INDEX "idx_sodetail_barang_id" ON "SODetail" USING btree ("barang_id");--> statement-breakpoint
CREATE INDEX "idx_pos_table_locks_table" ON "pos_table_locks" USING btree ("table_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_table_locks_table" ON "resto_table_locks" USING btree ("table_id");