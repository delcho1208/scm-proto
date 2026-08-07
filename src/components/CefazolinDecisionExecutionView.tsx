import { useState, type ReactNode } from "react";
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
  { key: "impact", label: "상황·영향", icon: "monitoring" },
  { key: "response", label: "대응안 검토", icon: "compare_arrows" },
  { key: "approval", label: "승인", icon: "verified_user" },
  { key: "execution", label: "실행·성과", icon: "play_circle" },
];

const checklistItems: Array<{ key: ChecklistKey; label: string; detail: string }> = [
  { key: "cost", label: "추가 조달비 검토", detail: "S1 대비 증분 조달비와 예산 범위 확인" },
  { key: "supplier", label: "공급사 입고 일정 확인", detail: "긴급조달 최초·최종 입고 일정 검토" },
  { key: "quality", label: "품질 승인 전제 확인", detail: "대체 원료 사용 전 품질 승인 필요" },
  {
    key: "transfer",
    label: "권역 재배분 가능량 확인",
    detail: "과잉권역 이관 후 안전재고 유지 확인",
  },
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
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
  tone?: "primary" | "danger" | "warning" | "success";
}) {
  const iconStyle = {
    primary: "bg-primary-container/40 text-scm-primary",
    danger: "bg-error-container/40 text-error",
    warning: "bg-[#fff7e6] text-[#ad6800]",
    success: "bg-green-50 text-green-700",
  }[tone];
  return (
    <div className="bento-card flex min-h-[118px] flex-col justify-between p-md">
      <div className="flex items-center justify-between gap-sm">
        <span className="text-[11px] font-bold text-on-surface-variant">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconStyle}`}>
          <Icon name={icon} className="text-[18px]" />
        </span>
      </div>
      <div>
        <p className="font-data text-[24px] font-bold leading-tight text-on-surface">{value}</p>
        <p className="mt-1 text-[10px] leading-4 text-on-surface-variant">{note}</p>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="bento-card overflow-hidden">
      <div className="flex items-start justify-between gap-md border-b border-outline-variant/60 px-md py-sm">
        <div>
          <h3 className="font-display text-[15px] font-bold text-on-surface">{title}</h3>
          {subtitle ? <p className="mt-1 text-[10px] text-on-surface-variant">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-md">{children}</div>
    </section>
  );
}

function actionSystem(actionType: string) {
  if (actionType.includes("원료발주")) return "ERP";
  if (actionType.includes("생산")) return "MES";
  return "WMS";
}

function actionUnit(unit: string) {
  if (unit === "완제품 환산단위") return "VIAL 환산";
  if (unit === "API 환산단위") return "API 환산";
  return "PLAN";
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

export function CefazolinDecisionExecutionView({ product }: { product: Product }) {
  const [tab, setTab] = useState<TabKey>("response");
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [hitlStatus, setHitlStatus] = useState<HitlStatus>("pending");
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>("locked");
  const [reviewer, setReviewer] = useState("");
  const [reviewerRole, setReviewerRole] = useState("SCM 운영");
  const [reviewNote, setReviewNote] = useState("");
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>(initialChecklist);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(cefazolinWorkflowRunMeta.latestSnapshotDate);

  if (product.key === "리피로우" && lipilouDashboard) {
    return <ProductDecisionExecution product={product} dashboard={lipilouDashboard} />;
  }
  if (product.key === "타미비어") {
    return <ProductDecisionExecution product={product} dashboard={tamivirDashboard} />;
  }

  const national = cefazolinDashboard.regions.National;
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
  const baselineSource = cefazolinDashboard.scenarios.find(
    (scenario) => scenario.id === "S1_무대응",
  );
  const checklistComplete = checklistItems.every((item) => checklist[item.key]);
  const approvalReady = reviewer.trim().length > 0 && checklistComplete;
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
    <div className="dashboard-fixed-layout flex-1 bg-surface px-lg pb-16 pt-16">
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
              CEFA-SUPPLY-20261028-01
            </span>
          </div>
          <h2 className="font-display text-headline-md text-on-surface">세파졸린 의사결정 실행</h2>
          <p className="mt-xs text-sm text-on-surface-variant">
            API 공급 차질 · 전국 목표재고 미달 · 데이터 기준{" "}
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

      <div className="mb-md flex items-center rounded-xl border border-outline-variant bg-white p-1.5 shadow-sm">
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
        <div className="space-y-md">
          <div className="grid grid-cols-6 gap-sm">
            <Metric
              label="현재고"
              value={`${fmt(cefazolinDashboard.totalInventory ?? 0)} VIAL 환산`}
              note={`목표 ${fmt(national.target_stock)} VIAL 환산`}
              icon="inventory_2"
              tone="danger"
            />
            <Metric
              label="목표재고 충족률"
              value={`${national.stock_ratio.toFixed(1)}%`}
              note={`부족권역 ${shortageRegions.length}개`}
              icon="monitoring"
              tone="danger"
            />
            <Metric
              label="최초 부족 주차"
              value={baselineSource?.firstShortageWeek ?? "-"}
              note={`무대응 기준 ${baselineScenario.shortageWeeks}주`}
              icon="event_busy"
              tone="warning"
            />
            <Metric
              label="연간 예측수요"
              value={`${fmt(cefazolinDashboard.annualForecastDemand)} VIAL 환산`}
              note="8개 권역 합계"
              icon="query_stats"
            />
            <Metric
              label="재배분 가능"
              value={`${fmt(cefazolinDashboard.transferableQuantityByRegion.National)} VIAL 환산`}
              note={`과잉권역 ${excessRegions.length}개`}
              icon="local_shipping"
              tone="warning"
            />
            <Metric
              label="MES 가동률"
              value={`${cefazolinDashboard.utilization?.toFixed(1) ?? "-"}%`}
              note="전국 평균"
              icon="precision_manufacturing"
            />
          </div>

          <div className="grid grid-cols-12 gap-md">
            <div className="col-span-8">
              <Section title="권역 재고 영향" subtitle="WMS 현재고 · 목표재고 · 충족률 기준">
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
                          <td className="px-sm py-xs font-bold text-on-surface">
                            {region.region.split("_").slice(1).join("_")}
                          </td>
                          <td className="px-sm py-xs text-right font-data">
                            {fmt(region.current_stock)} VIAL 환산
                          </td>
                          <td className="px-sm py-xs text-right font-data">
                            {fmt(region.target_stock)} VIAL 환산
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
                    [
                      "inventory",
                      "재고",
                      `전국 목표재고 충족률 ${national.stock_ratio.toFixed(1)}%`,
                    ],
                    [
                      "factory",
                      "조달",
                      `S3 긴급조달 ${fmt(recommendedScenario.emergencyProcurementQuantity)} API 환산`,
                    ],
                    [
                      "precision_manufacturing",
                      "생산",
                      `MES 평균 가동률 ${cefazolinDashboard.utilization?.toFixed(1) ?? "-"}%`,
                    ],
                    [
                      "local_shipping",
                      "물류",
                      `재배분 가능 ${fmt(cefazolinDashboard.transferableQuantityByRegion.National)} VIAL 환산`,
                    ],
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
                        <p className="mt-0.5 text-xs font-bold text-on-surface">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="의사결정 상태">
                <div className="grid grid-cols-2 gap-xs text-center">
                  <div className="rounded-lg bg-surface-container-low p-sm">
                    <p className="text-[10px] text-on-surface-variant">현재 단계</p>
                    <p className="mt-1 text-xs font-bold">{activeStep}단계</p>
                  </div>
                  <div className="rounded-lg bg-surface-container-low p-sm">
                    <p className="text-[10px] text-on-surface-variant">권고안</p>
                    <p className="mt-1 text-xs font-bold text-scm-primary">
                      {recommendedScenario.displayId}
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
          >
            <div className="grid grid-cols-3 gap-sm">
              {scenarioRows.map((scenario) => {
                const recommended = scenario.id === recommendedScenarioId;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => scenario.id === recommendedScenarioId && setTab("approval")}
                    className={`rounded-xl border p-md text-left transition ${recommended ? "border-scm-primary bg-primary-container/20 shadow-sm" : "border-outline-variant bg-white"}`}
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
                    <dl className="mt-md grid grid-cols-2 gap-xs text-[11px]">
                      <div className="rounded-lg bg-surface-container-low p-xs">
                        <dt className="text-on-surface-variant">서비스율</dt>
                        <dd className="mt-1 font-data font-bold">
                          {scenario.serviceRatePct.toFixed(1)}%
                        </dd>
                      </div>
                      <div className="rounded-lg bg-surface-container-low p-xs">
                        <dt className="text-on-surface-variant">최저 권역</dt>
                        <dd className="mt-1 font-data font-bold">
                          {scenario.minimumRegionalServiceRatePct.toFixed(1)}%
                        </dd>
                      </div>
                      <div className="rounded-lg bg-surface-container-low p-xs">
                        <dt className="text-on-surface-variant">미충족</dt>
                        <dd className="mt-1 font-data font-bold">
                          {fmt(scenario.totalUnmetDemand)} VIAL 환산
                        </dd>
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
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="S3 실행 항목" subtitle="추천 시나리오에서 생성되는 시스템별 작업">
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
                  <p className="text-[10px] text-on-surface-variant">긴급조달</p>
                  <p className="mt-1 font-data text-lg font-bold">
                    {fmt(recommendedScenario.emergencyProcurementQuantity)} API 환산
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
                {checklistItems.map((item) => (
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
                    <span>
                      <span className="block text-xs font-bold text-on-surface">{item.label}</span>
                      <span className="mt-0.5 block text-[10px] text-on-surface-variant">
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
                    className="flex-1 rounded-xl border border-[#ffd591] bg-[#fff7e6] px-sm py-2.5 text-xs font-bold text-[#ad6800]"
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
                    승인자 입력과 필수 검토 4건 완료 후 승인할 수 있습니다.
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
                  ? "처리 완료"
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
            subtitle="승인 완료 후 ERP·MES·WMS 작업을 생성합니다."
            action={
              <button
                type="button"
                disabled={executionStatus !== "ready"}
                onClick={execute}
                className="rounded-lg bg-scm-primary px-3 py-2 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                실행지시 처리
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
                            ? "처리 완료"
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

          <Section title="계획 대비 효과">
            <div className="grid grid-cols-4 gap-sm">
              <div className="rounded-xl border border-outline-variant p-md">
                <p className="text-[10px] font-bold text-on-surface-variant">서비스율 개선</p>
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
                <p className="text-[10px] font-bold text-on-surface-variant">미충족 감소</p>
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
                <p className="text-[10px] font-bold text-on-surface-variant">처리 시각</p>
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
                  Workflow trace
                </p>
                <h3 className="font-display text-lg font-bold">10단계 처리상태</h3>
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
                            ? "처리 완료"
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
