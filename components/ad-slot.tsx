/**
 * Space reserved for an ad so that adding ads later does not shift the page. Renders nothing
 * visible today. Never place one inside the part picker, over the 3D scene, or between the Build
 * Score and its warnings.
 */
const SIZES = {
  /** Wide banner between page sections. */
  banner: "min-h-[90px] md:min-h-[90px]",
  /** Box in a side column (desktop) or between sections (phone). */
  rectangle: "min-h-[250px]",
} as const;

export function AdSlot({ id, size }: { id: string; size: keyof typeof SIZES }) {
  return <div data-ad-slot={id} aria-hidden="true" className={`w-full ${SIZES[size]}`} />;
}
