import rawDashboardScenario from "../../dashboard_scenario.json";
import type { RiskLevel } from "@/data/scm";

type ScenarioRegion = {
  region: string;
  current_stock: number;
  target_stock: number;
  stock_ratio: number;
  status: string;
  map_color?: string;
};

type Recommendation = {
  title: string;
  transfer_amount: number;
  from_region: string;
  to_region: string;
  xai_explanation: string;
  approval_action: {
    initial_button_text: string;
    approved_button_text: string;
  };
};

type DashboardScenario = {
  date: string;
  scene_name: string;
  map_monitoring?: ScenarioRegion[];
  ai_recommendation_card?: Recommendation;
};

const regionIdByZone: Record<string, string> = {
  Zone1: "Seoul",
  Zone2: "Gyeonggi",
  Zone3: "Gangwon",
  Zone4: "Chungcheong",
  Zone5: "Honam",
  Zone6: "Daegu",
  Zone7: "Busan",
  Zone8: "Jeju",
};

function toRiskLevel(status: string): RiskLevel {
  const normalized = status.toUpperCase();
  if (normalized === "DANGER" || status === "위험") return "danger";
  if (normalized === "WARNING" || status === "주의") return "warning";
  return "safe";
}

export type LipilouRegionData = ScenarioRegion & {
  id: string;
  riskLevel: RiskLevel;
  riskText: string;
};

const scenarios = rawDashboardScenario.scenarios as DashboardScenario[];
const latestScenario = [...scenarios]
  .filter((scenario) => scenario.map_monitoring?.length)
  .sort((a, b) => b.date.localeCompare(a.date))[0];

export const lipilouDashboard = latestScenario
  ? {
      date: latestScenario.date,
      sceneName: latestScenario.scene_name,
      recommendation: latestScenario.ai_recommendation_card,
      regions: Object.fromEntries(
        (latestScenario.map_monitoring ?? []).map((item) => {
          const zone = item.region.split("_")[0];
          const id = regionIdByZone[zone];
          const riskLevel = toRiskLevel(item.status);
          return [
            id,
            {
              ...item,
              id,
              riskLevel,
              riskText:
                riskLevel === "danger"
                  ? "위험 (Danger)"
                  : riskLevel === "warning"
                    ? "주의 (Warning)"
                    : "안전 (Safe)",
            } satisfies LipilouRegionData,
          ];
        }),
      ) as Record<string, LipilouRegionData>,
    }
  : null;
