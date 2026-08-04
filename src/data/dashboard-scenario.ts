import rawLipilouScenario from "../../lipilou_dashboard_scenario.json";
import rawTamivirScenario from "../../tamivir_dashboard_scenario.json";
import type { RiskLevel } from "@/data/scm";

type RawRegion = {
  region: string;
  current_stock: number;
  target_stock: number;
  stock_ratio: number;
  status: string;
};

export type DashboardRegion = RawRegion & {
  id: string;
  riskLevel: RiskLevel;
  riskText: string;
};

export type DashboardRecommendation = {
  id: string;
  title: string;
  description: string;
  fromRegion?: string;
  toRegion?: string;
  transferAmount?: number;
  approvalButtonText: string;
};

export type ProductDashboardScenario = {
  date: string;
  sceneName: string;
  regions: Record<string, DashboardRegion>;
  recommendations: DashboardRecommendation[];
  totalInventory?: number;
  utilization?: number;
  riskScore?: number;
  externalSignal?: {
    title: string;
    value: string;
    detail: string;
  };
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

function toRegionId(regionName: string) {
  return regionIdByZone[regionName.split("_")[0]];
}

function toRiskLevel(status: string): RiskLevel {
  const normalized = status.toUpperCase();
  if (normalized === "DANGER" || status === "위험") return "danger";
  if (normalized === "WARNING" || status === "주의") return "warning";
  return "safe";
}

function normalizeRegions(regions: RawRegion[] = []) {
  return Object.fromEntries(
    regions.map((item) => {
      const id = toRegionId(item.region);
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
        } satisfies DashboardRegion,
      ];
    }),
  ) as Record<string, DashboardRegion>;
}

type LipilouRaw = {
  scenarios: Array<{
    date: string;
    scene_name: string;
    map_monitoring?: RawRegion[];
    ai_solutions?: Array<{
      id: string;
      title: string;
      summary?: string;
      reason: string;
      xai_explanation?: string;
      transfer_amount?: number;
      from_region?: string;
      to_region?: string;
      approval_action: { initial_button_text: string };
    }>;
  }>;
};

const lipilouRaw = rawLipilouScenario as LipilouRaw;
const lipilouLatest = [...lipilouRaw.scenarios]
  .filter((scenario) => scenario.map_monitoring?.length)
  .sort((a, b) => b.date.localeCompare(a.date))[0];
const lipilouRegions = normalizeRegions(lipilouLatest?.map_monitoring);

export const lipilouDashboard: ProductDashboardScenario | null = lipilouLatest
  ? {
      date: lipilouLatest.date,
      sceneName: lipilouLatest.scene_name,
      regions: lipilouRegions,
      totalInventory: Object.values(lipilouRegions).reduce(
        (sum, region) => sum + region.current_stock,
        0,
      ),
      recommendations: (lipilouLatest.ai_solutions ?? []).map((solution) => ({
        id: solution.id,
        title: solution.summary ?? solution.title,
        description: solution.xai_explanation ?? solution.reason,
        fromRegion: solution.from_region ? toRegionId(solution.from_region) : undefined,
        toRegion: solution.to_region ? toRegionId(solution.to_region) : undefined,
        transferAmount: solution.transfer_amount,
        approvalButtonText: solution.approval_action.initial_button_text,
      })),
    }
  : null;

type TamivirRaw = {
  scenarios: Array<{
    phase: string;
    dashboard_card?: { operation_rate: number; current_stock: number };
    external_event?: { event: string; policy: string };
    prediction?: { ai_target_stock: number; prediction_result: string };
    decision?: { current_stock: number; risk_score: number };
    recommendation?: { title: string; main_action: string; sub_actions: string[] };
    xai_cards?: Array<{ title: string; description: string }>;
    approval?: { button_text: string };
  }>;
};

const tamivirRaw = rawTamivirScenario as TamivirRaw;
const tamivirOperation = tamivirRaw.scenarios.find((scenario) => scenario.dashboard_card);
const tamivirEvent = tamivirRaw.scenarios.find((scenario) => scenario.external_event);
const tamivirDecision = tamivirRaw.scenarios.find((scenario) => scenario.decision);
const tamivirApproval = tamivirRaw.scenarios.find((scenario) => scenario.recommendation);

export const tamivirDashboard: ProductDashboardScenario = {
  date: "현재",
  sceneName: "외부 충격 기반 AI 생산 감축 의사결정",
  regions: {},
  totalInventory:
    tamivirDecision?.decision?.current_stock ?? tamivirOperation?.dashboard_card?.current_stock,
  utilization: tamivirOperation?.dashboard_card?.operation_rate,
  riskScore: tamivirDecision?.decision?.risk_score,
  externalSignal: tamivirEvent?.external_event
    ? {
        title: tamivirEvent.external_event.event,
        value: tamivirEvent.prediction
          ? `${tamivirEvent.prediction.prediction_result} · 목표 ${tamivirEvent.prediction.ai_target_stock.toLocaleString()}EA`
          : "외부 충격 감지",
        detail: tamivirEvent.external_event.policy,
      }
    : undefined,
  recommendations: tamivirApproval?.recommendation
    ? [
        {
          id: "TAMIVIR-PRODUCTION-REDUCTION",
          title: tamivirApproval.recommendation.main_action,
          description: [
            ...(tamivirApproval.recommendation.sub_actions ?? []),
            tamivirApproval.xai_cards?.[1]?.description,
          ]
            .filter(Boolean)
            .join(" · "),
          approvalButtonText: tamivirApproval.approval?.button_text ?? "생산 감축 승인",
        },
      ]
    : [],
};

