import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ModelTest } from "@/components/dev/model-test";
import { getCatalog } from "@/lib/catalog/server";

export const metadata: Metadata = {
  title: "Model test",
  robots: { index: false, follow: false },
};

/**
 * The model test page exists only in development or when `ENABLE_DEV_PAGES=1` is set. The check
 * reads the environment at request time (not frozen at build time). With Cache Components the
 * response streams, so a hidden page shows the not-found page with `noindex` but its HTTP
 * status stays 200; see the report for the `proxy.ts` / config alternative.
 */
async function ModelTestLoader() {
  await connection();
  if (process.env.NODE_ENV !== "development" && process.env.ENABLE_DEV_PAGES !== "1") notFound();
  const { cpus, gpu_chips, gpu_boards, chipsets, motherboards, ram_kits, psus, models } =
    await getCatalog();
  return (
    <ModelTest
      catalog={{ cpus, gpu_chips, gpu_boards, chipsets, motherboards, ram_kits, psus }}
      manifest={models}
    />
  );
}

export default function ModelTestPage() {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <ModelTestLoader />
    </Suspense>
  );
}
