type Cause = { label: string; score: number };

export type RiskFlowChartProps = {
  sourceLabel: string;
  sourceValue: string;
  sourceNote: string;
  causes: Cause[];
  outcomes: Array<{ label: string; value: string; note: string; tone: "danger" | "warning" }>;
};

const W = 1040;
const H = 400;
const LEFT_X = 24;
const NODE_W = 178;
const MID_X = 420;
const MID_W = 210;
const RIGHT_X = 826;

function ribbon(x1: number, y1: number, x2: number, y2: number, t1: number, t2: number) {
  const cx1 = x1 + (x2 - x1) * 0.45;
  const cx2 = x1 + (x2 - x1) * 0.55;
  return [
    `M${x1},${y1 - t1 / 2}`,
    `C${cx1},${y1 - t1 / 2} ${cx2},${y2 - t2 / 2} ${x2},${y2 - t2 / 2}`,
    `L${x2},${y2 + t2 / 2}`,
    `C${cx2},${y2 + t2 / 2} ${cx1},${y1 + t1 / 2} ${x1},${y1 + t1 / 2}`,
    "Z",
  ].join(" ");
}

export function CefazolinRiskFlowChart({
  sourceLabel,
  sourceValue,
  sourceNote,
  causes,
  outcomes,
}: RiskFlowChartProps) {
  const visibleCauses = causes.slice(0, 4);
  const totalScore = visibleCauses.reduce((sum, cause) => sum + cause.score, 0) || 1;
  const trackTop = 60;
  const trackBottom = H - 60;
  const span = trackBottom - trackTop;

  let cursor = trackTop;
  const midNodes = visibleCauses.map((cause) => {
    const thickness = Math.max(30, (cause.score / totalScore) * (span - 24));
    const y = cursor + thickness / 2;
    cursor += thickness + 8;
    return { ...cause, y, thickness };
  });

  const sourceY = (trackTop + trackBottom) / 2;
  const sourceThickness = span * 0.55;

  const outcomeCount = outcomes.length;
  const outcomeNodes = outcomes.map((outcome, index) => {
    const slot = span / outcomeCount;
    const y = trackTop + slot * index + slot / 2;
    return { ...outcome, y, thickness: Math.min(slot - 20, 110) };
  });

  return (
    <div className="relative overflow-hidden rounded-xl border border-outline-variant/70 bg-surface-container-lowest">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="리스크 원인-전파 경로">
        <defs>
          <linearGradient id="flow-a" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--scm-error)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--scm-warn)" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="flow-b" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--scm-warn)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--scm-error)" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="node-danger" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--scm-error)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--scm-error)" stopOpacity="0.72" />
          </linearGradient>
          <linearGradient id="node-warn" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--scm-warn)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--scm-warn)" stopOpacity="0.7" />
          </linearGradient>
          <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.16" />
          </filter>
        </defs>

        <text x={LEFT_X} y={34} className="fill-[var(--scm-on-surface-variant)] text-[13px] font-bold">
          원인 (공급 신호)
        </text>
        <text x={MID_X} y={34} className="fill-[var(--scm-on-surface-variant)] text-[13px] font-bold">
          증폭 · 기여요인
        </text>
        <text x={RIGHT_X} y={34} className="fill-[var(--scm-on-surface-variant)] text-[13px] font-bold">
          결과 (귀결)
        </text>

        {midNodes.map((node) => (
          <path
            key={`in-${node.label}`}
            d={ribbon(
              LEFT_X + NODE_W,
              sourceY,
              MID_X,
              node.y,
              sourceThickness * (node.score / totalScore),
              node.thickness,
            )}
            fill="url(#flow-a)"
          />
        ))}
        {midNodes.map((node) =>
          outcomeNodes.map((outcome) => (
            <path
              key={`out-${node.label}-${outcome.label}`}
              d={ribbon(
                MID_X + MID_W,
                node.y,
                RIGHT_X,
                outcome.y,
                node.thickness / outcomeNodes.length,
                outcome.thickness / midNodes.length,
              )}
              fill="url(#flow-b)"
              opacity="0.75"
            />
          )),
        )}

        <g filter="url(#soft-shadow)">
          <rect
            x={LEFT_X}
            y={sourceY - sourceThickness / 2}
            width={NODE_W}
            height={sourceThickness}
            rx="14"
            fill="url(#node-danger)"
          />
        </g>
        <text
          x={LEFT_X + 16}
          y={sourceY - 18}
          className="fill-white text-[13px] font-bold"
        >
          {sourceLabel}
        </text>
        <text x={LEFT_X + 16} y={sourceY + 12} className="fill-white text-[26px] font-bold">
          {sourceValue}
        </text>
        <text x={LEFT_X + 16} y={sourceY + 32} className="fill-white/85 text-[11px]">
          {sourceNote}
        </text>

        {midNodes.map((node) => (
          <g key={node.label} filter="url(#soft-shadow)">
            <rect
              x={MID_X}
              y={node.y - node.thickness / 2}
              width={MID_W}
              height={node.thickness}
              rx="12"
              fill="var(--scm-surface-container-lowest)"
              stroke="var(--scm-outline-variant)"
            />
            <rect
              x={MID_X}
              y={node.y - node.thickness / 2}
              width="5"
              height={node.thickness}
              rx="2.5"
              fill={node.score >= 80 ? "var(--scm-error)" : "var(--scm-warn)"}
            />
            <text
              x={MID_X + 18}
              y={node.y - 2}
              className="fill-[var(--scm-on-surface)] text-[13px] font-bold"
            >
              {node.label}
            </text>
            <text
              x={MID_X + 18}
              y={node.y + 17}
              className="fill-[var(--scm-on-surface-variant)] text-[11px]"
            >
              위험 신호 {node.score}/100
            </text>
          </g>
        ))}

        {outcomeNodes.map((outcome) => (
          <g key={outcome.label} filter="url(#soft-shadow)">
            <rect
              x={RIGHT_X}
              y={outcome.y - outcome.thickness / 2}
              width={W - RIGHT_X - 24}
              height={outcome.thickness}
              rx="14"
              fill={outcome.tone === "danger" ? "url(#node-danger)" : "url(#node-warn)"}
            />
            <text x={RIGHT_X + 16} y={outcome.y - 16} className="fill-white text-[12px] font-bold">
              {outcome.label}
            </text>
            <text x={RIGHT_X + 16} y={outcome.y + 10} className="fill-white text-[19px] font-bold">
              {outcome.value}
            </text>
            <text x={RIGHT_X + 16} y={outcome.y + 29} className="fill-white/85 text-[10px]">
              {outcome.note}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
