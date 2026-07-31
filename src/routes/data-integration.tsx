import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ScmShell, Icon } from "@/components/ScmShell";
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

function DataIntegrationView({ product }: { product: Product }) {
  const [regionId, setRegionId] = useState("Seoul");
  const region = regions[regionId];
  const records = getIntegrationRecords(regionId, product.key);

  return (
    <div className="max-monitor-width flex-1 bg-surface px-lg pb-16 pt-16">
      <div className="py-lg">
        <h3 className="mb-xs font-display text-headline-md text-on-surface">
          데이터 통합 · {region.name} / {product.name}
        </h3>
        <p className="text-on-surface-variant">
          권역별 의약품의 ERP · MES · WMS 시스템 연동 데이터를 확인합니다.
        </p>
      </div>

      {/* Region selector */}
      <div className="mb-lg flex flex-wrap gap-2">
        {markerOrder.map((id) => (
          <button
            key={id}
            onClick={() => setRegionId(id)}
            className={`rounded-full border px-4 py-1.5 text-[12px] font-bold transition-colors ${
              regionId === id
                ? "border-scm-primary bg-primary-container text-on-primary-container"
                : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-variant"
            }`}
          >
            {regions[id].name}
          </button>
        ))}
      </div>

      {/* System cards */}
      <div className="grid grid-cols-1 gap-lg lg:grid-cols-3">
        {records.map((rec) => {
          const meta = systemColumns[rec.system as SystemKey];
          return (
            <div key={rec.system} className="bento-card flex flex-col p-md">
              <div className="mb-md flex items-start gap-sm border-b border-outline-variant/40 pb-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                  <Icon name={meta.icon} className="text-[20px]" />
                </div>
                <div>
                  <h4 className="font-display text-headline-sm text-on-surface">{meta.title}</h4>
                  <p className="text-[11px] text-on-surface-variant">{meta.desc}</p>
                </div>
              </div>
              <dl className="space-y-3 text-[13px]">
                <Row label="문서번호" value={<span className="font-data">{rec.docNo}</span>} />
                <Row
                  label="연동 상태"
                  value={
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusStyle[rec.status]}`}
                    >
                      {rec.status}
                    </span>
                  }
                />
                <Row
                  label="수량 (BOX)"
                  value={<span className="font-data font-semibold text-scm-primary">{rec.qty}</span>}
                />
                <Row label="최근 동기화" value={<span className="font-data">{rec.updatedAt}</span>} />
                <Row label="비고" value={rec.note} />
              </dl>
            </div>
          );
        })}
      </div>

      {/* Cross-region summary */}
      <div className="bento-card mt-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-outline-variant/40 p-md">
          <h4 className="font-display text-headline-sm">
            전체 권역 · {product.name} 시스템 연동 현황
          </h4>
          <Icon name="table_view" className="text-outline" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="bg-surface-container-low text-[11px] uppercase text-on-surface-variant">
              <tr>
                <th className="px-md py-sm font-bold">권역</th>
                {(["ERP", "MES", "WMS"] as SystemKey[]).map((s) => (
                  <th key={s} className="px-md py-sm font-bold">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {markerOrder.map((id) => {
                const rows = getIntegrationRecords(id, product.key);
                return (
                  <tr
                    key={id}
                    onClick={() => setRegionId(id)}
                    className={`cursor-pointer border-t border-outline-variant/30 transition-colors hover:bg-surface-container-low ${
                      regionId === id ? "bg-primary-container/10" : ""
                    }`}
                  >
                    <td className="px-md py-sm font-bold text-on-surface">{regions[id].name}</td>
                    {rows.map((r) => (
                      <td key={r.system} className="px-md py-sm">
                        <div className="flex flex-col">
                          <span className="font-data text-[12px] text-on-surface">{r.qty} BOX</span>
                          <span
                            className={`mt-1 w-fit rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusStyle[r.status]}`}
                          >
                            {r.status}
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
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-md">
      <dt className="text-[11px] font-bold uppercase text-on-surface-variant">{label}</dt>
      <dd className="text-right text-on-surface">{value}</dd>
    </div>
  );
}
