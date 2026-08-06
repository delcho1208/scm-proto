import { useSyncExternalStore } from "react";
import { products } from "@/data/scm";

const defaultProductKey =
  products.find((product) => product.key === "세파졸린")?.key ?? products[0].key;

let selectedKey = defaultProductKey;
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
    () => defaultProductKey,
  );
}
