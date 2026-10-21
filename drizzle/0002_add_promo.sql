CREATE TABLE "promo_banner" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promo_banner_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"image_url" text NOT NULL,
	"title" text,
	"subtitle" text,
	"link_url" text,
	"urutan" integer DEFAULT 0,
	"aktif" integer DEFAULT 1,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "promo" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promo_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nama" text NOT NULL,
	"deskripsi" text,
	"banner_image" text,
	"tipe_diskon" text DEFAULT 'persen' NOT NULL,
	"nilai_diskon" double precision DEFAULT 0,
	"mulai" date,
	"selesai" date,
	"aktif" integer DEFAULT 1,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "promo_item" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promo_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"promo_id" integer NOT NULL,
	"barang_id" integer NOT NULL,
	"urutan" integer DEFAULT 0,
	CONSTRAINT "promo_item_promo_id_promo_id_fk" FOREIGN KEY ("promo_id") REFERENCES "promo"("id") ON DELETE CASCADE,
	CONSTRAINT "promo_item_barang_id_master_barang_id_fk" FOREIGN KEY ("barang_id") REFERENCES "master_barang"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE "menu_item" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "menu_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"barang_id" integer NOT NULL,
	"urutan" integer DEFAULT 0,
	"aktif" integer DEFAULT 1,
	CONSTRAINT "menu_item_barang_id_master_barang_id_fk" FOREIGN KEY ("barang_id") REFERENCES "master_barang"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "idx_promo_banner_aktif" ON "promo_banner" ("aktif");
--> statement-breakpoint
CREATE INDEX "idx_promo_aktif" ON "promo" ("aktif");
--> statement-breakpoint
CREATE INDEX "idx_promo_item_promo" ON "promo_item" ("promo_id");
--> statement-breakpoint
CREATE INDEX "idx_promo_item_barang" ON "promo_item" ("barang_id");
--> statement-breakpoint
CREATE INDEX "idx_menu_item_aktif" ON "menu_item" ("aktif");
--> statement-breakpoint
CREATE INDEX "idx_menu_item_barang" ON "menu_item" ("barang_id");
