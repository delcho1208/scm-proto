import { useSyncExternalStore } from "react";
import type { InfectiousSummary } from "@/data/infectious-region-map";

/* ---- global "Refresh Data" pulse ---- */
let refreshToken = 0;
const refreshListeners = new Set<() => void>();

export function triggerDataRefresh() {
  refreshToken += 1;
  refreshListeners.forEach((l) => l());
}

export function useRefreshToken() {
  return useSyncExternalStore(
    (cb) => {
      refreshListeners.add(cb);
      return () => refreshListeners.delete(cb);
    },
    () => refreshToken,
    () => 0,
  );
}

/* ---- globally exposed infectious disease values (for future AI/SCM reuse) ---- */
let latestSummary: InfectiousSummary | null = null;

export function setInfectiousSummary(summary: InfectiousSummary | null) {
  latestSummary = summary;
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__INFECTIOUS_DISEASE__ = summary;
  }
}

export function getInfectiousSummary() {
  return latestSummary;
}
