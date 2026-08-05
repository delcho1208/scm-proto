import { lipilouDashboard } from "@/data/dashboard-scenario";

export type LipilouGraphPoint = {
  period: string;
  x: number;
  y: number;
  value: number;
  type: "actual" | "predicted";
};

export type LipilouGraphRegion = {
  id: string;
  current_stock_box: number;
  target_stock_box: number;
  annual_demand_box: number;
  yoy_pct: number;
  operating_rate_pct: number;
  stock_status: "부족" | "과잉" | "적정";
  series: Array<{ period: string; value: number; type: "actual" | "predicted" }>;
};

const TICKS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
const FACTORS = [0.92, 0.96, 1, 1.05, 1.11];

function toStatus(ratio: number): LipilouGraphRegion["stock_status"] {
  if (ratio < 100) return "부족";
  if (ratio >= 130) return "과잉";
  return "적정";
}

function buildRegion(
  id: string,
  currentStock: number,
  targetStock: number,
  ratio: number,
): LipilouGraphRegion {
  const monthlyDemand = Math.max(1, Math.round(targetStock * 0.92));
  return {
    id,
    current_stock_box: currentStock,
    target_stock_box: targetStock,
    annual_demand_box: monthlyDemand * 12,
    yoy_pct: Math.round((ratio - 100) * 0.2 * 10) / 10,
    operating_rate_pct: Math.min(99, Math.round(60 + ratio * 0.25)),
    stock_status: toStatus(ratio),
    series: TICKS.map((period, index) => ({
      period,
      value: Math.round(monthlyDemand * FACTORS[index]),
      type: index <= 2 ? "actual" : "predicted",
    })),
  };
}

const scenarioRegions = lipilouDashboard?.regions ?? {};

const regionGraphs: Record<string, LipilouGraphRegion> = Object.fromEntries(
  Object.values(scenarioRegions).map((region) => [
    region.id,
    buildRegion(region.id, region.current_stock, region.target_stock, region.stock_ratio),
  ]),
);

const nationalCurrent = Object.values(scenarioRegions).reduce((sum, r) => sum + r.current_stock, 0);
const nationalTarget = Object.values(scenarioRegions).reduce((sum, r) => sum + r.target_stock, 0);

if (nationalTarget > 0) {
  regionGraphs.National = buildRegion(
    "National",
    nationalCurrent,
    nationalTarget,
    Math.round((nationalCurrent / nationalTarget) * 1000) / 10,
  );
}

export function getLipilouGraphRegion(regionId: string): LipilouGraphRegion | null {
  return regionGraphs[regionId] ?? null;
}

export function createLipilouGraph(region: LipilouGraphRegion) {
  const values = region.series.map((item) => item.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  const points: LipilouGraphPoint[] = region.series.map((item, index) => ({
    period: item.period,
    type: item.type,
    value: item.value,
    x: (index / (region.series.length - 1)) * 400,
    y: 170 - ((item.value - min) / span) * 130,
  }));

  const toPath = (list: LipilouGraphPoint[]) =>
    list.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

  const actualPoints = points.filter((point) => point.type === "actual");
  const predictedPoints = points.filter((point) => point.type === "predicted");
  const lastActual = actualPoints[actualPoints.length - 1];

  return {
    points,
    ticks: TICKS,
    actual: toPath(actualPoints),
    prediction: toPath(lastActual ? [lastActual, ...predictedPoints] : predictedPoints),
  };
}
