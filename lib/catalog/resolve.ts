import type { Chipset, Motherboard, ResolvedMotherboard } from "@/lib/schemas";

/**
 * Fills in a motherboard's effective CPU support list: its own `cpu_support` if present, otherwise
 * its chipset's. Pure. `chipset` must be the board's chipset.
 */
export function resolveMotherboard(board: Motherboard, chipset: Chipset): ResolvedMotherboard {
  return { ...board, cpu_support: board.cpu_support ?? chipset.cpu_support };
}
