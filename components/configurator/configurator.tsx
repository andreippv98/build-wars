"use client";

import type { ClientCatalog } from "@/lib/build";
import type { ModelEntry } from "@/lib/schemas";
import { ConfiguratorLayout } from "./configurator-layout";
import { ConfiguratorProvider } from "./configurator-provider";

export function Configurator({
  catalog,
  models,
}: {
  catalog: ClientCatalog;
  models: readonly ModelEntry[];
}) {
  return (
    <ConfiguratorProvider catalog={catalog} models={models}>
      <ConfiguratorLayout />
    </ConfiguratorProvider>
  );
}
