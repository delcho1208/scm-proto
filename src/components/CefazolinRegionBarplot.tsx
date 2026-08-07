export type RegionBar = {
  id: string;
  name: string;
  ratio: number;
  currentStock: number;
  targetStock: number;
};

const W = 1120;
const H = 470;
const PLOT_TOP = 46;
const PLOT_BOTTOM = 360;
const AXIS_X = 62;
const MAX_PCT = 200;
const DEPTH = 13;

function yFor(pct: number) {
  const clamped = Math.max(0, Math.min(MAX_PCT, pct));
  return PLOT_BOTTOM - (clamped / MAX_PCT) * (PLOT_BOTTOM - PLOT_TOP);
}

function Column({
  x,
  width,
  fromPct,
  toPct,
  fill,
  top,
}: {
  x: number;
  width: number;
  fromPct: number;
  toPct: number;
  fill: string;
  top: boolean;
}) {
  if (toPct <= fromPct) return null;
  const y0 = yFor(toPct);
  const y1 = yFor(fromPct);
  return (
    <g>
      {/* side face */}
      <path
        d={`M${x + width},${y0} L${x + width + DEPTH},${y0 - DEPTH} L${x + width + DEPTH},${y1 - DEPTH} L${x + width},${y1} Z`}
        fill={fill}
        opacity="0.55"
      />
      {/* top face */}
      {top ? (
        <path
          d={`M${x},${y0} L${x + DEPTH},${y0 - DEPTH} L${x + width + DEPTH},${y0 - DEPTH} L${x + width},${y0} Z`}
          fill={fill}
          opacity="0.8"
        />
      ) : null}
      {/* front face */}
      <rect x={x} y={y0} width={width} height={y1 - y0} fill={fill} />
    </g>
  );
}

export function CefazolinRegionBarplot({ regions }: { regions: RegionBar[] }) {
  const slot = (W - AXIS_X - 40) / regions.length;
  const barW = Math.min(66, slot - 44);
  const gridLines = [0, 50, 100, 150, 200];

  return (
    <div className="relative overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="권역별 목표재고 충족률">
        <defs>
          <filter id="glow-danger" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="var(--scm-error)" floodOpacity="0.75" />
          </filter>
          <filter id="glow-warn" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="var(--scm-warn)" floodOpacity="0.8" />
          </filter>
        </defs>

        {gridLines.map((line) => (
          <g key={line}>
            <line
              x1={AXIS_X}
              x2={W - 20}
              y1={yFor(line)}
              y2={yFor(line)}
              stroke={line === 100 ? "var(--scm-on-surface)" : "var(--scm-outline-variant)"}
              strokeWidth={line === 100 ? 2 : 1}
              strokeDasharray={line === 100 ? "10 6" : "3 5"}
              opacity={line === 100 ? 0.85 : 0.6}
            />
            <text
              x={AXIS_X - 10}
              y={yFor(line) + 4}
              textAnchor="end"
              className="fill-[var(--scm-on-surface-variant)] font-data text-[11px]"
            >
              {line}%
            </text>
          </g>
        ))}
        <text
          x={W - 22}
          y={yFor(100) - 10}
          textAnchor="end"
          className="fill-[var(--scm-on-surface)] text-[11px] font-bold"
        >
          목표재고 100% 기준선
        </text>

        {regions.map((region, index) => {
          const x = AXIS_X + 26 + slot * index;
          const shortage = region.ratio < 100;
          const excess = region.ratio > 100;
          const labelY = yFor(Math.max(region.ratio, 100)) - DEPTH - 16;
          return (
            <g key={region.id}>
              <Column
                x={x}
                width={barW}
                fromPct={0}
                toPct={Math.min(region.ratio, 100)}
                fill="var(--scm-safe)"
                top={!excess}
              />
              {shortage ? (
                <g filter="url(#glow-danger)">
                  <Column
                    x={x}
                    width={barW}
                    fromPct={region.ratio}
                    toPct={100}
                    fill="var(--scm-error)"
                    top
                  />
                </g>
              ) : null}
              {excess ? (
                <g filter="url(#glow-warn)">
                  <Column
                    x={x}
                    width={barW}
                    fromPct={100}
                    toPct={region.ratio}
                    fill="var(--scm-warn)"
                    top
                  />
                </g>
              ) : null}

              <text
                x={x + barW / 2 + DEPTH / 2}
                y={labelY}
                textAnchor="middle"
                className={`font-data text-[15px] font-bold ${
                  shortage
                    ? "fill-[var(--scm-error)]"
                    : excess
                      ? "fill-[var(--scm-warn)]"
                      : "fill-[var(--scm-on-surface)]"
                }`}
              >
                {shortage ? "⚠ " : ""}
                {region.ratio.toFixed(1)}%
              </text>

              <text
                x={x + barW / 2 + DEPTH / 2}
                y={PLOT_BOTTOM + 26}
                textAnchor="middle"
                className="fill-[var(--scm-on-surface)] text-[12px] font-bold"
              >
                {region.name}
              </text>
              <text
                x={x + barW / 2 + DEPTH / 2}
                y={PLOT_BOTTOM + 44}
                textAnchor="middle"
                className="fill-[var(--scm-on-surface-variant)] font-data text-[10px]"
              >
                {Math.round(region.currentStock).toLocaleString("ko-KR")}
              </text>
              <text
                x={x + barW / 2 + DEPTH / 2}
                y={PLOT_BOTTOM + 58}
                textAnchor="middle"
                className="fill-[var(--scm-on-surface-variant)] text-[10px]"
              >
                / {Math.round(region.targetStock).toLocaleString("ko-KR")} VIAL
              </text>
            </g>
          );
        })}

        <line
          x1={AXIS_X}
          x2={W - 20}
          y1={PLOT_BOTTOM}
          y2={PLOT_BOTTOM}
          stroke="var(--scm-outline)"
          strokeWidth="1.5"
        />

        <g transform={`translate(${AXIS_X}, ${H - 14})`}>
          {[
            { color: "var(--scm-safe)", label: "현재고" },
            { color: "var(--scm-error)", label: "부족분" },
            { color: "var(--scm-warn)", label: "과잉분" },
          ].map((item, index) => (
            <g key={item.label} transform={`translate(${index * 110}, 0)`}>
              <rect x="0" y="-10" width="12" height="12" rx="3" fill={item.color} />
              <text x="18" y="0" className="fill-[var(--scm-on-surface-variant)] text-[11px] font-bold">
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
