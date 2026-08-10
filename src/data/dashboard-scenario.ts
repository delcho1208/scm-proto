import rawLipilouScenario from "../../lipilou_dashboard_scenario.json";
import rawLipilouMonthlyScenario from "../../lipilou_dashboard_2027_months.json";
import rawTamivirScenario from "../../tamivir_dashboard_scenario.json";
import type { RiskLevel } from "@/data/scm";

type RawRegion = {
  region: string;
  current_stock: number;
  target_stock: number;
  stock_ratio: number;
  stockRatioLabel?: string;
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
  projectedTotalInventory?: number;
  projectedStatus?: string;
  affectedRegions?: string[];
  projectedRegions?: Record<string, DashboardRegion>;
  projectedTotalInventoryByTimelineKey?: Record<string, number>;
  projectedRegionsByTimelineKey?: Record<string, Record<string, DashboardRegion>>;
  costReduction?: string;
  feasibility?: number;
  executionPeriod?: string;
  supplyImpact?: string;
  xai?: { summary: string; evidence: string[]; limitation: string };
  approvalButtonText: string;
};

export type ProductDashboardScenario = {
  date: string;
  sceneName: string;
  regions: Record<string, DashboardRegion>;
  recommendations: DashboardRecommendation[];
  totalInventory?: number;
  utilization?: number;
  inventoryLevel?: RiskLevel;
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

function toRiskLevel(status: string, stockRatio: number): RiskLevel {
  const normalized = status.toUpperCase();
  // Explicit status from the source takes priority. Some feeds use percent ratios,
  // while Tamivir reports multiples (e.g. 24.1x), so ratio alone is not comparable.
  if (normalized === "DANGER" || status === "위험" || status === "부족")
    return "danger";
  if (status === "과잉") return "warning";
  if (status === "적정") return "safe";
  if (
    normalized === "WARNING" ||
    status === "주의" ||
    stockRatio >= 130
  )
    return "warning";
  if (stockRatio < 100) return "danger";
  return "safe";
}

function normalizeRegions(regions: RawRegion[] = []) {
  return Object.fromEntries(
    regions.map((item) => {
      const id = toRegionId(item.region);
      const riskLevel = toRiskLevel(item.status, item.stock_ratio);
      return [
        id,
        {
          ...item,
          id,
          riskLevel,
          riskText:
            riskLevel === "danger"
              ? "부족"
              : riskLevel === "warning"
                ? "과잉"
                : "적정",
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
      expected_after_transfer?: {
        from_region: {
          region: string;
          stock_after: number;
          stock_ratio_after: number;
          status_after: string;
        };
        to_region: {
          region: string;
          stock_after: number;
          stock_ratio_after: number;
          status_after: string;
        };
      };
    }>;
  }>;
};

export type LipilouMonthlyForecast = {
  month: string;
  regions: Record<string, DashboardRegion>;
  totalInventory: number;
  inventoryLevel: RiskLevel;
};

const lipilouRaw = rawLipilouScenario as LipilouRaw;
const lipilouLatest = [...lipilouRaw.scenarios]
  .filter((scenario) => scenario.map_monitoring?.length)
  .sort((a, b) => b.date.localeCompare(a.date))[0];
const lipilouRegions = normalizeRegions(lipilouLatest?.map_monitoring);
const lipilouTotalTarget = Object.values(lipilouRegions).reduce(
  (sum, region) => sum + region.target_stock,
  0,
);
const lipilouTotalInventory = Object.values(lipilouRegions).reduce(
  (sum, region) => sum + region.current_stock,
  0,
);

const lipilouTimelineKeyByMonth: Record<string, string> = {
  "2026-11": "26M11",
  "2026-12": "26M12",
  "2027-01": "27M01",
};

export const lipilouMonthlyForecastByTimelineKey = Object.fromEntries(
  rawLipilouMonthlyScenario.months.map((item) => {
    const month = item.month;
    const regions = normalizeRegions(item.regions_stock);
    const regionValues = Object.values(regions);
    return [
      lipilouTimelineKeyByMonth[month],
      {
        month,
        regions,
        totalInventory: regionValues.reduce((sum, region) => sum + region.current_stock, 0),
        inventoryLevel: regionValues.some((region) => region.riskLevel === "danger")
          ? "danger"
          : regionValues.some((region) => region.riskLevel === "warning")
            ? "warning"
            : "safe",
      } satisfies LipilouMonthlyForecast,
    ];
  }),
) as Record<string, LipilouMonthlyForecast>;

function getLipilouProjectedRegions(
  expected: NonNullable<NonNullable<LipilouRaw["scenarios"][number]["ai_solutions"]>[number]["expected_after_transfer"]> | undefined,
) {
  if (!expected) return undefined;

  const projected = { ...lipilouRegions };
  for (const item of [expected.from_region, expected.to_region]) {
    const id = toRegionId(item.region);
    const base = projected[id];
    if (!id || !base) continue;
    const riskLevel = toRiskLevel(item.status_after, item.stock_ratio_after);
    projected[id] = {
      ...base,
      current_stock: item.stock_after,
      stock_ratio: item.stock_ratio_after,
      status: item.status_after,
      riskLevel,
      riskText: riskLevel === "danger" ? "부족" : riskLevel === "warning" ? "과잉" : "적정",
    };
  }
  return projected;
}

export const lipilouDashboard: ProductDashboardScenario | null = lipilouLatest
  ? {
      date: lipilouLatest.date,
      sceneName: lipilouLatest.scene_name,
      regions: lipilouRegions,
      totalInventory: lipilouTotalInventory,
      inventoryLevel:
        lipilouTotalInventory < lipilouTotalTarget
          ? "danger"
          : lipilouTotalInventory >= lipilouTotalTarget * 1.3
            ? "warning"
            : "safe",
      externalSignal: {
        title: "2026년 건강검진 대상자 수",
        value: "21,794,755명",
        detail: "20세 이상 인구수의 50%",
      },
      recommendations: [
        {
          id: "SOLUTION-00",
          title: "현행유지",
          description: "A라인 품질 재검사 완료까지 기존 권역별 재고 배분을 유지합니다.",
          costReduction: "추가 비용 없음",
          feasibility: 100,
          executionPeriod: "현행 유지",
          supplyImpact: "제주 목표재고 미달이 지속될 수 있어 비교 기준으로만 사용합니다.",
          xai: {
            summary: "추가 이관이나 생산 조정 없이 현재 계획을 유지하는 비교 기준안입니다.",
            evidence: [
              `전국 현재고 ${lipilouTotalInventory.toLocaleString("ko-KR")} BOX 유지`,
              "ERP·MES·WMS 계획 변경 없음",
              "제주 목표재고 미달 상태 지속",
            ],
            limitation: "품질 재검사 지연과 제주 부족 위험을 해소하지 못합니다.",
          },
          approvalButtonText: "현행 유지",
        },
        ...(lipilouLatest.ai_solutions ?? []).map((solution) => ({
          id: solution.id,
          title: solution.summary ?? solution.title,
          description: solution.xai_explanation ?? solution.reason,
          fromRegion: solution.from_region ? toRegionId(solution.from_region) : undefined,
          toRegion: solution.to_region ? toRegionId(solution.to_region) : undefined,
          transferAmount: solution.transfer_amount,
          costReduction: solution.id === "SOLUTION-01" ? "5~8%" : "3~6%",
          feasibility: solution.id === "SOLUTION-01" ? 96 : 82,
          executionPeriod: solution.id === "SOLUTION-01" ? "2~3일" : "1~2주",
          supplyImpact:
            solution.id === "SOLUTION-01"
              ? "제주에 1,000 BOX를 보충해 목표재고 미달을 해소하고 서울 안전재고는 유지"
              : "B라인 증산으로 A라인 품질 재검사 기간의 공급 공백을 보완",
          xai: {
            summary: solution.xai_explanation ?? solution.reason,
            evidence:
              solution.id === "SOLUTION-01"
                ? [
                    "서울은 이관 후에도 자체 안전재고를 유지할 수 있는 유일한 권역",
                    "제주 부족분 1,000 BOX를 권역 간 재배치만으로 충당",
                    "추가 생산보다 실행 기간과 비용 부담이 낮음",
                  ]
                : [
                    "A라인 품질 재검사로 출하가 7일 지연될 가능성",
                    "B라인 가용 생산능력을 활용해 공급 회복력을 확보",
                    "권역 간 이관만으로 부족이 해소되지 않을 때 적용 가능한 보완안",
                  ],
            limitation:
              solution.id === "SOLUTION-01"
                ? "서울 출고 승인과 제주 운송편 확보가 필요하며, 운송 중 재고는 가용재고에서 제외합니다."
                : "B라인 설비·원료·품질 인력의 실제 가용 여부를 확인한 뒤 생산계획을 확정해야 합니다.",
          },
          projectedTotalInventory: solution.expected_after_transfer
            ? lipilouTotalInventory
            : undefined,
          affectedRegions: solution.expected_after_transfer
            ? [solution.expected_after_transfer.from_region.region, solution.expected_after_transfer.to_region.region].map(toRegionId)
            : undefined,
          projectedRegions: getLipilouProjectedRegions(solution.expected_after_transfer),
          approvalButtonText: solution.approval_action.initial_button_text,
        })),
      ],
    }
  : null;

type TamivirScenario = {
  date: string;
  scene_name: string;
  summary: {
    f2a_target: number;
    ai_target: number;
    current_stock: number;
    ratio: number;
    dead_stock_quantity: number;
    status: string;
    risk_score: number;
  };
  map_monitoring?: Array<{
    region: string;
    f2a_target: number;
    target_stock: number;
    current_stock: number;
    stock_ratio: number;
    status: string;
  }>;
  regions_stock?: Array<{
    region: string;
    f2a_target: number;
    target_stock: number;
    current_stock: number;
    stock_ratio: number;
    status: string;
  }>;
  ai_solutions: Array<{
    id: string;
    title: string;
    description: string;
    transferAmount?: number;
    fromRegion?: string;
    toRegion?: string;
    costReduction?: string;
    feasibility?: number;
    executionPeriod?: string;
    supplyImpact?: string;
    xai: { summary: string; reason: string[]; constraint: string };
    approval_action: { initial_button_text: string };
    after_apply: {
      current_stock: number;
      stock_ratio: number;
      status: string;
      dead_stock_quantity: number;
      map_monitoring: RawRegion[];
      projectedTotalInventoryByMonth?: Record<string, number>;
      monthlyMapMonitoring?: Record<string, RawRegion[]>;
    };
  }>;
  xai_cards: Array<{ title: string; value: string; description: string }>;
};

type TamivirRaw = { project: string; scenarios: TamivirScenario[] };

const tamivirRaw = rawTamivirScenario as TamivirRaw;
const tamivirLatest = [...tamivirRaw.scenarios].sort((a, b) => b.date.localeCompare(a.date))[0];
const tamivirLatestRegions = tamivirLatest.map_monitoring ?? tamivirLatest.regions_stock ?? [];
const tamivirZoneRegions = normalizeRegions(
  tamivirLatestRegions.map((region) => ({
    region: region.region,
    current_stock: region.current_stock,
    target_stock: region.target_stock,
    stock_ratio: region.stock_ratio,
    stockRatioLabel: `${region.stock_ratio.toFixed(1)}배`,
    status: region.status,
  })),
);
const tamivirNationalRisk = tamivirLatest.summary.status === "과잉"
  ? "warning"
  : tamivirLatest.summary.status === "부족" ? "danger" : "safe";
const tamivirRegions: Record<string, DashboardRegion> = {
  National: {
    id: "National",
    region: "National_전국 통합",
    current_stock: tamivirLatest.summary.current_stock,
    target_stock: tamivirLatest.summary.ai_target,
    stock_ratio: tamivirLatest.summary.ratio,
    stockRatioLabel: `${tamivirLatest.summary.ratio.toFixed(1)}배`,
    status: tamivirLatest.summary.status,
    riskLevel: tamivirNationalRisk,
    riskText: tamivirLatest.summary.status,
  },
  ...tamivirZoneRegions,
};

function createTamivirMonthlySnapshot(
  totalInventory: number,
  sourceScenario: TamivirScenario,
): LipilouMonthlyForecast {
  const sourceRegions = sourceScenario.map_monitoring ?? sourceScenario.regions_stock ?? [];
  const sourceTotal = sourceRegions.reduce((sum, region) => sum + region.current_stock, 0) || 1;
  const scale = totalInventory / sourceTotal;
  const zoneRegions = normalizeRegions(
    sourceRegions.map((region) => ({
      region: region.region,
      current_stock: Math.round(region.current_stock * scale),
      target_stock: region.target_stock,
      stock_ratio: (region.current_stock * scale) / Math.max(region.target_stock, 1),
      status: region.status,
    })),
  );
  const nationalRisk: RiskLevel = totalInventory > sourceScenario.summary.ai_target * 3
    ? "warning"
    : totalInventory < sourceScenario.summary.ai_target
      ? "danger"
      : "safe";
  zoneRegions.National = {
    id: "National",
    region: "National_전국 통합",
    current_stock: totalInventory,
    target_stock: sourceScenario.summary.ai_target,
    stock_ratio: totalInventory / Math.max(sourceScenario.summary.ai_target, 1),
    stockRatioLabel: `${(totalInventory / Math.max(sourceScenario.summary.ai_target, 1)).toFixed(1)}배`,
    status: nationalRisk === "warning" ? "과잉" : nationalRisk === "danger" ? "부족" : "적정",
    riskLevel: nationalRisk,
    riskText: nationalRisk === "warning" ? "과잉" : nationalRisk === "danger" ? "부족" : "적정",
  };
  return { month: "", regions: zoneRegions, totalInventory, inventoryLevel: nationalRisk };
}

const normalTamivirScenario = [...tamivirRaw.scenarios].sort((a, b) => a.date.localeCompare(b.date))[0];
const tamivirBaselineTotals: Record<string, number> = {
  "26M08": 1_440_000,
  "26M09": normalTamivirScenario.summary.current_stock,
  PRES: 1_340_000,
  "26M11": tamivirLatest.summary.current_stock,
  "26M12": 1_215_000,
  "27M01": 1_145_000,
};

export const tamivirMonthlyForecastByTimelineKey = Object.fromEntries(
  Object.entries(tamivirBaselineTotals).map(([key, total]) => [
    key,
    {
      ...createTamivirMonthlySnapshot(
        total,
        key === "26M08" || key === "26M09" ? normalTamivirScenario : tamivirLatest,
      ),
      month: ({ "26M08": "2026.08", "26M09": "2026.09", PRES: "2026.10", "26M11": "2026.11", "26M12": "2026.12", "27M01": "2027.01" } as Record<string, string>)[key],
    },
  ]),
) as Record<string, LipilouMonthlyForecast>;
const operationRateText = tamivirLatest.xai_cards.find((card) =>
  card.title.includes("생산 관성"),
)?.value;
const operationRate = Number(operationRateText?.match(/[\d.]+/)?.[0] ?? 97);
const demandXai = tamivirLatest.xai_cards.find((card) => card.title.includes("수요 예측"));

type TamivirForecast = {
  forecast: number;
  currentStock: number;
  yoy: number;
  operationRate: number;
  status: string;
  paths: { actual: string; prediction: string };
};

function createTamivirPaths(actualTrend: number[], forecastTrend: number[]) {
  const actualValues = actualTrend.slice(-3);
  const predictionValues = [actualValues.at(-1) ?? 0, ...forecastTrend.slice(-3)];
  const allValues = [...actualValues, ...predictionValues];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const point = (value: number, x: number) => `${x},${170 - ((value - min) / range) * 130}`;
  return {
    actual: actualValues.map((value, index) => `${index ? "L" : "M"}${point(value, index * 80)}`).join(" "),
    prediction: predictionValues.map((value, index) => `${index ? "L" : "M"}${point(value, 160 + index * 80)}`).join(" "),
  };
}

const tamivirForecastEntries = tamivirLatestRegions.map((region) => {
  const id = toRegionId(region.region);
  const forecastCard = (region as typeof region & {
    forecast_card?: { forecast: number; current_stock: number; yoy: number; actual_trend: number[]; forecast_trend: number[]; status: string; operation_rate: number };
  }).forecast_card;
  if (!forecastCard) return null;
  return [id, {
    forecast: forecastCard.forecast,
    currentStock: forecastCard.current_stock,
    yoy: forecastCard.yoy,
    operationRate: forecastCard.operation_rate,
    status: forecastCard.status,
    paths: createTamivirPaths(forecastCard.actual_trend, forecastCard.forecast_trend),
  } satisfies TamivirForecast] as const;
}).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

const nationalActualTrend = [0, 1, 2].map((index) => tamivirLatestRegions.reduce((sum, region) => {
  const card = (region as typeof region & { forecast_card?: { actual_trend: number[] } }).forecast_card;
  return sum + (card?.actual_trend[index] ?? 0);
}, 0));
const nationalForecastTrend = [0, 1, 2].map((index) => tamivirLatestRegions.reduce((sum, region) => {
  const card = (region as typeof region & { forecast_card?: { forecast_trend: number[] } }).forecast_card;
  return sum + (card?.forecast_trend[index] ?? 0);
}, 0));

export const tamivirForecastByRegion: Record<string, TamivirForecast> = {
  National: {
    forecast: tamivirLatest.summary.ai_target,
    currentStock: tamivirLatest.summary.current_stock,
    yoy: ((tamivirLatest.summary.ai_target / normalTamivirScenario.summary.ai_target) - 1) * 100,
    operationRate,
    status: tamivirLatest.summary.status,
    paths: createTamivirPaths(nationalActualTrend, nationalForecastTrend),
  },
  ...Object.fromEntries(tamivirForecastEntries),
};

export const tamivirAnnualF2aTarget = tamivirLatest.summary.f2a_target;

export const tamivirDashboard: ProductDashboardScenario = {
  date: tamivirLatest.date,
  sceneName: tamivirLatest.scene_name,
  regions: tamivirRegions,
  totalInventory: tamivirLatest.summary.current_stock,
  utilization: operationRate,
  inventoryLevel: tamivirNationalRisk,
  externalSignal: {
    title: "인플루엔자 수요 급감 예측",
    value: `현재 ${tamivirLatest.summary.current_stock.toLocaleString()}EA · AI 목표 ${tamivirLatest.summary.ai_target.toLocaleString()}EA`,
    detail: demandXai?.description ?? `전국 재고가 AI 목표의 ${tamivirLatest.summary.ratio.toFixed(1)}배로 예측되었습니다.`,
  },
  recommendations: [
    {
      id: "TAMIVIR-S1-STATUS-QUO",
      title: "현행 발주·생산계획 유지",
      description: `추가 조치 없이 현재 재고 ${tamivirLatest.summary.current_stock.toLocaleString()}EA와 기존 생산계획을 유지합니다.`,
      transferAmount: 0,
      costReduction: "절감 없음",
      feasibility: 100,
      executionPeriod: "현행 유지",
      supplyImpact: `과잉재고 ${tamivirLatest.summary.dead_stock_quantity.toLocaleString()}EA 지속`,
      xai: {
        summary: "비교 기준 시나리오로, 수요 급감에도 발주·생산계획을 변경하지 않습니다.",
        evidence: [
          `현재 재고 ${tamivirLatest.summary.current_stock.toLocaleString()}EA`,
          `AI 목표 ${tamivirLatest.summary.ai_target.toLocaleString()}EA`,
          `재고 비율 ${tamivirLatest.summary.ratio.toFixed(1)}배`,
        ],
        limitation: "과잉재고와 장기체화 위험이 해소되지 않습니다.",
      },
      projectedTotalInventory: tamivirLatest.summary.current_stock,
      projectedStatus: tamivirLatest.summary.status,
      affectedRegions: tamivirLatestRegions.map((region) => toRegionId(region.region)),
      projectedRegions: normalizeRegions(tamivirLatestRegions),
      approvalButtonText: "현행유지 비교",
    },
    ...tamivirLatest.ai_solutions.map((recommendation, index) => ({
      id: index === 0 ? "TAMIVIR-S2-PINPOINT-REDUCTION" : "TAMIVIR-S3-CDC-TRANSFER",
      title: index === 0 ? "신규 발주 보류·핀셋 감축" : "경기/인천·영남권 잉여재고 CDC 이송",
      description: `${recommendation.description}${recommendation.supplyImpact ? ` · 공급 영향: ${recommendation.supplyImpact}` : ""}`,
      transferAmount: recommendation.transferAmount,
      costReduction: recommendation.costReduction,
      feasibility: recommendation.feasibility,
      executionPeriod: recommendation.executionPeriod,
      supplyImpact: recommendation.supplyImpact,
      xai: {
        summary: recommendation.xai.summary,
        evidence: recommendation.xai.reason,
        limitation: recommendation.xai.constraint,
      },
      projectedTotalInventory: recommendation.after_apply.current_stock,
      projectedStatus: recommendation.after_apply.status,
      affectedRegions: recommendation.after_apply.map_monitoring.map((region) => toRegionId(region.region)),
      projectedRegions: normalizeRegions(recommendation.after_apply.map_monitoring),
      projectedTotalInventoryByTimelineKey: Object.fromEntries(
        Object.entries(recommendation.after_apply.projectedTotalInventoryByMonth ?? {}).map(
          ([month, value]) => [
            ({ "2026.08": "26M08", "2026.09": "26M09", "2026.10": "PRES", "2026.11": "26M11", "2026.12": "26M12", "2027.01": "27M01" } as Record<string, string>)[month] ?? month,
            value,
          ],
        ),
      ),
      projectedRegionsByTimelineKey: Object.fromEntries(
        Object.entries(recommendation.after_apply.monthlyMapMonitoring ?? {}).map(
          ([month, monthlyRegions]) => [
            ({ "2026.08": "26M08", "2026.09": "26M09", "2026.10": "PRES", "2026.11": "26M11", "2026.12": "26M12", "2027.01": "27M01" } as Record<string, string>)[month] ?? month,
            normalizeRegions(monthlyRegions),
          ],
        ),
      ),
      approvalButtonText: recommendation.approval_action.initial_button_text,
    })),
  ],
};
