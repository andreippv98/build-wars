"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Keeps items that left `items` around so they can fade out. Returns the live items followed by
 * the leaving ones (`leaving: true`) in ONE list, so React keeps an item's element when it goes
 * from live to leaving. Call `drop(key)` when a leaving item has finished fading.
 */
export function useRetained<T extends { key: string }>(items: T[]) {
  const [retired, setRetired] = useState<T[]>([]);
  const previous = useRef<T[]>([]);

  // Before paint, so a replaced part never flickers out of the scene for a frame.
  useLayoutEffect(() => {
    const live = new Set(items.map((item) => item.key));
    const gone = previous.current.filter((item) => !live.has(item.key));
    previous.current = items;
    if (gone.length) setRetired((all) => [...all.filter((item) => !live.has(item.key)), ...gone]);
  }, [items]);

  const drop = useCallback(
    (key: string) => setRetired((all) => all.filter((item) => item.key !== key)),
    [],
  );

  const liveKeys = new Set(items.map((item) => item.key));
  const list = [
    ...items.map((item) => ({ ...item, leaving: false })),
    ...retired
      .filter((item) => !liveKeys.has(item.key))
      .map((item) => ({ ...item, leaving: true })),
  ];
  return { list, drop };
}
