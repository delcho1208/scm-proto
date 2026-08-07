import { useEffect, useState } from "react";
import { Icon } from "@/components/ScmShell";
import { regions } from "@/data/scm";
import { infectiousRiskLabel, type InfectiousSummary } from "@/data/infectious-region-map";
import { setInfectiousSummary, useRefreshToken } from "@/data/app-signals";

const riskStyle: Record<string, string> = {
  normal: "border-green-200 bg-green-50 text-[#318f19]",
  attention: "border-orange-200 bg-orange-50 text-[#c2610a]",
  warning: "border-red-200 bg-red-50 text-error",
};

export function InfectiousDiseaseApiCard({ regionId }: { regionId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [summary, setSummary] = useState<InfectiousSummary | null>(null);
  const [error, setError] = useState("");
  const refreshToken = useRefreshToken();
  const regionLabel = regions[regionId]?.name ?? "전국 통합";

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    fetch(`/api/infectious-disease?mode=summary&region=${encodeURIComponent(regionId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as InfectiousSummary & { error?: string };
        if (!response.ok) throw new Error(payload.error || "감염병 데이터를 불러오지 못했습니다.");
        const next = { ...payload, selected_region_label: regionLabel };
        setSummary(next);
        setInfectiousSummary(next);
        setState("ready");
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "감염병 API 연결 오류");
        setState("error");
      });
    return () => controller.abort();
  }, [regionId, refreshToken, regionLabel]);

  const risk = summary?.risk_level ?? "normal";

  return (
    <div className="bento-card flex min-h-0 flex-1 flex-col p-md">
      <div className="flex items-start gap-sm">
        <div className="api-placeholder-icon">
          <Icon name="coronavirus" className="text-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-xs">
            <h4 className="truncate text-sm font-bold text-on-surface">감염병 환자 API</h4>
            {state === "ready" ? (
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${riskStyle[risk]}`}
              >
                {infectiousRiskLabel[risk]}
              </span>
            ) : (
              <span className="api-ready-badge">
                {state === "loading" ? "조회 중" : "연결 오류"}
              </span>
            )}
          </div>

          {state === "ready" && summary ? (
            <div className="mt-1 flex items-end gap-2">
              <strong className="font-data text-[20px] leading-none text-scm-primary">
                {summary.selected_region_total_patients.toLocaleString("ko-KR")}
              </strong>
              <span className="mb-0.5 text-[10px] font-bold text-on-surface-variant">명</span>
            </div>
          ) : (
            <p className="mt-1 text-[10px] leading-tight text-on-surface-variant">
              {state === "error" ? error : "지역별 감염병 환자 추이 조회 중"}
            </p>
          )}

          <code className="mt-2 block truncate rounded bg-surface-container-low px-2 py-1 text-[9px] text-scm-primary">
            Data Source · infectious_disease API
          </code>
        </div>
      </div>
    </div>
  );
}
