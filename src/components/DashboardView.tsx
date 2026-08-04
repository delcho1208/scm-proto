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
};

type AiRecommendation = {
  t: string;
  d: string;
  routes?: TransferRoute[];
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
  const scenarioRegion = isCurrentTimeline ? scenario?.regions[regionId] : undefined;
  const timelineRegion = timeline.regions[regionId];
  const region = regions[regionId];
  const nationalRiskLevel: RiskLevel =
    (isCurrentTimeline ? scenario?.inventoryLevel : undefined) ??
    (timeline.riskIndex >= 85 ? "danger" : timeline.riskIndex >= 65 ? "warning" : "safe");
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
    ? `${scenario?.date} 실데이터 · 목표 ${scenarioRegion.target_stock.toLocaleString()} BOX · 재고 수준 ${scenarioRegion.stockRatioLabel ?? `${scenarioRegion.stock_ratio}%`}`
    : `${timeline.label} ${timeline.isPrediction ? "예측" : "실측"} · 리스크 ${timelineRegion?.risk ?? timeline.riskIndex}/100`;

  const recommendations: AiRecommendation[] = scenario?.recommendations.length
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

  const activeTransferRoutes = recommendations.flatMap((recommendation, index) => {
    const checkKey = `${product.key}-${index}`;
    return (recommendationChecks[checkKey] ?? true) ? recommendation.routes ?? [] : [];
  });
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
            </div>
            <button className="mt-md w-full cursor-pointer rounded-lg bg-on-surface py-sm text-xs font-bold text-white shadow-md transition-opacity hover:opacity-90 active:scale-[0.98]">
              {scenario?.recommendations[0]?.approvalButtonText ?? "실행 계획 적용"}
            </button>
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
    </div>
  );
}
