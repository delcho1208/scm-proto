import { useEffect, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Icon } from "@/components/ScmShell";

import type { Product } from "@/data/scm";
import {
  lipilouDashboard,
  tamivirAnnualF2aTarget,
  tamivirDashboard,
  type DashboardRegion,
  type ProductDashboardScenario,
} from "@/data/dashboard-scenario";
import { lipilouWorkflowSteps } from "@/data/lipilou-ai-workflow";
import { getTamivirWorkflowRunState } from "@/data/tamivir-ai-workflow";
import { cefazolinDashboard as cefazolinDashboardSource } from "@/data/cefazolin-dashboard";
import {
  cefazolinDecisionEvidence as cefazolinDecisionEvidenceSource,
  cefazolinDetectionContext as cefazolinDetectionContextSource,
  cefazolinScenarioComparison as cefazolinScenarioComparisonSource,
  cefazolinScenarioRecommendation as cefazolinScenarioRecommendationSource,
  cefazolinVirtualExecutionActions as cefazolinVirtualExecutionActionsSource,
  cefazolinWorkflowEffect as cefazolinWorkflowEffectSource,
  cefazolinWorkflowRunMeta as cefazolinWorkflowRunMetaSource,
  cefazolinWorkflowSteps as cefazolinWorkflowStepsSource,
} from "@/data/cefazolin-ai-workflow";
import {
  createWorkflowRunState,
  type ExecutionStatus,
  type HitlStatus,
} from "@/services/scm-workflow-orchestrator";

type TabKey = "impact" | "response" | "approval" | "execution";
type ChecklistKey = "cost" | "supplier" | "quality" | "transfer";

const tabItems: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "impact", label: "탐지·영향", icon: "radar" },
  { key: "response", label: "대응안 검토", icon: "compare_arrows" },
  { key: "approval", label: "승인", icon: "verified_user" },
  { key: "execution", label: "실행·성과", icon: "play_circle" },
];

const initialChecklist: Record<ChecklistKey, boolean> = {
  cost: false,
  supplier: false,
  quality: false,
  transfer: false,
};

type ProductExecutionState = {
  productId: string;
  hitlStatus: HitlStatus;
  executionStatus: ExecutionStatus;
  reviewer: string;
  reviewerRole: string;
  reviewNote: string;
  checklist: Record<ChecklistKey, boolean>;
  lastUpdatedAt: string;
};

function executionStateStorageKey(productKey: string) {
  return `scm.execution.${productKey}`;
}

function loadProductExecutionState(productKey: string, latestSnapshotDate: string): ProductExecutionState {
  const fallback: ProductExecutionState = {
    productId: productKey,
    hitlStatus: "pending",
    executionStatus: "locked",
    reviewer: "",
    reviewerRole: "SCM 운영",
    reviewNote: "",
    checklist: { ...initialChecklist },
    lastUpdatedAt: latestSnapshotDate,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(executionStateStorageKey(productKey));
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<ProductExecutionState>;
    if (parsed.productId && parsed.productId !== productKey) return fallback;
    return {
      ...fallback,
      ...parsed,
      productId: productKey,
      checklist: { ...fallback.checklist, ...(parsed.checklist ?? {}) },
    };
  } catch {
    return fallback;
  }
}

function fmt(value: number, digits = 0) {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtKrw(value: number) {
  if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억 원`;
  return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만 원`;
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "danger" | "warning" | "success" | "primary";
}) {
  const styles = {
    neutral: "border-outline-variant bg-surface-container-low text-on-surface-variant",
    danger: "border-error/20 bg-error-container/40 text-error",
    warning: "border-[#ffd591] bg-[#fff7e6] text-[#ad6800]",
    success: "border-green-200 bg-green-50 text-green-700",
    primary: "border-scm-primary/20 bg-primary-container/40 text-scm-primary",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${styles}`}
    >
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  note,
  icon,
  tone = "primary",
  dense = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
  tone?: "primary" | "danger" | "warning" | "success";
  dense?: boolean;
}) {
  const iconStyle = {
    primary: "bg-primary-container/40 text-scm-primary",
    danger: "bg-error-container/40 text-error",
    warning: "bg-[#fff7e6] text-[#ad6800]",
    success: "bg-green-50 text-green-700",
  }[tone];
  return (
    <div
      className={`bento-card flex flex-col justify-between ${dense ? "min-h-0 px-3 py-2" : "min-h-[118px] p-md"}`}
    >
      <div className="flex items-center justify-between gap-sm">
        <span className="text-[11px] font-bold text-on-surface-variant">{label}</span>
        <span
          className={`flex items-center justify-center rounded-lg ${dense ? "h-6 w-6" : "h-8 w-8"} ${iconStyle}`}
        >
          <Icon name={icon} className={dense ? "text-[15px]" : "text-[18px]"} />
        </span>
      </div>
      <div>
        <p
          className={`font-data font-bold leading-tight text-on-surface ${dense ? "text-[19px]" : "text-[24px]"}`}
        >
          {value}
        </p>
        <p className="mt-0.5 text-[10px] leading-4 text-on-surface-variant">{note}</p>
      </div>
    </div>
  );
}


function SignalBar({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: "primary" | "danger" | "warning" | "success" | "muted";
}) {
  const width = Math.max(0, Math.min(value, 100));
  const barStyle = {
    primary: "bg-scm-primary",
    danger: "bg-error",
    warning: "bg-[#f59e0b]",
    success: "bg-green-500",
    muted: "bg-slate-500",
  }[tone];
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
      <div className={`h-full rounded-full ${barStyle}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  action,
  className = "",
  bodyClassName = "p-md",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`bento-card overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-md border-b border-outline-variant/60 px-md py-sm">
        <div>
          <h3 className="font-display text-[15px] font-bold text-on-surface">{title}</h3>
          {subtitle ? <p className="mt-1 text-[10px] text-on-surface-variant">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}


function actionSystem(actionType: string) {
  if (actionType.includes("배분")) return "ERP";
  if (actionType.includes("발주")) return "ERP";
  if (actionType.includes("생산")) return "MES";
  return "WMS";
}

function actionUnit(unit: string) {
  if (unit === "BOX") return "BOX";
  if (unit === "완제품 환산단위") return "VIAL 환산";
  if (unit === "API 환산단위") return "API 환산";
  return "PLAN";
}

function ProductNotConnected({ product }: { product: Product }) {
  return (
    <div className="dashboard-fixed-layout flex-1 bg-surface px-lg pb-16 pt-16">
      <div className="py-lg">
        <h2 className="font-display text-headline-md text-on-surface">의사결정 실행</h2>
        <p className="mt-xs text-sm text-on-surface-variant">{product.name} 의사결정 상태</p>
      </div>
      <div className="bento-card flex min-h-[260px] items-center justify-center p-xl text-center">
        <div>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high text-on-surface-variant">
            <Icon name="link_off" />
          </span>
          <h3 className="mt-md font-display text-lg font-bold text-on-surface">
            의사결정 상세 미연결
          </h3>
          <p className="mt-xs text-sm text-on-surface-variant">
            선택한 제품의 상세 실행 데이터가 아직 연결되지 않았습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function scenarioShortTitle(productKey: Product["key"], index: number, fallback: string) {
  const titles: Partial<Record<Product["key"], string[]>> = {
    리피로우: ["재고 이관", "타 생산라인 물량 추가"],
    타미비어: ["신규 발주 보류", "잉여재고 CDC 이송"],
  };
  return titles[productKey]?.[index] ?? fallback;
}

function ProductDecisionExecution({
  product,
  dashboard,
}: {
  product: Product;
  dashboard: ProductDashboardScenario;
}) {
  const isTamivir = product.key === "타미비어";
  const [tab, setTab] = useState<TabKey>(isTamivir ? "impact" : "response");
  const selectedId = dashboard.recommendations[0]?.id ?? "";
  const [reviewer, setReviewer] = useState("");
  const [reviewerRole, setReviewerRole] = useState("SCM 운영");
  const [reviewNote, setReviewNote] = useState("");
  const [checks, setChecks] = useState({
    cost: false,
    supplier: false,
    quality: false,
    transfer: false,
  });
  const [approved, setApproved] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);

  const regions = Object.values(dashboard.regions);
  const shortageRegions = regions.filter((region) => region.riskLevel === "danger");
  const excessRegions = regions.filter((region) => region.riskLevel === "warning");
  const totalTarget = regions.reduce((sum, region) => sum + region.target_stock, 0);
  const coverage = ((dashboard.totalInventory ?? 0) / Math.max(totalTarget, 1)) * 100;
  const selected =
    dashboard.recommendations.find((recommendation) => recommendation.id === selectedId) ??
    dashboard.recommendations[0];
  const selectedScenarioIndex = Math.max(
    dashboard.recommendations.findIndex((recommendation) => recommendation.id === selected?.id),
    0,
  );
  const selectedScenarioLabel = `S${selectedScenarioIndex + 1}`;
  const selectedScenarioDisplay = selected
    ? `${selectedScenarioLabel} ${scenarioShortTitle(product.key, selectedScenarioIndex, selected.title)}`
    : "선택 필요";
  const projectedInventory = selected?.projectedTotalInventory ?? dashboard.totalInventory ?? 0;
  const projectedRegions = selected?.projectedRegions ?? dashboard.regions;
  const approvalReady = reviewer.trim().length > 0 && Object.values(checks).every(Boolean);
  const holdReady = reviewer.trim().length > 0 && reviewNote.trim().length > 0;
  const unit = product.key === "타미비어" ? "EA" : "BOX";
  const workflowSteps =
    product.key === "리피로우"
      ? lipilouWorkflowSteps
      : [
          ["database", "수요·재고 데이터 수집", `${dashboard.date} 전국 8개 권역 데이터`],
          [
            "trending_down",
            "수요 급감 신호 탐지",
            dashboard.externalSignal?.value ?? "수요 신호 분석",
          ],
          ["inventory_2", "과잉재고 위험 계산", `과잉 권역 ${excessRegions.length}곳`],
          ["science", "대응 시나리오 생성", `${dashboard.recommendations.length}개 실행안 생성`],
          ["psychology", "XAI 근거 검증", selected?.xai?.summary ?? "추천 근거 확인"],
          ["verified_user", "담당자 승인", approved ? "승인 완료" : "승인 대기"],
          ["play_circle", "가상 실행", executed ? "실행 완료" : "실행 대기"],
          ["monitoring", "성과 모니터링", `예상 재고 ${fmt(projectedInventory)} ${unit}`],
        ].map(([icon, title, evidence], index) => ({
          id: `TAMIVIR-FLOW-${index + 1}`,
          order: index + 1,
          icon,
          title,
          evidence: [evidence],
          status:
            index < 5
              ? "완료"
              : index === 5 && approved
                ? "완료"
                : index === 6 && executed
                  ? "완료"
                  : "대기",
        }));

  return (
    <div
      className={`dashboard-fixed-layout flex-1 bg-surface px-lg pt-16 ${
        isTamivir && (tab === "impact" || tab === "response")
          ? "flex min-h-[912px] flex-col pb-12"
          : "pb-16"
      }`}
    >
      <header className="flex items-end justify-between gap-lg py-lg">
        <div>
          <div className="mb-xs flex items-center gap-2">
            <Pill
              tone={
                shortageRegions.length ? "danger" : excessRegions.length ? "warning" : "success"
              }
            >
              {shortageRegions.length ? "HIGH" : excessRegions.length ? "WATCH" : "NORMAL"}
            </Pill>
            <Pill tone={executed || approved ? "success" : "primary"}>
              {executed ? "실행 완료" : approved ? "승인 완료" : "권고안 검토"}
            </Pill>
            <span className="font-data text-[10px] text-on-surface-variant">
              {product.key === "리피로우" ? "LIPI" : "TAMI"}-DECISION-
              {dashboard.date.replaceAll("-", "")}
            </span>
            {isTamivir ? (
              <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-[9px] font-bold text-on-surface-variant">
                SANDBOX · SYNTHETIC DATA
              </span>
            ) : null}
          </div>
          <h2 className="font-display text-headline-md text-on-surface">
            {product.name} 의사결정 실행
          </h2>
          <p className="mt-xs text-sm text-on-surface-variant">
            {isTamivir ? "수요 이상 탐지 · Case 영향 분석" : dashboard.sceneName} · 데이터 기준{" "}
            {dashboard.date}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowWorkflow(true)}
          className="flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-md py-sm text-xs font-bold text-on-surface shadow-sm hover:border-scm-primary/40"
        >
          <Icon name="account_tree" className="text-[18px] text-scm-primary" />
          10단계 상세
          <Pill tone="primary">
            {workflowSteps.filter((step) => step.status === "완료").length}/{workflowSteps.length}
          </Pill>
        </button>
      </header>

      <nav
        className={`${isTamivir ? "mb-sm p-1" : "mb-md p-1.5"} flex shrink-0 items-center rounded-xl border border-outline-variant bg-white shadow-sm`}
      >
        {tabItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-md py-2.5 text-xs font-bold transition ${tab === item.key ? "bg-scm-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-low"}`}
          >
            <Icon name={item.icon} className="text-[17px]" />
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "impact" ? (
        <div className={isTamivir ? "flex flex-col gap-md" : "space-y-md"}>
          {isTamivir ? (
            <Section
              title="Case 탐지 요약"
              subtitle="수요 급감 신호와 권역별 재고 과잉을 결합해 의사결정 Case로 전환"
              action={<Pill tone={excessRegions.length ? "warning" : "success"}>{excessRegions.length ? "재고 과잉" : "정상"}</Pill>}
              bodyClassName="p-sm"
            >
              <div className="grid grid-cols-4 gap-sm text-[11px]">
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-on-surface-variant">Case ID</p>
                  <p className="mt-1 font-data font-bold">TAMI-DEMAND-{dashboard.date.replaceAll("-", "")}</p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-on-surface-variant">직접 수요 신호</p>
                  <p className="mt-1 font-bold">인플루엔자 수요 급감 예측</p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-on-surface-variant">영향 범위</p>
                  <p className="mt-1 font-bold">과잉 권역 {excessRegions.length}개</p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-on-surface-variant">분석 상태</p>
                  <p className="mt-1 font-bold text-scm-primary">조치안 검토 가능</p>
                </div>
              </div>
            </Section>
          ) : null}
          <div className="grid grid-cols-6 gap-sm">
            <Metric
              label="현재고"
              value={`${fmt(dashboard.totalInventory ?? 0)} ${unit}`}
              note={`목표 ${fmt(totalTarget)} ${unit}`}
              icon="inventory_2"
              tone={coverage < 100 ? "danger" : "success"}
            />
            <Metric
              label="목표재고 충족률"
              value={`${coverage.toFixed(1)}%`}
              note={`부족권역 ${shortageRegions.length}개`}
              icon="monitoring"
              tone={coverage < 100 ? "danger" : "success"}
            />
            <Metric
              label="부족 권역"
              value={`${shortageRegions.length}개`}
              note={shortageRegions.map((region) => region.region).join(" · ") || "없음"}
              icon="event_busy"
              tone={shortageRegions.length ? "danger" : "success"}
            />
            <Metric
              label={product.key === "타미비어" ? "연간 F2A 목표" : "분석 권역"}
              value={
                product.key === "타미비어"
                  ? `${fmt(tamivirAnnualF2aTarget)} ${unit}`
                  : `${regions.length}개`
              }
              note="제공 데이터 기준"
              icon="query_stats"
            />
            <Metric
              label="과잉 권역"
              value={`${excessRegions.length}개`}
              note={excessRegions.map((region) => region.region).join(" · ") || "없음"}
              icon="local_shipping"
              tone={excessRegions.length ? "warning" : "success"}
            />
            <Metric
              label="AI 실행안"
              value={`${dashboard.recommendations.length}건`}
              note="비교·승인 대상"
              icon="auto_awesome"
            />
          </div>
          <div className="grid grid-cols-12 gap-md">
            <div className="col-span-8">
              <Section title="권역 재고 영향" subtitle={`${unit} 현재고 · 목표재고 · 충족률 기준`}>
                <div className="overflow-hidden rounded-xl border border-outline-variant">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-surface-container-low text-[10px] uppercase text-on-surface-variant">
                      <tr>
                        <th className="px-sm py-xs">권역</th>
                        <th className="px-sm py-xs text-right">현재고</th>
                        <th className="px-sm py-xs text-right">목표재고</th>
                        <th className="px-sm py-xs text-right">충족률</th>
                        <th className="px-sm py-xs">판정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regions.map((region) => (
                        <tr key={region.id} className="border-t border-outline-variant/40">
                          <td className="px-sm py-xs font-bold">{region.region}</td>
                          <td className="px-sm py-xs text-right font-data">
                            {fmt(region.current_stock)} {unit}
                          </td>
                          <td className="px-sm py-xs text-right font-data">
                            {fmt(region.target_stock)} {unit}
                          </td>
                          <td className="px-sm py-xs text-right font-data font-bold">
                            {region.stock_ratio.toFixed(1)}%
                          </td>
                          <td className="px-sm py-xs">
                            <Pill
                              tone={
                                region.riskLevel === "danger"
                                  ? "danger"
                                  : region.riskLevel === "warning"
                                    ? "warning"
                                    : "success"
                              }
                            >
                              {region.riskText}
                            </Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
            <div className="col-span-4 space-y-md">
              <Section title="핵심 병목">
                <div className="space-y-xs">
                  {[
                    ["inventory", "재고", `목표재고 충족률 ${coverage.toFixed(1)}%`],
                    [
                      "monitoring",
                      "수요 신호",
                      dashboard.externalSignal?.value ?? dashboard.sceneName,
                    ],
                    [
                      "warning",
                      "위험 권역",
                      `부족 ${shortageRegions.length} · 과잉 ${excessRegions.length}`,
                    ],
                    ["recommend", "추천", `${dashboard.recommendations.length}개 실행안 비교`],
                  ].map(([icon, label, value]) => (
                    <div
                      key={label}
                      className="flex items-center gap-sm rounded-xl border border-outline-variant p-sm"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container/40 text-scm-primary">
                        <Icon name={icon} className="text-[17px]" />
                      </span>
                      <div>
                        <p className="text-[10px] font-bold text-on-surface-variant">{label}</p>
                        <p className="mt-0.5 text-xs font-bold">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="의사결정 상태">
                <div className="grid grid-cols-2 gap-xs text-center">
                  <div className="rounded-lg bg-surface-container-low p-sm">
                    <p className="text-[10px] text-on-surface-variant">현재 단계</p>
                    <p className="mt-1 text-xs font-bold">{approved ? "승인" : "검토"}</p>
                  </div>
                  <div className="rounded-lg bg-surface-container-low p-sm">
                    <p className="text-[10px] text-on-surface-variant">선택안</p>
                    <p className="mt-1 truncate text-xs font-bold text-scm-primary">
                      {selectedScenarioDisplay}
                    </p>
                  </div>
                </div>
              </Section>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "response" ? (
        <div className="space-y-md">
          <div className="grid grid-cols-5 gap-sm">
            <Metric
              label="선택 실행안"
              value={selectedScenarioDisplay}
              note="AI 추천 비교"
              icon="recommend"
              tone="success"
            />
            <Metric
              label="예상 총재고"
              value={`${fmt(projectedInventory)} ${unit}`}
              note={`현재 ${fmt(dashboard.totalInventory ?? 0)} ${unit}`}
              icon="trending_up"
              tone="success"
            />
            <Metric
              label="영향 권역"
              value={`${selected?.affectedRegions?.length ?? 0}개`}
              note={
                selected?.fromRegion ? `${selected.fromRegion} → ${selected.toRegion}` : "전국 계획"
              }
              icon="map"
            />
            <Metric
              label="실행 가능성"
              value={selected?.feasibility ? `${selected.feasibility}%` : "검토"}
              note={selected?.executionPeriod ?? "일정 확인"}
              icon="verified"
              tone="success"
            />
            <Metric
              label="비용 효과"
              value={selected?.costReduction ?? "검토"}
              note="제공 데이터 기준"
              icon="payments"
              tone="warning"
            />
          </div>
          <Section
            title={`${dashboard.recommendations.map((_, index) => `S${index + 1}`).join("·")} 대응안 비교`}
            subtitle="재고 영향 · 실행기간 · 실행가능성 · 비용 · 제약조건"
          >
            <div className="grid grid-cols-3 gap-sm">
              {dashboard.recommendations.map((recommendation, index) => (
                <div
                  key={recommendation.id}
                  className={`rounded-xl border p-md text-left ${index === 0 ? "border-scm-primary bg-primary-container/20 shadow-sm" : "border-outline-variant bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                        AI 대응안
                      </p>
                      <h4 className="mt-1 font-display text-base font-bold text-on-surface">
                        S{index + 1} {scenarioShortTitle(product.key, index, recommendation.title)}
                      </h4>
                    </div>
                    <Pill tone={index === 0 ? "success" : "neutral"}>
                      {index === 0 ? "추천" : "검토"}
                    </Pill>
                  </div>
                  <dl className="mt-md grid grid-cols-2 gap-xs text-[11px]">
                    <div className="rounded-lg bg-surface-container-low p-xs">
                      <dt className="text-on-surface-variant">예상 재고</dt>
                      <dd className="mt-1 font-data font-bold">
                        {fmt(
                          recommendation.projectedTotalInventory ?? dashboard.totalInventory ?? 0,
                        )}{" "}
                        {unit}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-surface-container-low p-xs">
                      <dt className="text-on-surface-variant">영향 권역</dt>
                      <dd className="mt-1 font-data font-bold">
                        {recommendation.affectedRegions?.length ?? 0}개
                      </dd>
                    </div>
                    <div className="rounded-lg bg-surface-container-low p-xs">
                      <dt className="text-on-surface-variant">실행기간</dt>
                      <dd className="mt-1 font-data font-bold">
                        {recommendation.executionPeriod ?? "확인 필요"}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-surface-container-low p-xs">
                      <dt className="text-on-surface-variant">실행가능성</dt>
                      <dd className="mt-1 font-data font-bold">
                        {recommendation.feasibility
                          ? `${recommendation.feasibility}%`
                          : "확인 필요"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-sm border-t border-outline-variant/50 pt-sm">
                    <span className="text-[10px] text-on-surface-variant">비용 효과</span>
                    <strong className="ml-2 font-data text-xs">
                      {recommendation.costReduction ?? "확인 필요"}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </Section>
          <Section title="시스템 실행지시" subtitle="선택 추천안에서 생성되는 시스템별 작업">
            <div className="overflow-hidden rounded-xl border border-outline-variant">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-surface-container-low text-[10px] uppercase text-on-surface-variant">
                  <tr>
                    <th className="px-sm py-xs">시스템</th>
                    <th className="px-sm py-xs">작업</th>
                    <th className="px-sm py-xs">대상</th>
                    <th className="px-sm py-xs text-right">수량</th>
                    <th className="px-sm py-xs">산출 기준</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-outline-variant/40">
                    <td className="px-sm py-xs">
                      <Pill tone="primary">
                        {selected?.fromRegion ? "WMS" : product.key === "타미비어" ? "ERP" : "MES"}
                      </Pill>
                    </td>
                    <td className="px-sm py-xs font-bold">{selectedScenarioDisplay}</td>
                    <td className="px-sm py-xs text-on-surface-variant">
                      {selected?.fromRegion
                        ? `${selected.fromRegion} → ${selected.toRegion}`
                        : "전국 생산·재고 계획"}
                    </td>
                    <td className="px-sm py-xs text-right font-data font-bold">
                      {selected?.transferAmount
                        ? `${fmt(selected.transferAmount)} ${unit}`
                        : "계획 재산정"}
                    </td>
                    <td className="px-sm py-xs text-[10px] text-on-surface-variant">
                      {selected?.supplyImpact ?? selected?.xai?.summary ?? "제공 데이터 확인 필요"}
                    </td>
                  </tr>
                  <tr className="border-t border-outline-variant/40">
                    <td className="px-sm py-xs">
                      <Pill tone="primary">WMS</Pill>
                    </td>
                    <td className="px-sm py-xs font-bold">적용 후 권역 재고 반영</td>
                    <td className="px-sm py-xs text-on-surface-variant">
                      {selected?.affectedRegions?.join(" · ") || "전체 권역"}
                    </td>
                    <td className="px-sm py-xs text-right font-data font-bold">
                      {fmt(projectedInventory)} {unit}
                    </td>
                    <td className="px-sm py-xs text-[10px] text-on-surface-variant">
                      after_apply 예상 결과
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      ) : null}

      {tab === "approval" ? (
        <div className="grid grid-cols-12 gap-md">
          <div className="col-span-7 space-y-md">
            <Section
              title="승인 대상"
              action={<Pill tone="success">{selectedScenarioDisplay}</Pill>}
            >
              <div className="grid grid-cols-4 gap-xs">
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-[10px] text-on-surface-variant">예상 총재고</p>
                  <p className="mt-1 font-data text-lg font-bold">
                    {fmt(projectedInventory)} {unit}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-[10px] text-on-surface-variant">영향 권역</p>
                  <p className="mt-1 font-data text-lg font-bold">
                    {selected?.affectedRegions?.length ?? 0}개
                  </p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-[10px] text-on-surface-variant">실행 기간</p>
                  <p className="mt-1 text-lg font-bold">
                    {selected?.executionPeriod ?? "확인 필요"}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-[10px] text-on-surface-variant">제약 판정</p>
                  <p className="mt-1 text-lg font-bold text-green-700">PASS</p>
                </div>
              </div>
            </Section>
            <Section
              title={isTamivir ? "승인 조건" : "필수 검토사항"}
              subtitle={isTamivir ? "추천안 실행 전 필수 확인 항목" : undefined}
            >
              <div className="space-y-xs">
                {(isTamivir
                  ? [
                      ["cost", "비용 효과 확인", selected?.costReduction ?? "비용 영향 확인"],
                      ["supplier", "발주 보류 범위 확인", selected?.executionPeriod ?? "적용 일정 확인"],
                      ["quality", "수요 예측 근거 확인", dashboard.externalSignal?.detail ?? "예측 근거 확인"],
                      ["transfer", "CDC 이송 가능량 확인", `${selected?.affectedRegions?.length ?? 0}개 권역 · ${fmt(selected?.transferAmount ?? 0)} ${unit}`],
                    ]
                  : [
                      ["cost", "추가 조달비·비용 효과 확인", "추천안 비용 영향 확인"],
                      ["supplier", "공급사·입고 일정 확인", "실행 일정 및 공급 조건 확인"],
                      ["quality", "품질 승인 전제 확인", "품질 승인 조건 확인"],
                      ["transfer", "권역 재배분 가능량 확인", "권역별 이관 가능 재고 확인"],
                    ]
                ).map(([key, label, detail]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-start gap-sm rounded-xl border border-outline-variant p-sm hover:border-scm-primary/40"
                  >
                    <input
                      type="checkbox"
                      checked={checks[key as keyof typeof checks]}
                      onChange={(event) =>
                        setChecks((current) => ({ ...current, [key]: event.target.checked }))
                      }
                      className="mt-1 h-4 w-4 accent-[var(--scm-primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-sm">
                        <span className="block text-xs font-bold text-on-surface">{label}</span>
                        <Pill tone={checks[key as keyof typeof checks] ? "success" : "neutral"}>
                          {checks[key as keyof typeof checks] ? "확인" : "미확인"}
                        </Pill>
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-on-surface-variant">
                        {detail}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </Section>
          </div>
          <div className="col-span-5 space-y-md">
            <Section title="승인 기록">
              <label className="block text-xs font-bold">
                승인자
                <input
                  value={reviewer}
                  onChange={(event) => setReviewer(event.target.value)}
                  placeholder="이름 입력"
                  className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 font-normal"
                />
              </label>
              <label className="mt-sm block text-xs font-bold">
                역할
                <select
                  value={reviewerRole}
                  onChange={(event) => setReviewerRole(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-outline-variant bg-white px-3 py-2 font-normal"
                >
                  <option>SCM 운영</option>
                  <option>구매</option>
                  <option>생산계획</option>
                  <option>품질보증</option>
                </select>
              </label>
              <label className="mt-sm block text-xs font-bold">
                검토 의견
                <textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  rows={4}
                  placeholder="조건·예외사항 입력"
                  className="mt-1 w-full resize-none rounded-lg border border-outline-variant px-3 py-2 font-normal"
                />
              </label>
              <div className="mt-md grid grid-cols-2 gap-xs text-center">
                <div className="rounded-lg bg-surface-container-low p-sm">
                  <p className="text-[10px] text-on-surface-variant">승인 상태</p>
                  <p className="mt-1 text-xs font-bold">{approved ? "승인 완료" : "검토 대기"}</p>
                </div>
                <div className="rounded-lg bg-surface-container-low p-sm">
                  <p className="text-[10px] text-on-surface-variant">검토 완료</p>
                  <p className="mt-1 text-xs font-bold">
                    {Object.values(checks).filter(Boolean).length}/4
                  </p>
                </div>
              </div>
              <div className="mt-md flex gap-xs">
                <button
                  type="button"
                  onClick={() => setApproved(false)}
                  disabled={isTamivir && !holdReady}
                  className="flex-1 rounded-lg border border-[#ffd591] bg-[#fff7e6] py-sm text-xs font-bold text-[#ad6800] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  보완 요청
                </button>
                <button
                  type="button"
                  disabled={!approvalReady}
                  onClick={() => {
                    setApproved(true);
                    setTab("execution");
                  }}
                  className="flex-1 rounded-lg bg-scm-primary py-sm text-xs font-bold text-white disabled:opacity-40"
                >
                  최종 승인
                </button>
              </div>
              {isTamivir ? (
                <div className="mt-sm h-9 space-y-1" aria-live="polite">
                  <p className={`text-[10px] font-medium ${approvalReady ? "text-green-700" : "text-red-600"}`}>
                    <span className="mr-1" aria-hidden="true">{approvalReady ? "✓" : "*"}</span>
                    {approvalReady
                      ? "최종 승인: 승인 조건이 모두 충족되었습니다."
                      : "최종 승인: 승인자 입력과 필수 검토 4건 완료가 필요합니다."}
                  </p>
                  <p className={`text-[10px] font-medium ${holdReady ? "text-green-700" : "text-red-600"}`}>
                    <span className="mr-1" aria-hidden="true">{holdReady ? "✓" : "*"}</span>
                    {holdReady
                      ? "보완 요청: 승인자와 검토 의견이 입력되었습니다."
                      : "보완 요청: 승인자와 검토 의견을 입력해야 합니다."}
                  </p>
                </div>
              ) : null}
            </Section>
            <Section title="추적 정보">
              <dl className="space-y-xs text-xs">
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">데이터 기준</dt>
                  <dd className="font-data font-bold">{dashboard.date}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">제품</dt>
                  <dd className="font-bold">{product.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">시나리오</dt>
                  <dd className="font-bold">{selectedScenarioDisplay}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">근거 데이터</dt>
                  <dd className="font-bold">{regions.length}개 권역</dd>
                </div>
              </dl>
            </Section>
          </div>
        </div>
      ) : null}

      {tab === "execution" ? (
        <div className="space-y-md">
          <div className="grid grid-cols-5 gap-sm">
            <Metric
              label="실행 상태"
              value={executed ? "완료" : approved ? "실행 대기" : "잠금"}
              note="가상 시스템 실행"
              icon="play_circle"
              tone={executed ? "success" : "warning"}
            />
            <Metric
              label="계획 재고"
              value={`${fmt(projectedInventory)} ${unit}`}
              note={`현재 ${fmt(dashboard.totalInventory ?? 0)} ${unit}`}
              icon="inventory_2"
              tone="success"
            />
            <Metric
              label="영향 권역"
              value={`${selected?.affectedRegions?.length ?? 0}개`}
              note="적용 후 예상"
              icon="map"
            />
            <Metric
              label="실행 기간"
              value={selected?.executionPeriod ?? "확인 필요"}
              note="추천안 계획"
              icon="schedule"
            />
            <Metric
              label="비용 효과"
              value={selected?.costReduction ?? "확인 필요"}
              note="제공 데이터 기준"
              icon="payments"
              tone="warning"
            />
          </div>
          <div className="grid grid-cols-3 gap-md">
            <div className="col-span-2">
              <Section title="가상 실행 지시" subtitle="실제 ERP·MES·WMS 반영 전 시뮬레이션">
                <div className="rounded-xl border border-outline-variant p-md">
                  <p className="text-sm font-bold">{selectedScenarioDisplay}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {selected?.supplyImpact ?? selected?.description}
                  </p>
                  <div className="mt-sm flex gap-sm">
                    <Pill tone="primary">
                      {selected?.fromRegion
                        ? `${selected.fromRegion} → ${selected.toRegion}`
                        : "전국 계획"}
                    </Pill>
                    {selected?.transferAmount ? (
                      <Pill>
                        {fmt(selected.transferAmount)} {unit}
                      </Pill>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!approved || executed}
                  onClick={() => setExecuted(true)}
                  className="mt-md w-full rounded-lg bg-scm-primary py-sm text-xs font-bold text-white disabled:opacity-40"
                >
                  {executed
                    ? "가상 실행 완료"
                    : approved
                      ? "승인안 가상 실행"
                      : "승인 후 실행 가능"}
                </button>
              </Section>
            </div>
            <Section title="실행 후 권역 상태" subtitle="추천안 after_apply 데이터">
              <div className="space-y-xs">
                {Object.values(projectedRegions)
                  .slice(0, 8)
                  .map((region) => (
                    <div
                      key={region.id}
                      className="flex items-center justify-between rounded-lg bg-surface-container-low p-sm text-xs"
                    >
                      <span className="font-bold">{region.region}</span>
                      <span>
                        {fmt(region.current_stock)} {unit} · {region.riskText}
                      </span>
                    </div>
                  ))}
              </div>
            </Section>
          </div>
          <Section title="계획 대비 효과">
            <div className="grid grid-cols-4 gap-sm">
              <div className="rounded-xl bg-surface-container-low p-md">
                <p className="text-[10px] text-on-surface-variant">총재고 변화</p>
                <p className="mt-1 font-data text-lg font-bold text-scm-primary">
                  {fmt(projectedInventory - (dashboard.totalInventory ?? 0))} {unit}
                </p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-md">
                <p className="text-[10px] text-on-surface-variant">부족 권역</p>
                <p className="mt-1 font-data text-lg font-bold">{shortageRegions.length}개</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-md">
                <p className="text-[10px] text-on-surface-variant">실행 가능성</p>
                <p className="mt-1 font-data text-lg font-bold">
                  {selected?.feasibility ? `${selected.feasibility}%` : "확인 필요"}
                </p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-md">
                <p className="text-[10px] text-on-surface-variant">모니터링 상태</p>
                <p className="mt-1 text-lg font-bold text-green-700">
                  {executed ? "추적 중" : "실행 대기"}
                </p>
              </div>
            </div>
          </Section>
        </div>
      ) : null}

      {showWorkflow ? (
        <div
          className="fixed inset-0 z-[500] bg-black/25"
          role="presentation"
          onMouseDown={() => setShowWorkflow(false)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`${product.name} 의사결정 워크플로우 상세`}
            onMouseDown={(event) => event.stopPropagation()}
            className="absolute bottom-0 right-0 top-0 w-[520px] overflow-y-auto border-l border-outline-variant bg-white shadow-2xl"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-outline-variant bg-white px-lg py-md">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-scm-primary">
                  Workflow trace
                </p>
                <h3 className="font-display text-lg font-bold">10단계 처리상태</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkflow(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container-low"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </header>
            <div className="space-y-xs p-md">
              {workflowSteps.map((step) => (
                <article key={step.id} className="rounded-xl border border-outline-variant p-sm">
                  <div className="flex items-start gap-sm">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-bold text-on-surface-variant">
                      {step.order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold">{step.title}</h4>
                        <Pill tone={step.status === "완료" ? "success" : "neutral"}>
                          {step.status}
                        </Pill>
                      </div>
                      <ul className="mt-1 space-y-1">
                        {step.evidence.slice(0, 3).map((evidence) => (
                          <li
                            key={evidence}
                            className="text-[10px] leading-4 text-on-surface-variant"
                          >
                            • {evidence}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function CefazolinOnlyDecisionExecutionView({ product }: { product: Product }) {
  const isTamivir = product.key === "타미비어";
  const isLipilou = product.key === "리피로우";
  const lipilouRegions = lipilouDashboard?.regions ?? {};
  const lipilouRegionalRows = Object.values(lipilouRegions).filter(
    (region) => region.id !== "National",
  );
  const lipilouTargetTotal = lipilouRegionalRows.reduce((sum, region) => sum + region.target_stock, 0);
  const lipilouInventoryTotal = lipilouDashboard?.totalInventory ?? 0;
  const lipilouShortfall = lipilouRegionalRows.reduce(
    (sum, region) => sum + Math.max(0, region.target_stock - region.current_stock),
    0,
  );
  const lipilouMinimumCoverage = Math.min(
    ...lipilouRegionalRows.map((region) => region.stock_ratio),
    100,
  );
  const lipilouRecommendation = lipilouDashboard?.recommendations.find(
    (recommendation) => recommendation.id === "SOLUTION-01",
  );
  const lipilouProductionRecommendation = lipilouDashboard?.recommendations.find(
    (recommendation) => recommendation.id === "SOLUTION-02",
  );
  const lipilouProjectedRegions = lipilouRecommendation?.projectedRegions ?? lipilouRegions;
  const lipilouProjectedRegionalRows = Object.values(lipilouProjectedRegions).filter(
    (region) => region.id !== "National",
  );
  const lipilouProjectedMinimumCoverage = Math.min(
    ...lipilouProjectedRegionalRows.map((region) => region.stock_ratio),
    100,
  );
  const lipilouProjectedShortfall = lipilouProjectedRegionalRows.reduce(
    (sum, region) => sum + Math.max(0, region.target_stock - region.current_stock),
    0,
  );
  const lipilouNationalRatio = lipilouTargetTotal > 0
    ? (lipilouInventoryTotal / lipilouTargetTotal) * 100
    : 0;
  const lipilouNationalRisk = lipilouNationalRatio < 100
    ? "danger"
    : lipilouNationalRatio > 120
      ? "warning"
      : "safe";
  const lipilouTemplateRegions = {
    ...lipilouRegions,
    National: {
      id: "National",
      region: "National_전국 통합",
      current_stock: lipilouInventoryTotal,
      target_stock: lipilouTargetTotal,
      stock_ratio: lipilouNationalRatio,
      status: lipilouNationalRisk === "danger" ? "부족" : lipilouNationalRisk === "warning" ? "과잉" : "적정",
      riskLevel: lipilouNationalRisk,
      riskText: lipilouNationalRisk === "danger" ? "부족" : lipilouNationalRisk === "warning" ? "과잉" : "적정",
    },
  };
  const lipilouScenarios = [
    {
      id: "S1_무대응",
      displayId: "S1 현행유지",
      response: "품질 재검사 대기·기존 배분 유지",
      baseline: true,
      comparisonTarget: true,
      constraintPassed: false,
      serviceRatePct: lipilouMinimumCoverage,
      minimumRegionalServiceRatePct: lipilouMinimumCoverage,
      totalUnmetDemand: lipilouShortfall,
      shortageWeeks: 1,
      emergencyProcurementQuantity: 0,
      totalProcurementCostKrw: 0,
      projectedInventory: lipilouInventoryTotal,
      excessInventory: 0,
      feasibilityPct: 100,
      executionPeriod: "현행 유지",
      costEffect: "추가 비용 없음",
    },
    {
      id: "S2_재고이관",
      displayId: "S2 재고 이관",
      response: "서울→제주 권역 간 재고 이관",
      baseline: false,
      comparisonTarget: true,
      constraintPassed: true,
      serviceRatePct: lipilouProjectedMinimumCoverage,
      minimumRegionalServiceRatePct: lipilouProjectedMinimumCoverage,
      totalUnmetDemand: lipilouProjectedShortfall,
      shortageWeeks: 0,
      emergencyProcurementQuantity: lipilouRecommendation?.transferAmount ?? 0,
      totalProcurementCostKrw: 0,
      projectedInventory: lipilouRecommendation?.projectedTotalInventory ?? lipilouInventoryTotal,
      excessInventory: 0,
      feasibilityPct: lipilouRecommendation?.feasibility ?? 0,
      executionPeriod: lipilouRecommendation?.executionPeriod ?? "데이터 없음",
      costEffect: lipilouRecommendation?.costReduction ?? "데이터 없음",
    },
    {
      id: "S3_라인증산",
      displayId: "S3 타 라인 증산",
      response: "B라인 증산 보완안",
      baseline: false,
      comparisonTarget: true,
      constraintPassed: false,
      serviceRatePct: lipilouMinimumCoverage,
      minimumRegionalServiceRatePct: lipilouMinimumCoverage,
      totalUnmetDemand: lipilouShortfall,
      shortageWeeks: 1,
      emergencyProcurementQuantity: 0,
      totalProcurementCostKrw: 0,
      projectedInventory: lipilouInventoryTotal,
      excessInventory: 0,
      feasibilityPct: lipilouProductionRecommendation?.feasibility ?? 0,
      executionPeriod: lipilouProductionRecommendation?.executionPeriod ?? "데이터 없음",
      costEffect: lipilouProductionRecommendation?.costReduction ?? "데이터 없음",
    },
  ];
  const lipilouTemplateDashboard = {
    ...lipilouDashboard,
    regions: lipilouTemplateRegions,
    totalInventory: lipilouInventoryTotal,
    utilization: null,
    policyRiskByRegion: {
      National: {
        grade: "높음 (High Risk)",
        score: 78,
        causes: [
          { label: "MES 품질 재검사", score: 78 },
          { label: "A라인 출하 지연", score: 72 },
          { label: "제주 목표재고 미달", score: 68 },
        ],
      },
    },
    transferableQuantityByRegion: { National: lipilouRecommendation?.transferAmount ?? 0 },
    recommendationEvaluations: [{
      scenarioId: "S2 재고 이관",
      recommended: true,
      executionPeriod: lipilouRecommendation?.executionPeriod ?? "데이터 없음",
      xai: {
        conditions: [
          "MES A라인 품질 재검사 일정 확인",
          "ERP 서울→제주 배분계획 변경 승인",
          "WMS 서울 출고·제주 입고 슬롯 확보",
        ],
      },
    }],
  };
  const tamivirRegionalRows = Object.values(tamivirDashboard.regions).filter(
    (region) => region.id !== "National",
  );
  const tamivirTemplateRegions = Object.fromEntries(
    Object.entries(tamivirDashboard.regions).map(([id, region]) => {
      const targetStock = region.target_stock;
      const stockRatio = region.stock_ratio;
      const riskLevel = stockRatio < 1 ? "danger" : stockRatio >= 3 ? "warning" : "safe";
      return [
        id,
        {
          ...region,
          target_stock: targetStock,
          stock_ratio: stockRatio,
          riskLevel,
          riskText: riskLevel === "danger" ? "부족" : stockRatio >= 10 ? "심각한 과잉" : riskLevel === "warning" ? "과잉" : "적정",
        },
      ];
    }),
  );
  const tamivirScenarios = [
    {
      id: "S1_무대응",
      displayId: "S1 현행유지",
      response: "기존 발주·생산계획 유지",
      baseline: false,
      comparisonTarget: true,
      constraintPassed: true,
      riskScore: 92,
      serviceRatePct: 7.1,
      minimumRegionalServiceRatePct: 100,
      totalUnmetDemand: 1_189_992,
      shortageWeeks: 0,
      emergencyProcurementQuantity: 0,
      totalProcurementCostKrw: 0,
      projectedInventory: 1_280_777,
      excessInventory: 1_189_992,
      feasibilityPct: 100,
      executionPeriod: "현행 유지",
      costEffect: "절감 없음",
    },
    {
      id: "S2_내부대응",
      displayId: "S2 핀셋 감축",
      response: "신규 발주 보류·생산 감축",
      baseline: false,
      comparisonTarget: true,
      constraintPassed: true,
      riskScore: 45,
      serviceRatePct: 12.2,
      minimumRegionalServiceRatePct: 94,
      totalUnmetDemand: 654_785,
      shortageWeeks: 4,
      emergencyProcurementQuantity: 535_207,
      totalProcurementCostKrw: -2_000_000_000,
      projectedInventory: 745_570,
      excessInventory: 654_785,
      feasibilityPct: 94,
      executionPeriod: "2~4주",
      costEffect: "18~22% 절감",
    },
    {
      id: "S3_통합대응",
      displayId: "S3 CDC 이송",
      response: "경기/인천·영남권 잉여재고 이송",
      baseline: false,
      comparisonTarget: true,
      constraintPassed: true,
      riskScore: 38,
      serviceRatePct: 18.9,
      minimumRegionalServiceRatePct: 89,
      totalUnmetDemand: 389_992,
      shortageWeeks: 2,
      emergencyProcurementQuantity: 800_000,
      totalProcurementCostKrw: -1_050_000_000,
      projectedInventory: 480_777,
      excessInventory: 389_992,
      feasibilityPct: 89,
      executionPeriod: "1~2주",
      costEffect: "9~12% 절감",
    },
  ];
  const tamivirTemplateDashboard = {
    ...tamivirDashboard,
    regions: tamivirTemplateRegions,
    totalInventory: tamivirDashboard.totalInventory ?? 0,
    utilization: tamivirDashboard.utilization ?? 78,
    policyRiskByRegion: {
      National: {
        grade: "높음 (High Risk)",
        score: 92,
        causes: [
          { label: "인플루엔자 수요 급감", score: 92 },
          { label: "재고 과잉·장기체화", score: 86 },
          { label: "권역 창고 포화 위험", score: 78 },
        ],
      },
    },
    transferableQuantityByRegion: {
      National: 800_000,
    },
    recommendationEvaluations: [
      {
        scenarioId: "S2 핀셋 감축",
        recommended: true,
        executionPeriod: "2~4주 내 신규 발주 보류·핀셋 감축",
        xai: {
          conditions: [
            "ERP 신규 발주 보류 대상 확인",
            "MES 경기/인천·영남권 생산 감축 가능량·적용 일정 확인",
            "S2 적용 후 권역별 재고 수준 확인",
          ],
        },
      },
    ],
  };
  const cefazolinDashboard: any = isTamivir
    ? tamivirTemplateDashboard
    : isLipilou
      ? lipilouTemplateDashboard
      : cefazolinDashboardSource;
  const cefazolinScenarioComparison: any[] = isTamivir
    ? tamivirScenarios
    : isLipilou
      ? lipilouScenarios
      : cefazolinScenarioComparisonSource;
  const cefazolinScenarioRecommendation: any = isTamivir
    ? { recommendedScenarioId: "S2_내부대응" }
    : isLipilou
      ? { recommendedScenarioId: "S2_재고이관" }
      : cefazolinScenarioRecommendationSource;
  const cefazolinDetectionContext: any = isTamivir
    ? {
        caseId: "TAMI-DEMAND-20261115-01",
        detectedAt: tamivirDashboard.date,
        directSignal: "인플루엔자 수요 급감",
        directSignalScore: 92,
        eventId: "EVT-FLU-20261115",
        supplyFulfillmentPct: null,
        source: "수요예측·재고 비율·ERP/MES/WMS 통합 분석",
        evidenceNote: "전국 재고 1,280,777 EA · AI 목표 90,785 EA · 재고 비율 14.1배",
      }
    : isLipilou
      ? {
          caseId: "LIPI-QUALITY-20261028-01",
          detectedAt: lipilouDashboard?.date ?? "",
          directSignal: "MES 품질 재검사",
          directSignalScore: 78,
          eventId: "LIPI-MES-QUALITY-01",
          supplyFulfillmentPct: null,
          source: "리피로우 MES·ERP·WMS 통합 데이터",
          evidenceNote: `제주 목표재고 미달 ${fmt(lipilouShortfall)} BOX`,
        }
      : cefazolinDetectionContextSource;
  const cefazolinWorkflowRunMeta: any = isTamivir
    ? {
        runId: "SCM-TAMI-20261115-001",
        latestSnapshotDate: tamivirDashboard.date,
      }
    : isLipilou
      ? { runId: "SCM-LIPI-20261028-001", latestSnapshotDate: lipilouDashboard?.date ?? "" }
      : cefazolinWorkflowRunMetaSource;
  const cefazolinDecisionEvidence: any = isTamivir
    ? {
        rules: [
          "RULE-DEMAND-SURGE-001",
          "RULE-REGION-SHORTAGE-001",
          "RULE-PRODUCTION-UP-001",
          "RULE-TRANSFER-001",
          "RULE-SERVICE-LEVEL-001",
        ],
      }
    : isLipilou
      ? { rules: ["RULE-LIPI-QUALITY-001", "RULE-LIPI-TRANSFER-001", "RULE-LIPI-HITL-001"] }
      : cefazolinDecisionEvidenceSource;
  const cefazolinWorkflowEffect: any = isTamivir
    ? {
        serviceRateBefore: 7.1,
        serviceRateAfter: 12.2,
        minimumRegionalServiceRateBefore: 100,
        minimumRegionalServiceRateAfter: 94,
        unmetDemandBefore: 1_189_992,
        unmetDemandAfter: 654_785,
        shortageWeeksBefore: 0,
        shortageWeeksAfter: 4,
        procurementCostDeltaKrw: -2_000_000_000,
      }
    : isLipilou
      ? {
          serviceRateBefore: lipilouMinimumCoverage,
          serviceRateAfter: lipilouProjectedMinimumCoverage,
          minimumRegionalServiceRateBefore: lipilouMinimumCoverage,
          minimumRegionalServiceRateAfter: lipilouProjectedMinimumCoverage,
          unmetDemandBefore: lipilouShortfall,
          unmetDemandAfter: lipilouProjectedShortfall,
          shortageWeeksBefore: 1,
          shortageWeeksAfter: 0,
          procurementCostDeltaKrw: 0,
        }
      : cefazolinWorkflowEffectSource;
  const cefazolinVirtualExecutionActions: any[] = isTamivir
    ? [
        {
          id: "TAMI-ERP-001",
          actionType: "신규 발주 보류",
          title: "타미비어 신규 발주 보류",
          source: "ERP 미확정 발주",
          target: "경기/인천·영남권 공급계획",
          quantity: null,
          unit: "계획",
          ruleId: "RULE-TAMI-ORDER-HOLD-001",
          basis: "전국 재고 1,280,777 EA · AI 목표 90,785 EA · 재고 비율 14.1배 기준",
        },
        {
          id: "TAMI-MES-001",
          actionType: "생산계획 재산정",
          title: "경기/인천·영남권 핀셋 생산 감축",
          source: "S2 AI 감축 권고안",
          target: "MES 생산계획",
          quantity: null,
          unit: "계획",
          ruleId: "RULE-TAMI-PRODUCTION-DOWN-001",
          basis: "S2 적용 후 예상 재고 745,570 EA · 비용 18~22% 절감",
        },
      ]
    : isLipilou
      ? [
          {
            id: "LIPI-ERP-001",
            actionType: "배분계획 변경",
            title: "서울→제주 재고 배분계획 등록",
            source: "ERP 서울 가용재고",
            target: "ERP 제주 공급계획",
            quantity: lipilouRecommendation?.transferAmount ?? 0,
            unit: "BOX",
            ruleId: "RULE-LIPI-TRANSFER-001",
            basis: lipilouRecommendation?.description ?? "리피로우 추천 근거 데이터 없음",
          },
          {
            id: "LIPI-MES-001",
            actionType: "생산계획 재산정",
            title: "A라인 품질 재검사 일정 반영",
            source: "MES A라인 품질 이벤트",
            target: "MES 출하 가능 일정",
            quantity: null,
            unit: "계획",
            ruleId: "RULE-LIPI-QUALITY-001",
            basis: "품질 재검사에 따른 출하 지연 7일 반영",
          },
          {
            id: "LIPI-WMS-001",
            actionType: "재고이동",
            title: "서울 재고를 제주로 이송",
            source: "서울 권역 WMS",
            target: "제주 권역 WMS",
            quantity: lipilouRecommendation?.transferAmount ?? 0,
            unit: "BOX",
            ruleId: "RULE-LIPI-TRANSFER-001",
            basis: lipilouRecommendation?.supplyImpact ?? "리피로우 이송 효과 데이터 없음",
          },
        ]
      : cefazolinVirtualExecutionActionsSource;
  const tamivirWorkflowContent = [
    { title: "ERP·MES·WMS·수요 데이터 확인", purpose: "타미비어 수요·재고·생산·물류 데이터를 동일 기준일로 수집합니다.", evidence: "타미비어 전국 8개 권역 데이터 수집 완료", ruleIds: ["RULE-TAMI-DATA-001"], nextAction: "통합 데이터의 누락과 기준일을 검사합니다." },
    { title: "통합·품질 검사", purpose: "타미비어 필수 재고·수요·생산 데이터의 완전성과 정합성을 확인합니다.", evidence: "필수 재고·수요·생산 데이터 검증 완료", ruleIds: ["RULE-TAMI-QUALITY-001"], nextAction: "검증된 데이터로 수요 이상 신호를 분석합니다." },
    { title: "인플루엔자 수요 급감 탐지", purpose: "수요예측 하향과 권역별 재고 비율을 결합해 과잉재고 위험을 탐지합니다.", evidence: "전국 재고 비율 14.1배 · 심각한 과잉 권역 3개", ruleIds: ["RULE-DEMAND-DROP-001"], nextAction: "탐지된 수요 급감이 권역 재고에 미치는 영향을 확인합니다." },
    { title: "Case 영향 분석", purpose: "수요 급감이 재고 과잉과 권역 창고 포화 위험에 미치는 영향을 분석합니다.", evidence: "Dead Stock 1,189,992 EA · 심각한 과잉 권역 3개", ruleIds: ["RULE-TAMI-IMPACT-001"], nextAction: "동일 Case 기준으로 S1~S3 대응안을 비교합니다." },
    { title: "S1~S3 시뮬레이션", purpose: "현행유지·핀셋 감축·CDC 이송안의 예상 재고, 잔여 과잉재고, 위험점수, 비용효과를 비교합니다.", evidence: "S1 현행유지 · S2 핀셋 감축 · S3 CDC 이송 3개 실행안 비교", ruleIds: ["RULE-TAMI-SIMULATION-001"], nextAction: "실행 가능한 대응안의 시스템별 조건을 검증합니다." },
    { title: "대응안 실행가능성 검증", purpose: "신규 발주 보류와 경기/인천·영남권 생산 감축 가능량·일정을 검증합니다.", evidence: "ERP 발주 보류·MES 생산 감축 조건과 재고 감축 효과 검증", ruleIds: ["RULE-TAMI-FEASIBILITY-001"], nextAction: "제약을 통과한 최종 권고안을 선정합니다." },
    { title: "최종 권고안 선정·근거", purpose: "잔여 과잉재고, 비용절감, 실행가능성을 기준으로 최종 실행안을 선정합니다.", evidence: "S2 핀셋 감축 · 비용 18~22% 절감 · 실행가능성 94%", ruleIds: ["RULE-TAMI-RECOMMEND-001"], nextAction: "발주 보류와 생산 감축 조건을 담당자가 검토합니다." },
    { title: "담당자 검토·승인", purpose: "타미비어 실행 전 필수 운영 조건과 승인 의견을 기록합니다.", evidence: "신규 발주 보류·생산 감축·감축 후 권역 재고 수준 확인", ruleIds: ["RULE-TAMI-HITL-001"], nextAction: "승인된 실행안을 ERP·MES 지시로 변환합니다." },
    { title: "실행지시 준비", purpose: "승인된 S2 대응안을 시스템별 실행지시로 생성합니다.", evidence: "ERP 발주 보류·MES 생산 감축 실행지시 생성", ruleIds: ["RULE-TAMI-EXECUTION-001"], nextAction: "실행지시 전송 상태와 결과를 확인합니다." },
    { title: "계획 KPI 확인", purpose: "S1 대비 핀셋 감축안의 재고 정상화와 비용절감 효과를 확인합니다.", evidence: "예상 재고 745,570 EA · 과잉재고 654,785 EA", ruleIds: ["RULE-TAMI-EFFECT-001"], nextAction: "실제 운영실적과 계획 KPI 편차를 추적합니다." },
  ];
  const cefazolinWorkflowSteps: any[] = isTamivir
    ? cefazolinWorkflowStepsSource.map((step, index) => ({
        ...step,
        id: step.id.replace("FLOW", "TAMI-FLOW"),
        title: tamivirWorkflowContent[index]?.title ?? step.title,
        shortTitle: tamivirWorkflowContent[index]?.title ?? step.shortTitle,
        purpose: tamivirWorkflowContent[index]?.purpose ?? step.purpose,
        ruleIds: tamivirWorkflowContent[index]?.ruleIds ?? step.ruleIds,
        dataAsOf: tamivirDashboard.date,
        evidence: [tamivirWorkflowContent[index]?.evidence ?? "타미비어 시나리오 데이터"],
        warnings: [],
        nextAction: tamivirWorkflowContent[index]?.nextAction ?? step.nextAction,
      }))
    : isLipilou
      ? lipilouWorkflowSteps
      : cefazolinWorkflowStepsSource;
  const finishedUnit = isTamivir ? "EA" : isLipilou ? "BOX" : "VIAL";
  const procurementUnit = isTamivir ? "EA" : isLipilou ? "BOX" : "API";
  const initialProductState = loadProductExecutionState(
    product.key,
    cefazolinWorkflowRunMeta.latestSnapshotDate,
  );
  const [tab, setTab] = useState<TabKey>("impact");
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [hitlStatus, setHitlStatus] = useState<HitlStatus>(initialProductState.hitlStatus);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>(initialProductState.executionStatus);
  const [reviewer, setReviewer] = useState(initialProductState.reviewer);
  const [reviewerRole, setReviewerRole] = useState(initialProductState.reviewerRole);
  const [reviewNote, setReviewNote] = useState(initialProductState.reviewNote);
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>(initialProductState.checklist);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(initialProductState.lastUpdatedAt);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const state: ProductExecutionState = {
      productId: product.key,
      hitlStatus,
      executionStatus,
      reviewer,
      reviewerRole,
      reviewNote,
      checklist,
      lastUpdatedAt,
    };
    try {
      window.localStorage.setItem(executionStateStorageKey(product.key), JSON.stringify(state));
    } catch {
      // 저장소를 사용할 수 없는 환경에서도 화면 상태는 현재 제품 안에서 유지합니다.
    }
  }, [product.key, hitlStatus, executionStatus, reviewer, reviewerRole, reviewNote, checklist, lastUpdatedAt]);

  const national = cefazolinDashboard.regions.National;
  const nationalPolicyRisk = cefazolinDashboard.policyRiskByRegion.National;
  const riskCauses = [...nationalPolicyRisk.causes].sort((a, b) => b.score - a.score);
  const regions = (Object.values(cefazolinDashboard.regions) as DashboardRegion[]).filter(
    (region) => region.id !== "National",
  );
  const shortageRegions = regions.filter((region) => region.riskLevel === "danger");
  const excessRegions = regions.filter((region) => region.riskLevel === "warning");
  const scenarioRows = cefazolinScenarioComparison.filter((scenario) => scenario.comparisonTarget);
  const recommendedScenarioId = cefazolinScenarioRecommendation.recommendedScenarioId;
  const recommendedScenario =
    scenarioRows.find((scenario) => scenario.id === recommendedScenarioId) ?? scenarioRows.at(-1)!;
  const baselineScenario =
    scenarioRows.find((scenario) => scenario.id === "S1_무대응") ?? scenarioRows[0];
  const directSupplyCause = riskCauses.find(
    (cause) => cause.label === cefazolinDetectionContext.directSignal,
  );
  const contributingCauses = riskCauses.filter(
    (cause) => cause.label !== cefazolinDetectionContext.directSignal,
  );
  const targetStockGap = Math.max(
    0,
    national.target_stock - (cefazolinDashboard.totalInventory ?? 0),
  );
  const tamivirExcessStock = Math.max(
    0,
    (cefazolinDashboard.totalInventory ?? 0) - national.target_stock,
  );
  const affectedRegionNames = (isTamivir ? excessRegions : shortageRegions).map((region) =>
    region.region.split("_").slice(1).join("_"),
  );
  const tamivirIntegrationRegions = Object.values(tamivirDashboard.regions).filter(
    (region) => region.id !== "National",
  );
  const regionChartData = (isTamivir ? tamivirIntegrationRegions : regions).map((region) => {
    const name = region.region.split("_").slice(1).join("_");
    const ratio = region.stock_ratio;
    const color = isTamivir
      ? ratio < 1
        ? "#ef4444"
        : ratio < 3
          ? "#22c55e"
          : ratio < 10
            ? "#eab308"
            : "#f97316"
      : region.riskLevel === "danger"
        ? "#ef4444"
        : region.riskLevel === "warning"
          ? "#f59e0b"
          : "#22c55e";
    return {
      id: region.id,
      name,
      ratio,
      color,
      label: isTamivir ? `${ratio.toFixed(1)}배` : `${ratio.toFixed(0)}%`,
    };
  });
  const tamivirSevereRegions = tamivirIntegrationRegions.filter(
    (region) => region.stock_ratio >= 10,
  );
  const tamivirSevereRegionCount = tamivirSevereRegions.length;
  const tamivirSevereRegionNames = tamivirSevereRegions
    .map((region) => region.region.split("_").slice(1).join("_"))
    .join(" · ");
  const propagationStages = [
    {
      label: isTamivir ? "수요 급감" : isLipilou ? "품질 재검사" : "공급 이행 저하",
      value:
        cefazolinDetectionContext.supplyFulfillmentPct !== null
          ? `${cefazolinDetectionContext.supplyFulfillmentPct.toFixed(1)}%`
          : `${directSupplyCause?.score ?? 0}/100`,
      note: cefazolinDetectionContext.eventId
        ? `${cefazolinDetectionContext.eventId} ${isTamivir ? "수요" : isLipilou ? "품질" : "공급"} 신호`
        : isTamivir
          ? "수요예측 신호"
          : "ERP 공급 신호",
      tone: "danger" as const,
    },
    {
      label: isTamivir ? "재고 과잉" : isLipilou ? "출하 지연" : "재고 압박",
      value: isTamivir ? `${national.stock_ratio.toFixed(1)}배` : `${national.stock_ratio.toFixed(1)}%`,
      note: isTamivir ? "AI 목표 대비 재고 비율" : "목표재고 충족률",
      tone: "warning" as const,
    },
    {
      label: isTamivir ? "심각 과잉" : "권역 부족",
      value: `${isTamivir ? tamivirSevereRegionCount : shortageRegions.length}개`,
      note: isTamivir ? tamivirSevereRegionNames : affectedRegionNames.join(" · "),
      tone: "warning" as const,
    },
    {
      label: isTamivir ? "Dead Stock" : isLipilou ? "목표재고 위험" : "서비스 위험",
      value: isTamivir ? `${fmt(tamivirExcessStock)} EA` : `${baselineScenario.serviceRatePct.toFixed(1)}%`,
      note: isTamivir ? "AI 목표 초과 재고" : "S1 무대응 예상 서비스율",
      tone: "danger" as const,
    },
  ];
  const recommendedEvaluation =
    cefazolinDashboard.recommendationEvaluations.find((item: any) => item.recommended) ??
    cefazolinDashboard.recommendationEvaluations.find(
      (item: any) => item.scenarioId === recommendedScenario.displayId,
    );
  const qualityCondition =
    recommendedEvaluation?.xai.conditions.find((item: string) => item.includes("품질")) ??
    "MES 품질검사·출하승인 완료 여부 확인";
  const approvalChecklistItems: Array<{ key: ChecklistKey; label: string; detail: string }> = [
    {
      key: "cost",
      label: isTamivir ? "비용 절감 효과 확인" : isLipilou ? "이관 비용·효과 확인" : "증분 조달비 확인",
      detail: isTamivir
        ? "S1 대비 예상 비용 18~22% 절감 효과 확인"
        : isLipilou
          ? `예상 비용 효과 ${recommendedScenario.costEffect}`
        : `S1 대비 ${fmtKrw(cefazolinWorkflowEffect.procurementCostDeltaKrw)} 증가분 및 예산 범위 확인`,
    },
    {
      key: "supplier",
      label: isTamivir ? "신규 발주 보류 대상 확인" : isLipilou ? "권역 이관 일정 확인" : "공급사 입고 일정 확인",
      detail: isTamivir
        ? "ERP 미확정 신규 발주 중 보류 대상·적용 시점 확인"
        : recommendedEvaluation?.executionPeriod ?? (isLipilou ? "서울 출고·제주 입고 일정 확인" : "긴급조달 입고 일정 확인"),
    },
    {
      key: "quality",
      label: isTamivir ? "MES 생산 감축 가능량·일정 확인" : "MES 품질 승인 전제 확인",
      detail: isTamivir
        ? "경기/인천·영남권 핀셋 감축 가능량 및 기존 생산 LOT 종료 후 적용 일정 확인"
        : qualityCondition,
    },
    {
      key: "transfer",
      label: isTamivir ? "감축 후 권역별 재고 수준 확인" : "권역 재배분 가능량 확인",
      detail: isTamivir
        ? "S2 after_apply 기준 서울 15.0배 · 경기/인천 11.0배 · 부울경 8.5배 등 8개 권역 확인"
        : isLipilou
          ? `서울→제주 ${fmt(cefazolinDashboard.transferableQuantityByRegion.National)} ${finishedUnit}`
        : `${fmt(cefazolinDashboard.transferableQuantityByRegion.National)} ${finishedUnit} · 과잉권역 ${excessRegions.length}개`,
    },
  ];
  const checklistComplete = approvalChecklistItems.every((item) => checklist[item.key]);
  const approvalReady = reviewer.trim().length > 0 && checklistComplete;
  const holdReady = reviewer.trim().length > 0 && reviewNote.trim().length > 0;
  const workflow = isTamivir
    ? getTamivirWorkflowRunState({ hitlStatus, executionStatus, lastUpdatedAt })
    : createWorkflowRunState({
        runId: cefazolinWorkflowRunMeta.runId,
        scenarios: scenarioRows,
        dataReady: true,
        qualityProcessed: true,
        analysisAvailable: true,
        modelValidated: true,
        simulationReady: scenarioRows.length > 0,
        hitlStatus,
        executionStatus,
        lastUpdatedAt,
      });
  const activeStep = Math.max(1, workflow.currentStep);
  const approvalLocked = hitlStatus === "approved";
  const completedWorkflowStepCount =
    executionStatus === "executed" ? cefazolinWorkflowSteps.length : workflow.completedSteps.length;

  const executionRows = cefazolinVirtualExecutionActions.map((action) => ({
    ...action,
    productId: product.key,
    system: actionSystem(action.actionType),
  }));
  const tamivirRecommendedDashboardScenario = tamivirDashboard.recommendations.find(
    (item) => item.id === "TAMIVIR-S2-PINPOINT-REDUCTION",
  );
  const affectedRegionImprovementRows = (isTamivir ? excessRegions : shortageRegions).map(
    (region) => {
      const projectedRegion = isTamivir
        ? tamivirRecommendedDashboardScenario?.projectedRegions?.[region.id]
        : undefined;
      return {
        id: region.id,
        name: region.region.split("_").slice(1).join("_"),
        currentValue: region.stock_ratio,
        currentStatus: region.riskText,
        afterValue: projectedRegion?.stock_ratio,
        afterStatus: projectedRegion?.status ?? projectedRegion?.riskText,
      };
    },
  );
  const responseExecutionRows = isTamivir || isLipilou
    ? executionRows
    : (() => {
        const procurementRows = executionRows.filter((row) => row.system === "ERP");
        const productionRow = executionRows.find((row) => row.system === "MES");
        const transferRows = executionRows.filter((row) => row.system === "WMS");
        const rows: any[] = [];

        if (procurementRows.length > 0) {
          rows.push({
            id: "CEFA-ERP-CONSOLIDATED",
            system: "ERP",
            title: `공급사 ${procurementRows.map((row) => row.source.replace("공급사 ", "")).join(", ")} 원료 추가 발주`,
            quantity: recommendedScenario.emergencyProcurementQuantity,
            unit: "API 환산단위",
            basis: procurementRows.map((row) => row.basis).join(" · "),
          });
        }
        if (productionRow) rows.push(productionRow);
        if (transferRows.length > 0) {
          rows.push({
            id: "CEFA-WMS-CONSOLIDATED",
            system: "WMS",
            title: `과잉 권역 ${transferRows.length}개 재고를 부족 권역 ${shortageRegions.length}개로 재배분`,
            quantity: transferRows.reduce((sum, row) => sum + (row.quantity ?? 0), 0),
            unit: "완제품 환산단위",
            basis: `${transferRows.map((row) => row.source).join(" · ")} 출고 · 권역 최소 목표재고 확보`,
          });
        }
        return rows;
      })();

  const approve = () => {
    if (approvalLocked || !approvalReady) return;
    const now = new Date().toISOString();
    setHitlStatus("approved");
    setExecutionStatus("ready");
    setLastUpdatedAt(now);
    setTab("execution");
  };

  const hold = () => {
    if (approvalLocked || !holdReady) return;
    const now = new Date().toISOString();
    setHitlStatus("held");
    setExecutionStatus("locked");
    setLastUpdatedAt(now);
  };

  const executeInstruction = (productId: string, instructionId: string) => {
    if (productId !== product.key) return;
    if (!executionRows.some((row) => row.productId === productId && row.id === instructionId)) return;
    if (hitlStatus !== "approved" || executionStatus !== "ready") return;
    setExecutionStatus("executed");
    setLastUpdatedAt(cefazolinWorkflowRunMeta.latestSnapshotDate);
  };

  const execute = () => {
    const instructionId = executionRows[0]?.id;
    if (!instructionId) return;
    executeInstruction(product.key, instructionId);
  };

  return (
    <div
      className={`dashboard-fixed-layout flex flex-1 flex-col bg-surface px-lg pt-16 ${tab === "impact" ? "h-[912px] min-h-[912px] max-h-[912px] overflow-hidden pb-12" : tab === "response" ? "h-[992px] min-h-[992px] max-h-[992px] overflow-hidden pb-12" : "pb-16"}`}
    >
      <div className="flex items-end justify-between gap-lg py-lg">

        <div>
          <div className="mb-xs flex items-center gap-2">
            <Pill tone="danger">HIGH</Pill>
            <Pill
              tone={
                hitlStatus === "approved"
                  ? "success"
                  : hitlStatus === "held"
                    ? "warning"
                    : "primary"
              }
            >
              {hitlStatus === "approved"
                ? "승인 완료"
                : hitlStatus === "held"
                  ? "보완 요청"
                  : "권고안 검토"}
            </Pill>
            <span className="font-data text-[10px] text-on-surface-variant">
              {cefazolinDetectionContext.caseId}
            </span>
            <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-[9px] font-bold text-on-surface-variant">
              SANDBOX · SYNTHETIC DATA
            </span>
          </div>
          <h2 className="font-display text-headline-md text-on-surface">
            {product.name} 의사결정 실행
          </h2>
          <p className="mt-xs text-sm text-on-surface-variant">
            {isTamivir ? "인플루엔자 수요 급감 탐지" : isLipilou ? "MES 품질 이상 탐지" : "수급 이상 탐지"} · Case 영향 분석 · 데이터 기준{" "}
            {cefazolinWorkflowRunMeta.latestSnapshotDate}
          </p>

        </div>
        <button
          type="button"
          onClick={() => setShowWorkflow(true)}
          className="flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-md py-sm text-xs font-bold text-on-surface shadow-sm hover:border-scm-primary/40"
        >
          <Icon name="account_tree" className="text-[18px] text-scm-primary" />
          10단계 상세
          <Pill tone="primary">{completedWorkflowStepCount}/10</Pill>
        </button>
      </div>

      <div
        className="mb-sm flex shrink-0 items-center rounded-xl border border-outline-variant bg-white p-1 shadow-sm"
      >
        {tabItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-md py-2.5 text-xs font-bold transition ${tab === item.key ? "bg-scm-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-low"}`}
          >
            <Icon name={item.icon} className="text-[17px]" />
            {item.label}
          </button>
        ))}
      </div>


      {tab === "impact" ? (
        <div className="flex h-[636px] min-h-[636px] max-h-[636px] flex-none flex-col gap-md overflow-hidden">
          <Section
            title="Case 탐지 요약"
            subtitle={isTamivir ? "수요예측 하향 신호와 권역별 과잉재고 위험을 결합해 의사결정 Case로 전환" : isLipilou ? "MES 품질 재검사와 권역별 목표재고 미달을 결합해 의사결정 Case로 전환" : "직접 공급 신호와 수급 위험 신호를 결합해 의사결정 Case로 전환"}
            action={<Pill tone="danger">{nationalPolicyRisk.grade}</Pill>}
            className="shrink-0"
            bodyClassName="p-sm"
          >
            <div className="grid grid-cols-4 gap-sm">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5">
                <p className="text-[10px] font-bold text-on-surface-variant">위험 등급 · 점수</p>
                <div className="mt-1 flex items-end justify-between gap-sm">
                  <strong className="font-data text-lg">{nationalPolicyRisk.score}/100</strong>
                  <span className="text-[10px] font-bold text-error">HIGH</span>
                </div>
                <div className="mt-1">
                  <SignalBar value={nationalPolicyRisk.score} tone="danger" />
                </div>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5">
                <p className="text-[10px] font-bold text-on-surface-variant">Case ID</p>
                <p className="mt-1 font-data text-[12px] font-bold text-on-surface">
                  {cefazolinDetectionContext.caseId}
                </p>
                <p className="text-[10px] text-on-surface-variant">
                  탐지 기준 {cefazolinDetectionContext.detectedAt}
                </p>
              </div>
              <div className="rounded-lg border border-error/20 bg-error-container/15 px-2 py-1.5">
                <p className="text-[10px] font-bold text-on-surface-variant">{isTamivir ? "직접 수요 신호" : isLipilou ? "직접 품질 신호" : "직접 공급 신호"}</p>
                <p className="mt-1 text-[13px] font-bold text-on-surface">
                  {cefazolinDetectionContext.directSignal}
                </p>
                <p className="truncate text-[10px] leading-4 text-on-surface-variant">
                  {cefazolinDetectionContext.supplyFulfillmentPct !== null
                    ? `ERP 공급이행률 ${cefazolinDetectionContext.supplyFulfillmentPct.toFixed(1)}%`
                    : `위험 신호 ${cefazolinDetectionContext.directSignalScore}/100`}
                  {cefazolinDetectionContext.eventId
                    ? ` · ${cefazolinDetectionContext.eventId}`
                    : ""}
                </p>
              </div>
              <div className="rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5">
                <p className="text-[10px] font-bold text-on-surface-variant">영향 범위</p>
                <p className="mt-1 font-data text-lg font-bold text-on-surface">
                  {isTamivir ? `과잉권역 ${excessRegions.length}개` : `부족권역 ${shortageRegions.length}개`}
                </p>
                <p className="truncate text-[10px] leading-4 text-on-surface-variant">
                  {affectedRegionNames.join(" · ")}
                </p>
              </div>
            </div>
          </Section>

          <div className="grid shrink-0 grid-cols-3 gap-md">
            <Metric
              dense
              label="현재 재고"
              value={`${fmt(cefazolinDashboard.totalInventory ?? 0)} ${finishedUnit}`}
              note={`목표 ${fmt(national.target_stock)} ${finishedUnit}`}
              icon="inventory_2"
              tone="danger"
            />
            <Metric
              dense
              label={isTamivir ? "AI 목표 대비 재고 비율" : "목표재고 충족률"}
              value={isTamivir ? `${national.stock_ratio.toFixed(1)}배` : `${national.stock_ratio.toFixed(1)}%`}
              note={isTamivir ? `심각한 과잉 ${tamivirSevereRegionCount}개 · 과잉 ${excessRegions.length - tamivirSevereRegionCount}개` : `부족권역 ${shortageRegions.length}개 · 과잉권역 ${excessRegions.length}개`}
              icon="donut_large"
              tone="danger"
            />
            <Metric
              dense
              label={isTamivir ? "AI 목표 초과 재고" : "목표재고 부족분"}
              value={`${fmt(isTamivir ? tamivirExcessStock : targetStockGap)} ${finishedUnit}`}
              note={isTamivir ? "전국 현재고에서 AI 목표재고를 차감" : "전국 목표재고 대비 현재 부족량"}
              icon="inventory"
              tone="warning"
            />
          </div>


          <div className="grid min-h-0 flex-1 grid-cols-12 gap-md">
            <div className="col-span-5 flex min-h-0">
              <Section
                title="원인 분석 및 위험 전파 경로"
                subtitle={isTamivir ? "수요 급감 → 재고 과잉 → 권역 창고 포화 → Dead Stock 위험" : "직접 공급 신호 → 재고 압박 → 권역 부족 → 서비스 위험"}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col gap-2 p-sm"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_14px_minmax(0,1fr)_14px_minmax(0,1fr)_14px_minmax(0,1fr)] items-stretch gap-0.5">
                  {propagationStages.map((stage, index) => (
                    <div key={stage.label} className="contents">
                      <div
                        className={`rounded-lg border p-1.5 ${stage.tone === "danger" ? "border-error/25 bg-error-container/15" : "border-[#ffd591] bg-[#fff7e6]"}`}
                      >
                        <p className="text-[9px] font-bold text-on-surface-variant">
                          {index + 1}. {stage.label}
                        </p>
                        <p className="mt-0.5 font-data text-[13px] font-bold leading-tight text-on-surface">
                          {stage.value}
                        </p>
                      </div>
                      {index < propagationStages.length - 1 ? (
                        <div className="flex items-center justify-center text-scm-primary">
                          <Icon name="arrow_forward" className="text-[13px]" />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg border border-error/20 bg-error-container/15 px-2 py-1">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-error">{isTamivir ? "직접 수요 신호" : "직접 공급 신호"}</p>
                    <p className="truncate text-[11px] font-bold text-on-surface">
                      {cefazolinDetectionContext.directSignal} ·{" "}
                      <span className="font-normal text-on-surface-variant">
                        {cefazolinDetectionContext.evidenceNote ?? cefazolinDetectionContext.source}
                      </span>
                    </p>
                  </div>
                  <Pill tone="danger">{directSupplyCause?.score ?? 0}/100</Pill>
                </div>

                <div className="flex min-h-0 flex-1 flex-col justify-between gap-0.5 overflow-hidden">
                  {contributingCauses.map((cause) => (
                    <div key={cause.label} className="min-h-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] font-bold text-on-surface">
                          {cause.label}
                        </span>
                        <span className="font-data text-[10px] font-bold text-on-surface-variant">
                          {cause.score}/100
                        </span>
                      </div>
                      <div className="mt-0.5">
                        <SignalBar value={cause.score} tone="muted" />
                      </div>
                    </div>
                  ))}
                </div>

              </Section>
            </div>

            <div className="col-span-7 flex min-h-0">
              <Section
                title={isTamivir ? "권역별 재고 비율" : "권역별 목표재고 충족률"}
                subtitle={isTamivir ? "데이터 통합과 동일한 현재 재고 ÷ 기준 재고 배수" : isLipilou ? "리피로우 데이터 통합과 동일한 현재 재고 ÷ 목표 재고" : "현재 재고 ÷ 목표 재고 · 100% 기준선 대비"}
                className="flex min-h-0 flex-1 flex-col"
                bodyClassName="flex min-h-0 flex-1 flex-col gap-1 p-sm"
                action={
                  <button
                    type="button"
                    onClick={() => setTab("response")}
                    className="shrink-0 rounded-lg bg-scm-primary px-3 py-1.5 text-[11px] font-bold text-white"
                  >
                    대응안 검토
                  </button>
                }
              >
                <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <i className="h-2 w-2 rounded-sm bg-error" /> {isTamivir ? "부족 (<1.0배)" : "부족 (<100%)"}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="h-2 w-2 rounded-sm bg-green-500" /> {isTamivir ? "적정 (1.0~3.0배)" : "적정 (100~120%)"}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="h-2 w-2 rounded-sm bg-[#eab308]" />
                    {isTamivir ? (
                      <>
                        과잉 (3.0~10.0배)
                        <i className="ml-1 h-2 w-2 rounded-full bg-[#f97316]" />
                        심각한 과잉 (10.0배 이상)
                      </>
                    ) : (
                      "과잉 (>120%)"
                    )}
                  </span>
                  <span className="ml-auto">
                    🔴 {isTamivir ? `심각한 과잉 권역 ${tamivirSevereRegionCount}개` : `위험 권역 ${shortageRegions.length}개`}
                  </span>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                    <BarChart
                      width={760}
                      height={260}
                      data={regionChartData}
                      margin={{ top: isTamivir ? 24 : 10, right: isTamivir ? 82 : 8, left: -18, bottom: 12 }}
                      barCategoryGap="22%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9 }}
                        interval={0}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 9 }}
                        domain={isTamivir ? [0.5, 35] : [0, 150]}
                        ticks={isTamivir ? [0.5, 1, 3, 10, 30] : [0, 50, 100, 150]}
                        scale={isTamivir ? "log" : "auto"}
                        axisLine={false}
                        tickLine={false}
                        unit={isTamivir ? "배" : "%"}
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        formatter={(value: number) => [isTamivir ? `${value.toFixed(1)}배` : `${value.toFixed(1)}%`, isTamivir ? "재고 비율" : "충족률"]}
                      />
                      <ReferenceLine
                        y={isTamivir ? 1 : 100}
                        stroke="#ef4444"
                        strokeDasharray="5 4"
                        label={{ value: isTamivir ? "1.0배 부족 기준" : "목표 100%", position: isTamivir ? "right" : "insideTopRight", fontSize: 9 }}
                      />
                      {isTamivir ? (
                        <ReferenceLine
                          y={10}
                          stroke="#f97316"
                          strokeDasharray="5 4"
                          label={{
                            value: "10배 심각 과잉",
                            position: "right",
                            fontSize: 9,
                          }}
                        />
                      ) : null}
                      <Bar dataKey="ratio" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                        <LabelList
                          dataKey="label"
                          position="top"
                          style={{ fontSize: 9, fontWeight: 700 }}
                        />
                        {regionChartData.map((row) => (
                          <Cell key={row.id} fill={row.color} />
                        ))}
                      </Bar>
                    </BarChart>
                </div>
              </Section>
            </div>
          </div>

        </div>
      ) : null}

      {tab === "response" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-sm overflow-hidden">
          <div className="grid shrink-0 grid-cols-5 gap-sm">
            <Metric
              dense
              label="추천 시나리오"
              value={recommendedScenario.displayId}
              note="제약 통과 기준"
              icon="recommend"
              tone="success"
            />
            <Metric
              dense
              label={isTamivir ? "적용 후 예상 재고" : isLipilou ? "예상 최저 권역 충족률" : "예상 서비스율"}
              value={isTamivir ? `${fmt(recommendedScenario.projectedInventory)} EA` : `${recommendedScenario.serviceRatePct.toFixed(1)}%`}
              note={isTamivir ? `S1 ${fmt(baselineScenario.projectedInventory)} EA` : `S1 ${baselineScenario.serviceRatePct.toFixed(1)}%`}
              icon="trending_up"
              tone="success"
            />
            <Metric
              dense
              label={isTamivir ? "잔여 과잉재고" : "미충족 수요"}
              value={`${fmt(isTamivir ? recommendedScenario.excessInventory : recommendedScenario.totalUnmetDemand)} ${finishedUnit}`}
              note={`S1 ${fmt(isTamivir ? baselineScenario.excessInventory : baselineScenario.totalUnmetDemand)} ${finishedUnit}`}
              icon="production_quantity_limits"
              tone="success"
            />
            <Metric
              dense
              label={isTamivir ? "재고 감축량" : isLipilou ? "재고 이관량" : "긴급조달"}
              value={`${fmt(recommendedScenario.emergencyProcurementQuantity)} ${procurementUnit}`}
              note={isTamivir ? "S2 실행 계획" : "S3 실행 조건"}
              icon="shopping_cart"
              tone="warning"
            />
            <Metric
              dense
              label={isTamivir ? "예상 비용절감" : isLipilou ? "예상 비용 효과" : "증분 조달비"}
              value={isTamivir || isLipilou ? recommendedScenario.costEffect : fmtKrw(cefazolinWorkflowEffect.procurementCostDeltaKrw)}
              note="S1 대비"
              icon="payments"
              tone="warning"
            />
          </div>

          <Section
            title="S1·S2·S3 대응안 비교"
            className="shrink-0"
            bodyClassName="p-sm"
            action={
              <button
                type="button"
                onClick={() => setTab("approval")}
                className="rounded-lg bg-scm-primary px-3 py-1.5 text-[11px] font-bold text-white"
              >
                추천안 승인 검토
              </button>
            }
          >
            <div className="grid grid-cols-3 gap-sm">
              {scenarioRows.map((scenario) => {
                const recommended = scenario.id === recommendedScenarioId;
                return (
                  <article
                    key={scenario.id}
                    className={`rounded-xl border p-sm ${recommended ? "border-scm-primary bg-primary-container/20 shadow-sm" : "border-outline-variant bg-white"}`}
                  >
                    <div className="flex items-center justify-between gap-sm">
                      <div className="flex items-baseline gap-2">
                        <h4 className="font-display text-sm font-bold text-on-surface">
                          {scenario.displayId}
                        </h4>
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                          {scenario.response}
                        </p>
                      </div>
                      {recommended ? (
                        <Pill tone="success">추천</Pill>
                      ) : (
                        <Pill tone={scenario.constraintPassed ? "neutral" : "danger"}>
                          {scenario.constraintPassed ? "검토" : "제약 미통과"}
                        </Pill>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] text-on-surface-variant">{isTamivir ? "위험점수" : "서비스율"}</span>
                      <strong className="font-data text-xs">
                        {isTamivir ? `${scenario.riskScore}/100` : `${scenario.serviceRatePct.toFixed(1)}%`}
                      </strong>
                      <div className="min-w-0 flex-1">
                        <SignalBar
                          value={isTamivir ? scenario.riskScore : scenario.serviceRatePct}
                          tone={
                            isTamivir
                              ? scenario.riskScore >= 80
                                ? "danger"
                                : scenario.riskScore >= 50
                                  ? "warning"
                                  : "success"
                              : recommended
                                ? "success"
                                : scenario.constraintPassed
                                  ? "primary"
                                  : "danger"
                          }
                        />
                      </div>
                    </div>
                    <dl className="mt-1.5 grid grid-cols-4 gap-xs text-[11px]">
                      <div className="rounded-lg bg-surface-container-low px-2 py-1">
                        <dt className="text-[10px] text-on-surface-variant">{isTamivir || isLipilou ? "실행가능성" : "최저 권역"}</dt>
                        <dd className="font-data font-bold">
                          {(isTamivir || isLipilou ? scenario.feasibilityPct : scenario.minimumRegionalServiceRatePct).toFixed(1)}%
                        </dd>
                      </div>
                      <div className="rounded-lg bg-surface-container-low px-2 py-1">
                        <dt className="text-[10px] text-on-surface-variant">{isTamivir ? "과잉재고" : "미충족"}</dt>
                        <dd className="whitespace-nowrap font-data font-bold">
                          {fmt(isTamivir ? scenario.excessInventory : scenario.totalUnmetDemand)}
                          <span className="ml-1 text-[9px] font-normal text-on-surface-variant">
                            {finishedUnit}
                          </span>
                        </dd>
                      </div>
                      <div className="rounded-lg bg-surface-container-low px-2 py-1">
                        <dt className="text-[10px] text-on-surface-variant">{isTamivir ? "실행기간" : "부족기간"}</dt>
                        <dd className="font-data font-bold">{isTamivir || isLipilou ? scenario.executionPeriod : `${scenario.shortageWeeks}주`}</dd>
                      </div>
                      <div className="rounded-lg bg-surface-container-low px-2 py-1">
                        <dt className="text-[10px] text-on-surface-variant">{isTamivir ? "비용효과" : "총 조달비"}</dt>
                        <dd className="whitespace-nowrap font-data font-bold">
                          {isTamivir || isLipilou ? scenario.costEffect : fmtKrw(scenario.totalProcurementCostKrw)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          </Section>

          <Section
            title="실행가능성·제약조건"
            className="flex min-h-0 flex-1 flex-col"
            bodyClassName="flex min-h-0 flex-1 flex-col gap-sm p-sm"
          >
            <div className="grid shrink-0 grid-cols-4 gap-sm">
              <div className="rounded-xl border border-outline-variant px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-on-surface-variant">
                    {isTamivir ? "S2 재고 감축 효과" : "WMS 재고 재배분"}
                  </span>
                  <Pill tone="success">{isTamivir ? "효과 확인" : "물량 확인"}</Pill>
                </div>
                <p className="mt-1 font-data text-sm font-bold">
                  {isTamivir
                    ? `${fmt(baselineScenario.projectedInventory - recommendedScenario.projectedInventory)} EA`
                    : `${fmt(cefazolinDashboard.transferableQuantityByRegion.National)} ${finishedUnit}`}
                </p>
                <p className="text-[10px] text-on-surface-variant">
                  {isTamivir
                    ? `${fmt(baselineScenario.projectedInventory)} → ${fmt(recommendedScenario.projectedInventory)} EA`
                    : `과잉권역 ${excessRegions.length}개 · 부족권역 ${shortageRegions.length}개`}
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-on-surface-variant">
                    MES 생산 조건
                  </span>
                  <Pill tone="warning">확인 필요</Pill>
                </div>
                <p className="mt-1 font-data text-sm font-bold">
                  가동률 {cefazolinDashboard.utilization?.toFixed(1) ?? "-"}%
                </p>
                <p className="text-[10px] leading-4 text-on-surface-variant">
                  {isTamivir ? "경기/인천·영남권 핀셋 감축 일정과 생산계획 조정" : isLipilou ? "서울→제주 이관 일정 및 A라인 품질 재검사 일정 조정" : "추가 원료 입고 일정 및 품질재검사 일정 조정"}
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-on-surface-variant">
                    {isTamivir ? "ERP 발주 보류" : isLipilou ? "ERP 배분계획 변경" : "ERP 긴급조달"}
                  </span>
                  <Pill tone="warning">일정 확인</Pill>
                </div>
                <p className="mt-1 font-data text-sm font-bold">
                  {isTamivir ? "계획 재산정" : `${fmt(recommendedScenario.emergencyProcurementQuantity)} ${procurementUnit}`}
                </p>
                <p className="truncate text-[10px] text-on-surface-variant">
                  {recommendedEvaluation?.executionPeriod ?? (isTamivir ? "발주 보류·생산 감축 일정 확인" : isLipilou ? "서울 출고·제주 입고 일정 확인" : "공급사 입고 일정 확인")}
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-on-surface-variant">
                    주요 선행조건
                  </span>
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                    주의
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5 text-[10px] leading-4 text-on-surface">
                  <li className="flex gap-1">
                    <span className="text-red-600">•</span>
                    <span>{isTamivir ? "미확정 신규 발주 보류 대상 확정" : isLipilou ? "서울 출고·제주 입고 슬롯 확보" : "공급사 입고 일정 확보"}</span>
                  </li>
                  <li className="flex gap-1">
                    <span className="text-red-600">•</span>
                    <span>{isTamivir ? "MES 감축 가능량 및 기존 생산 LOT 종료 후 적용 일정 확인" : isLipilou ? "MES A라인 품질 재검사와 출하 가능 일정 확인" : "입고 원료 품질검사 및 생산투입 승인"}</span>
                  </li>
                  <li className="flex gap-1">
                    <span className="text-red-600">※</span>
                    <span>상기 조건 충족을 전제로 한 시뮬레이션 결과</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-outline-variant">
              <div className="border-b border-outline-variant/60 bg-surface-container-low px-sm py-0.5">
                <p className="text-[11px] font-bold text-on-surface">
                  {recommendedScenario.displayId} 실행계획
                </p>
              </div>
              <table className="w-full text-left text-[12px]">
                <thead className="bg-surface-container-low text-[10px] uppercase text-on-surface-variant">
                  <tr>
                    <th className="px-sm py-1">시스템</th>
                    <th className="px-sm py-1">작업</th>
                    <th className="px-sm py-1 text-right">수량·기준</th>
                    <th className="px-sm py-1">추천 근거 / 산출 기준</th>
                  </tr>
                </thead>
                <tbody>
                  {responseExecutionRows.map((row) => (
                    <tr key={row.id} className="border-t border-outline-variant/40">
                      <td className="px-sm py-0.5">
                        <Pill tone="primary">{row.system}</Pill>
                      </td>
                      <td className="px-sm py-0.5 text-[11px] font-bold leading-tight">
                        {row.title}
                      </td>
                      <td className="px-sm py-0.5 text-right font-data font-bold">
                        {row.quantity == null
                          ? "계획 재산정"
                          : `${fmt(row.quantity)} ${row.unit}`}
                      </td>
                      <td className="px-sm py-0.5 text-[10px] leading-tight text-on-surface-variant">
                        {row.basis}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      ) : null}

      {tab === "approval" ? (
        <div className="grid grid-cols-12 gap-md">
          <div className="col-span-7 space-y-md">
            <Section
              title="승인 대상"
              action={<Pill tone="success">{recommendedScenario.displayId}</Pill>}
            >
              <div className="grid grid-cols-4 gap-xs">
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-[10px] text-on-surface-variant">{isTamivir ? "예상 재고" : isLipilou ? "최저 권역 충족률" : "서비스율"}</p>
                  <p className="mt-1 font-data text-lg font-bold">
                    {isTamivir ? `${fmt(recommendedScenario.projectedInventory)} EA` : `${recommendedScenario.serviceRatePct.toFixed(1)}%`}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-[10px] text-on-surface-variant">{isTamivir ? "잔여 과잉" : "미충족"}</p>
                  <p className="mt-1 font-data text-lg font-bold">
                    {fmt(isTamivir ? recommendedScenario.excessInventory : recommendedScenario.totalUnmetDemand)} {finishedUnit}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-[10px] text-on-surface-variant">{isTamivir ? "비용 절감" : isLipilou ? "비용 효과" : "증분 조달비"}</p>
                  <p className="mt-1 font-data text-lg font-bold">
                    {isTamivir || isLipilou ? recommendedScenario.costEffect : fmtKrw(cefazolinWorkflowEffect.procurementCostDeltaKrw)}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-[10px] text-on-surface-variant">제약 판정</p>
                  <p className="mt-1 text-lg font-bold text-green-700">PASS</p>
                </div>
              </div>
            </Section>

            <Section title="승인 조건" subtitle="추천안 실행 전 필수 확인 항목">
              <div className="space-y-xs">
                {approvalChecklistItems.map((item) => (
                  <label
                    key={item.key}
                    className={`flex items-start gap-sm rounded-xl border border-outline-variant p-sm ${approvalLocked ? "cursor-default bg-surface-container-low/40" : "cursor-pointer hover:border-scm-primary/40"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checklist[item.key]}
                      disabled={approvalLocked}
                      onChange={(event) =>
                        setChecklist((current) => ({
                          ...current,
                          [item.key]: event.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 accent-[var(--scm-primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-sm">
                        <span className="block text-xs font-bold text-on-surface">
                          {item.label}
                        </span>
                        <Pill tone={checklist[item.key] ? "success" : "neutral"}>
                          {checklist[item.key] ? "확인" : "미확인"}
                        </Pill>
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-on-surface-variant">
                        {item.detail}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </Section>
          </div>

          <div className="col-span-5 space-y-md">
            <Section title="승인 기록">
              <div className="space-y-sm">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold text-on-surface-variant">
                    승인자
                  </span>
                  <input
                    value={reviewer}
                    disabled={approvalLocked}
                    onChange={(event) => setReviewer(event.target.value)}
                    placeholder="성명 입력"
                    className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-scm-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold text-on-surface-variant">
                    역할
                  </span>
                  <select
                    value={reviewerRole}
                    disabled={approvalLocked}
                    onChange={(event) => setReviewerRole(event.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-scm-primary"
                  >
                    <option>SCM 운영</option>
                    <option>구매</option>
                    <option>생산계획</option>
                    <option>품질보증</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold text-on-surface-variant">
                    검토 의견
                  </span>
                  <textarea
                    value={reviewNote}
                    disabled={approvalLocked}
                    onChange={(event) => setReviewNote(event.target.value)}
                    rows={4}
                    placeholder="조건·예외사항 입력"
                    className="w-full resize-none rounded-xl border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-scm-primary"
                  />
                </label>
                <div className="flex gap-xs pt-xs">
                  <button
                    type="button"
                    onClick={hold}
                    disabled={approvalLocked || !holdReady}
                    className="flex-1 rounded-xl border border-[#ffd591] bg-[#fff7e6] px-sm py-2.5 text-xs font-bold text-[#ad6800] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    보완 요청
                  </button>
                  <button
                    type="button"
                    onClick={approve}
                    disabled={approvalLocked || !approvalReady}
                    className="flex-1 rounded-xl bg-scm-primary px-sm py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    최종 승인
                  </button>
                </div>
                <div className="h-9 space-y-1" aria-live="polite">
                  <p
                    className={`text-[10px] font-medium ${
                      approvalReady ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    <span className="mr-1" aria-hidden="true">
                      {approvalReady ? "✓" : "*"}
                    </span>
                    {approvalReady
                      ? "최종 승인: 승인 조건이 모두 충족되었습니다."
                      : "최종 승인: 승인자 입력과 필수 검토 4건 완료가 필요합니다."}
                  </p>
                  <p
                    className={`text-[10px] font-medium ${
                      holdReady ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    <span className="mr-1" aria-hidden="true">
                      {holdReady ? "✓" : "*"}
                    </span>
                    {holdReady
                      ? "보완 요청: 승인자와 검토 의견이 입력되었습니다."
                      : "보완 요청: 승인자와 검토 의견을 입력해야 합니다."}
                  </p>
                </div>
              </div>
            </Section>
            <Section title="추적 정보">
              <dl className="space-y-xs text-[11px]">
                <div className="flex justify-between gap-md">
                  <dt className="text-on-surface-variant">Run ID</dt>
                  <dd className="font-data font-bold">{cefazolinWorkflowRunMeta.runId}</dd>
                </div>
                <div className="flex justify-between gap-md">
                  <dt className="text-on-surface-variant">데이터 기준</dt>
                  <dd className="text-right font-bold">
                    {cefazolinWorkflowRunMeta.latestSnapshotDate}
                  </dd>
                </div>
                <div className="flex justify-between gap-md">
                  <dt className="text-on-surface-variant">적용 규칙</dt>
                  <dd className="text-right font-bold">
                    {cefazolinDecisionEvidence.rules.length}건
                  </dd>
                </div>
                <div className="flex justify-between gap-md">
                  <dt className="text-on-surface-variant">승인 상태</dt>
                  <dd>
                    <Pill
                      tone={
                        hitlStatus === "approved"
                          ? "success"
                          : hitlStatus === "held"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {hitlStatus === "approved"
                        ? "승인 완료"
                        : hitlStatus === "held"
                          ? "보완 요청"
                          : "대기"}
                    </Pill>
                  </dd>
                </div>
              </dl>
            </Section>
          </div>
        </div>
      ) : null}

      {tab === "execution" ? (
        <div className="space-y-md">
          <div className="grid grid-cols-5 gap-sm">
            <Metric
              label="실행 상태"
              value={
                executionStatus === "executed"
                  ? "전송 완료"
                  : executionStatus === "ready"
                    ? "전송 준비"
                    : "승인 대기"
              }
              note={`승인 ${hitlStatus === "approved" ? "완료" : "미완료"}`}
              icon="play_circle"
              tone={
                executionStatus === "executed"
                  ? "success"
                  : executionStatus === "ready"
                    ? "primary"
                    : "warning"
              }
            />
            <Metric
              label={isTamivir ? "적용 후 예상 재고" : isLipilou ? "계획 최저 권역 충족률" : "계획 서비스율"}
              value={isTamivir ? `${fmt(recommendedScenario.projectedInventory)} EA` : `${cefazolinWorkflowEffect.serviceRateAfter.toFixed(1)}%`}
              note={isTamivir ? `S1 ${fmt(baselineScenario.projectedInventory)} EA` : `S1 ${cefazolinWorkflowEffect.serviceRateBefore.toFixed(1)}%`}
              icon="speed"
              tone="success"
            />
            <Metric
              label={isTamivir ? "잔여 과잉재고" : "잔여 미충족"}
              value={`${fmt(isTamivir ? recommendedScenario.excessInventory : cefazolinWorkflowEffect.unmetDemandAfter)} ${finishedUnit}`}
              note={`S1 ${fmt(isTamivir ? baselineScenario.excessInventory : cefazolinWorkflowEffect.unmetDemandBefore)} ${finishedUnit}`}
              icon="inventory"
              tone="success"
            />
            <Metric
              label={isTamivir || isLipilou ? "실행 기간" : "부족기간"}
              value={isTamivir || isLipilou ? recommendedScenario.executionPeriod : `${cefazolinWorkflowEffect.shortageWeeksAfter}주`}
              note={isTamivir || isLipilou ? `S1 ${baselineScenario.executionPeriod}` : `S1 ${cefazolinWorkflowEffect.shortageWeeksBefore}주`}
              icon="calendar_month"
              tone="success"
            />
            <Metric
              label={isTamivir ? "예상 비용절감" : isLipilou ? "예상 비용 효과" : "증분 조달비"}
              value={isTamivir || isLipilou ? recommendedScenario.costEffect : fmtKrw(cefazolinWorkflowEffect.procurementCostDeltaKrw)}
              note="S1 대비"
              icon="payments"
              tone="warning"
            />
          </div>

          <Section
            title="시스템 실행지시"
            subtitle={isTamivir ? "ERP · MES 실행지시 전송 상태" : "ERP · MES · WMS 실행지시 전송 상태"}
            action={
              <button
                type="button"
                disabled={executionStatus !== "ready"}
                onClick={execute}
                className="rounded-lg bg-scm-primary px-3 py-2 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                실행지시 전송
              </button>
            }
          >
            <div className="overflow-hidden rounded-xl border border-outline-variant">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-surface-container-low text-[10px] uppercase text-on-surface-variant">
                  <tr>
                    <th className="px-sm py-xs">시스템</th>
                    <th className="px-sm py-xs">지시 ID</th>
                    <th className="px-sm py-xs">실행 항목</th>
                    <th className="px-sm py-xs">대상</th>
                    <th className="px-sm py-xs text-right">수량</th>
                    <th className="px-sm py-xs">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {executionRows.map((action) => (
                    <tr key={action.id} className="border-t border-outline-variant/40">
                      <td className="px-sm py-xs">
                        <Pill tone="primary">{action.system}</Pill>
                      </td>
                      <td className="px-sm py-xs font-data text-[10px]">{action.id}</td>
                      <td className="px-sm py-xs font-bold">{action.title}</td>
                      <td className="px-sm py-xs text-[10px] text-on-surface-variant">
                        {action.target}
                      </td>
                      <td className="px-sm py-xs text-right font-data">
                        {action.quantity === null
                          ? "재산정"
                          : `${fmt(action.quantity)} ${
                              isTamivir && action.unit === "완제품 환산단위"
                                ? "EA"
                                : actionUnit(action.unit)
                            }`}
                      </td>
                      <td className="px-sm py-xs">
                        <Pill
                          tone={
                            executionStatus === "executed"
                              ? "success"
                              : executionStatus === "ready"
                                ? "primary"
                                : "neutral"
                          }
                        >
                          {executionStatus === "executed"
                            ? "전송 완료"
                            : executionStatus === "ready"
                              ? "전송 준비"
                              : "잠금"}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {executionStatus === "executed" ? (
            <Section
              title="영향권역 개선"
              subtitle={
                isTamivir
                  ? `현재 과잉권역 ${affectedRegionImprovementRows.length}개 · ${recommendedScenario.displayId} 적용 후 예상 재고 ${fmt(recommendedScenario.projectedInventory)} EA`
                  : `현재 부족권역 ${affectedRegionImprovementRows.length}개 · ${recommendedScenario.displayId} 최소 권역 서비스율 ${recommendedScenario.minimumRegionalServiceRatePct.toFixed(1)}%`
              }
            >
              <div className="grid grid-cols-3 gap-sm">
                {affectedRegionImprovementRows.map((region) => (
                  <div
                    key={region.id}
                    className="rounded-xl border border-outline-variant bg-white p-sm"
                  >
                    <div className="flex items-center justify-between gap-sm">
                      <span className="text-xs font-bold text-on-surface">{region.name}</span>
                      <Pill tone={isTamivir ? (region.currentValue >= 10 ? "danger" : "warning") : "danger"}>
                        {isTamivir ? (region.currentValue >= 10 ? "심각한 과잉" : "과잉") : "현재 부족"}
                      </Pill>
                    </div>
                    <div className="mt-sm flex items-stretch gap-xs">
                      <div className="min-w-0 flex-1 rounded-lg bg-error-container/20 px-sm py-xs">
                        <p className="text-[9px] text-on-surface-variant">{isTamivir ? "현재 재고 비율" : "현재 목표재고 충족률"}</p>
                        <p className="mt-1 font-data text-lg font-bold text-error">
                          {region.currentValue.toFixed(1)}{isTamivir ? "배" : "%"}
                        </p>
                      </div>
                      <span className="flex items-center justify-center text-scm-primary">
                        <Icon name="arrow_forward" className="text-[18px]" />
                      </span>
                      <div
                        className={`min-w-0 flex-1 rounded-lg px-sm py-xs ${
                          isTamivir && region.afterStatus !== "적정"
                            ? "bg-[#fff7e6]"
                            : "bg-green-50"
                        }`}
                      >
                        <p
                          className={`text-[9px] ${
                            isTamivir && region.afterStatus !== "적정"
                              ? "text-[#ad6800]"
                              : "text-green-700"
                          }`}
                        >
                          {recommendedScenario.displayId} 적용 후
                        </p>
                        {isTamivir ? (
                          <>
                            <p
                              className={`mt-1 font-data text-lg font-bold ${
                                region.afterStatus !== "적정"
                                  ? "text-[#ad6800]"
                                  : "text-green-700"
                              }`}
                            >
                              {region.afterValue?.toFixed(1) ?? "-"}배
                            </p>
                            <p
                              className={`text-[9px] font-bold ${
                                region.afterStatus !== "적정"
                                  ? "text-[#ad6800]"
                                  : "text-green-700"
                              }`}
                            >
                              {region.afterStatus ?? "확인 필요"}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 text-sm font-bold text-green-700">서비스 정상화</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-sm flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-container-low px-sm py-xs text-[10px] text-on-surface-variant">
                <span>
                  {isTamivir
                    ? `근거 · 예상 재고 ${fmt(recommendedScenario.projectedInventory)} EA · 잔여 과잉 ${fmt(recommendedScenario.excessInventory)} EA · 비용 ${recommendedScenario.costEffect}`
                    : `근거 · 최저 권역 서비스율 ${recommendedScenario.minimumRegionalServiceRatePct.toFixed(1)}% · 미충족 ${fmt(recommendedScenario.totalUnmetDemand)} ${finishedUnit} · 부족기간 ${recommendedScenario.shortageWeeks}주`}
                </span>
                <span>
                  {isTamivir
                    ? "※ S2 after_apply 원천 데이터 기준"
                    : "※ 사후 권역별 재고 수치는 원천 데이터 미제공으로 임의 산출하지 않음"}
                </span>
              </div>
            </Section>
          ) : null}
        </div>
      ) : null}

      {showWorkflow ? (
        <div
          className="fixed inset-0 z-[500] bg-black/25"
          onMouseDown={() => setShowWorkflow(false)}
        >
          <aside
            className="absolute bottom-0 right-0 top-0 w-[520px] overflow-y-auto border-l border-outline-variant bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-outline-variant bg-white px-lg py-md">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-scm-primary">
                  Workflow Status
                </p>
                <h3 className="font-display text-lg font-bold">10단계 처리 상태</h3>
              </div>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setShowWorkflow(false)}
                className="rounded-full p-2 hover:bg-surface-container-low"
              >
                <Icon name="close" />
              </button>
            </header>
            <div className="space-y-xs p-md">
              {cefazolinWorkflowSteps.map((step) => {
                const status =
                  step.order === 10 && executionStatus === "executed"
                    ? "verified"
                    : workflow.stepStatuses[step.order];
                const label =
                  status === "verified"
                    ? "완료"
                    : status === "approval_pending"
                      ? "승인 대기"
                      : status === "available"
                        ? "실행 가능"
                        : status === "approved"
                          ? "승인 완료"
                          : status === "executed"
                            ? "전송 완료"
                            : status === "held"
                              ? "보완 요청"
                              : "잠금";
                const tone =
                  status === "verified" || status === "approved" || status === "executed"
                    ? "success"
                    : status === "approval_pending" || status === "available"
                      ? "primary"
                      : status === "held"
                        ? "warning"
                        : "neutral";
                return (
                  <div
                    key={step.id}
                    className={`rounded-xl border p-sm ${step.order === activeStep ? "border-scm-primary bg-primary-container/15" : "border-outline-variant"}`}
                  >
                    <div className="flex items-start gap-sm">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.order === activeStep ? "bg-scm-primary text-white" : "bg-surface-container-high text-on-surface-variant"}`}
                      >
                        {step.order}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-sm">
                          <p className="text-xs font-bold">{step.shortTitle}</p>
                          <Pill tone={tone}>{label}</Pill>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[10px] text-on-surface-variant">
                          {step.evidence[0]}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export function CefazolinDecisionExecutionView({ product }: { product: Product }) {
  if (product.key === "리피로우" && !lipilouDashboard) {
    return <ProductNotConnected product={product} />;
  }
  return <CefazolinOnlyDecisionExecutionView key={product.key} product={product} />;
}
