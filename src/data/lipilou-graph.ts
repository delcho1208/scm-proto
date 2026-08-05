<<<<<<< HEAD
import lipilouGraphData from "../../lipilou_graph.json";

export type LipilouTrendPoint = {
  period: string;
  value_box: number;
=======
import { lipilouDashboard } from "@/data/dashboard-scenario";

export type LipilouGraphPoint = {
  period: string;
  x: number;
  y: number;
  value: number;
>>>>>>> dc6b62fa6562b904abb87d160e82d6e61c3cf1bc
  type: "actual" | "predicted";
};

export type LipilouGraphRegion = {
<<<<<<< HEAD
  region: string;
  region_key: string;
  annual_demand_box: number;
  yoy_pct: number;
  monthly_trend: LipilouTrendPoint[];
  current_stock_box: number;
  operating_rate_pct: number;
  stock_status: string;
};

type GraphPoint = LipilouTrendPoint & { x: number; y: number };

export type LipilouGraph = {
  actual: string;
  prediction: string;
  points: GraphPoint[];
  ticks: string[];
};

const regionKeyByDashboardId: Record<string, string> = {
  Seoul: "seoul",
  Gyeonggi: "gyeonggi_incheon",
  Gangwon: "gangwon",
  Chungcheong: "chungcheong_daejeon_sejong",
  Daegu: "gyeongbuk_daegu",
  Honam: "jeolla_gwangju",
  Busan: "gyeongnam_ulsan_busan",
  Jeju: "jeju",
};

const national = lipilouGraphData.national as LipilouGraphRegion;
const regionByKey = new Map(
  (lipilouGraphData.regions as LipilouGraphRegion[]).map((region) => [
    region.region_key,
    region,
  ]),
);

export function getLipilouGraphRegion(regionId: string): LipilouGraphRegion | null {
  if (regionId === "National") return national;
  const graphRegionKey = regionKeyByDashboardId[regionId];
  return graphRegionKey ? (regionByKey.get(graphRegionKey) ?? null) : null;
}

function toPath(points: GraphPoint[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
}

export function createLipilouGraph(region: LipilouGraphRegion): LipilouGraph {
  const trend = region.monthly_trend;
  const values = trend.map((point) => point.value_box);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const points = trend.map<GraphPoint>((point, index) => ({
    ...point,
    x: trend.length === 1 ? 200 : (index * 400) / (trend.length - 1),
    y: 170 - ((point.value_box - min) / range) * 130,
  }));

  const firstPredictionIndex = points.findIndex((point) => point.type === "predicted");
  const actualPoints = points.filter((point) => point.type === "actual");
  const predictionPoints =
    firstPredictionIndex < 0
      ? []
      : points.slice(Math.max(0, firstPredictionIndex - 1));

  return {
    actual: toPath(actualPoints),
    prediction: toPath(predictionPoints),
    points,
    ticks: points.map((point) => point.period),
=======
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
>>>>>>> dc6b62fa6562b904abb87d160e82d6e61c3cf1bc
  };
}
