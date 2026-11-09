CREATE TABLE "board_cpu_support" (
	"id" serial PRIMARY KEY NOT NULL,
	"motherboard_id" text,
	"chipset_id" text,
	"cpu_id" text,
	"cpu_generation" text,
	"needs_bios_update" boolean NOT NULL,
	CONSTRAINT "board_cpu_support_one_owner" CHECK (num_nonnulls("board_cpu_support"."motherboard_id", "board_cpu_support"."chipset_id") = 1),
	CONSTRAINT "board_cpu_support_one_target" CHECK (num_nonnulls("board_cpu_support"."cpu_id", "board_cpu_support"."cpu_generation") = 1)
);
--> statement-breakpoint
CREATE TABLE "chipsets" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor" text NOT NULL,
	"name" text NOT NULL,
	"socket" text NOT NULL,
	"source_notes" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cpus" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"vendor" text NOT NULL,
	"name" text NOT NULL,
	"socket" text NOT NULL,
	"generation" text NOT NULL,
	"year" integer NOT NULL,
	"cores" integer NOT NULL,
	"threads" integer NOT NULL,
	"base_ghz" real NOT NULL,
	"boost_ghz" real NOT NULL,
	"cache_mb" real NOT NULL,
	"tdp_w" integer NOT NULL,
	"ppt_w" integer NOT NULL,
	"igpu" boolean NOT NULL,
	"mem_types" text[] NOT NULL,
	"max_mem_speed" jsonb NOT NULL,
	"pcie_gen" integer NOT NULL,
	"perf_index" real NOT NULL,
	"source_notes" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "cpus_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gpu_boards" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"chip_id" text NOT NULL,
	"maker" text NOT NULL,
	"series" text,
	"model" text NOT NULL,
	"boost_mhz" integer NOT NULL,
	"power_w" integer NOT NULL,
	"conn_8pin" integer NOT NULL,
	"conn_12v2x6" integer NOT NULL,
	"length_mm" integer NOT NULL,
	"slots" real NOT NULL,
	"fan_count" integer NOT NULL,
	"rec_psu_w" integer NOT NULL,
	"source_notes" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gpu_chips" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"vendor" text NOT NULL,
	"name" text NOT NULL,
	"series" text NOT NULL,
	"year" integer NOT NULL,
	"vram_gb" integer NOT NULL,
	"vram_type" text NOT NULL,
	"ref_boost_mhz" integer NOT NULL,
	"ref_power_w" integer NOT NULL,
	"pcie_gen" integer NOT NULL,
	"pcie_lanes" integer NOT NULL,
	"high_power_spikes" boolean NOT NULL,
	"perf_index" real NOT NULL,
	"source_notes" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "gpu_chips_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "motherboards" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"maker" text NOT NULL,
	"model" text NOT NULL,
	"chipset_id" text NOT NULL,
	"socket" text NOT NULL,
	"form_factor" text NOT NULL,
	"mem_type" text NOT NULL,
	"ram_slots" integer NOT NULL,
	"max_mem_gb" integer NOT NULL,
	"max_mem_speed" integer NOT NULL,
	"pcie_gen" integer NOT NULL,
	"eps_required" integer NOT NULL,
	"source_notes" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "motherboards_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "psus" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"maker" text NOT NULL,
	"model" text NOT NULL,
	"watts" integer NOT NULL,
	"efficiency" text NOT NULL,
	"atx3" boolean NOT NULL,
	"eps_count" integer NOT NULL,
	"pcie_8pin_count" integer NOT NULL,
	"conn_12v2x6_count" integer NOT NULL,
	"modular" text NOT NULL,
	"source_notes" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "psus_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ram_kits" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"capacity_gb" integer NOT NULL,
	"sticks" integer NOT NULL,
	"speed_mts" integer NOT NULL,
	"cas" integer NOT NULL,
	"voltage" real NOT NULL,
	"brand" text,
	"model" text,
	"source_notes" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_cpu_support" ADD CONSTRAINT "board_cpu_support_motherboard_id_motherboards_id_fk" FOREIGN KEY ("motherboard_id") REFERENCES "public"."motherboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_cpu_support" ADD CONSTRAINT "board_cpu_support_chipset_id_chipsets_id_fk" FOREIGN KEY ("chipset_id") REFERENCES "public"."chipsets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_cpu_support" ADD CONSTRAINT "board_cpu_support_cpu_id_cpus_id_fk" FOREIGN KEY ("cpu_id") REFERENCES "public"."cpus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gpu_boards" ADD CONSTRAINT "gpu_boards_chip_id_gpu_chips_id_fk" FOREIGN KEY ("chip_id") REFERENCES "public"."gpu_chips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motherboards" ADD CONSTRAINT "motherboards_chipset_id_chipsets_id_fk" FOREIGN KEY ("chipset_id") REFERENCES "public"."chipsets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_cpu_support_motherboard_idx" ON "board_cpu_support" USING btree ("motherboard_id");--> statement-breakpoint
CREATE INDEX "board_cpu_support_chipset_idx" ON "board_cpu_support" USING btree ("chipset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gpu_boards_chip_slug_uq" ON "gpu_boards" USING btree ("chip_id","slug");