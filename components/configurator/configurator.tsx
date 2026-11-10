"use client";

import type { ClientCatalog } from "@/lib/build";
import { ConfiguratorLayout } from "./configurator-layout";
import { ConfiguratorProvider } from "./configurator-provider";

export function Configurator({ catalog }: { catalog: ClientCatalog }) {
  return (
    <ConfiguratorProvider catalog={catalog}>
      <ConfiguratorLayout />
    </ConfiguratorProvider>
  );
}
