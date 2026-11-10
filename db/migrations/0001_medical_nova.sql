ALTER TABLE "cpus" ADD COLUMN "perf_index_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "gpu_boards" ADD COLUMN "conn_6pin" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "gpu_chips" ADD COLUMN "perf_index_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "psus" ADD COLUMN "pcie_6pin_count" integer DEFAULT 0 NOT NULL;