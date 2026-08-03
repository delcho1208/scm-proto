import { useSyncExternalStore } from "react";
import { products } from "@/data/scm";

let selectedKey = products[0].key;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setSelectedProductKey(key: string) {
  if (key === selectedKey) return;
  selectedKey = key;
  listeners.forEach((l) => l());
}

export function useSelectedProductKey() {
  return useSyncExternalStore(
    subscribe,
    () => selectedKey,
    () => products[0].key,
  );
}
