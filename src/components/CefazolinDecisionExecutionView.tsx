import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ScmShell";
import type { Product } from "@/data/scm";
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

function ProductNotConnected({ product }: { product: Product }) {
  return (
    <div className="dashboard-fixed-layout flex-1 bg-surface px-lg pb-16 pt-16">
      <div className="py-lg">
        <h2 className="font-display text-headline-md text-on-surface">의사결정 실행</h2>
        <p className="mt-xs text-sm text-on-surface-variant">{product.name} 실행 콘솔 연결 상태</p>
      </div>
      <div className="bento-card flex min-h-[260px] items-center justify-center p-xl text-center">
        <div>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-high text-on-surface-variant">
            <Icon name="link_off" />
          </span>
          <h3 className="mt-md font-display text-lg font-bold text-on-surface">
            제품별 실행 모듈 미연결
          </h3>
          <p className="mt-xs text-sm text-on-surface-variant">
            현재 의사결정 실행 상세 모듈은 세파졸린에 연결되어 있습니다.
          </p>
        </div>
      </div>
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

  if (product.key !== "세파졸린") return <ProductNotConnected product={product} />;

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
