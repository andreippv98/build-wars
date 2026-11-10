import type { Metadata } from "next";
import { Suspense } from "react";
import { Configurator } from "@/components/configurator/configurator";
import { getClientCatalog, getPublicModels } from "@/lib/catalog/server";

export const metadata: Metadata = {
  title: "Build a PC",
  description:
    "Pick a CPU, graphics card, memory, motherboard and power supply, check that they work together and see the Build Score.",
};

export default async function BuildPage() {
  const [catalog, models] = await Promise.all([getClientCatalog(), getPublicModels()]);
  return (
    // The configurator reads the build from the URL, which only exists in the browser.
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <Configurator catalog={catalog} models={models} />
    </Suspense>
  );
}
