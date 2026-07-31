import { useRef, useState } from "react";
import { markerOrder, regions, riskFactors, type Product, type RiskLevel } from "@/data/scm";
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

export function DashboardView({ product }: { product: Product }) {
  const [regionId, setRegionId] = useState("National");
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const region = regions[regionId];
  const risk = riskStyles[region.riskLevel];

  const baseStock = Number(product.stock.replace(/,/g, ""));
  const panelStock = (
    regionId === "National" ? baseStock : Math.floor(baseStock * 0.12)
  ).toLocaleString();

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
    <div className="max-monitor-width flex-1 bg-surface px-lg pb-12 pt-16">
      <div className="flex flex-col items-start justify-between gap-md py-lg md:flex-row md:items-end">
        <div>
          <h3 className="mb-xs font-display text-headline-md text-on-surface">{region.title}</h3>
          <div className="flex items-center gap-sm text-on-surface-variant">
            <span className="flex items-center gap-xs text-label-caps">
              <span className="h-2 w-2 animate-pulse rounded-full bg-scm-primary" />
              실시간 공급망 가시성 활성화
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[
            { n: "01", label: "데이터 수집", active: false },
            { n: "02", label: "수요 예측 &\n리스크 분석", active: false },
            { n: "04", label: "디지털 트윈", active: true },
            { n: "06", label: "실행 및\nERP 연동", active: false },
          ].map((step, i) => (
            <div key={step.n} className="flex items-center gap-2">
              {i > 0 && <div className="mb-4 h-[1px] w-6 bg-outline-variant" />}
              <div className={`flex flex-col items-center gap-1 ${step.active ? "" : "opacity-40"}`}>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full font-data text-data-sm ${
                    step.active
                      ? "bg-scm-primary text-white"
                      : "border border-outline bg-surface-container-highest"
                  }`}
                >
                  {step.n}
                </span>
                <span
                  className={`whitespace-pre-line text-center text-[10px] font-bold ${
                    step.active ? "text-scm-primary" : ""
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-lg lg:h-[520px]">
        {/* Forecast */}
        <div className="col-span-12 h-full lg:col-span-3">
          <div className="bento-card flex h-full flex-col p-md">
            <div className="mb-md flex items-center justify-between">
              <h4 className="font-display text-headline-sm">{product.forecastTitle}</h4>
              <Icon name="show_chart" className="text-outline" />
            </div>
            <div className="mb-xs">
              <p className="mb-base text-label-caps text-on-surface-variant">
                {regionId === "National"
                  ? "전국 단위 연간 예상 수요량"
                  : `${region.name} 연간 예상 수요량`}
              </p>
              <div className="flex items-end gap-sm">
                <span className="font-display text-display-lg text-scm-primary">
                  {product.annualDemand}
                </span>
                <span className="mb-1 text-on-surface-variant">BOX</span>
              </div>
              <div className="mt-2 flex items-center gap-xs font-bold text-scm-primary">
                <Icon name="trending_up" className="text-[16px]" />
                <span className="text-sm">{product.yoyGrowth}</span>
              </div>
            </div>
            <div className="mt-md flex flex-1 flex-col justify-between rounded-xl border border-outline-variant/30 bg-surface-container-low p-sm">
              <div className="mb-4 flex items-center justify-between">
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
                    stroke="#737687"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                    x1="300"
                    x2="300"
                    y1="20"
                    y2="180"
                  />
                  <path className="path-actual" d={product.paths.actual} />
                  <path className="path-prediction" d={product.paths.prediction} />
                  <circle className="chart-dot" cx="0" cy={product.dots[0]} r="3" />
                  <circle className="chart-dot" cx="120" cy={product.dots[1]} r="3" />
                  <circle className="chart-dot" cx="300" cy={product.dots[2]} r="3" />
                  <circle
                    className="chart-dot chart-dot-prediction"
                    cx="380"
                    cy={product.dots[3]}
                    r="3"
                  />
                </svg>
                <div className="mt-2 flex justify-between px-1 text-[10px] font-bold text-on-surface-variant/60">
                  <span>24 Q3</span>
                  <span>24 Q4</span>
                  <span className="text-scm-primary">PRES</span>
                  <span className="text-error">26 Q1</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="bento-card relative col-span-12 flex min-h-[420px] flex-col overflow-hidden bg-white lg:col-span-6">
          <div className="pointer-events-none relative z-10 flex items-start justify-between p-lg">
            <div className="pointer-events-auto">
              <h4 className="mb-1 font-display text-headline-sm text-on-surface">
                지능형 권역 모니터링
              </h4>
              <p className="text-on-surface-variant/80">
                공급망 거점을 선택하여 실시간 데이터를 확인하세요.
              </p>
            </div>
            <div className="pointer-events-auto flex items-center gap-xs">
              <button
                onClick={() => selectRegion("National")}
                className="cursor-pointer rounded-lg border border-outline-variant bg-white p-2 shadow-sm transition-colors hover:bg-surface-variant active:scale-95"
              >
                <Icon name="refresh" className="text-[18px]" />
              </button>
            </div>
          </div>

          <div
            ref={mapRef}
            className="relative flex flex-1 items-center justify-center overflow-hidden bg-white"
          >
            <img
              alt="South Korea Map"
              src={region.img}
              className="max-h-[90%] max-w-[90%] object-contain transition-opacity duration-300"
            />
            <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-[2/5] h-[90%] -translate-x-1/2 -translate-y-1/2">
              {markerOrder.map((id) => {
                const r = regions[id];
                if (!r.box) return null;
                return (
                  <button
                    key={id}
                    title={r.name}
                    onClick={() => selectRegion(id)}
                    className={`region-marker pointer-events-auto ${regionId === id ? "active" : ""}`}
                    style={{ ...r.box, zIndex: r.z ?? 20 }}
                  >
                    <span className="region-marker-label">{r.shortName ?? r.name}</span>
                  </button>
                );
              })}
            </div>


            <div
              ref={panelRef}
              onMouseDown={startDrag}
              className="floating-info-panel"
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
                      {panelStock}
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
                        {region.riskText}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-outline-variant/30 pt-2">
                  <p className="text-[11px] leading-tight text-on-surface-variant">{region.desc}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="z-10 flex items-center justify-between border-t border-outline-variant bg-white/60 p-md backdrop-blur-sm">
            <div className="flex items-center gap-md">
              {[
                { c: "status-dot-safe", label: "안전 (Safe)" },
                { c: "status-dot-warning", label: "주의 (Warning)" },
                { c: "status-dot-danger", label: "위험 (Danger)" },
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
        <div className="col-span-12 flex h-full flex-col gap-lg lg:col-span-3">
          <div className="bento-card flex flex-col items-center p-md">
            <div className="mb-md flex w-full items-center justify-between">
              <h4 className="font-display text-headline-sm">리스크 지수 (Risk Index)</h4>
              <Icon name="warning" className="text-error" />
            </div>
            <div className="relative mb-md flex flex-col items-center">
              <div className="relative h-24 w-48 overflow-hidden">
                <div className="absolute left-0 top-0 h-48 w-48 rounded-full border-[16px] border-surface-container-highest" />
                <div
                  className="absolute left-0 top-0 h-48 w-48 rounded-full border-[16px] border-error"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
                    transform: "rotate(140deg)",
                  }}
                />
                <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
                  <span className="text-display-lg font-bold text-on-surface">78</span>
                  <span className="text-[10px] font-bold uppercase text-error">
                    높음 (High Risk)
                  </span>
                </div>
              </div>
            </div>
            <div className="w-full space-y-2">
              <p className="mb-1 text-[10px] font-bold uppercase text-on-surface-variant">
                리스크 요인
              </p>
              {riskFactors.map((f) => (
                <div key={f.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: f.color }} />
                    <span className="text-on-surface">{f.label}</span>
                  </div>
                  <span className="font-data text-data-sm">{f.score}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-card flex flex-1 flex-col bg-on-surface-variant/5 p-md">
            <div className="mb-md flex items-center gap-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-scm-primary text-white">
                <Icon name="auto_awesome" className="text-[16px]" filled />
              </div>
              <h4 className="font-display text-headline-sm">AI 추천 실행안</h4>
            </div>
            <div className="flex-1 space-y-sm overflow-y-auto">
              {[
                { t: "수도권 센터 증설 추진", d: "25년 3분기 내 물류 허브 확장" },
                { t: "재고 권역 재배치 최적화", d: "강원/충청 → 수도권 물량 조정" },
              ].map((rec) => (
                <label
                  key={rec.t}
                  className="flex cursor-pointer items-start gap-md rounded p-xs transition-colors hover:bg-white/50"
                >
                  <input
                    defaultChecked
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
              ))}
            </div>
            <button className="mt-md w-full cursor-pointer rounded-lg bg-on-surface py-sm text-xs font-bold text-white shadow-md transition-opacity hover:opacity-90 active:scale-[0.98]">
              실행 계획 적용
            </button>
          </div>
        </div>
      </div>

      {/* KPI bar */}
      <div className="mt-xl grid grid-cols-2 gap-md md:grid-cols-4">
        <div className="bento-card flex flex-col justify-center p-sm text-center">
          <p className="mb-xs text-[10px] font-bold text-on-surface-variant">현재 재고 (BOX)</p>
          <span className="font-display text-headline-sm">{product.stock}</span>
        </div>
        <div className="bento-card flex flex-col justify-center p-sm text-center">
          <p className="mb-xs text-[10px] font-bold text-on-surface-variant">
            가동률 (Operating Rate)
          </p>
          <span className="font-display text-headline-sm text-scm-primary">
            {product.utilization}
          </span>
        </div>
        <div className="bento-card flex flex-col justify-center border-b-2 border-error/20 p-sm text-center">
          <p className="mb-xs text-[10px] font-bold text-on-surface-variant">품절 위험</p>
          <span className="font-display text-headline-sm text-error">{product.stockout}</span>
        </div>
        <div className="bento-card flex flex-col justify-center p-sm text-center">
          <p className="mb-xs text-[10px] font-bold text-on-surface-variant">ROI (YTD)</p>
          <span className="font-display text-headline-sm text-[#52c41a]">{product.roi}</span>
        </div>
      </div>
    </div>
  );
}
