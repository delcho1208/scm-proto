import type { RiskLevel } from "@/data/scm";

export const timelineKeys = ["24Q3", "24Q4", "PRES", "25Q1", "25Q2", "26Q1"] as const;
export type TimelineKey = (typeof timelineKeys)[number];

export type TimelineRegion = {
  status: RiskLevel;
  inventory: number;
  risk: number;
};

export type TimelinePoint = {
  label: string;
  tick: string;
  isPrediction: boolean;
  totalInventory: number;
  riskIndex: number;
  riskFactors: [number, number, number, number];
  utilization: number;
  stockoutRisk: number;
  roi: number;
  regions: Record<string, TimelineRegion>;
};

const point = (
  data: Omit<TimelinePoint, "regions">,
  regions: Array<[string, RiskLevel, number, number]>,
): TimelinePoint => ({
  ...data,
  regions: Object.fromEntries(
    regions.map(([id, status, inventory, risk]) => [id, { status, inventory, risk }]),
  ),
});

export const timelineData: Record<TimelineKey, TimelinePoint> = {
  "24Q3": point(
    { label: "2024 Q3", tick: "24 Q3", isPrediction: false, totalInventory: 15200, riskIndex: 62, riskFactors: [61, 68, 54, 63], utilization: 86.4, stockoutRisk: 6.2, roi: 7.8 },
    [["Seoul", "safe", 2100, 55], ["Gyeonggi", "safe", 3200, 58], ["Gangwon", "safe", 1100, 40], ["Chungcheong", "warning", 1800, 65], ["Daegu", "safe", 2000, 50], ["Honam", "safe", 1500, 45], ["Busan", "safe", 2800, 48], ["Jeju", "safe", 700, 30]],
  ),
  "24Q4": point(
    { label: "2024 Q4", tick: "24 Q4", isPrediction: false, totalInventory: 17180, riskIndex: 68, riskFactors: [70, 72, 58, 66], utilization: 89.1, stockoutRisk: 7.1, roi: 9.2 },
    [["Seoul", "warning", 2250, 64], ["Gyeonggi", "safe", 3550, 59], ["Gangwon", "safe", 1180, 43], ["Chungcheong", "warning", 1950, 67], ["Daegu", "safe", 2160, 52], ["Honam", "safe", 1690, 48], ["Busan", "warning", 3560, 66], ["Jeju", "safe", 840, 35]],
  ),
  PRES: point(
    { label: "현재 (PRES)", tick: "PRES", isPrediction: false, totalInventory: 20037, riskIndex: 78, riskFactors: [85, 80, 65, 70], utilization: 93.6, stockoutRisk: 8.4, roi: 12.4 },
    [["Seoul", "danger", 4024, 82], ["Gyeonggi", "safe", 3696, 56], ["Gangwon", "safe", 1274, 41], ["Chungcheong", "safe", 2049, 52], ["Daegu", "safe", 2049, 49], ["Honam", "safe", 1707, 44], ["Busan", "safe", 3418, 46], ["Jeju", "safe", 1820, 38]],
  ),
  "25Q1": point(
    { label: "2025 Q1", tick: "25 Q1", isPrediction: true, totalInventory: 18760, riskIndex: 83, riskFactors: [88, 86, 72, 77], utilization: 95.2, stockoutRisk: 10.8, roi: 11.6 },
    [["Seoul", "danger", 3180, 88], ["Gyeonggi", "warning", 3410, 69], ["Gangwon", "safe", 1210, 46], ["Chungcheong", "warning", 1810, 70], ["Daegu", "safe", 1980, 57], ["Honam", "safe", 1580, 51], ["Busan", "warning", 3980, 68], ["Jeju", "safe", 1610, 43]],
  ),
  "25Q2": point(
    { label: "2025 Q2", tick: "25 Q2", isPrediction: true, totalInventory: 16940, riskIndex: 87, riskFactors: [91, 89, 78, 82], utilization: 97.1, stockoutRisk: 13.5, roi: 10.3 },
    [["Seoul", "danger", 2620, 92], ["Gyeonggi", "danger", 2970, 84], ["Gangwon", "warning", 1050, 66], ["Chungcheong", "warning", 1640, 75], ["Daegu", "warning", 1760, 69], ["Honam", "safe", 1460, 58], ["Busan", "warning", 4120, 73], ["Jeju", "safe", 1320, 49]],
  ),
  "26Q1": point(
    { label: "2026 Q1", tick: "26 Q1", isPrediction: true, totalInventory: 14580, riskIndex: 92, riskFactors: [95, 93, 84, 89], utilization: 98.4, stockoutRisk: 17.9, roi: 7.4 },
    [["Seoul", "danger", 1980, 96], ["Gyeonggi", "danger", 2510, 90], ["Gangwon", "warning", 890, 72], ["Chungcheong", "danger", 1330, 86], ["Daegu", "warning", 1510, 78], ["Honam", "warning", 1190, 69], ["Busan", "danger", 4230, 85], ["Jeju", "warning", 940, 65]],
  ),
};

