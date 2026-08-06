import { useEffect, useRef, useState } from "react";
import { markerOrder, regions, type Product, type RiskLevel } from "@/data/scm";
import { lipilouDashboard, tamivirDashboard } from "@/data/dashboard-scenario";
import { cefazolinDashboard } from "@/data/cefazolin-dashboard";
import { timelineData, timelineKeys, type TimelineKey } from "@/data/timeline";
import { Icon } from "@/components/ScmShell";
import {
  cefazolinAnalysisReadiness,
  cefazolinDataCollectionSummary,
  cefazolinDataQualitySummary,
  cefazolinDecisionEvidence,
  cefazolinForecastRiskSummary,
  cefazolinReadinessChecks,
  cefazolinScenarioComparison,
  cefazolinScenarioRecommendation,
  cefazolinVirtualExecutionActions,
  cefazolinWorkflowEffect,
  cefazolinWorkflowRunMeta,
  cefazolinWorkflowSteps,
  getCefazolinWorkflowRunState,
} from "@/data/cefazolin-ai-workflow";
import { formatScmQuantity, getScmQuantityUnit } from "@/data/cefazolin-dashboard";
import type {
  ExecutionStatus,
  HitlStatus,
  WorkflowRuntimeStatus,
} from "@/services/scm-workflow-orchestrator";

const riskStyles: Record<RiskLevel, { dot: string; badge: string; text: string; bullet: string }> =
  {
    danger: {
      dot: "status-dot-danger",
      badge: "bg-error-container/30 border-error/20",
      text: "text-error",
      bullet: "bg-error",
    },
    warning: {
      dot: "status-dot-warning",
      badge: "bg-orange-50 border-[#faad14]/20",
      text: "text-[#faad14]",
      bullet: "bg-[#faad14]",
    },
    safe: {
      dot: "status-dot-safe",
      badge: "bg-green-50 border-[#52c41a]/20",
      text: "text-[#52c41a]",
      bullet: "bg-[#52c41a]",
    },
  };

type TransferRoute = {
  from: string;
  to: string;
  label?: string;
};

const workflowStatusMeta: Record<
  WorkflowRuntimeStatus,
  { label: string; badge: string; dot: string }
> = {
  verified: {
    label: "검증 완료",
    badge: "bg-green-50 text-[#318f19] border-green-200",
    dot: "bg-[#318f19]",
  },
  available: {
    label: "실행 가능",
    badge: "bg-primary-container text-white border-scm-primary/20",
    dot: "bg-scm-primary",
  },
  review_required: {
    label: "검토 필요",
    badge: "bg-[#fff7e6] text-[#ad6800] border-[#ffd591]",
    dot: "bg-[#faad14]",
  },
  approval_pending: {
    label: "승인 대기",
    badge: "bg-surface-container-low text-on-surface-variant border-outline-variant",
    dot: "bg-outline",
  },
  locked: {
    label: "잠김",
    badge: "bg-surface-container-low text-outline border-outline-variant",
    dot: "bg-outline-variant",
  },
  approved: {
    label: "승인 완료",
    badge: "bg-green-50 text-[#318f19] border-green-200",
    dot: "bg-[#318f19]",
  },
  held: {
    label: "보류",
    badge: "bg-[#fff7e6] text-[#ad6800] border-[#ffd591]",
    dot: "bg-[#faad14]",
  },
  executed: {
    label: "가상 실행 완료",
    badge: "bg-primary-container text-white border-scm-primary/20",
    dot: "bg-scm-primary",
  },
};

type HitlChecklistKey =
  "procurementCost" | "supplierSchedule" | "qualityApproval" | "transferCapacity";

const hitlChecklistItems: Array<{
  key: HitlChecklistKey;
  label: string;
}> = [
  { key: "procurementCost", label: "추가 조달비 확인" },
  { key: "supplierSchedule", label: "공급사 입고 일정 확인" },
  { key: "qualityApproval", label: "품질 승인 전제 확인" },
  { key: "transferCapacity", label: "권역 재배분 가능량 확인" },
];

const emptyHitlChecklist: Record<HitlChecklistKey, boolean> = {
  procurementCost: false,
  supplierSchedule: false,
  qualityApproval: false,
  transferCapacity: false,
};

const workflowGroupOrder = ["데이터 준비", "분석·시뮬레이션", "의사결정", "승인·실행"] as const;

function formatWorkflowTimestamp(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(value).toLocaleString("ko-KR");
}

function formatKrw(value: number): string {
  return `${(value / 100_000_000).toFixed(2)}억 원`;
}

type AiRecommendation = {
  t: string;
  d: string;
  routes?: TransferRoute[];
  evaluation?: {
    scenarioId: string;
    roleLabel: string;
    recommended: boolean;
    ruleIds: string[];
    dataAsOf: string;
    costKpi: {
      label: string;
      value: string;
      direction: "increase" | "decrease" | "neutral";
    };
    feasibility: {
      label: string;
      score: number;
      metric: string;
    };
    executionPeriod: string;
    supplyImpact: string;
    xai: {
      summary: string;
      evidence: string[];
      conditions: string[];
      constraints: string[];
      limitation: string;
    };
  };
};

function getMarkerCenter(regionId: string) {
  const box = regions[regionId]?.box;
  if (!box) return null;
  return {
    x: Number.parseFloat(box.left) + Number.parseFloat(box.width) / 2,
    y: Number.parseFloat(box.top) + Number.parseFloat(box.height) / 2,
  };
}

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const from = previousValue.current;
    const startedAt = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / 350, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + (value - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(animate);
      else previousValue.current = value;
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <>
      {displayValue.toLocaleString("ko-KR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </>
  );
}

type CefazolinNewsItem = { title: string; url: string; publishedAt: string };

function CefazolinNewsApiCard({ productName }: { productName: string }) {
  const [news, setNews] = useState<CefazolinNewsItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    fetch(`/api/news?query=${encodeURIComponent(productName)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { items?: CefazolinNewsItem[] };
        if (!response.ok) throw new Error("뉴스 조회 실패");
        setNews(payload.items ?? []);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [productName]);

  return (
    <div className="bento-card flex min-h-0 flex-1 flex-col p-md">
      <div className="flex min-h-0 flex-1 items-start gap-sm overflow-hidden">
        <div className="api-placeholder-icon news shrink-0">
          <Icon name="newspaper" className="text-[18px]" />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-xs">
            <h4 className="truncate text-sm font-bold text-on-surface">{productName} 뉴스</h4>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="api-ready-badge">
                {state === "loading" ? "검색 중" : state === "ready" ? "연결됨" : "설정 필요"}
              </span>
              <button
                type="button"
                aria-label={`${productName} 뉴스 전체 보기`}
                disabled={news.length === 0}
                onClick={() => setIsOpen(true)}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-outline-variant bg-white text-scm-primary hover:bg-primary-container disabled:opacity-40"
              >
                <Icon name="add" className="text-[16px]" />
              </button>
            </div>
          </div>
          <p className="mt-1 text-[10px] font-bold text-scm-primary">최신 뉴스</p>
          <div className="mt-2 min-h-0 flex-1 overflow-hidden">
            {state === "loading" ? (
              <p className="text-[10px] text-on-surface-variant">뉴스를 불러오는 중입니다.</p>
            ) : state === "error" ? (
              <p className="text-[10px] text-error">뉴스 연결을 확인해 주세요.</p>
            ) : news.length ? (
              <ul className="space-y-1.5">
                {news.slice(0, 2).map((item) => (
                  <li key={`${item.url}-${item.publishedAt}`}>
                    <a href={item.url} target="_blank" rel="noreferrer" className="line-clamp-1 text-[10px] font-semibold text-on-surface hover:text-scm-primary hover:underline">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] text-on-surface-variant">검색된 뉴스가 없습니다.</p>
            )}
          </div>
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-6 backdrop-blur-[2px]" onMouseDown={() => setIsOpen(false)}>
          <section role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-2xl overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-scm-primary">NAVER NEWS</p>
                <h3 className="font-display text-lg font-bold text-on-surface">{productName} 최신 뉴스</h3>
              </div>
              <button type="button" aria-label="닫기" onClick={() => setIsOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container-low">
                <Icon name="close" className="text-[20px]" />
              </button>
            </header>
            <ul className="max-h-[60vh] divide-y divide-outline-variant/50 overflow-y-auto px-6">
              {news.map((item) => (
                <li key={`${item.url}-${item.publishedAt}`} className="py-4">
                  <a href={item.url} target="_blank" rel="noreferrer" className="group block">
                    <span className="text-sm font-bold leading-6 text-on-surface group-hover:text-scm-primary group-hover:underline">{item.title}</span>
                    <span className="mt-1 block text-[10px] text-on-surface-variant">{new Date(item.publishedAt).toLocaleDateString("ko-KR")}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function CefazolinDashboardView({ product }: { product: Product }) {
  const [regionId, setRegionId] = useState("National");
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [recommendationChecks, setRecommendationChecks] = useState<Record<string, boolean>>({});
  const [selectedRecommendationIndex, setSelectedRecommendationIndex] = useState(0);
  const [showRecommendationXai, setShowRecommendationXai] = useState(false);
  const [showScenarioComparison, setShowScenarioComparison] = useState(false);
  const [showAiWorkflow, setShowAiWorkflow] = useState(false);
  const [selectedWorkflowStepIndex, setSelectedWorkflowStepIndex] = useState(0);
  const [hitlStatus, setHitlStatus] = useState<HitlStatus>("pending");
  const [hitlReviewer, setHitlReviewer] = useState("");
  const [hitlReviewerRole, setHitlReviewerRole] = useState("");
  const [hitlReviewNote, setHitlReviewNote] = useState("");
  const [hitlChecklist, setHitlChecklist] =
    useState<Record<HitlChecklistKey, boolean>>(emptyHitlChecklist);
  const [hitlReviewedAt, setHitlReviewedAt] = useState<string | null>(null);
  const [virtualExecutionStatus, setVirtualExecutionStatus] = useState<ExecutionStatus>("locked");
  const [virtualExecutedAt, setVirtualExecutedAt] = useState<string | null>(null);
  const [workflowLastUpdatedAt, setWorkflowLastUpdatedAt] = useState(
    cefazolinWorkflowRunMeta.latestSnapshotDate,
  );
  const [timelineIndex, setTimelineIndex] = useState(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timelineFrameRef = useRef<number | null>(null);
  const pendingTimelineIndex = useRef(2);

  const timelineKey: TimelineKey = timelineKeys[timelineIndex];
  const timeline = timelineData[timelineKey];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setTimelineIndex((current) => {
        if (current >= timelineKeys.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1500);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  useEffect(
    () => () => {
      if (timelineFrameRef.current !== null) cancelAnimationFrame(timelineFrameRef.current);
    },
    [],
  );

  useEffect(() => {
    setSelectedRecommendationIndex(0);
    setShowRecommendationXai(false);
    setShowScenarioComparison(false);
    setShowAiWorkflow(false);
    setSelectedWorkflowStepIndex(0);
    setHitlStatus("pending");
    setHitlReviewer("");
    setHitlReviewerRole("");
    setHitlReviewNote("");
    setHitlChecklist(emptyHitlChecklist);
    setHitlReviewedAt(null);
    setVirtualExecutionStatus("locked");
    setVirtualExecutedAt(null);
    setWorkflowLastUpdatedAt(cefazolinWorkflowRunMeta.latestSnapshotDate);
  }, [product.key]);

  useEffect(() => {
    if (!showScenarioComparison && !showAiWorkflow) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showAiWorkflow) setShowAiWorkflow(false);
      else setShowScenarioComparison(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showAiWorkflow, showScenarioComparison]);

  const changeTimeline = (nextIndex: number) => {
    pendingTimelineIndex.current = nextIndex;
    if (timelineFrameRef.current !== null) return;
    timelineFrameRef.current = requestAnimationFrame(() => {
      setTimelineIndex(pendingTimelineIndex.current);
      timelineFrameRef.current = null;
    });
  };

  const togglePlayback = () => {
    if (!isPlaying) setTimelineIndex(0);
    setIsPlaying((playing) => !playing);
  };

  const scenario =
    product.key === "리피로우"
      ? lipilouDashboard
      : product.key === "타미비어"
        ? tamivirDashboard
        : product.key === cefazolinDashboard.productKey
          ? cefazolinDashboard
          : null;
  const cefazolinData = product.key === cefazolinDashboard.productKey ? cefazolinDashboard : null;
  const isCurrentTimeline = timelineKey === "PRES";
  const scenarioRegion = isCurrentTimeline ? scenario?.regions[regionId] : undefined;
  const timelineRegion = timeline.regions[regionId];
  const region = regions[regionId];
  const nationalRiskLevel: RiskLevel =
    (isCurrentTimeline ? scenario?.inventoryLevel : undefined) ??
    (timeline.riskIndex >= 85 ? "danger" : timeline.riskIndex >= 65 ? "warning" : "safe");
  const regionRiskLevel =
    scenarioRegion?.riskLevel ??
    timelineRegion?.status ??
    (regionId === "National" ? nationalRiskLevel : region.riskLevel);
  const risk = riskStyles[regionRiskLevel];
  const nationalRisk = riskStyles[nationalRiskLevel];

  const displayedTotalInventory =
    (isCurrentTimeline ? scenario?.totalInventory : undefined) ?? timeline.totalInventory;
  const displayedUtilization =
    (isCurrentTimeline ? scenario?.utilization : undefined) ?? timeline.utilization;
  const panelInventory =
    scenarioRegion?.current_stock ?? timelineRegion?.inventory ?? displayedTotalInventory;
  const selectedCefazolinRegion = cefazolinData?.regions[regionId];
  const forecastInventory = selectedCefazolinRegion?.current_stock ?? displayedTotalInventory;
  const forecastRateValue =
    cefazolinData && regionId !== "National"
      ? (selectedCefazolinRegion?.stock_ratio ?? 0)
      : displayedUtilization;
  const forecastRateLabel =
    cefazolinData && regionId !== "National"
      ? "목표재고 충족률 (권역)"
      : cefazolinData
        ? "공장 가동률 (전국 MES)"
        : "가동률 (Operating Rate)";
  const annualDemand = cefazolinData
    ? Math.round(
        cefazolinData.annualForecastDemandByRegion[regionId] ?? cefazolinData.annualForecastDemand,
      ).toLocaleString("ko-KR")
    : product.annualDemand;
  const trendText = cefazolinData
    ? regionId === "National"
      ? `S3 서비스율 ${cefazolinData.serviceRatePct.toFixed(2)}%`
      : `목표재고 충족률 ${selectedCefazolinRegion?.stockRatioLabel ?? `${selectedCefazolinRegion?.stock_ratio ?? 0}%`}`
    : product.yoyGrowth;
  const chartPaths =
    cefazolinData?.chartByRegion[regionId] ?? cefazolinData?.chart ?? product.paths;
  const riskText =
    regionRiskLevel === "danger" ? "부족" : regionRiskLevel === "warning" ? "과잉" : "적정";
  const nationalRiskText =
    nationalRiskLevel === "danger" ? "부족" : nationalRiskLevel === "warning" ? "과잉" : "적정";
  const forecastRiskLevel = cefazolinData
    ? (selectedCefazolinRegion?.riskLevel ?? nationalRiskLevel)
    : nationalRiskLevel;
  const forecastRisk = riskStyles[forecastRiskLevel];
  const forecastRiskText = cefazolinData
    ? (selectedCefazolinRegion?.riskText ?? nationalRiskText)
    : nationalRiskText;
  const forecastRiskLabel = cefazolinData
    ? regionId === "National"
      ? "전국 재고·공급 위험"
      : "권역 재고·공급 위험"
    : "품절 위험";
  const regionDescription = scenarioRegion
    ? `${cefazolinData ? "WMS 데이터 스냅샷" : `${scenario?.date} 기준 데이터`} · 목표 ${cefazolinData ? formatScmQuantity(scenarioRegion.target_stock, "finishedInventory") : `${scenarioRegion.target_stock.toLocaleString()} BOX`} · 재고 수준 ${scenarioRegion.stockRatioLabel ?? `${scenarioRegion.stock_ratio}%`}`
    : `${timeline.label} ${timeline.isPrediction ? "예측" : "실측"} · 리스크 ${timelineRegion?.risk ?? timeline.riskIndex}/100`;

  const recommendations: AiRecommendation[] = cefazolinData
    ? cefazolinData.recommendationEvaluations.map((recommendation) => ({
        t: recommendation.title,
        d: recommendation.description,
        evaluation: {
          scenarioId: recommendation.scenarioId,
          roleLabel: recommendation.roleLabel,
          recommended: recommendation.recommended,
          ruleIds: recommendation.ruleIds,
          dataAsOf: recommendation.dataAsOf,
          costKpi: recommendation.costKpi,
          feasibility: recommendation.feasibility,
          executionPeriod: recommendation.executionPeriod,
          supplyImpact: recommendation.supplyImpact,
          xai: recommendation.xai,
        },
      }))
    : scenario?.recommendations.length
      ? scenario.recommendations.map((recommendation) => ({
          t: recommendation.title,
          d: recommendation.description,
          routes:
            recommendation.fromRegion && recommendation.toRegion
              ? [
                  {
                    from: recommendation.fromRegion,
                    to: recommendation.toRegion,
                    label: recommendation.transferAmount
                      ? `${recommendation.transferAmount.toLocaleString()}EA`
                      : undefined,
                  },
                ]
              : undefined,
        }))
      : [
          { t: "수도권 센터 증설 추진", d: "25년 3분기 내 물류 허브 확장" },
          {
            t: "재고 권역 재배치 최적화",
            d: "강원/충청 → 수도권 물량 조정",
            routes: [
              { from: "Gangwon", to: "Gyeonggi" },
              { from: "Chungcheong", to: "Gyeonggi" },
            ],
          },
        ];

  const selectedEvaluation = recommendations[selectedRecommendationIndex]?.evaluation;
  const recommendedScenarioCode =
    cefazolinScenarioRecommendation.recommendedScenarioId?.split("_")[0] ?? null;
  const recommendedEvaluationIndex = Math.max(
    recommendations.findIndex(
      (recommendation) => recommendation.evaluation?.scenarioId === recommendedScenarioCode,
    ),
    0,
  );

  const activeTransferRoutes = recommendations.flatMap((recommendation, index) => {
    const checkKey = `${product.key}-${index}`;
    return (recommendationChecks[checkKey] ?? true) ? (recommendation.routes ?? []) : [];
  });

  const selectedWorkflowStep =
    cefazolinWorkflowSteps[selectedWorkflowStepIndex] ?? cefazolinWorkflowSteps[0];
  const workflowRunState = getCefazolinWorkflowRunState({
    hitlStatus,
    executionStatus: virtualExecutionStatus,
    lastUpdatedAt: workflowLastUpdatedAt,
  });
  const workflowCompletedCount = workflowRunState.completedSteps.length;
  const workflowStatusFor = (order: number): WorkflowRuntimeStatus =>
    workflowRunState.stepStatuses[order];
  const hitlChecklistComplete = hitlChecklistItems.every((item) => hitlChecklist[item.key]);
  const hitlIdentityComplete = Boolean(hitlReviewer.trim() && hitlReviewerRole.trim());
  const hitlCanApprove = hitlIdentityComplete && hitlChecklistComplete;
  const approvalDisabledReason = !hitlIdentityComplete
    ? "검토자와 부서·역할을 입력해야 합니다."
    : !hitlChecklistComplete
      ? "필수 확인사항 4개를 모두 선택해야 합니다."
      : "";

  const openAiWorkflow = (stepIndex = 0) => {
    setSelectedWorkflowStepIndex(stepIndex);
    setShowScenarioComparison(false);
    setShowAiWorkflow(true);
  };

  const reviewHitl = (nextStatus: Exclude<HitlStatus, "pending">) => {
    if (!hitlIdentityComplete) return;
    if (nextStatus === "approved" && !hitlCanApprove) return;
    const reviewedAt = new Date().toISOString();
    setHitlStatus(nextStatus);
    setHitlReviewedAt(reviewedAt);
    setWorkflowLastUpdatedAt(reviewedAt);
    if (nextStatus === "approved") {
      setVirtualExecutionStatus("ready");
      setSelectedWorkflowStepIndex(8);
    } else {
      setVirtualExecutionStatus("locked");
      setVirtualExecutedAt(null);
    }
  };

  const executeVirtualPlan = () => {
    if (hitlStatus !== "approved" || virtualExecutionStatus !== "ready") return;
    const executedAt = new Date().toISOString();
    setVirtualExecutionStatus("executed");
    setVirtualExecutedAt(executedAt);
    setWorkflowLastUpdatedAt(executedAt);
    setSelectedWorkflowStepIndex(9);
  };

  const selectRegion = (id: string) => {
    setRegionId(id);
    setPanelPos(null);
  };

  const startDrag = (e: React.MouseEvent) => {
    const panel = panelRef.current;
    const container = mapRef.current;
    if (!panel || !container) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startTop = panel.offsetTop;
    const startLeft = panel.offsetLeft;

    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      let top = startTop + (ev.clientY - startY);
      let left = startLeft + (ev.clientX - startX);
      top = Math.max(0, Math.min(top, container.offsetHeight - panel.offsetHeight));
      left = Math.max(0, Math.min(left, container.offsetWidth - panel.offsetWidth));
      setPanelPos({ top, left });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div className="dashboard-fixed-layout flex-1 bg-surface px-lg pb-12 pt-16">
      <div className="flex flex-row items-end justify-between gap-md py-lg">
        <div>
          <h3 className="mb-xs font-display text-headline-md text-on-surface">{region.title}</h3>
          <div className="flex items-center gap-sm text-on-surface-variant">
            <span className="flex items-center gap-xs text-label-caps">
              <span className="h-2 w-2 rounded-full bg-scm-primary" />
              기준시점 통합 공급망 모니터링
            </span>
          </div>
        </div>
        {cefazolinData && (
          <button
            type="button"
            onClick={() => openAiWorkflow(workflowRunState.currentStep - 1)}
            className="flex items-center gap-3 rounded-xl border border-scm-primary/30 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-primary-container/30"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-scm-primary text-white">
              <Icon name="account_tree" className="text-[20px]" />
            </span>
            <span>
              <span className="block text-xs font-bold text-on-surface">
                SCM 의사결정 실행 콘솔
              </span>
              <span className="mt-0.5 block text-[10px] text-on-surface-variant">
                {workflowCompletedCount}/10 단계 완료 ·{" "}
                {virtualExecutionStatus === "executed"
                  ? "가상 실행 완료"
                  : hitlStatus === "approved"
                    ? "승인 완료"
                    : hitlStatus === "held"
                      ? "보류"
                      : "권고안 검토"}
              </span>
            </span>
            <Icon name="chevron_right" className="text-[18px] text-scm-primary" />
          </button>
        )}
      </div>

      {/* Bento grid */}
      <div className="grid h-[650px] min-h-0 grid-cols-12 grid-rows-[minmax(0,650px)] gap-lg">
        {/* Forecast */}
        <div className="col-span-3 h-full min-h-0 min-w-0">
          <div className="bento-card flex h-full min-h-0 flex-col overflow-hidden p-md">
            <div className="mb-md flex min-w-0 items-start justify-between gap-sm">
              <h4 className="min-w-0 break-words font-display text-headline-sm">
                {product.forecastTitle}
              </h4>
              <Icon name="show_chart" className="shrink-0 text-outline" />
            </div>
            <div className="mb-xs">
              <p className="mb-base text-label-caps text-on-surface-variant">
                {regionId === "National"
                  ? "전국 단위 연간 예상 수요량"
                  : `${region.name} 연간 예상 수요량`}
              </p>
              <div className="flex items-end gap-sm">
                <span className="font-display text-display-lg text-scm-primary">
                  {annualDemand}
                </span>
                <span className="mb-1 text-xs text-on-surface-variant">
                  {cefazolinData ? getScmQuantityUnit("demand") : "BOX"}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-xs font-bold text-scm-primary">
                <Icon name="trending_up" className="text-[16px]" />
                <span className="text-sm">{trendText}</span>
              </div>
            </div>
            <div className="mt-sm flex h-[170px] shrink-0 flex-col justify-between rounded-xl border border-outline-variant/30 bg-surface-container-low p-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">
                  Monthly Trends
                </span>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1">
                    <span className="h-0.5 w-2 bg-scm-primary" />
                    <span className="text-[9px] font-bold">
                      {cefazolinData ? "예측수요" : "Actual"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-0.5 w-2 border-b border-dashed bg-error" />
                    <span className="text-[9px] font-bold">
                      {cefazolinData ? "목표재고" : "Pred."}
                    </span>
                  </div>
                </div>
              </div>
              <div className="relative flex h-full w-full flex-col">
                <svg className="chart-svg flex-1" preserveAspectRatio="none" viewBox="0 0 400 200">
                  <line stroke="#e1e1ee" strokeWidth="1" x1="0" x2="400" y1="180" y2="180" />
                  {[140, 100, 60].map((y) => (
                    <line
                      key={y}
                      stroke="#e1e1ee"
                      strokeDasharray="2 2"
                      strokeWidth="1"
                      x1="0"
                      x2="400"
                      y1={y}
                      y2={y}
                    />
                  ))}
                  {!cefazolinData && (
                    <line
                      className="timeline-chart-marker"
                      strokeWidth="2"
                      x1={timelineIndex * 80}
                      x2={timelineIndex * 80}
                      y1="20"
                      y2="180"
                    />
                  )}
                  <path className="path-actual" d={chartPaths.actual} />
                  <path className="path-prediction" d={chartPaths.prediction} />
                  {!cefazolinData && (
                    <>
                      <circle className="chart-dot" cx="0" cy={product.dots[0]} r="3" />
                      <circle className="chart-dot" cx="120" cy={product.dots[1]} r="3" />
                      <circle className="chart-dot" cx="300" cy={product.dots[2]} r="3" />
                      <circle
                        className="chart-dot chart-dot-prediction"
                        cx="380"
                        cy={product.dots[3]}
                        r="3"
                      />
                    </>
                  )}
                </svg>
                <div
                  className={`mt-2 grid text-center font-bold text-on-surface-variant/60 ${cefazolinData ? "grid-cols-12 text-[7px]" : "grid-cols-6 text-[9px]"}`}
                >
                  {cefazolinData
                    ? cefazolinData.regionalMonthly[regionId].map((metric) => (
                        <span key={metric.month}>{metric.month.replace("2025-", "25.")}</span>
                      ))
                    : timelineKeys.map((key, index) => (
                        <span
                          key={key}
                          className={
                            index === timelineIndex
                              ? timeline.isPrediction
                                ? "text-[#ad6800]"
                                : "text-scm-primary"
                              : ""
                          }
                        >
                          {timelineData[key].tick}
                        </span>
                      ))}
                </div>
              </div>
            </div>
            <div className="mt-sm grid min-h-0 flex-1 grid-rows-3 gap-xs">
              <div className="forecast-kpi-row">
                <div>
                  <p>
                    현재 재고 ({cefazolinData ? getScmQuantityUnit("finishedInventory") : "BOX"})
                  </p>
                  <strong>
                    <AnimatedNumber value={forecastInventory} />
                  </strong>
                </div>
                <Icon name="inventory_2" className="text-[18px] text-scm-primary" />
              </div>
              <div className="forecast-kpi-row">
                <div>
                  <p>{forecastRateLabel}</p>
                  <strong className="text-scm-primary">
                    <AnimatedNumber value={forecastRateValue} decimals={1} />%
                  </strong>
                </div>
                <Icon
                  name={
                    cefazolinData && regionId !== "National"
                      ? "monitoring"
                      : "precision_manufacturing"
                  }
                  className="text-[18px] text-scm-primary"
                />
              </div>
              <div className="forecast-kpi-row">
                <div>
                  <p>{forecastRiskLabel}</p>
                  <div
                    className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${forecastRisk.badge}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${forecastRisk.bullet}`} />
                    <span className={`text-[10px] font-bold uppercase ${forecastRisk.text}`}>
                      {forecastRiskText}
                    </span>
                  </div>
                </div>
                <Icon name="warning" className={`text-[18px] ${forecastRisk.text}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="bento-card relative col-span-6 flex min-h-0 min-w-0 flex-col overflow-hidden bg-white">
          <div className="relative z-10 flex flex-row items-center gap-md border-b border-outline-variant/70 px-md py-xs">
            <h4 className="shrink-0 font-display text-headline-sm text-on-surface">
              지능형 권역 모니터링
            </h4>
            <div className="time-scrubber min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-sm">
                <div className="flex items-center gap-xs">
                  <span className="font-data text-xs font-bold text-on-surface">
                    {timeline.label}
                  </span>
                  <span
                    className={`timeline-badge ${timeline.isPrediction ? "prediction" : "actual"}`}
                  >
                    {timeline.isPrediction ? "예측치" : "실측치"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="timeline-play-button"
                  aria-label={isPlaying ? "타임랩스 일시정지" : "타임랩스 재생"}
                >
                  <Icon name={isPlaying ? "pause" : "play_arrow"} className="text-[16px]" filled />
                  <span>{isPlaying ? "일시정지" : "재생"}</span>
                </button>
              </div>
              <input
                aria-label="공급망 데이터 시점"
                className="timeline-range"
                max={timelineKeys.length - 1}
                min="0"
                onChange={(event) => {
                  setIsPlaying(false);
                  changeTimeline(Number(event.target.value));
                }}
                step="1"
                type="range"
                value={timelineIndex}
              />
              <div className="timeline-ticks">
                {timelineKeys.map((key, index) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      changeTimeline(index);
                    }}
                    className={index === timelineIndex ? "active" : ""}
                  >
                    {timelineData[key].tick}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            ref={mapRef}
            className={`timeline-map relative flex flex-1 items-center justify-center overflow-hidden bg-white ${timeline.isPrediction ? "prediction" : ""}`}
          >
            <img
              alt="South Korea Map"
              src={region.img}
              className="max-h-[90%] max-w-[90%] object-contain transition-opacity duration-300"
            />
            <div
              key={timelineKey}
              className="timeline-data-fade pointer-events-none absolute left-1/2 top-1/2 aspect-[1456/1941] h-[90%] -translate-x-1/2 -translate-y-1/2"
            >
              {activeTransferRoutes.length > 0 && (
                <svg
                  aria-label="AI 추천 물류 이동 경로"
                  className="transfer-route-layer"
                  preserveAspectRatio="none"
                  role="img"
                  viewBox="0 0 100 100"
                >
                  <defs>
                    <marker
                      id="transfer-arrowhead"
                      markerHeight="4"
                      markerWidth="4"
                      orient="auto"
                      refX="3.5"
                      refY="2"
                    >
                      <path d="M0,0 L4,2 L0,4 Z" fill="var(--scm-primary)" />
                    </marker>
                  </defs>
                  {activeTransferRoutes.map((route, index) => {
                    const from = getMarkerCenter(route.from);
                    const to = getMarkerCenter(route.to);
                    if (!from || !to) return null;
                    const midX = (from.x + to.x) / 2;
                    const midY = (from.y + to.y) / 2;
                    const curveX = midX + (index % 2 === 0 ? -7 : 7);
                    const labelX = (from.x + 2 * curveX + to.x) / 4;
                    const labelY = (from.y + 2 * midY + to.y) / 4;
                    return (
                      <g key={`${route.from}-${route.to}-${index}`}>
                        <path
                          className="transfer-route-path"
                          d={`M ${from.x} ${from.y} Q ${curveX} ${midY} ${to.x} ${to.y}`}
                          markerEnd="url(#transfer-arrowhead)"
                        />
                        <circle className="transfer-route-origin" cx={from.x} cy={from.y} r="1.5" />
                        {route.label && (
                          <g transform={`translate(${labelX} ${labelY})`}>
                            <rect
                              className="transfer-route-label-bg"
                              x="-8"
                              y="-3.2"
                              width="16"
                              height="6.4"
                              rx="3.2"
                            />
                            <text className="transfer-route-label" textAnchor="middle" y="1.2">
                              {route.label}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              )}
              {markerOrder.map((id) => {
                const r = regions[id];
                const markerRisk =
                  (isCurrentTimeline ? scenario?.regions[id]?.riskLevel : undefined) ??
                  timeline.regions[id]?.status;
                if (!r.box) return null;
                return (
                  <button
                    key={id}
                    title={r.name}
                    onClick={() => selectRegion(id)}
                    className={`region-marker marker-${id} pointer-events-auto ${markerRisk ? `risk-${markerRisk}` : ""} ${regionId === id ? "active" : ""}`}
                    style={{ ...r.box, zIndex: r.z ?? 20 }}
                  >
                    <span className="region-marker-label">{r.shortName ?? r.name}</span>
                  </button>
                );
              })}
            </div>

            <div
              key={`${timelineKey}-${regionId}`}
              ref={panelRef}
              onMouseDown={startDrag}
              className="floating-info-panel timeline-data-fade"
              style={
                panelPos
                  ? { top: panelPos.top, left: panelPos.left, right: "auto" }
                  : { top: 20, right: 20 }
              }
            >
              <div className="mb-3 flex items-center justify-between border-b border-outline-variant/30 pb-2">
                <div className="flex items-center gap-2">
                  <Icon name="drag_indicator" className="text-[14px] text-outline opacity-40" />
                  <h5 className="text-[14px] font-bold">{region.name}</h5>
                </div>
                <span className={`h-3 w-3 rounded-full ${risk.dot}`} />
              </div>
              <div className="pointer-events-none space-y-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">
                    현재 재고
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-data text-[18px] font-semibold text-scm-primary">
                      <AnimatedNumber value={panelInventory} decimals={cefazolinData ? 3 : 0} />
                    </span>
                    <span className="text-[10px] font-bold">
                      {cefazolinData ? getScmQuantityUnit("finishedInventory") : "BOX"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">
                    품절 위험
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${risk.badge}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${risk.bullet}`} />
                      <span className={`text-xs font-bold uppercase ${risk.text}`}>{riskText}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-outline-variant/30 pt-2">
                  <p className="text-[11px] leading-tight text-on-surface-variant">
                    {regionDescription}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="z-10 flex items-center justify-between border-t border-outline-variant bg-white/60 p-md backdrop-blur-sm">
            <div className="flex items-center gap-md">
              {[
                { c: "status-dot-safe", label: "적정" },
                { c: "status-dot-warning", label: "과잉" },
                { c: "status-dot-danger", label: "부족" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${l.c}`} />
                  <span className="text-[10px] font-bold text-on-surface-variant">{l.label}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => selectRegion("National")}
              className="cursor-pointer rounded-lg bg-scm-primary px-4 py-1.5 text-[11px] font-bold text-white shadow-sm transition-opacity hover:opacity-90 active:scale-95"
            >
              전국 종합 데이터
            </button>
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col gap-sm">
          <div className="bento-card flex min-h-0 flex-[2] flex-col overflow-hidden bg-on-surface-variant/5 p-md">
            <div className="mb-sm flex items-center gap-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-scm-primary text-white">
                <Icon name="auto_awesome" className="text-[16px]" filled />
              </div>
              <h4 className="font-display text-headline-sm">AI 추천 실행안</h4>
            </div>
            <p
              className={`mb-xs text-[10px] font-bold ${timeline.isPrediction ? "text-[#ad6800]" : "text-scm-primary"}`}
            >
              {timeline.label} 시점 기준 추천 ·{" "}
              {timeline.isPrediction ? "예측 데이터 기반" : "실측 데이터 기반"}
            </p>
            <div className="min-h-0 flex-1 space-y-sm overflow-y-auto">
              {!showRecommendationXai &&
                recommendations.map((rec, index) => {
                  const checkKey = `${product.key}-${index}`;
                  const checked = recommendationChecks[checkKey] ?? true;
                  if (rec.evaluation) {
                    const selected = selectedRecommendationIndex === index;
                    return (
                      <button
                        key={rec.t}
                        type="button"
                        onClick={() => {
                          setSelectedRecommendationIndex(index);
                          setShowRecommendationXai(true);
                        }}
                        className={`w-full cursor-pointer rounded-lg border p-sm text-left transition-colors ${selected ? "border-scm-primary bg-primary-container/20" : "border-outline-variant bg-white hover:bg-surface-container-low"}`}
                      >
                        <div className="flex items-start justify-between gap-sm">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-on-surface">{rec.t}</p>
                            <p className="mt-0.5 text-[10px] leading-tight text-on-surface-variant">
                              {rec.d}
                            </p>
                          </div>
                          <Icon
                            name={selected ? "radio_button_checked" : "radio_button_unchecked"}
                            className="shrink-0 text-[17px] text-scm-primary"
                          />
                        </div>
                        <div className="mt-sm grid grid-cols-2 gap-xs">
                          <div className="rounded-md bg-surface-container-low p-xs">
                            <p className="text-[9px] font-bold text-on-surface-variant">
                              {rec.evaluation.costKpi.label}
                            </p>
                            <p
                              className={`mt-0.5 font-data text-xs font-bold ${rec.evaluation.costKpi.direction === "decrease" ? "text-[#318f19]" : rec.evaluation.costKpi.direction === "increase" ? "text-error" : "text-on-surface"}`}
                            >
                              {rec.evaluation.costKpi.value}
                            </p>
                          </div>
                          <div className="rounded-md bg-surface-container-low p-xs">
                            <div className="flex items-center justify-between gap-xs">
                              <p className="text-[9px] font-bold text-on-surface-variant">
                                {rec.evaluation.feasibility.metric}
                              </p>
                              <span className="text-[9px] font-bold text-[#318f19]">
                                {rec.evaluation.feasibility.label}
                              </span>
                            </div>
                            <p className="mt-0.5 font-data text-xs font-bold text-scm-primary">
                              {Math.round(rec.evaluation.feasibility.score)}/100
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  }
                  return (
                    <label
                      key={rec.t}
                      className="flex cursor-pointer items-start gap-md rounded p-xs transition-colors hover:bg-white/50"
                    >
                      <input
                        checked={checked}
                        onChange={(event) =>
                          setRecommendationChecks((current) => ({
                            ...current,
                            [checkKey]: event.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded accent-[#004ccd]"
                        type="checkbox"
                      />
                      <div>
                        <p className="text-xs font-bold text-on-surface">{rec.t}</p>
                        <p className="mt-0.5 text-[10px] leading-tight text-on-surface-variant">
                          {rec.d}
                        </p>
                      </div>
                    </label>
                  );
                })}
              {showRecommendationXai && selectedEvaluation && (
                <div className="rounded-lg border border-scm-primary/20 bg-white p-sm">
                  <div className="mb-sm flex items-center justify-between gap-xs">
                    <div className="flex items-center gap-xs">
                      <Icon name="psychology" className="text-[16px] text-scm-primary" />
                      <p className="text-[10px] font-bold text-scm-primary">XAI 판단 근거</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRecommendationXai(false)}
                      className="rounded-full border border-outline-variant px-2 py-0.5 text-[9px] font-bold text-on-surface-variant hover:bg-surface-container-low"
                    >
                      추천안 목록
                    </button>
                  </div>
                  <div className="mb-sm grid grid-cols-2 gap-xs">
                    <div className="rounded-md bg-surface-container-low p-xs">
                      <p className="text-[9px] font-bold text-on-surface-variant">
                        {selectedEvaluation.costKpi.label}
                      </p>
                      <p
                        className={`font-data text-xs font-bold ${selectedEvaluation.costKpi.direction === "decrease" ? "text-[#318f19]" : selectedEvaluation.costKpi.direction === "increase" ? "text-error" : "text-on-surface"}`}
                      >
                        {selectedEvaluation.costKpi.value}
                      </p>
                    </div>
                    <div className="rounded-md bg-surface-container-low p-xs">
                      <p className="text-[9px] font-bold text-on-surface-variant">
                        {selectedEvaluation.feasibility.metric}
                      </p>
                      <p className="font-data text-xs font-bold text-scm-primary">
                        {selectedEvaluation.feasibility.label} ·{" "}
                        {Math.round(selectedEvaluation.feasibility.score)}/100
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] leading-snug text-on-surface">
                    {selectedEvaluation.xai.summary}
                  </p>
                  <ul className="mt-xs space-y-0.5 text-[9px] leading-snug text-on-surface-variant">
                    {selectedEvaluation.xai.evidence.map((evidence) => (
                      <li key={evidence}>• {evidence}</li>
                    ))}
                  </ul>
                  <p className="mt-xs text-[9px] font-bold text-on-surface">핵심 실행조건</p>
                  <ul className="mt-0.5 space-y-0.5 text-[9px] leading-snug text-on-surface-variant">
                    {selectedEvaluation.xai.conditions.map((condition) => (
                      <li key={condition}>• {condition}</li>
                    ))}
                  </ul>
                  <p className="mt-xs border-t border-outline-variant/50 pt-xs text-[9px] leading-snug text-[#ad6800]">
                    해석 한계: {selectedEvaluation.xai.limitation}
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!cefazolinData) return;
                setSelectedRecommendationIndex(recommendedEvaluationIndex);
                setShowRecommendationXai(false);
                setShowScenarioComparison(true);
              }}
              className="mt-md w-full cursor-pointer rounded-lg bg-on-surface py-sm text-xs font-bold text-white shadow-md transition-opacity hover:opacity-90 active:scale-[0.98]"
            >
              {cefazolinData
                ? "S1·S2·S3 비교 및 실행안 검토"
                : (scenario?.recommendations[0]?.approvalButtonText ?? "실행 계획 적용")}
            </button>
          </div>

          <CefazolinNewsApiCard productName={product.name} />
        </div>
      </div>

      {showAiWorkflow && cefazolinData && selectedWorkflowStep && (
        <div
          className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto p-2 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-workflow-title"
        >
          <button
            type="button"
            aria-label="SCM 의사결정 실행 콘솔 닫기"
            onClick={() => setShowAiWorkflow(false)}
            className="absolute inset-0 bg-on-surface/50 backdrop-blur-[2px]"
          />
          <div className="relative z-10 flex h-[min(780px,88dvh)] w-[min(1180px,92vw)] flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-2xl [word-break:keep-all]">
            <div className="flex items-center justify-between gap-4 border-b border-outline-variant px-4 py-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="ai-workflow-title"
                    className="font-display text-headline-md text-on-surface"
                  >
                    SCM 의사결정 실행 콘솔
                  </h2>
                  <span className="rounded-full bg-primary-container px-3 py-1 text-[10px] font-bold text-white">
                    합성 데이터 기반 Digital Twin PoC
                  </span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">CEFAZOLIN SCM DECISION RUN</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="font-data text-sm font-bold text-scm-primary">
                    {workflowCompletedCount}/10
                  </p>
                  <p className="text-[10px] text-on-surface-variant">단계 완료</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAiWorkflow(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
                  aria-label="닫기"
                  autoFocus
                >
                  <Icon name="close" className="text-[24px]" />
                </button>
              </div>
            </div>

            <div className="border-b border-outline-variant bg-surface-container-low/50 px-4 py-1.5">
              <dl className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-9">
                {[
                  ["실행 ID", workflowRunState.runId],
                  ["제품", cefazolinWorkflowRunMeta.productName],
                  ["데이터 기준", cefazolinWorkflowRunMeta.latestSnapshotDate],
                  ["데이터 유형", cefazolinWorkflowRunMeta.dataType],
                  [
                    "현재 단계",
                    cefazolinWorkflowSteps[workflowRunState.currentStep - 1]?.shortTitle ??
                      "확인 필요",
                  ],
                  [
                    "권고 시나리오",
                    workflowRunState.recommendation?.recommendationTitle ?? "산출 불가",
                  ],
                  ["분석 상태", cefazolinAnalysisReadiness.verdict],
                  [
                    "승인 상태",
                    hitlStatus === "approved"
                      ? "승인 완료"
                      : hitlStatus === "held"
                        ? "보류"
                        : "승인 대기",
                  ],
                  ["마지막 갱신", formatWorkflowTimestamp(workflowRunState.lastUpdatedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[9px] font-bold uppercase text-on-surface-variant">
                      {label}
                    </dt>
                    <dd className="mt-0.5 truncate font-data text-[11px] font-bold text-on-surface">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-outline-variant/50">
                  <div
                    className="h-full rounded-full bg-scm-primary transition-[width]"
                    style={{ width: `${workflowCompletedCount * 10}%` }}
                  />
                </div>
                <span className="shrink-0 font-data text-[10px] font-bold text-scm-primary">
                  {workflowCompletedCount}/10 단계 완료
                </span>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[240px_minmax(0,1fr)]">
              <div className="max-h-[28vh] min-h-0 overflow-y-auto border-b border-outline-variant bg-surface-container-low/40 p-2 lg:max-h-none lg:border-b-0 lg:border-r">
                <div className="space-y-3">
                  {workflowGroupOrder.map((group) => (
                    <section key={group} aria-label={group}>
                      <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
                        {group}
                      </p>
                      <div className="space-y-0.5">
                        {cefazolinWorkflowSteps
                          .filter((step) => step.group === group)
                          .map((step) => {
                            const index = step.order - 1;
                            const runtimeStatus = workflowStatusFor(step.order);
                            const statusMeta = workflowStatusMeta[runtimeStatus];
                            const selected = selectedWorkflowStepIndex === index;
                            return (
                              <button
                                key={step.id}
                                type="button"
                                onClick={() => setSelectedWorkflowStepIndex(index)}
                                aria-current={selected ? "step" : undefined}
                                className={`relative flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors ${selected ? "border-scm-primary bg-white" : "border-transparent hover:bg-white/80"}`}
                              >
                                <span
                                  className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${selected ? "bg-scm-primary text-white" : "border border-outline-variant bg-white text-on-surface"}`}
                                >
                                  {step.order}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-on-surface">
                                  {step.shortTitle}
                                </span>
                                <span
                                  className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${statusMeta.badge}`}
                                >
                                  {statusMeta.label}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto p-3 lg:p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-scm-primary text-white">
                      <Icon name={selectedWorkflowStep.icon} className="text-[24px]" />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-scm-primary">
                        STEP {selectedWorkflowStep.order}
                      </p>
                      <h3 className="mt-1 font-display text-headline-sm text-on-surface">
                        {selectedWorkflowStep.title}
                      </h3>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${workflowStatusMeta[workflowStatusFor(selectedWorkflowStep.order)].badge}`}
                  >
                    {workflowStatusMeta[workflowStatusFor(selectedWorkflowStep.order)].label}
                  </span>
                </div>

                <p className="mt-4 rounded-xl bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface">
                  {selectedWorkflowStep.purpose}
                </p>

                <div className="mt-4 rounded-xl border border-outline-variant px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                      데이터 기준시점
                    </p>
                    <p className="font-data text-xs font-bold text-on-surface">
                      {selectedWorkflowStep.dataAsOf}
                    </p>
                  </div>
                </div>

                <section className="mt-4 rounded-xl border border-scm-primary/25 bg-primary-container/35 p-4">
                  <div className="flex items-center gap-2 text-scm-primary">
                    <Icon name="fact_check" className="text-[18px]" />
                    <h4 className="text-sm font-bold">근거 및 처리 결과</h4>
                  </div>
                  <ul className="mt-3 grid gap-2 text-xs leading-relaxed text-on-surface-variant md:grid-cols-2">
                    {selectedWorkflowStep.evidence.map((evidence) => (
                      <li key={evidence} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-scm-primary" />
                        <span>{evidence}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {selectedWorkflowStep.order === 1 && (
                  <section className="mt-4 overflow-hidden rounded-xl border border-outline-variant">
                    <div className="border-b border-outline-variant bg-surface-container-low px-4 py-3">
                      <h4 className="text-sm font-bold text-on-surface">시스템별 데이터 스냅샷</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-left text-xs">
                        <thead className="text-[10px] uppercase text-on-surface-variant">
                          <tr>
                            <th className="px-4 py-2">시스템</th>
                            <th className="px-4 py-2 text-right">데이터 건수</th>
                            <th className="px-4 py-2 text-right">동기화 완료</th>
                            <th className="px-4 py-2">기준일</th>
                            <th className="px-4 py-2">연동 상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cefazolinDataCollectionSummary.systems.map((system) => (
                            <tr key={system.system} className="border-t border-outline-variant/50">
                              <td className="px-4 py-3 font-bold">{system.system}</td>
                              <td className="px-4 py-3 text-right font-data">
                                {system.recordCount}건
                              </td>
                              <td className="px-4 py-3 text-right font-data">
                                {system.syncedCount}건
                              </td>
                              <td className="px-4 py-3 font-data">{system.dataAsOf}</td>
                              <td className="px-4 py-3">
                                <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-bold text-[#318f19]">
                                  배치 데이터 확인
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {selectedWorkflowStep.order === 2 && (
                  <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      [
                        "동기화 완료",
                        `${cefazolinDataQualitySummary.syncedCount}/${cefazolinDataQualitySummary.totalCount}건`,
                      ],
                      [
                        "시스템 키 정합성",
                        cefazolinDataQualitySummary.systemKeyMatches ? "통과" : "실패",
                      ],
                      [
                        "권역 키 정규화",
                        cefazolinDataQualitySummary.regionKeyNormalized ? "통과" : "실패",
                      ],
                      [
                        "필수 수치 검사",
                        cefazolinDataQualitySummary.requiredNumericValuesValid
                          ? "결측·음수 없음"
                          : "오류 있음",
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-outline-variant p-4">
                        <p className="text-[10px] font-bold text-on-surface-variant">{label}</p>
                        <p className="mt-2 text-right font-data text-sm font-bold text-on-surface">
                          {value}
                        </p>
                      </div>
                    ))}
                  </section>
                )}

                {selectedWorkflowStep.order === 4 && (
                  <section className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-xl border border-outline-variant p-4">
                      <h4 className="text-sm font-bold text-on-surface">A. 수요예측</h4>
                      <dl className="mt-3 space-y-2 text-xs">
                        {[
                          ["예측 대상", cefazolinForecastRiskSummary.forecast.target],
                          ["권역 수", `${cefazolinForecastRiskSummary.forecast.regionCount}개`],
                          ["예측 기간", cefazolinForecastRiskSummary.forecast.period],
                          ["데이터 기준일", cefazolinForecastRiskSummary.forecast.dataAsOf],
                        ].map(([label, value]) => (
                          <div key={label} className="flex justify-between gap-4">
                            <dt className="text-on-surface-variant">{label}</dt>
                            <dd className="text-right font-data font-bold">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <div className="rounded-xl border border-outline-variant p-4">
                      <h4 className="text-sm font-bold text-on-surface">B. 부족위험 모델</h4>
                      <dl className="mt-3 space-y-2 text-xs">
                        <div className="flex justify-between gap-4">
                          <dt className="text-on-surface-variant">모델명</dt>
                          <dd className="font-data font-bold">
                            {cefazolinForecastRiskSummary.riskModel.model}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-on-surface-variant">학습 데이터</dt>
                          <dd className="font-data font-bold">
                            {cefazolinForecastRiskSummary.riskModel.trainingRows.toLocaleString(
                              "ko-KR",
                            )}
                            행
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-on-surface-variant">검증 지표</dt>
                          <dd className="font-data font-bold">
                            ROC-AUC {cefazolinForecastRiskSummary.riskModel.rocAuc.toFixed(3)}
                            {" · "}F1 {cefazolinForecastRiskSummary.riskModel.f1.toFixed(3)}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {cefazolinForecastRiskSummary.riskModel.topFeatures.map((feature) => (
                          <span
                            key={feature.label}
                            className="rounded bg-primary-container/60 px-2 py-1 text-[10px] font-bold text-white"
                          >
                            {feature.label}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-[10px] text-[#ad6800]">
                        {cefazolinForecastRiskSummary.notice}
                      </p>
                    </div>
                  </section>
                )}

                {selectedWorkflowStep.order === 5 && (
                  <section className="mt-4 overflow-hidden rounded-xl border border-outline-variant">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1080px] text-left text-[11px]">
                        <thead className="bg-surface-container-low text-[9px] uppercase text-on-surface-variant">
                          <tr>
                            <th className="px-3 py-2">시나리오</th>
                            <th className="px-3 py-2">대응 방식</th>
                            <th className="px-3 py-2 text-right">서비스율</th>
                            <th className="px-3 py-2 text-right">최저 권역 서비스율</th>
                            <th className="px-3 py-2 text-right">미충족 수요</th>
                            <th className="px-3 py-2 text-right">부족 주차</th>
                            <th className="px-3 py-2 text-right">추가 조달</th>
                            <th className="px-3 py-2 text-right">비용</th>
                            <th className="px-3 py-2">제약</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cefazolinScenarioComparison.map((scenarioRow) => (
                            <tr key={scenarioRow.id} className="border-t border-outline-variant/50">
                              <td className="px-3 py-3 font-bold">
                                {scenarioRow.displayId}
                                {scenarioRow.baseline && (
                                  <span className="ml-1 rounded bg-surface-container-low px-1.5 py-0.5 text-[8px] text-on-surface-variant">
                                    기준선
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3">{scenarioRow.response}</td>
                              <td className="px-3 py-3 text-right font-data">
                                {scenarioRow.serviceRatePct.toFixed(2)}%
                              </td>
                              <td className="px-3 py-3 text-right font-data">
                                {scenarioRow.minimumRegionalServiceRatePct.toFixed(2)}%
                              </td>
                              <td className="px-3 py-3 text-right font-data">
                                {formatScmQuantity(scenarioRow.totalUnmetDemand, "demand")}
                              </td>
                              <td className="px-3 py-3 text-right font-data">
                                {scenarioRow.shortageWeeks}주
                              </td>
                              <td className="px-3 py-3 text-right font-data">
                                {formatScmQuantity(
                                  scenarioRow.emergencyProcurementQuantity,
                                  "apiProcurement",
                                )}
                              </td>
                              <td className="px-3 py-3 text-right font-data">
                                {formatKrw(scenarioRow.totalProcurementCostKrw)}
                              </td>
                              <td className="px-3 py-3">
                                {scenarioRow.constraintPassed ? "통과" : "미통과"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="border-t border-outline-variant px-4 py-2 text-[9px] text-on-surface-variant">
                      제약 통과는 필수 수치의 유효 범위·비음수 조건 기준입니다.
                    </p>
                  </section>
                )}

                {selectedWorkflowStep.order === 6 && (
                  <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="rounded-xl border border-scm-primary/30 bg-primary-container/35 p-4">
                      <p className="text-[10px] font-bold uppercase text-scm-primary">
                        계산된 최종 권고안
                      </p>
                      <h4 className="mt-2 font-display text-headline-sm text-on-surface">
                        {cefazolinScenarioRecommendation.recommendationTitle}
                      </h4>
                      <ul className="mt-3 space-y-2 text-xs text-on-surface-variant">
                        {cefazolinScenarioRecommendation.decisionReasons.map((reason) => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                      <div className="mt-4 border-t border-scm-primary/20 pt-3">
                        <p className="text-[10px] text-on-surface-variant">
                          S1 대비 주요 비용 증가분
                        </p>
                        <p className="mt-1 text-right font-data text-base font-bold text-error">
                          {formatKrw(cefazolinWorkflowEffect.procurementCostDeltaKrw)}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-outline-variant p-4">
                      <h4 className="text-sm font-bold text-on-surface">다른 시나리오 제외 사유</h4>
                      <div className="mt-3 space-y-2">
                        {cefazolinScenarioRecommendation.excludedScenarios.map(
                          (scenarioExclusion) => (
                            <div
                              key={scenarioExclusion.scenarioId}
                              className="rounded-lg bg-surface-container-low p-3"
                            >
                              <p className="text-xs font-bold text-on-surface">
                                {scenarioExclusion.scenarioId.replace("_", " ")}
                              </p>
                              <p className="mt-1 text-[10px] leading-relaxed text-on-surface-variant">
                                {scenarioExclusion.reason}
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {selectedWorkflowStep.order === 7 && (
                  <section className="mt-4 grid gap-3 xl:grid-cols-3">
                    {[
                      ["A. 모델 근거", cefazolinDecisionEvidence.model],
                      ["B. 시뮬레이션 근거", cefazolinDecisionEvidence.simulation],
                      ["C. 규칙 근거", cefazolinDecisionEvidence.rules],
                    ].map(([title, items]) => (
                      <div
                        key={title as string}
                        className="rounded-xl border border-outline-variant p-4"
                      >
                        <h4 className="text-sm font-bold text-on-surface">{title as string}</h4>
                        <ul className="mt-3 space-y-2 text-[10px] leading-relaxed text-on-surface-variant">
                          {(items as string[]).map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                )}

                {selectedWorkflowStep.order === 3 && (
                  <section className="mt-4 rounded-xl border border-outline-variant p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-on-surface">분석 준비성 검사</h4>
                        <p className="mt-1 text-[10px] text-on-surface-variant">
                          {cefazolinAnalysisReadiness.scope}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="block text-sm font-bold text-scm-primary">
                          {cefazolinAnalysisReadiness.verdict}
                        </span>
                        <span className="font-data text-[10px] text-on-surface-variant">
                          통과 {cefazolinAnalysisReadiness.passedChecks} · 경고{" "}
                          {cefazolinAnalysisReadiness.warningChecks} · 실패{" "}
                          {cefazolinAnalysisReadiness.failedChecks}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {cefazolinReadinessChecks.map((check) => (
                        <div key={check.id} className="rounded-lg bg-surface-container-low p-3">
                          <div className="flex items-start gap-2">
                            <Icon
                              name={
                                check.status === "pass"
                                  ? "check_circle"
                                  : check.status === "warning"
                                    ? "warning"
                                    : "error"
                              }
                              className={`text-[17px] ${check.status === "pass" ? "text-[#318f19]" : check.status === "warning" ? "text-[#ad6800]" : "text-error"}`}
                            />
                            <div>
                              <p className="text-xs font-bold text-on-surface">{check.label}</p>
                              <p className="mt-1 text-[10px] leading-snug text-on-surface-variant">
                                {check.evidence}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedWorkflowStep.order === 8 && (
                  <section className="mt-4 rounded-xl border border-outline-variant p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-on-surface">
                          {cefazolinScenarioRecommendation.recommendationTitle} 담당자 검토
                        </h4>
                        <p className="mt-1 text-[10px] text-on-surface-variant">
                          승인 전에는 가상 실행 단계가 잠깁니다. 승인 기록은 현재 브라우저 세션에만
                          유지됩니다.
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${workflowStatusMeta[workflowStatusFor(8)].badge}`}
                      >
                        {workflowStatusMeta[workflowStatusFor(8)].label}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-bold text-on-surface">검토자</span>
                        <input
                          value={hitlReviewer}
                          onChange={(event) => setHitlReviewer(event.target.value)}
                          disabled={
                            hitlStatus === "approved" || virtualExecutionStatus === "executed"
                          }
                          className="mt-2 w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-scm-primary"
                          placeholder="검토자 이름"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-on-surface">
                          검토 부서 또는 역할
                        </span>
                        <input
                          value={hitlReviewerRole}
                          onChange={(event) => setHitlReviewerRole(event.target.value)}
                          disabled={
                            hitlStatus === "approved" || virtualExecutionStatus === "executed"
                          }
                          className="mt-2 w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-scm-primary"
                          placeholder="예: SCM 운영 / 구매 담당"
                        />
                      </label>
                    </div>
                    <label className="mt-3 block">
                      <span className="text-xs font-bold text-on-surface">검토 메모</span>
                      <textarea
                        value={hitlReviewNote}
                        onChange={(event) => setHitlReviewNote(event.target.value)}
                        disabled={
                          hitlStatus === "approved" || virtualExecutionStatus === "executed"
                        }
                        className="mt-2 min-h-20 w-full resize-y rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm outline-none focus:border-scm-primary"
                        placeholder="공급사 일정, 품질 승인 전제, 권역 배분 우선순위를 확인하세요."
                      />
                    </label>
                    <fieldset className="mt-4 rounded-xl bg-surface-container-low p-4">
                      <legend className="px-1 text-xs font-bold text-on-surface">
                        필수 확인사항
                      </legend>
                      <div className="mt-1 grid gap-2 sm:grid-cols-2">
                        {hitlChecklistItems.map((item) => (
                          <label
                            key={item.key}
                            className="flex items-center gap-2 text-xs text-on-surface"
                          >
                            <input
                              type="checkbox"
                              checked={hitlChecklist[item.key]}
                              onChange={(event) =>
                                setHitlChecklist((current) => ({
                                  ...current,
                                  [item.key]: event.target.checked,
                                }))
                              }
                              disabled={
                                hitlStatus === "approved" || virtualExecutionStatus === "executed"
                              }
                              className="h-4 w-4 accent-scm-primary"
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="mt-3 grid gap-3 rounded-lg border border-outline-variant p-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] text-on-surface-variant">승인 대상</p>
                        <p className="mt-1 text-xs font-bold text-on-surface">
                          {cefazolinScenarioRecommendation.recommendationTitle}
                        </p>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-[10px] text-on-surface-variant">S1 대비 조달비 증가분</p>
                        <p className="mt-1 font-data text-xs font-bold text-error">
                          {formatKrw(cefazolinWorkflowEffect.procurementCostDeltaKrw)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => reviewHitl("approved")}
                        disabled={
                          !hitlCanApprove ||
                          hitlStatus === "approved" ||
                          virtualExecutionStatus === "executed"
                        }
                        className="rounded-lg bg-scm-primary px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        가상 실행 승인
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewHitl("held")}
                        disabled={!hitlIdentityComplete || virtualExecutionStatus === "executed"}
                        className="rounded-lg border border-[#ffd591] bg-[#fff7e6] px-4 py-2 text-xs font-bold text-[#ad6800] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        보류
                      </button>
                    </div>
                    {hitlStatus === "pending" && approvalDisabledReason && (
                      <p className="mt-2 text-[10px] text-error">
                        승인 비활성화: {approvalDisabledReason}
                      </p>
                    )}
                    {hitlReviewedAt && (
                      <p className="mt-3 text-[10px] text-on-surface-variant">
                        {hitlReviewer} ({hitlReviewerRole}) ·{" "}
                        {new Date(hitlReviewedAt).toLocaleString("ko-KR")} ·{" "}
                        {hitlReviewNote || "메모 없음"}
                      </p>
                    )}
                  </section>
                )}

                {selectedWorkflowStep.order === 9 && (
                  <section className="mt-4 rounded-xl border border-outline-variant p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-on-surface">가상 실행 명령</h4>
                        <p className="mt-1 text-[10px] text-on-surface-variant">
                          실제 ERP·MES·WMS에는 전송하지 않습니다.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={executeVirtualPlan}
                        disabled={hitlStatus !== "approved" || virtualExecutionStatus !== "ready"}
                        className="rounded-lg bg-on-surface px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {virtualExecutionStatus === "executed"
                          ? "가상 실행 완료"
                          : hitlStatus === "approved"
                            ? "가상 발주·생산·이동 실행"
                            : "담당자 승인 필요"}
                      </button>
                    </div>
                    {hitlStatus !== "approved" && (
                      <p className="mt-3 text-[10px] text-error">
                        실행 잠김: 담당자 승인 완료 후 실행할 수 있습니다.
                      </p>
                    )}
                    <div className="mt-4 overflow-x-auto rounded-lg border border-outline-variant">
                      <table className="w-full min-w-[1020px] text-left text-[10px]">
                        <thead className="bg-surface-container-low text-[9px] uppercase text-on-surface-variant">
                          <tr>
                            <th className="px-3 py-2">작업 ID</th>
                            <th className="px-3 py-2">작업 유형</th>
                            <th className="px-3 py-2">Source</th>
                            <th className="px-3 py-2">Target</th>
                            <th className="px-3 py-2 text-right">수량</th>
                            <th className="px-3 py-2">적용 규칙</th>
                            <th className="px-3 py-2">산출 근거</th>
                            <th className="px-3 py-2">상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cefazolinVirtualExecutionActions.map((action) => (
                            <tr key={action.id} className="border-t border-outline-variant/50">
                              <td className="px-3 py-3 font-data font-bold">{action.id}</td>
                              <td className="px-3 py-3">{action.actionType}</td>
                              <td className="px-3 py-3">{action.source}</td>
                              <td className="px-3 py-3">{action.target}</td>
                              <td className="px-3 py-3 text-right font-data">
                                {action.quantity === null
                                  ? action.unit
                                  : `${action.quantity.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} ${action.unit}`}
                              </td>
                              <td className="px-3 py-3 font-data">{action.ruleId}</td>
                              <td className="px-3 py-3">{action.basis}</td>
                              <td className="px-3 py-3">
                                {virtualExecutionStatus === "executed"
                                  ? "가상 실행 완료"
                                  : hitlStatus === "approved"
                                    ? "실행 가능"
                                    : "잠김"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {virtualExecutedAt && (
                      <p className="mt-3 text-[10px] text-on-surface-variant">
                        가상 실행시각 {new Date(virtualExecutedAt).toLocaleString("ko-KR")}
                      </p>
                    )}
                  </section>
                )}

                {selectedWorkflowStep.order === 10 && (
                  <section className="mt-4 rounded-xl border border-outline-variant p-4">
                    {virtualExecutionStatus !== "executed" ? (
                      <div className="rounded-lg bg-surface-container-low p-5 text-center">
                        <Icon name="lock" className="text-[24px] text-outline" />
                        <p className="mt-2 text-sm font-bold text-on-surface">
                          가상 실행 완료 후 예상효과가 활성화됩니다.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Icon name="monitoring" className="text-[20px] text-scm-primary" />
                          <h4 className="text-sm font-bold text-on-surface">
                            S1 기준 대비 {cefazolinScenarioRecommendation.recommendationTitle}{" "}
                            예상효과
                          </h4>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                          {[
                            {
                              label: "서비스율",
                              before: `${cefazolinWorkflowEffect.serviceRateBefore.toFixed(2)}%`,
                              after: `${cefazolinWorkflowEffect.serviceRateAfter.toFixed(2)}%`,
                            },
                            {
                              label: "최저 권역 서비스율",
                              before: `${cefazolinWorkflowEffect.minimumRegionalServiceRateBefore.toFixed(2)}%`,
                              after: `${cefazolinWorkflowEffect.minimumRegionalServiceRateAfter.toFixed(2)}%`,
                            },
                            {
                              label: "미충족 수요",
                              before: formatScmQuantity(
                                cefazolinWorkflowEffect.unmetDemandBefore,
                                "demand",
                              ),
                              after: formatScmQuantity(
                                cefazolinWorkflowEffect.unmetDemandAfter,
                                "demand",
                              ),
                            },
                            {
                              label: "부족 발생",
                              before: `${cefazolinWorkflowEffect.shortageWeeksBefore}주`,
                              after: `${cefazolinWorkflowEffect.shortageWeeksAfter}주`,
                            },
                            {
                              label: "조달비 증가분",
                              before: "S1 기준",
                              after: formatKrw(cefazolinWorkflowEffect.procurementCostDeltaKrw),
                            },
                          ].map((metric) => (
                            <div
                              key={metric.label}
                              className="rounded-lg bg-surface-container-low p-3"
                            >
                              <p className="text-[10px] font-bold text-on-surface-variant">
                                {metric.label}
                              </p>
                              <p className="mt-2 text-xs text-on-surface-variant line-through">
                                {metric.before}
                              </p>
                              <p className="mt-1 font-data text-base font-bold text-scm-primary">
                                {metric.after}
                              </p>
                            </div>
                          ))}
                        </div>
                        <p className="mt-4 rounded-lg bg-[#fff7e6] p-3 text-xs leading-relaxed text-[#ad6800]">
                          이 결과는 실제 운영성과가 아니라 합성 데이터 기반 시뮬레이션 예상값입니다.
                        </p>
                      </>
                    )}
                  </section>
                )}

                {selectedWorkflowStep.warnings.length > 0 && (
                  <section className="mt-4 rounded-xl border border-[#ffd591] bg-[#fff7e6] p-3">
                    <h4 className="text-xs font-bold text-[#ad6800]">오류·주의사항</h4>
                    <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-[#ad6800]">
                      {selectedWorkflowStep.warnings.map((warning) => (
                        <li key={warning}>• {warning}</li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant p-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase text-on-surface-variant">
                      다음 행동
                    </p>
                    <p className="mt-1 text-xs font-bold text-on-surface">
                      {selectedWorkflowStep.nextAction}
                    </p>
                  </div>
                  {selectedWorkflowStep.order < 10 && (
                    <button
                      type="button"
                      onClick={() => setSelectedWorkflowStepIndex(selectedWorkflowStep.order)}
                      className="rounded-lg border border-scm-primary px-3 py-2 text-[10px] font-bold text-scm-primary hover:bg-primary-container/30"
                    >
                      다음 단계 보기
                    </button>
                  )}
                </section>

                <details className="mt-4 rounded-xl border border-outline-variant px-4 py-3">
                  <summary className="cursor-pointer text-xs font-bold text-on-surface">
                    적용 규칙 ID 펼쳐보기
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedWorkflowStep.ruleIds.map((ruleId) => (
                      <code
                        key={ruleId}
                        className="rounded bg-primary-container/60 px-2 py-1 text-[10px] font-bold text-white"
                      >
                        {ruleId}
                      </code>
                    ))}
                  </div>
                </details>

                <p className="mt-4 border-t border-outline-variant pt-3 text-[10px] leading-relaxed text-on-surface-variant">
                  본 흐름의 HITL 승인과 실행은 브라우저 세션 내 가상 기능입니다. 실제 시스템
                  반영에는 인증·권한·데이터베이스·ERP/MES/WMS API가 별도로 필요합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScenarioComparison && cefazolinData && selectedEvaluation && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-2 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scenario-comparison-title"
        >
          <button
            type="button"
            aria-label="실행안 비교 닫기"
            onClick={() => setShowScenarioComparison(false)}
            className="absolute inset-0 bg-on-surface/45 backdrop-blur-[2px]"
          />
          <div className="relative z-10 flex h-[min(780px,88dvh)] w-[min(1180px,92vw)] flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-2xl [word-break:keep-all]">
            <div className="flex items-center justify-between border-b border-outline-variant px-4 py-2">
              <div>
                <h2
                  id="scenario-comparison-title"
                  className="font-display text-headline-md text-on-surface"
                >
                  AI 추천 실행안 비교 및 XAI 설명
                </h2>
                <p className="mt-1 text-xs text-on-surface-variant">
                  S1 무대응 · S2 권역 재고 재배분 · S3 권역 재배분 및 원료 추가 발주
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowScenarioComparison(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
                aria-label="닫기"
              >
                <Icon name="close" className="text-[24px]" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[390px_minmax(0,1fr)]">
              <div className="min-h-0 space-y-2 overflow-y-auto border-b border-outline-variant bg-surface-container-low/40 p-3 lg:border-b-0 lg:border-r">
                {recommendations.map((recommendation, index) => {
                  const evaluation = recommendation.evaluation;
                  if (!evaluation) return null;
                  const selected = selectedRecommendationIndex === index;
                  return (
                    <button
                      key={evaluation.scenarioId}
                      type="button"
                      onClick={() => setSelectedRecommendationIndex(index)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${selected ? "border-scm-primary bg-white shadow-sm ring-1 ring-scm-primary/20" : "border-outline-variant bg-white/80 hover:border-scm-primary/40"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-scm-primary text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-display text-base font-bold text-on-surface">
                                {recommendation.t}
                              </p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${evaluation.recommended ? "bg-primary-container text-white" : "bg-surface-container-low text-on-surface-variant"}`}
                              >
                                {evaluation.roleLabel}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-snug text-on-surface-variant">
                              {recommendation.d}
                            </p>
                          </div>
                        </div>
                        <Icon
                          name={selected ? "check_circle" : "radio_button_unchecked"}
                          className={`shrink-0 text-[22px] ${selected ? "text-scm-primary" : "text-outline"}`}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-surface-container-low p-2.5">
                          <p className="text-[9px] font-bold text-on-surface-variant">
                            {evaluation.costKpi.label}
                          </p>
                          <p
                            className={`mt-1 font-data text-xs font-bold ${evaluation.costKpi.direction === "increase" ? "text-error" : evaluation.costKpi.direction === "decrease" ? "text-[#318f19]" : "text-on-surface"}`}
                          >
                            {evaluation.costKpi.value}
                          </p>
                        </div>
                        <div className="rounded-lg bg-surface-container-low p-2.5">
                          <p className="text-[9px] font-bold text-on-surface-variant">
                            최저 권역 서비스
                          </p>
                          <p className="mt-1 font-data text-xs font-bold text-scm-primary">
                            {evaluation.feasibility.score.toFixed(2)}%
                          </p>
                        </div>
                        <div className="rounded-lg bg-surface-container-low p-2.5">
                          <p className="text-[9px] font-bold text-on-surface-variant">실행 구분</p>
                          <p className="mt-1 text-xs font-bold text-on-surface">
                            {evaluation.roleLabel}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="min-h-0 overflow-y-auto p-3 lg:p-4">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-scm-primary px-3 py-1 text-xs font-bold text-white">
                    {selectedEvaluation.scenarioId}
                  </span>
                  <h3 className="font-display text-headline-sm text-on-surface">
                    {recommendations[selectedRecommendationIndex]?.t}
                  </h3>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${selectedEvaluation.recommended ? "bg-primary-container text-white" : "bg-surface-container-low text-on-surface-variant"}`}
                  >
                    {selectedEvaluation.roleLabel}
                  </span>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] text-on-surface-variant">
                  <span className="font-bold">적용 규칙</span>
                  {selectedEvaluation.ruleIds.map((ruleId) => (
                    <code
                      key={ruleId}
                      className="rounded bg-surface-container-low px-2 py-1 text-scm-primary"
                    >
                      {ruleId}
                    </code>
                  ))}
                  <span className="ml-auto font-data">기준시점 {selectedEvaluation.dataAsOf}</span>
                </div>

                <section className="rounded-xl border border-scm-primary/40 bg-primary-container/45 p-5">
                  <div className="flex items-center gap-2 text-scm-primary">
                    <Icon name="auto_awesome" className="text-[20px]" filled />
                    <h4 className="font-bold">AI가 이 실행안을 평가한 이유</h4>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-on-surface">
                    {selectedEvaluation.xai.summary}
                  </p>
                  <ul className="mt-4 grid gap-2 border-t border-scm-primary/20 pt-4 text-sm text-on-surface-variant md:grid-cols-2">
                    {selectedEvaluation.xai.evidence.map((evidence) => (
                      <li key={evidence} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-scm-primary" />
                        <span>{evidence}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-outline-variant p-4">
                    <p className="text-xs font-bold text-on-surface-variant">
                      {selectedEvaluation.costKpi.label}
                    </p>
                    <p
                      className={`mt-2 font-data text-lg font-bold ${selectedEvaluation.costKpi.direction === "increase" ? "text-error" : selectedEvaluation.costKpi.direction === "decrease" ? "text-[#318f19]" : "text-on-surface"}`}
                    >
                      {selectedEvaluation.costKpi.value}
                    </p>
                  </div>
                  <div className="rounded-xl border border-outline-variant p-4">
                    <p className="text-xs font-bold text-on-surface-variant">
                      {selectedEvaluation.feasibility.metric}
                    </p>
                    <p className="mt-2 font-data text-lg font-bold text-scm-primary">
                      {selectedEvaluation.feasibility.score.toFixed(2)}% ·{" "}
                      {selectedEvaluation.feasibility.label}
                    </p>
                  </div>
                  <div className="rounded-xl border border-outline-variant p-4">
                    <p className="text-xs font-bold text-on-surface-variant">예상 실행 기간</p>
                    <p className="mt-2 text-sm font-bold leading-snug text-on-surface">
                      {selectedEvaluation.executionPeriod}
                    </p>
                  </div>
                  <div className="rounded-xl border border-outline-variant p-4">
                    <p className="text-xs font-bold text-on-surface-variant">정량 공급망 영향</p>
                    <p className="mt-2 text-sm font-bold leading-snug text-on-surface">
                      {selectedEvaluation.supplyImpact}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <section className="rounded-xl bg-surface-container-low p-4">
                    <div className="flex items-center gap-2">
                      <Icon name="task_alt" className="text-[18px] text-[#318f19]" />
                      <h4 className="text-sm font-bold text-on-surface">핵심 실행조건</h4>
                    </div>
                    <ul className="mt-3 space-y-2 text-xs leading-relaxed text-on-surface-variant">
                      {selectedEvaluation.xai.conditions.map((condition) => (
                        <li key={condition} className="flex gap-2">
                          <span className="font-bold text-[#318f19]">•</span>
                          <span>{condition}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className="rounded-xl bg-[#fff7e6] p-4">
                    <div className="flex items-center gap-2">
                      <Icon name="warning" className="text-[18px] text-[#ad6800]" />
                      <h4 className="text-sm font-bold text-on-surface">제약조건 및 잔여 위험</h4>
                    </div>
                    <ul className="mt-3 space-y-2 text-xs leading-relaxed text-on-surface-variant">
                      {selectedEvaluation.xai.constraints.map((constraint) => (
                        <li key={constraint} className="flex gap-2">
                          <span className="font-bold text-[#ad6800]">•</span>
                          <span>{constraint}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                <p className="mt-4 rounded-lg border border-outline-variant bg-white p-3 text-xs leading-relaxed text-on-surface-variant">
                  <strong className="text-on-surface">해석 한계:</strong>{" "}
                  {selectedEvaluation.xai.limitation}
                </p>
                {selectedEvaluation.recommended && (
                  <button
                    type="button"
                    onClick={() => openAiWorkflow(7)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-scm-primary px-4 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90"
                  >
                    <Icon name="verified_user" className="text-[18px]" />
                    HITL 검토·승인 단계로 이동
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
