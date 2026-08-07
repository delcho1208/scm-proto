import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ScmShell, Icon } from "@/components/ScmShell";
import { getCefazolinIntegrationRecords } from "@/data/cefazolin-dashboard";
import { cefazolinDashboard } from "@/data/cefazolin-dashboard";
import { lipilouDashboard, tamivirDashboard } from "@/data/dashboard-scenario";
import { getLipilouIntegrationRecords } from "@/data/lipilou-integration";
import { getTamivirIntegrationRecords } from "@/data/tamivir-integration";
import {
  getIntegrationRecords,
  markerOrder,
  regions,
  systemColumns,
  type Product,
  type SystemKey,
} from "@/data/scm";

export const Route = createFileRoute("/data-integration")({
  head: () => ({
    meta: [
      { title: "데이터 통합 — Digital Twin SCM Portal" },
      {
        name: "description",
        content:
          "권역별·의약품별 ERP, MES, WMS 연동 데이터를 한 화면에서 조회하는 SCM 데이터 통합 뷰입니다.",
      },
      { property: "og:title", content: "데이터 통합 — Digital Twin SCM Portal" },
      {
        property: "og:description",
        content: "권역별 의약품의 ERP · MES · WMS 연동 현황을 통합 조회합니다.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ScmShell>{(product) => <DataIntegrationView product={product} />}</ScmShell>,
});

const statusStyle: Record<string, string> = {
  "동기화 완료": "bg-green-50 text-[#52c41a] border-[#52c41a]/20",
  처리중: "bg-orange-50 text-[#faad14] border-[#faad14]/20",
  지연: "bg-error-container/30 text-error border-error/20",
};

const dataTypeStyle: Record<string, string> = {
  "ERP 확정공급 배분": "bg-blue-50 text-blue-700 border-blue-200",
  "MES 생산·품질 실적": "bg-violet-50 text-violet-700 border-violet-200",
  "WMS 재고·출하 실적": "bg-amber-50 text-amber-700 border-amber-200",
  "ERP 원료·구매 실적": "bg-blue-50 text-blue-700 border-blue-200",
  "WMS 일별 재고 실적": "bg-amber-50 text-amber-700 border-amber-200",
};

type StockStatus = "safe" | "warning" | "danger" | "critical";

function getSimulationStockMeta(productKey: string, regionId: string): { ratio: number; valueLabel: string; status: StockStatus; label: string; description: string; critical: boolean } {
  const dashboard = productKey === "세파졸린"
    ? cefazolinDashboard
    : productKey === "리피로우"
      ? lipilouDashboard
      : tamivirDashboard;
  const region = dashboard?.regions[regionId];
  const rawRatio = region?.stock_ratio ?? 1;
  if (productKey === "타미비어") {
    if (rawRatio < 1) return { ratio: rawRatio, valueLabel: `${rawRatio.toFixed(1)}배`, status: "danger", label: "부족", description: "안전재고 미달", critical: false };
    if (rawRatio < 3) return { ratio: rawRatio, valueLabel: `${rawRatio.toFixed(1)}배`, status: "safe", label: "적정", description: "정상 운영", critical: false };
    if (rawRatio < 10) return { ratio: rawRatio, valueLabel: `${rawRatio.toFixed(1)}배`, status: "warning", label: "과잉", description: "재고 과다, 모니터링 필요", critical: false };
    return { ratio: rawRatio, valueLabel: `${rawRatio.toFixed(1)}배`, status: "critical", label: "심각한 과잉", description: "생산감축 Trigger 발생", critical: true };
  }

  const ratio = Math.round(rawRatio);
  const upperNormal = 120;
  if (ratio < 100) return { ratio, valueLabel: `${ratio}%`, status: "danger", label: "부족", description: "안전재고 미달", critical: false };
  if (ratio <= upperNormal) return { ratio, valueLabel: `${ratio}%`, status: "safe", label: "적정", description: "정상 운영", critical: false };
  return { ratio, valueLabel: `${ratio}%`, status: "warning", label: "과잉", description: "재고 과다", critical: false };
}

function getProductIntegrationRecords(regionId: string, productKey: string) {
  if (productKey === "세파졸린") return getCefazolinIntegrationRecords(regionId);
  if (productKey === "리피로우") return getLipilouIntegrationRecords(regionId);
  if (productKey === "타미비어") return getTamivirIntegrationRecords(regionId);
  return getIntegrationRecords(regionId, productKey);
}

function DataIntegrationView({ product }: { product: Product }) {
  const [regionId, setRegionId] = useState("Seoul");
  const [viewMode, setViewMode] = useState<"twin" | "table">("twin");
  const [selectedSystem, setSelectedSystem] = useState<SystemKey | null>(null);
  const detailSectionRef = useRef<HTMLDivElement>(null);
  const region = regions[regionId];
  const records = getProductIntegrationRecords(regionId, product.key);

  const selectTwinRegion = (id: string) => {
    setRegionId(id);
    window.requestAnimationFrame(() => {
      detailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="dashboard-fixed-layout flex-1 bg-surface px-lg pb-16 pt-16">
      <div className="flex w-full flex-row items-end justify-between gap-md py-lg text-left">
        <div className="w-full text-left">
          <h3 className="mb-xs font-display text-headline-md text-on-surface">
            데이터 통합 · {region.name} / {product.name}
          </h3>
          <p className="text-on-surface-variant">
            권역별 의약품의 ERP · MES · WMS 시스템 연동 데이터를 확인합니다.
          </p>
        </div>
      </div>

      <div className="grid h-[650px] grid-cols-12 grid-rows-[minmax(0,650px)] items-start gap-lg">
        {/* System cards */}
        <div ref={detailSectionRef} className="col-span-4 flex h-full min-h-0 scroll-mt-20 flex-col gap-sm">
          {records.map((rec) => {
            const meta = systemColumns[rec.system as SystemKey];
            return (
              <div
                key={rec.system}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedSystem(rec.system as SystemKey)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedSystem(rec.system as SystemKey);
                  }
                }}
                className="bento-card group flex min-h-0 flex-1 cursor-pointer flex-col overflow-hidden p-sm transition hover:border-scm-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scm-primary"
              >
                <div className="mb-xs flex shrink-0 items-start gap-sm border-b border-outline-variant/40 pb-xs">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                    <Icon name={meta.icon} className="text-[20px]" />
                  </div>
                  <div>
                    <h4 className="font-display text-[16px] font-bold leading-tight text-on-surface">{meta.title}</h4>
                    <p className="mt-0.5 text-[10px] leading-tight text-on-surface-variant">{meta.desc}</p>
                  </div>
                </div>
                <dl className="min-h-0 flex-1 space-y-1.5 text-[12px]">
                  <Row label="문서번호" value={<span className="font-data">{rec.docNo}</span>} />
                  <Row
                    label="연동 상태"
                    value={
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusStyle[rec.status]}`}>
                        {rec.status}
                      </span>
                    }
                  />
                  <Row label="수량 (BOX)" value={<span className="font-data font-semibold text-scm-primary">{rec.qty}</span>} />
                  <Row label="최근 동기화" value={<span className="font-data">{rec.updatedAt}</span>} />
                </dl>
                <div className="mt-xs flex shrink-0 items-center justify-end gap-1 border-t border-outline-variant/30 pt-xs text-[11px] font-bold text-scm-primary">
                  상세 보기 <Icon name="arrow_forward" className="text-[14px] transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Cross-region summary */}
        <div className="bento-card col-span-8 flex h-full min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-outline-variant/40 p-md">
            <h4 className="font-display text-headline-sm">
              전체 권역 · {product.name} 시스템 연동 현황
            </h4>
            <div className="integration-view-toggle" aria-label="연동 현황 보기 방식">
              <button
                type="button"
                aria-pressed={viewMode === "twin"}
                className={viewMode === "twin" ? "active" : ""}
                onClick={() => setViewMode("twin")}
                title="디지털 트윈 보기"
              >
                <Icon name="view_in_ar" className="text-[18px]" />
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "table"}
                className={viewMode === "table" ? "active" : ""}
                onClick={() => setViewMode("table")}
                title="테이블 보기"
              >
                <Icon name="table_view" className="text-[18px]" />
              </button>
            </div>
          </div>
          {viewMode === "twin" ? (
            <div className="warehouse-photo-stage min-h-0 flex-1 overflow-hidden">
              <div className="warehouse-zone-tags" aria-label="창고 작업 구역">
                <span><Icon name="move_to_inbox" /> 입고</span>
                <span><Icon name="inventory_2" /> 보관</span>
                <span><Icon name="shopping_cart" /> 피킹</span>
                <span><Icon name="local_shipping" /> 출고</span>
              </div>
              <div className="warehouse-photo-grid">
                {markerOrder.map((id) => {
                  const stock = getSimulationStockMeta(product.key, id);
                  const isActive = regionId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      data-status={stock.status}
                      className={`warehouse-photo-zone ${stock.critical ? "critical" : ""} ${isActive ? "active" : ""}`}
                      onClick={() => selectTwinRegion(id)}
                      aria-label={`${regions[id].name} ${stock.label}, ${stock.description}`}
                      title={stock.description}
                    >
                      <span className="warehouse-photo-card">
                        <span><i />{regions[id].name}</span>
                        <strong>{product.key === "타미비어" ? "재고 비율" : "안전재고"} <b>{stock.valueLabel}</b></strong>
                      </span>
                      <span className="warehouse-photo-outline" aria-hidden="true" />
                      <span className="warehouse-photo-status">{stock.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="warehouse-photo-legend">
                <b>{product.name} 재고 판정</b>
                {product.key === "타미비어" ? <>
                  <span className="danger"><i /> 부족 (&lt;1.0)</span>
                  <span className="safe"><i /> 적정 (1.0~3.0)</span>
                  <span className="warning"><i /> 과잉 (3.0~10.0)</span>
                  <span className="critical"><i /> 심각한 과잉 (≥10.0)</span>
                </> : <>
                  <span className="danger"><i /> 부족 (&lt;100%)</span>
                  <span className="safe"><i /> 적정 (100~120%)</span>
                  <span className="warning"><i /> 과잉 (&gt;120%{product.key === "리피로우" ? "~170%" : ""})</span>
                </>}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead className="bg-surface-container-low text-[11px] uppercase text-on-surface-variant">
                  <tr>
                    <th className="px-md py-sm font-bold">권역</th>
                    {(["ERP", "MES", "WMS"] as SystemKey[]).map((s) => (
                      <th key={s} className="px-md py-sm font-bold">{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {markerOrder.map((id) => {
                    const rows = getProductIntegrationRecords(id, product.key);
                    return (
                      <tr
                        key={id}
                        onClick={() => setRegionId(id)}
                        className={`cursor-pointer border-t border-outline-variant/30 transition-colors hover:bg-surface-container-low ${regionId === id ? "bg-primary-container/10" : ""}`}
                      >
                        <td className="px-md py-sm font-bold text-on-surface">{regions[id].name}</td>
                        {rows.map((row) => (
                          <td key={row.system} className="px-md py-sm">
                            <div className="flex flex-col">
                              <span className="font-data text-[12px] text-on-surface">{row.qty} BOX</span>
                              <span className={`mt-1 w-fit rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusStyle[row.status]}`}>
                                {row.status}
                              </span>
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {selectedSystem ? (
        <SystemDetailPanel
          system={selectedSystem}
          record={records.find((record) => record.system === selectedSystem)}
          regionName={region.name}
          productName={product.name}
          onClose={() => setSelectedSystem(null)}
        />
      ) : null}
    </div>
  );
}

function SystemDetailPanel({
  system,
  record,
  regionName,
  productName,
  onClose,
}: {
  system: SystemKey;
  record: ReturnType<typeof getIntegrationRecords>[number] | undefined;
  regionName: string;
  productName: string;
  onClose: () => void;
}) {
  const meta = systemColumns[system];

  return (
    <div className="fixed inset-0 z-[600] bg-slate-950/25" onMouseDown={onClose}>
      <aside
        className="absolute right-0 top-0 flex h-full w-[440px] flex-col bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-outline-variant p-lg">
          <div className="flex items-center gap-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
              <Icon name={meta.icon} className="text-[24px]" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-scm-primary">System detail</p>
              <h2 className="font-display text-headline-sm text-on-surface">{meta.title}</h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">{regionName} · {productName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container">
            <Icon name="close" className="text-[22px]" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-lg">
          <p className="mb-md text-sm leading-6 text-on-surface-variant">{meta.desc}</p>
          {record ? (
            <dl className="space-y-sm rounded-2xl border border-outline-variant bg-surface-container-lowest p-md">
              <DetailRow label="문서번호" value={record.docNo} mono />
              <DetailRow label="연동 상태" value={record.status} />
              <DetailRow label="수량" value={`${record.qty} BOX`} mono />
              <DetailRow label="최근 동기화" value={record.updatedAt} mono />
              {record.leadTimeHours !== undefined ? <DetailRow label="평균 리드타임" value={`${record.leadTimeHours.toFixed(2)}시간`} mono /> : null}
              {record.dataType ? <DetailRow label="데이터 구분" value={record.dataType} /> : null}
              {record.calculationBasis ? <DetailRow label="산출 기준" value={record.calculationBasis} /> : null}
              <DetailRow label="비고" value={record.note} />
            </dl>
          ) : (
            <p className="rounded-xl bg-surface-container p-md text-sm text-on-surface-variant">표시할 연동 데이터가 없습니다.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-outline-variant/50 pb-sm last:border-0 last:pb-0">
      <dt className="text-[11px] font-bold uppercase text-on-surface-variant">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-semibold text-on-surface ${mono ? "font-data" : ""}`}>{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-sm">
      <dt className="shrink-0 pt-0.5 text-[11px] font-bold uppercase leading-tight text-on-surface-variant">
        {label}
      </dt>
      <dd className="min-w-0 max-w-[72%] break-words text-right text-[11px] leading-snug text-on-surface">{value}</dd>
    </div>
  );
}
