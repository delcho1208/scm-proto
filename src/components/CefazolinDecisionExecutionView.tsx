import { useState, type ReactNode } from "react";
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
  type ProductDashboardScenario,
} from "@/data/dashboard-scenario";
import { lipilouWorkflowSteps } from "@/data/lipilou-ai-workflow";
import { cefazolinDashboard } from "@/data/cefazolin-dashboard";
import {
  cefazolinDecisionEvidence,
  cefazolinDetectionContext,
  cefazolinScenarioComparison,
  cefazolinScenarioRecommendation,
  cefazolinVirtualExecutionActions,
  cefazolinWorkflowEffect,
  cefazolinWorkflowRunMeta,
  cefazolinWorkflowSteps,
  getCefazolinWorkflowRunState,
} from "@/data/cefazolin-ai-workflow";
import type { ExecutionStatus, HitlStatus } from "@/services/scm-workflow-orchestrator";

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
  if (actionType.includes("발주")) return "ERP";
  if (actionType.includes("생산")) return "MES";
  return "WMS";
}

function actionUnit(unit: string) {
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
  const [tab, setTab] = useState<TabKey>("response");
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
    <div className="dashboard-fixed-layout flex-1 bg-surface px-lg pb-16 pt-16">
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
          </div>
          <h2 className="font-display text-headline-md text-on-surface">
            {product.name} 의사결정 실행
          </h2>
          <p className="mt-xs text-sm text-on-surface-variant">
            {dashboard.sceneName} · 데이터 기준 {dashboard.date}
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

      <nav className="mb-md flex items-center rounded-xl border border-outline-variant bg-white p-1.5 shadow-sm">
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
        <div className="space-y-md">
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
            <Section title="필수 검토사항">
              <div className="space-y-xs">
                {[
                  ["cost", "추가 조달비·비용 효과 확인"],
                  ["supplier", "공급사·입고 일정 확인"],
                  ["quality", "품질 승인 전제 확인"],
                  ["transfer", "권역 재배분 가능량 확인"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-sm rounded-xl border border-outline-variant p-sm text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={checks[key as keyof typeof checks]}
                      onChange={(event) =>
                        setChecks((current) => ({ ...current, [key]: event.target.checked }))
                      }
                      className="accent-[#004ccd]"
                    />
                    {label}
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
                  className="flex-1 rounded-lg border border-[#ffd591] bg-[#fff7e6] py-sm text-xs font-bold text-[#ad6800]"
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
  const [tab, setTab] = useState<TabKey>("impact");
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [hitlStatus, setHitlStatus] = useState<HitlStatus>("pending");
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>("locked");
  const [reviewer, setReviewer] = useState("");
  const [reviewerRole, setReviewerRole] = useState("SCM 운영");
  const [reviewNote, setReviewNote] = useState("");
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>(initialChecklist);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(cefazolinWorkflowRunMeta.latestSnapshotDate);

  if (product.key !== "세파졸린") return <ProductNotConnected product={product} />;

  const national = cefazolinDashboard.regions.National;
  const nationalPolicyRisk = cefazolinDashboard.policyRiskByRegion.National;
  const riskCauses = [...nationalPolicyRisk.causes].sort((a, b) => b.score - a.score);
  const regions = Object.values(cefazolinDashboard.regions).filter(
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
  const affectedRegionNames = shortageRegions.map((region) =>
    region.region.split("_").slice(1).join("_"),
  );
  const regionChartData = regions.map((region) => {
    const name = region.region.split("_").slice(1).join("_");
    const ratio = region.stock_ratio;
    const color =
      region.riskLevel === "danger"
        ? "#ef4444"
        : region.riskLevel === "warning"
          ? "#f59e0b"
          : "#22c55e";
    return {
      id: region.id,
      name,
      ratio,
      color,
      label: `${ratio.toFixed(0)}%`,
    };
  });

  const propagationStages = [
    {
      label: "공급 이행 저하",
      value:
        cefazolinDetectionContext.supplyFulfillmentPct !== null
          ? `${cefazolinDetectionContext.supplyFulfillmentPct.toFixed(1)}%`
          : `${directSupplyCause?.score ?? 0}/100`,
      note: cefazolinDetectionContext.eventId
        ? `${cefazolinDetectionContext.eventId} 공급 신호`
        : "ERP 공급 신호",
      tone: "danger" as const,
    },
    {
      label: "재고 압박",
      value: `${national.stock_ratio.toFixed(1)}%`,
      note: "목표재고 충족률",
      tone: "warning" as const,
    },
    {
      label: "권역 부족",
      value: `${shortageRegions.length}개`,
      note: affectedRegionNames.join(" · "),
      tone: "warning" as const,
    },
    {
      label: "서비스 위험",
      value: `${baselineScenario.serviceRatePct.toFixed(1)}%`,
      note: "S1 무대응 예상 서비스율",
      tone: "danger" as const,
    },
  ];
  const recommendedEvaluation =
    cefazolinDashboard.recommendationEvaluations.find((item) => item.recommended) ??
    cefazolinDashboard.recommendationEvaluations.find(
      (item) => item.scenarioId === recommendedScenario.displayId,
    );
  const qualityCondition =
    recommendedEvaluation?.xai.conditions.find((item) => item.includes("품질")) ??
    "MES 품질검사·출하승인 완료 여부 확인";
  const approvalChecklistItems: Array<{ key: ChecklistKey; label: string; detail: string }> = [
    {
      key: "cost",
      label: "증분 조달비 확인",
      detail: `S1 대비 ${fmtKrw(cefazolinWorkflowEffect.procurementCostDeltaKrw)} 증가분 및 예산 범위 확인`,
    },
    {
      key: "supplier",
      label: "공급사 입고 일정 확인",
      detail: recommendedEvaluation?.executionPeriod ?? "긴급조달 입고 일정 확인",
    },
    { key: "quality", label: "MES 품질 승인 전제 확인", detail: qualityCondition },
    {
      key: "transfer",
      label: "권역 재배분 가능량 확인",
      detail: `${fmt(cefazolinDashboard.transferableQuantityByRegion.National)} VIAL 환산 · 과잉권역 ${excessRegions.length}개`,
    },
  ];
  const checklistComplete = approvalChecklistItems.every((item) => checklist[item.key]);
  const approvalReady = reviewer.trim().length > 0 && checklistComplete;
  const holdReady = reviewer.trim().length > 0 && reviewNote.trim().length > 0;
  const workflow = getCefazolinWorkflowRunState({ hitlStatus, executionStatus, lastUpdatedAt });
  const activeStep = Math.max(1, workflow.currentStep);

  const executionRows = cefazolinVirtualExecutionActions.map((action) => ({
    ...action,
    system: actionSystem(action.actionType),
  }));

  const approve = () => {
    if (!approvalReady) return;
    const now = new Date().toISOString();
    setHitlStatus("approved");
    setExecutionStatus("ready");
    setLastUpdatedAt(now);
    setTab("execution");
  };

  const hold = () => {
    if (!holdReady) return;
    const now = new Date().toISOString();
    setHitlStatus("held");
    setExecutionStatus("locked");
    setLastUpdatedAt(now);
  };

  const execute = () => {
    if (hitlStatus !== "approved" || executionStatus !== "ready") return;
    const now = new Date().toISOString();
    setExecutionStatus("executed");
    setLastUpdatedAt(now);
  };

  return (
    <div
      className={`dashboard-fixed-layout flex flex-1 flex-col bg-surface px-lg pt-16 ${tab === "impact" ? "h-[880px] min-h-[880px] max-h-[880px] overflow-hidden pb-12" : "pb-16"}`}
    >
      <div
        className={`flex items-end justify-between gap-lg ${tab === "impact" ? "shrink-0 py-1" : "py-lg"}`}
      >

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
              CEFA-SUPPLY-20261028-01
            </span>
            <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-[9px] font-bold text-on-surface-variant">
              SANDBOX · SYNTHETIC DATA
            </span>
          </div>
          <h2
            className={`font-display text-on-surface ${tab === "impact" ? "text-[22px] font-bold leading-tight" : "text-headline-md"}`}
          >
            세파졸린 의사결정 실행
          </h2>
          <p
            className={`text-on-surface-variant ${tab === "impact" ? "text-[11px]" : "mt-xs text-sm"}`}
          >
            수급 이상 탐지 · Case 영향 분석 · 데이터 기준{" "}
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
          <Pill tone="primary">{workflow.completedSteps.length}/10</Pill>
        </button>
      </div>

      <div
        className={`shrink-0 flex items-center rounded-xl border border-outline-variant bg-white p-1 shadow-sm ${tab === "impact" ? "mb-1" : "mb-sm"}`}
      >
        {tabItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-md text-xs font-bold transition ${tab === "impact" ? "py-1.5" : "py-2.5"} ${tab === item.key ? "bg-scm-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-low"}`}
          >
            <Icon name={item.icon} className="text-[17px]" />
            {item.label}
          </button>
        ))}
      </div>


      {tab === "impact" ? (
        <div className="flex h-[664px] min-h-[664px] max-h-[664px] flex-none flex-col gap-sm overflow-hidden">
          <Section
            title="Case 탐지 요약"
            subtitle="직접 공급 신호와 수급 위험 신호를 결합해 의사결정 Case로 전환"
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
                <p className="text-[10px] font-bold text-on-surface-variant">직접 공급 신호</p>
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
                  부족권역 {shortageRegions.length}개
                </p>
                <p className="truncate text-[10px] leading-4 text-on-surface-variant">
                  {affectedRegionNames.join(" · ")}
                </p>
              </div>
            </div>
          </Section>

          <div className="grid shrink-0 grid-cols-3 gap-sm">
            <Metric
              dense
              label="현재 재고"
              value={`${fmt(cefazolinDashboard.totalInventory ?? 0)} VIAL 환산`}
              note={`목표 ${fmt(national.target_stock)} VIAL 환산`}
              icon="inventory_2"
              tone="danger"
            />
            <Metric
              dense
              label="목표재고 충족률"
              value={`${national.stock_ratio.toFixed(1)}%`}
              note={`부족권역 ${shortageRegions.length}개 · 과잉권역 ${excessRegions.length}개`}
              icon="donut_large"
              tone="danger"
            />
            <Metric
              dense
              label="목표재고 부족분"
              value={`${fmt(targetStockGap)} VIAL 환산`}
              note="전국 목표재고 대비 현재 부족량"
              icon="inventory"
              tone="warning"
            />
          </div>


          <div className="grid min-h-0 flex-1 grid-cols-12 gap-sm">
            <div className="col-span-5 flex min-h-0">
              <Section
                title="원인 분석 및 위험 전파 경로"
                subtitle="직접 공급 신호 → 재고 압박 → 권역 부족 → 서비스 위험"
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
                    <p className="text-[9px] font-bold text-error">직접 공급 신호</p>
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
                title="권역별 목표재고 충족률"
                subtitle="현재 재고 ÷ 목표 재고 · 100% 기준선 대비"
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
                    <i className="h-2 w-2 rounded-sm bg-error" /> 부족 (&lt;100%)
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="h-2 w-2 rounded-sm bg-green-500" /> 적정
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="h-2 w-2 rounded-sm bg-[#f59e0b]" /> 과잉
                  </span>
                  <span className="ml-auto">🔴 위험 권역 {shortageRegions.length}개</span>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                    <BarChart
                      width={760}
                      height={236}
                      data={regionChartData}
                      margin={{ top: 10, right: 8, left: -18, bottom: 12 }}
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
                        domain={[0, 150]}
                        ticks={[0, 50, 100, 150]}
                        axisLine={false}
                        tickLine={false}
                        unit="%"
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, "충족률"]}
                      />
                      <ReferenceLine
                        y={100}
                        stroke="#ef4444"
                        strokeDasharray="5 4"
                        label={{ value: "목표 100%", position: "insideTopRight", fontSize: 9 }}
                      />
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
                <div className="flex flex-wrap gap-1">
                  {regionChartData
                    .filter((row) => row.ratio < 100)
                    .map((row) => (
                      <span
                        key={row.id}
                        className="inline-flex items-center gap-1 rounded-full border border-error/25 bg-error-container/25 px-2 py-0.5 text-[9px] font-bold text-error"
                      >
                        🔴 {row.name} {row.ratio.toFixed(0)}%
                      </span>
                    ))}
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
              label="추천 시나리오"
              value={recommendedScenario.displayId}
              note="제약 통과 기준"
              icon="recommend"
              tone="success"
            />
            <Metric
              label="예상 서비스율"
              value={`${recommendedScenario.serviceRatePct.toFixed(1)}%`}
              note={`S1 ${baselineScenario.serviceRatePct.toFixed(1)}%`}
              icon="trending_up"
              tone="success"
            />
            <Metric
              label="미충족 수요"
              value={`${fmt(recommendedScenario.totalUnmetDemand)} VIAL 환산`}
              note={`S1 ${fmt(baselineScenario.totalUnmetDemand)} VIAL 환산`}
              icon="production_quantity_limits"
              tone="success"
            />
            <Metric
              label="긴급조달"
              value={`${fmt(recommendedScenario.emergencyProcurementQuantity)} API 환산`}
              note="S3 실행 조건"
              icon="shopping_cart"
              tone="warning"
            />
            <Metric
              label="증분 조달비"
              value={fmtKrw(cefazolinWorkflowEffect.procurementCostDeltaKrw)}
              note="S1 대비"
              icon="payments"
              tone="warning"
            />
          </div>

          <Section
            title="S1·S2·S3 대응안 비교"
            subtitle="서비스율 · 부족기간 · 권역 서비스 · 비용 · 제약조건"
            action={
              <button
                type="button"
                onClick={() => setTab("approval")}
                className="rounded-lg bg-scm-primary px-3 py-2 text-[11px] font-bold text-white"
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
                    className={`rounded-xl border p-md ${recommended ? "border-scm-primary bg-primary-container/20 shadow-sm" : "border-outline-variant bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-sm">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                          {scenario.response}
                        </p>
                        <h4 className="mt-1 font-display text-base font-bold text-on-surface">
                          {scenario.displayId}
                        </h4>
                      </div>
                      {recommended ? (
                        <Pill tone="success">추천</Pill>
                      ) : (
                        <Pill tone={scenario.constraintPassed ? "neutral" : "danger"}>
                          {scenario.constraintPassed ? "검토" : "제약 미통과"}
                        </Pill>
                      )}
                    </div>
                    <div className="mt-md rounded-lg bg-surface-container-low p-xs">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-on-surface-variant">서비스율</span>
                        <strong className="font-data text-xs">
                          {scenario.serviceRatePct.toFixed(1)}%
                        </strong>
                      </div>
                      <SignalBar
                        value={scenario.serviceRatePct}
                        tone={
                          recommended ? "success" : scenario.constraintPassed ? "primary" : "danger"
                        }
                      />
                    </div>
                    <dl className="mt-xs grid grid-cols-3 gap-xs text-[11px]">
                      <div className="rounded-lg bg-surface-container-low p-xs">
                        <dt className="text-on-surface-variant">최저 권역</dt>
                        <dd className="mt-1 font-data font-bold">
                          {scenario.minimumRegionalServiceRatePct.toFixed(1)}%
                        </dd>
                      </div>
                      <div className="rounded-lg bg-surface-container-low p-xs">
                        <dt className="text-on-surface-variant">미충족</dt>
                        <dd className="mt-1 font-data font-bold">
                          {fmt(scenario.totalUnmetDemand)}
                        </dd>
                        <span className="text-[9px] text-on-surface-variant">VIAL 환산</span>
                      </div>
                      <div className="rounded-lg bg-surface-container-low p-xs">
                        <dt className="text-on-surface-variant">부족기간</dt>
                        <dd className="mt-1 font-data font-bold">{scenario.shortageWeeks}주</dd>
                      </div>
                    </dl>
                    <div className="mt-sm border-t border-outline-variant/50 pt-sm">
                      <span className="text-[10px] text-on-surface-variant">총 조달비</span>
                      <strong className="ml-2 font-data text-xs">
                        {fmtKrw(scenario.totalProcurementCostKrw)}
                      </strong>
                    </div>
                  </article>
                );
              })}
            </div>
          </Section>

          <Section
            title="실행가능성·제약조건"
            subtitle="추천안 실행 전 재고·생산·조달·품질 조건 확인"
          >
            <div className="grid grid-cols-4 gap-sm">
              <div className="rounded-xl border border-outline-variant p-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-on-surface-variant">
                    WMS 재고 재배분
                  </span>
                  <Pill tone="success">물량 확인</Pill>
                </div>
                <p className="mt-2 font-data text-lg font-bold">
                  {fmt(cefazolinDashboard.transferableQuantityByRegion.National)} VIAL 환산
                </p>
                <p className="mt-1 text-[10px] text-on-surface-variant">
                  과잉권역 {excessRegions.length}개 · 부족권역 {shortageRegions.length}개
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant p-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-on-surface-variant">
                    MES 생산 조건
                  </span>
                  <Pill tone="warning">확인 필요</Pill>
                </div>
                <p className="mt-2 font-data text-lg font-bold">
                  가동률 {cefazolinDashboard.utilization?.toFixed(1) ?? "-"}%
                </p>
                <p className="mt-1 text-[10px] text-on-surface-variant">
                  추가 원료 입고 후 생산계획 재산정
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant p-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-on-surface-variant">
                    ERP 긴급조달
                  </span>
                  <Pill tone="warning">일정 확인</Pill>
                </div>
                <p className="mt-2 font-data text-lg font-bold">
                  {fmt(recommendedScenario.emergencyProcurementQuantity)} API 환산
                </p>
                <p className="mt-1 text-[10px] text-on-surface-variant">
                  {recommendedEvaluation?.executionPeriod ?? "공급사 입고 일정 확인"}
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant p-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-on-surface-variant">
                    MES 품질·출하
                  </span>
                  <Pill tone="warning">선행조건</Pill>
                </div>
                <p className="mt-2 text-sm font-bold leading-5 text-on-surface">
                  품질검사·출하승인
                </p>
                <p className="mt-1 text-[10px] leading-4 text-on-surface-variant">
                  {qualityCondition}
                </p>
              </div>
            </div>
            <div className="mt-sm grid grid-cols-2 gap-sm">
              <div className="rounded-xl bg-surface-container-low p-sm">
                <p className="text-[10px] font-bold text-on-surface-variant">실행 조건</p>
                <ul className="mt-2 space-y-1.5 text-[11px] leading-4 text-on-surface">
                  {(recommendedEvaluation?.xai.conditions ?? []).map((condition) => (
                    <li key={condition} className="flex gap-2">
                      <span className="text-scm-primary">•</span>
                      <span>{condition}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-surface-container-low p-sm">
                <p className="text-[10px] font-bold text-on-surface-variant">제약·주의사항</p>
                <ul className="mt-2 space-y-1.5 text-[11px] leading-4 text-on-surface">
                  {(recommendedEvaluation?.xai.constraints ?? []).map((constraint) => (
                    <li key={constraint} className="flex gap-2">
                      <span className="text-[#ad6800]">•</span>
                      <span>{constraint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          <Section
            title={`${recommendedScenario.displayId} 실행계획`}
            subtitle="시스템별 실행 항목 · 대상 · 수량 · 산출 기준"
          >
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
                  {executionRows.map((action) => (
                    <tr key={action.id} className="border-t border-outline-variant/40">
                      <td className="px-sm py-xs">
                        <Pill tone="primary">{action.system}</Pill>
                      </td>
                      <td className="px-sm py-xs font-bold">{action.title}</td>
                      <td className="px-sm py-xs text-on-surface-variant">{action.target}</td>
                      <td className="px-sm py-xs text-right font-data font-bold">
                        {action.quantity === null
                          ? "계획 재산정"
                          : `${fmt(action.quantity)} ${actionUnit(action.unit)}`}
                      </td>
                      <td className="max-w-[320px] px-sm py-xs text-[10px] leading-4 text-on-surface-variant">
                        {action.basis}
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
                  <p className="text-[10px] text-on-surface-variant">서비스율</p>
                  <p className="mt-1 font-data text-lg font-bold">
                    {recommendedScenario.serviceRatePct.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-[10px] text-on-surface-variant">미충족</p>
                  <p className="mt-1 font-data text-lg font-bold">
                    {fmt(recommendedScenario.totalUnmetDemand)} VIAL 환산
                  </p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-sm">
                  <p className="text-[10px] text-on-surface-variant">증분 조달비</p>
                  <p className="mt-1 font-data text-lg font-bold">
                    {fmtKrw(cefazolinWorkflowEffect.procurementCostDeltaKrw)}
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
                    className="flex cursor-pointer items-start gap-sm rounded-xl border border-outline-variant p-sm hover:border-scm-primary/40"
                  >
                    <input
                      type="checkbox"
                      checked={checklist[item.key]}
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
                    disabled={!holdReady}
                    className="flex-1 rounded-xl border border-[#ffd591] bg-[#fff7e6] px-sm py-2.5 text-xs font-bold text-[#ad6800] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    보완 요청
                  </button>
                  <button
                    type="button"
                    onClick={approve}
                    disabled={!approvalReady}
                    className="flex-1 rounded-xl bg-scm-primary px-sm py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    최종 승인
                  </button>
                </div>
                {!approvalReady ? (
                  <p className="text-[10px] text-on-surface-variant">
                    최종 승인: 승인자 입력과 필수 검토 4건 완료가 필요합니다.
                  </p>
                ) : null}
                {!holdReady ? (
                  <p className="text-[10px] text-on-surface-variant">
                    보완 요청: 승인자와 검토 의견을 입력해야 합니다.
                  </p>
                ) : null}
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
              label="계획 서비스율"
              value={`${cefazolinWorkflowEffect.serviceRateAfter.toFixed(1)}%`}
              note={`S1 ${cefazolinWorkflowEffect.serviceRateBefore.toFixed(1)}%`}
              icon="speed"
              tone="success"
            />
            <Metric
              label="잔여 미충족"
              value={`${fmt(cefazolinWorkflowEffect.unmetDemandAfter)} VIAL 환산`}
              note={`S1 ${fmt(cefazolinWorkflowEffect.unmetDemandBefore)} VIAL 환산`}
              icon="inventory"
              tone="success"
            />
            <Metric
              label="부족기간"
              value={`${cefazolinWorkflowEffect.shortageWeeksAfter}주`}
              note={`S1 ${cefazolinWorkflowEffect.shortageWeeksBefore}주`}
              icon="calendar_month"
              tone="success"
            />
            <Metric
              label="증분 조달비"
              value={fmtKrw(cefazolinWorkflowEffect.procurementCostDeltaKrw)}
              note="S1 대비"
              icon="payments"
              tone="warning"
            />
          </div>

          <Section
            title="시스템 실행지시"
            subtitle="ERP · MES · WMS 실행지시 전송 상태"
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
                          : `${fmt(action.quantity)} ${actionUnit(action.unit)}`}
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

          <Section title="계획 대비 효과" subtitle="S1 기준 대비 추천 시나리오의 계획 KPI">
            <div className="grid grid-cols-4 gap-sm">
              <div className="rounded-xl border border-outline-variant p-md">
                <p className="text-[10px] font-bold text-on-surface-variant">서비스율 변화</p>
                <p className="mt-2 font-data text-xl font-bold text-green-700">
                  +
                  {(
                    cefazolinWorkflowEffect.serviceRateAfter -
                    cefazolinWorkflowEffect.serviceRateBefore
                  ).toFixed(1)}
                  %p
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant p-md">
                <p className="text-[10px] font-bold text-on-surface-variant">미충족 수요 변화</p>
                <p className="mt-2 font-data text-xl font-bold text-green-700">
                  -
                  {fmt(
                    cefazolinWorkflowEffect.unmetDemandBefore -
                      cefazolinWorkflowEffect.unmetDemandAfter,
                  )}{" "}
                  VIAL 환산
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant p-md">
                <p className="text-[10px] font-bold text-on-surface-variant">최저 권역 서비스율</p>
                <p className="mt-2 font-data text-xl font-bold">
                  {cefazolinWorkflowEffect.minimumRegionalServiceRateAfter.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant p-md">
                <p className="text-[10px] font-bold text-on-surface-variant">최근 전송 시각</p>
                <p className="mt-2 font-data text-sm font-bold">
                  {executionStatus === "executed"
                    ? new Date(lastUpdatedAt).toLocaleString("ko-KR")
                    : "-"}
                </p>
              </div>
            </div>
          </Section>
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
                const status = workflow.stepStatuses[step.order];
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
  if (product.key === "리피로우" && lipilouDashboard) {
    return <ProductDecisionExecution product={product} dashboard={lipilouDashboard} />;
  }
  if (product.key === "타미비어") {
    return <ProductDecisionExecution product={product} dashboard={tamivirDashboard} />;
  }
  return <CefazolinOnlyDecisionExecutionView product={product} />;
}
