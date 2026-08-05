import { useEffect, useRef, useState } from "react";
import { markerOrder, regions, type Product, type RiskLevel } from "@/data/scm";
import { lipilouDashboard, tamivirDashboard } from "@/data/dashboard-scenario";
import { cefazolinDashboard } from "@/data/cefazolin-dashboard";
import { createLipilouGraph, getLipilouGraphRegion } from "@/data/lipilou-graph";
import { timelineData, timelineKeys, type TimelineKey } from "@/data/timeline";
import { Icon } from "@/components/ScmShell";

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
  amount?: number;
};

type AiRecommendation = {
  id: string;
  t: string;
  d: string;
  routes?: TransferRoute[];
  costReduction?: string;
  feasibility?: number;
  executionPeriod?: string;
};

const productApiMeta: Record<string, { title: string; description: string; endpoint: string; icon: string }> = {
  리피로우: {
    title: "건강검진 데이터 API",
    description: "이상지질혈증 검사·처방 수요 신호 연동 영역",
    endpoint: "/api/health-screening",
    icon: "health_metrics",
  },
  타미비어: {
    title: "감염병 환자 API",
    description: "지역별 독감·호흡기 감염 환자 추이 연동 영역",
    endpoint: "/api/infectious-disease",
    icon: "coronavirus",
  },
  세파졸린: {
    title: "원료 중단 API",
    description: "원료 공급 중단·납기 지연 신호 연동 영역",
    endpoint: "/api/raw-material-disruption",
    icon: "factory",
  },
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

  return <>{displayValue.toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

export function DashboardView({ product }: { product: Product }) {
  const [regionId, setRegionId] = useState("National");
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const [recommendationChecks, setRecommendationChecks] = useState<Record<string, boolean>>({});
  const [timelineIndex, setTimelineIndex] = useState(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);
  const [selectedRecommendationIndex, setSelectedRecommendationIndex] = useState(0);
  const [isRecommendationApplied, setIsRecommendationApplied] = useState(false);
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
    setIsRecommendationApplied(false);
  }, [product.key]);

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
        : product.key === "세파졸린"
          ? cefazolinDashboard
          : null;
  const lipilouGraphRegion = product.key === "리피로우" ? getLipilouGraphRegion(regionId) : null;
  const lipilouGraph = lipilouGraphRegion ? createLipilouGraph(lipilouGraphRegion) : null;
  const forecastPaths =
    lipilouGraph ?? (product.key === "세파졸린" ? cefazolinDashboard.chart : product.paths);
  const annualDemand =
    lipilouGraphRegion
      ? lipilouGraphRegion.annual_demand_box.toLocaleString("ko-KR")
      : product.key === "세파졸린"
      ? Math.round(cefazolinDashboard.annualForecastDemand).toLocaleString("ko-KR")
      : product.annualDemand;
  const forecastYoy = lipilouGraphRegion
    ? `${lipilouGraphRegion.yoy_pct >= 0 ? "+" : ""}${lipilouGraphRegion.yoy_pct}% YoY`
    : product.yoyGrowth;
  const isCurrentTimeline = timelineKey === "PRES";
  const appliedTransfers = (scenario?.recommendations ?? []).flatMap((recommendation, index) => {
    const checkKey = `${product.key}-${index}`;
    return isRecommendationApplied &&
      (recommendationChecks[checkKey] ?? true) &&
      recommendation.fromRegion &&
      recommendation.toRegion &&
      recommendation.transferAmount
      ? [{ from: recommendation.fromRegion, to: recommendation.toRegion, amount: recommendation.transferAmount }]
      : [];
  });
  const getScenarioRegion = (id: string) => {
    const baseRegion = isCurrentTimeline ? scenario?.regions[id] : undefined;
    if (!baseRegion || !isRecommendationApplied) return baseRegion;
    const inventoryDelta = appliedTransfers.reduce((sum, transfer) => {
      if (transfer.from === id) return sum - transfer.amount;
      if (transfer.to === id) return sum + transfer.amount;
      return sum;
    }, 0);
    if (inventoryDelta === 0) return baseRegion;
    const currentStock = Math.max(0, baseRegion.current_stock + inventoryDelta);
    const stockRatio = baseRegion.target_stock > 0 ? (currentStock / baseRegion.target_stock) * 100 : 0;
    const riskLevel: RiskLevel = stockRatio < 100 ? "danger" : stockRatio >= 130 ? "warning" : "safe";
    return {
      ...baseRegion,
      current_stock: currentStock,
      stock_ratio: Math.round(stockRatio * 10) / 10,
      stockRatioLabel: `${stockRatio.toFixed(1)}%`,
      riskLevel,
      riskText: riskLevel === "danger" ? "부족" : riskLevel === "warning" ? "과잉" : "적정",
    };
  };
  const scenarioRegion = getScenarioRegion(regionId);
  const timelineRegion = timeline.regions[regionId];
  const region = regions[regionId];
  const nationalRiskLevel: RiskLevel =
    (isCurrentTimeline ? scenario?.inventoryLevel : undefined) ??
    (timeline.stockoutRisk >= 15 ? "danger" : timeline.stockoutRisk >= 8 ? "warning" : "safe");
  const regionRiskLevel = scenarioRegion?.riskLevel ?? timelineRegion?.status ?? (regionId === "National" ? nationalRiskLevel : region.riskLevel);
  const risk = riskStyles[regionRiskLevel];
  const nationalRisk = riskStyles[nationalRiskLevel];
  const forecastRiskLevel: RiskLevel = lipilouGraphRegion
    ? lipilouGraphRegion.stock_status === "부족"
      ? "danger"
      : lipilouGraphRegion.stock_status === "과잉"
        ? "warning"
        : "safe"
    : nationalRiskLevel;
  const forecastRisk = riskStyles[forecastRiskLevel];
  const forecastRiskText = forecastRiskLevel === "danger" ? "부족" : forecastRiskLevel === "warning" ? "과잉" : "적정";

  const displayedTotalInventory =
    (isCurrentTimeline ? scenario?.totalInventory : undefined) ?? timeline.totalInventory;
  const displayedUtilization =
    (isCurrentTimeline ? scenario?.utilization : undefined) ?? timeline.utilization;
  const forecastInventory = lipilouGraphRegion?.current_stock_box ?? displayedTotalInventory;
  const forecastUtilization = lipilouGraphRegion?.operating_rate_pct ?? displayedUtilization;
  const panelInventory = scenarioRegion?.current_stock ?? timelineRegion?.inventory ?? displayedTotalInventory;
  const riskText = regionRiskLevel === "danger" ? "부족" : regionRiskLevel === "warning" ? "과잉" : "적정";
  const nationalRiskText = nationalRiskLevel === "danger" ? "부족" : nationalRiskLevel === "warning" ? "과잉" : "적정";
  const regionDescription = scenarioRegion
    ? `${scenario?.date} ${isRecommendationApplied ? "추천안 적용 예상값" : "실데이터"} · 목표 ${scenarioRegion.target_stock.toLocaleString()} BOX · 재고 수준 ${scenarioRegion.stockRatioLabel ?? `${scenarioRegion.stock_ratio}%`}`
    : `${timeline.label} ${timeline.isPrediction ? "예측" : "실측"} · 재고 상태 ${riskText}`;

  const recommendations: AiRecommendation[] = scenario?.recommendations.length
    ? scenario.recommendations.map((recommendation) => ({
        id: recommendation.id,
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
                  amount: recommendation.transferAmount,
                },
              ]
            : undefined,
        costReduction: recommendation.transferAmount ? "8~12%" : undefined,
        feasibility:
          recommendation.fromRegion && recommendation.toRegion && recommendation.transferAmount
            ? 86
            : undefined,
        executionPeriod: recommendation.transferAmount ? "1~2주" : undefined,
      }))
    : [
        { id: "fallback-1", t: "수도권 센터 증설 추진", d: "25년 3분기 내 물류 허브 확장" },
        {
          id: "fallback-2",
          t: "재고 권역 재배치 최적화",
          d: "강원/충청 → 수도권 물량 조정",
          routes: [
            { from: "Gangwon", to: "Gyeonggi" },
            { from: "Chungcheong", to: "Gyeonggi" },
          ],
        },
      ];

  const selectedRecommendation =
    recommendations[selectedRecommendationIndex] ?? recommendations[0];

  const activeTransferRoutes = recommendations.flatMap((recommendation, index) => {
    const checkKey = `${product.key}-${index}`;
    return (recommendationChecks[checkKey] ?? true) ? recommendation.routes ?? [] : [];
  });
  const displayedTransferRoutes = isRecommendationApplied ? activeTransferRoutes : [];
  const productApi = productApiMeta[product.key] ?? productApiMeta.리피로우;

  const selectRegion = (id: string) => {
    setRegionId(id);
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
              <span className="h-2 w-2 animate-pulse rounded-full bg-scm-primary" />
              실시간 공급망 가시성 활성화
            </span>
          </div>
        </div>
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
                <span className="mb-1 text-on-surface-variant">BOX</span>
              </div>
              <div className="mt-2 flex items-center gap-xs font-bold text-scm-primary">
                <Icon name="trending_up" className="text-[16px]" />
                <span className="text-sm">{forecastYoy}</span>
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
                    <span className="text-[9px] font-bold">Actual</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-0.5 w-2 border-b border-dashed bg-error" />
                    <span className="text-[9px] font-bold">Pred.</span>
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
                  <line
                    className="timeline-chart-marker"
                    strokeWidth="2"
                    x1={timelineIndex * 80}
                    x2={timelineIndex * 80}
                    y1="20"
                    y2="180"
                  />
                  <path className="path-actual" d={forecastPaths.actual} />
                  <path className="path-prediction" d={forecastPaths.prediction} />
                  {lipilouGraph ? (
                    lipilouGraph.points.map((point) => (
                      <circle
                        key={point.period}
                        className={`chart-dot ${point.type === "predicted" ? "chart-dot-prediction" : ""}`}
                        cx={point.x}
                        cy={point.y}
                        r="3"
                      />
                    ))
                  ) : (
                    <>
                      <circle className="chart-dot" cx="0" cy={product.dots[0]} r="3" />
                      <circle className="chart-dot" cx="120" cy={product.dots[1]} r="3" />
                      <circle className="chart-dot" cx="300" cy={product.dots[2]} r="3" />
                      <circle className="chart-dot chart-dot-prediction" cx="380" cy={product.dots[3]} r="3" />
                    </>
                  )}
                </svg>
                <div className={`mt-2 grid text-center text-[9px] font-bold text-on-surface-variant/60 ${lipilouGraph ? "grid-cols-5" : "grid-cols-6"}`}>
                  {(lipilouGraph?.ticks ?? timelineKeys).map((key, index) => (
                    <span
                      key={key}
                      className={index === timelineIndex ? (timeline.isPrediction ? "text-[#ad6800]" : "text-scm-primary") : ""}
                    >
                      {lipilouGraph ? key : timelineData[key as TimelineKey].tick}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-sm grid min-h-0 flex-1 grid-rows-3 gap-xs">
              <div className="forecast-kpi-row">
                <div>
                  <p>현재 재고 (BOX)</p>
                  <strong><AnimatedNumber value={forecastInventory} /></strong>
                </div>
                <Icon name="inventory_2" className="text-[18px] text-scm-primary" />
              </div>
              <div className="forecast-kpi-row">
                <div>
                  <p>가동률 (Operating Rate)</p>
                  <strong className="text-scm-primary"><AnimatedNumber value={forecastUtilization} decimals={1} />%</strong>
                </div>
                <Icon name="precision_manufacturing" className="text-[18px] text-scm-primary" />
              </div>
              <div className="forecast-kpi-row">
                <div>
                  <p>품절 위험</p>
                  <div className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${forecastRisk.badge}`}>
                    <span className={`h-2 w-2 rounded-full ${forecastRisk.bullet}`} />
                    <span className={`text-[10px] font-bold uppercase ${forecastRisk.text}`}>{forecastRiskText}</span>
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
            {isRecommendationApplied ? (
              <span className="shrink-0 rounded-full border border-scm-primary/30 bg-primary-container px-2.5 py-1 text-[10px] font-black text-on-primary-container">
                AI 추천 적용 예상 결과
              </span>
            ) : null}
            <div className="time-scrubber min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-sm">
                <div className="flex items-center gap-xs">
                  <span className="font-data text-xs font-bold text-on-surface">{timeline.label}</span>
                  <span className={`timeline-badge ${timeline.isPrediction ? "prediction" : "actual"}`}>
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
                  <button key={key} type="button" onClick={() => { setIsPlaying(false); changeTimeline(index); }} className={index === timelineIndex ? "active" : ""}>
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
            <div key={timelineKey} className="timeline-data-fade pointer-events-none absolute left-1/2 top-1/2 aspect-[1456/1941] h-[90%] -translate-x-1/2 -translate-y-1/2">
              {displayedTransferRoutes.length > 0 && (
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
                  {displayedTransferRoutes.map((route, index) => {
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
                            <rect className="transfer-route-label-bg" x="-8" y="-3.2" width="16" height="6.4" rx="3.2" />
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
                  getScenarioRegion(id)?.riskLevel ??
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
                    {isRecommendationApplied ? "예상 재고" : "현재 재고"}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-data text-[18px] font-semibold text-scm-primary">
                      <AnimatedNumber value={panelInventory} />
                    </span>
                    <span className="text-[10px] font-bold">BOX</span>
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
                      <span className={`text-xs font-bold uppercase ${risk.text}`}>
                        {riskText}
                      </span>
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
            <p className={`mb-xs text-[10px] font-bold ${timeline.isPrediction ? "text-[#ad6800]" : "text-scm-primary"}`}>
              {timeline.label} 시점 기준 추천 · {timeline.isPrediction ? "예측 데이터 기반" : "실측 데이터 기반"}
            </p>
            <div className="min-h-0 flex-1 space-y-sm overflow-y-auto">
              {recommendations.map((rec, index) => {
                const checkKey = `${product.key}-${index}`;
                const checked = recommendationChecks[checkKey] ?? true;
                return (
                <label
                  key={rec.t}
                  className="flex cursor-pointer items-center gap-sm rounded p-xs transition-colors hover:bg-white/50"
                >
                  <input
                    checked={checked}
                    onChange={(event) =>
                      setRecommendationChecks((current) => ({
                        ...current,
                        [checkKey]: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 shrink-0 rounded accent-[#004ccd]"
                    type="checkbox"
                  />
                  <div>
                    <p className="text-xs font-bold text-on-surface">{rec.t}</p>
                  </div>
                </label>
                );
              })}
            </div>
            <div className="mt-md grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedRecommendationIndex(0);
                  setIsRecommendationOpen(true);
                }}
                className="cursor-pointer rounded-lg border border-on-surface bg-white py-sm text-[11px] font-bold text-on-surface transition-colors hover:bg-surface-container-low active:scale-[0.98]"
              >
                실행안 비교
              </button>
              {isRecommendationApplied ? (
                <button
                  type="button"
                  onClick={() => setIsRecommendationApplied(false)}
                  className="cursor-pointer rounded-lg bg-on-surface py-sm text-[11px] font-bold text-white shadow-md transition-opacity hover:opacity-90 active:scale-[0.98]"
                >
                  원래 값으로 복원
                </button>
              ) : (
                <button
                  type="button"
                  disabled={activeTransferRoutes.length === 0}
                  title={activeTransferRoutes.length === 0 ? "적용 가능한 이관 실행안을 선택해 주세요" : undefined}
                  onClick={() => {
                    setIsPlaying(false);
                    setTimelineIndex(2);
                    setIsRecommendationApplied(true);
                  }}
                  className="cursor-pointer rounded-lg bg-scm-primary py-sm text-[11px] font-bold text-white shadow-md transition-opacity hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  체크 실행안 적용
                </button>
              )}
            </div>
          </div>

          <div className="bento-card flex min-h-0 flex-1 flex-col p-md">
            <div className="flex items-start gap-sm">
              <div className="api-placeholder-icon">
                <Icon name={productApi.icon} className="text-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-xs">
                  <h4 className="truncate text-sm font-bold text-on-surface">{productApi.title}</h4>
                  <span className="api-ready-badge">{scenario?.externalSignal ? "데이터 연결" : "연결 대기"}</span>
                </div>
                <p className="mt-1 text-[10px] leading-tight text-on-surface-variant">
                  {scenario?.externalSignal
                    ? `${scenario.externalSignal.title} · ${scenario.externalSignal.value} · ${scenario.externalSignal.detail}`
                    : productApi.description}
                </p>
                <code className="mt-2 block truncate rounded bg-surface-container-low px-2 py-1 text-[9px] text-scm-primary">
                  {productApi.endpoint}
                </code>
              </div>
            </div>
          </div>

          <div className="bento-card flex min-h-0 flex-1 flex-col p-md">
            <div className="flex items-start gap-sm">
              <div className="api-placeholder-icon news">
                <Icon name="newspaper" className="text-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-xs">
                  <h4 className="truncate text-sm font-bold text-on-surface">뉴스 크롤링 API</h4>
                  <span className="api-ready-badge">연결 대기</span>
                </div>
                <p className="mt-1 text-[10px] leading-tight text-on-surface-variant">
                  공급망·의약품 이슈와 실시간 뉴스 신호 연동 영역
                </p>
                <code className="mt-2 block truncate rounded bg-surface-container-low px-2 py-1 text-[9px] text-scm-primary">
                  /api/news-crawling
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isRecommendationOpen && selectedRecommendation ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/45 p-6 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={() => setIsRecommendationOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="recommendation-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
            className="flex max-h-[78vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-scm-primary">
                  AI Recommendation Evaluation
                </p>
                <h3 id="recommendation-dialog-title" className="mt-1 font-display text-xl font-bold text-on-surface">
                  AI 추천 실행안 비교 및 XAI 설명
                </h3>
              </div>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setIsRecommendationOpen(false)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <div className="min-h-0 overflow-y-auto border-r border-outline-variant bg-surface-container-low/50 p-4">
                <p className="mb-3 text-xs font-bold text-on-surface-variant">추천안별 평가</p>
                <div className="space-y-3">
                  {recommendations.map((recommendation, index) => {
                    const isSelected = index === selectedRecommendationIndex;
                    return (
                      <button
                        key={recommendation.id}
                        type="button"
                        onClick={() => setSelectedRecommendationIndex(index)}
                        className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-all ${
                          isSelected
                            ? "border-scm-primary bg-white shadow-md ring-2 ring-scm-primary/10"
                            : "border-outline-variant bg-white/70 hover:border-scm-primary/40 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-container text-[11px] font-black text-on-primary-container">
                              {index + 1}
                            </span>
                            <span className="text-sm font-bold leading-snug text-on-surface">{recommendation.t}</span>
                          </div>
                          {isSelected ? <Icon name="check_circle" className="shrink-0 text-[18px] text-scm-primary" filled /> : null}
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <Metric label="비용 감축(추정)" value={recommendation.costReduction ?? "추가 예정"} />
                          <Metric label="실현 가능성(추정)" value={recommendation.feasibility ? `${recommendation.feasibility}/100` : "추가 예정"} />
                          <Metric label="실행 기간" value={recommendation.executionPeriod ?? "추가 예정"} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto p-6">
                <div className="flex items-center gap-2 text-scm-primary">
                  <Icon name="psychology" className="text-[22px]" filled />
                  <span className="text-xs font-black uppercase tracking-wider">XAI Explanation</span>
                </div>
                <h4 className="mt-4 font-display text-lg font-bold leading-snug text-on-surface">
                  {selectedRecommendation.t}
                </h4>
                <div className="mt-4 rounded-xl border border-primary-container bg-primary-container/20 p-4">
                  <p className="text-[11px] font-bold text-scm-primary">AI가 이 실행안을 추천한 이유</p>
                  <p className="mt-2 text-sm leading-6 text-on-surface">
                    {selectedRecommendation.d || "상세 XAI 설명은 추가 예정입니다."}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <DetailItem icon="savings" label="비용 감축 효과" value={selectedRecommendation.costReduction ?? "산정 로직 및 상세 데이터 추가 예정"} />
                  <DetailItem icon="task_alt" label="실현 가능성" value={selectedRecommendation.feasibility ? `${selectedRecommendation.feasibility}/100 · 실행 조건 검토 완료` : "평가 기준 및 점수 추가 예정"} />
                  <DetailItem icon="schedule" label="예상 실행 기간" value={selectedRecommendation.executionPeriod ?? "실행 일정 추가 예정"} />
                  <DetailItem icon="monitoring" label="예상 공급망 영향" value="정량 시뮬레이션 결과 추가 예정" />
                </div>

                <div className="mt-5 rounded-xl bg-surface-container-low p-4">
                  <p className="text-[11px] font-bold text-on-surface-variant">판단 근거 및 제약 조건</p>
                  <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                    현재 연결된 재고, 권역 위험도와 이관 경로를 기준으로 설명합니다. 비용 모델, 인력·설비 제약 및 상세 실행 조건은 데이터 업로드 후 추가 예정입니다.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg bg-surface-container-low px-2 py-2 text-center">
      <span className="block text-[9px] font-bold text-on-surface-variant">{label}</span>
      <span className="mt-1 block text-[11px] font-black text-on-surface">{value}</span>
    </span>
  );
}

function DetailItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant p-3">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Icon name={icon} className="text-[17px]" />
        <span className="text-[10px] font-bold">{label}</span>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-on-surface">{value}</p>
    </div>
  );
}
