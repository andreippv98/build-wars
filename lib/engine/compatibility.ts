import { estimatePower } from "./power";
import type { Build, Issue, PowerEstimate } from "./types";

/**
 * Runs every compatibility rule on a build. Pure. A rule only runs when all the parts it needs
 * are selected, so a partial build never produces noise.
 *
 * `power` is the estimate for this build; pass it when you already have it (and in tests),
 * otherwise it is computed here.
 *
 * Returned issues are ordered: errors, then warnings, then info; within a severity, in the order
 * of `RULE_IDS`.
 *
 * Rules (ids from `RULE_IDS`; "board" = motherboard):
 *
 *  cpu_socket (cpu + board): cpu.socket != board.socket -> error.
 *
 *  cpu_generation (cpu + board; skipped when cpu_socket fails): find the board's cpu_support
 *    entry for this CPU: an entry with cpu_id == cpu.id wins, else one with
 *    cpu_generation == cpu.generation. None -> error. needs_bios_update -> warning.
 *
 *  ram_type: (ram + board) ram.type != board.mem_type -> error [ram, motherboard].
 *    (ram + cpu) ram.type not in cpu.mem_types -> error [cpu, ram]. Both can fire.
 *
 *  ram_sticks (ram + board): ram.sticks > board.ram_slots -> error.
 *
 *  ram_capacity (ram + board): ram.capacity_gb > board.max_mem_gb -> error.
 *
 *  ram_speed (ram + board and/or cpu): limits are board.max_mem_speed and
 *    cpu.max_mem_speed[ram.type] (ignored when the CPU has no entry for that type).
 *    ram.speed_mts > lowest applicable limit -> one warning that names the lower speed and
 *    which part(s) set it. Slots: ram plus the limiting part(s).
 *
 *  display_output (cpu, no gpu): cpu.igpu false -> error [cpu, gpu].
 *
 *  psu_wattage (psu + at least a cpu or a gpu): psu.watts < power.peakW -> error;
 *    else psu.watts < power.recommendedPsuW -> warning. Slots: [psu].
 *
 *  gpu_power_connectors (gpu + psu), numbers from ENGINE_CONFIG.connectors:
 *    adapters = max(0, board.conn_12v2x6 - psu.conn_12v2x6_count)
 *    perAdapter = clamp(ceil(board.power_w / wattsPer8pin), adapterMin8pin, adapterMax8pin)
 *    needed8pin = board.conn_8pin + adapters x perAdapter
 *    psu.pcie_8pin_count < needed8pin -> error (the PSU can't power this card);
 *    else adapters > 0 -> warning (works with an adapter). Slots: [gpu, psu].
 *
 *  cpu_power_connectors (board + psu): psu.eps_count < board.eps_required -> warning.
 *
 *  pcie_generation (gpu + board): slotGen = min(board.pcie_gen, cpu.pcie_gen if a cpu is
 *    selected). chip.pcie_gen > slotGen: warning when chip.pcie_lanes <= laneLimitedMaxLanes and
 *    slotGen <= laneLimitedSlotGen (ENGINE_CONFIG.pcie); otherwise info. Slots: [gpu, motherboard].
 */
export function checkCompatibility(
  build: Build,
  power: PowerEstimate = estimatePower(build),
): Issue[] {
  void build;
  void power;
  throw new Error("not implemented");
}
