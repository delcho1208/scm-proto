import { useSyncExternalStore } from "react";
import { regions } from "@/data/scm";
import type { InfectiousSummary } from "@/data/infectious-region-map";

type CacheEntry = {
  summary: InfectiousSummary;
  regionLabel: string;
};

type CacheState = {
  status: "idle" | "loading" | "ready" | "error";
  data: Record<string, CacheEntry>;
  error: string;
  version: number;
};

const REGION_IDS = Object.keys(regions);

let state: CacheState = {
  status: "idle",
  data: {},
  error: "",
  version: 0,
};

const listeners = new Set<() => void>();
let currentController: AbortController | null = null;
let activeLoad: Promise<void> | null = null;

function notify() {
  state = { ...state, version: state.version + 1 };
  listeners.forEach((l) => l());
}

function getSnapshot(): CacheState {
  return state;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useInfectiousCache() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

async function fetchRegionSummary(
  regionId: string,
  signal: AbortSignal,
): Promise<CacheEntry> {
  const regionLabel = regions[regionId]?.name ?? "전국 통합";
  const response = await fetch(
    `/api/infectious-disease?mode=summary&region=${encodeURIComponent(regionId)}`,
    { signal },
  );
  const payload = (await response.json()) as InfectiousSummary & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `${regionLabel} 데이터를 불러오지 못했습니다.`);
  }
  return {
    summary: { ...payload, selected_region_label: regionLabel },
    regionLabel,
  };
}

async function doLoad(signal: AbortSignal, background: boolean) {
  const hasData = Object.keys(state.data).length > 0;
  if (!background && !hasData) {
    state = { ...state, status: "loading", error: "" };
    notify();
  }

  try {
    const entries = await Promise.all(
      REGION_IDS.map((id) => fetchRegionSummary(id, signal)),
    );

    if (signal.aborted) return;

    const data: Record<string, CacheEntry> = {};
    for (const entry of entries) {
      data[entry.summary.selected_region] = entry;
    }

    state = {
      status: hasData || entries.length > 0 ? "ready" : "error",
      data,
      error: "",
      version: state.version,
    };
    notify();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;

    const message = error instanceof Error ? error.message : "감염병 API 연결 오류";
    if (Object.keys(state.data).length > 0) {
      // Keep existing cached data on background refresh failure.
      state = { ...state, error: message };
    } else {
      state = { ...state, status: "error", error: message };
    }
    notify();
  }
}

export function loadInfectiousSummaries(options?: { force?: boolean; background?: boolean }) {
  const force = options?.force ?? false;
  const background = options?.background ?? false;

  if (!force && state.status === "ready") {
    return activeLoad ?? Promise.resolve();
  }
  if (state.status === "loading" && !force) {
    return activeLoad ?? Promise.resolve();
  }

  currentController?.abort();
  currentController = new AbortController();

  activeLoad = doLoad(currentController.signal, background).finally(() => {
    activeLoad = null;
  });
  return activeLoad;
}

export function getInfectiousCacheEntry(regionId: string): CacheEntry | undefined {
  return state.data[regionId];
}
