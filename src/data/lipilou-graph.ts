import lipilouGraphData from "../../lipilou_graph.json";

export type LipilouTrendPoint = {
  period: string;
  value_box: number;
  type: "actual" | "predicted";
};

export type LipilouGraphRegion = {
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
  const alignedPeriods = ["26.08", "26.09", "26.10", "26.11", "26.12", "27.01"];
  const trend = region.monthly_trend.map((point, index) => ({
    ...point,
    period: alignedPeriods[index] ?? point.period,
    type: (index <= 2 ? "actual" : "predicted") as LipilouTrendPoint["type"],
  }));
  const values = trend.map((point) => point.value_box);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const points = trend.map<GraphPoint>((point, index) => ({
    ...point,
    x: trend.length === 1 ? 200 : index * 80,
    y: 170 - ((point.value_box - min) / range) * 130,
  }));

  const firstPredictionIndex = points.findIndex((point) => point.type === "predicted");
  const actualPoints = points.filter((point) => point.type === "actual");
  const predictionPoints =
    firstPredictionIndex < 0 ? [] : points.slice(Math.max(0, firstPredictionIndex - 1));

  return {
    actual: toPath(actualPoints),
    prediction: toPath(predictionPoints),
    points,
    ticks: alignedPeriods,
  };
}
