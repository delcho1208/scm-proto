import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ScmShell, Icon } from "@/components/ScmShell";
import { getCefazolinIntegrationRecords } from "@/data/cefazolin-dashboard";
import { getLipilouIntegrationRecords } from "@/data/lipilou-integration";
import { getTamivirIntegrationRecords } from "@/data/tamivir-integration";
import { getIntegrationRecords, markerOrder, regions, type Product, type SystemKey } from "@/data/scm";

export const Route = createFileRoute("/data-integration")({
  head: () => ({
    meta: [
      { title: "창고 관제 — 제약 SCM 디지털 트윈" },
      { name: "description", content: "8개 권역의 ERP·MES·WMS 연동과 안전재고를 통합 관제합니다." },
    ],
  }),
  component: () => <ScmShell>{(product) => <DataIntegrationView product={product} />}</ScmShell>,
});

type StockStatus = "danger" | "warning" | "safe";
type WarehouseZone = {
  id: string;
  name: string;
  safetyStockRatio: number;
  inventory: number;
  leadTime: number;
  lastUpdated: string;
};

const systemCards: Array<{
  key: SystemKey;
  color: string;
  description: string;
  count: string;
  icon: string;
}> = [
  { key: "ERP", color: "blue", description: "주문, 생산계획", count: "1,245", icon: "account_tree" },
  { key: "MES", color: "green", description: "생산실적, 재고", count: "3,578", icon: "precision_manufacturing" },
  { key: "WMS", color: "orange", description: "입출고, 재고위치", count: "8,923", icon: "warehouse" },
];

const baseRatios: Record<string, number[]> = {
  세파졸린: [58, 82, 105, 110, 70, 125, 130, 115],
  리피로우: [118, 106, 92, 101, 84, 112, 96, 68],
  타미비어: [245, 182, 94, 108, 97, 102, 128, 88],
};

function getStockMeta(ratio: number): { status: StockStatus; label: string; color: string } {
  if (ratio < 70) return { status: "danger", label: "위험", color: "#dc2626" };
  if (ratio < 100) return { status: "warning", label: "주의", color: "#eab308" };
  return { status: "safe", label: "정상", color: "#16a34a" };
}

function getProductIntegrationRecords(regionId: string, productKey: string) {
  if (productKey === "세파졸린") return getCefazolinIntegrationRecords(regionId);
  if (productKey === "리피로우") return getLipilouIntegrationRecords(regionId);
  if (productKey === "타미비어") return getTamivirIntegrationRecords(regionId);
  return getIntegrationRecords(regionId, productKey);
}

function createZones(product: Product): WarehouseZone[] {
  const ratios = baseRatios[product.key] ?? baseRatios.세파졸린;
  return markerOrder.map((id, index) => {
    const records = getProductIntegrationRecords(id, product.key);
    const rawQty = Number((records.find((record) => record.system === "WMS")?.qty ?? "0").replaceAll(",", ""));
    return {
      id,
      name: regions[id].name.replace("인천", "·인천").replace("울산", "·울산").replace("경남", "·경남"),
      safetyStockRatio: ratios[index],
      inventory: rawQty || 8_400 + index * 1_270,
      leadTime: Number((18 + index * 1.7).toFixed(1)),
      lastUpdated: records.find((record) => record.system === "WMS")?.updatedAt ?? "2026-10-28",
    };
  });
}

function DataIntegrationView({ product }: { product: Product }) {
  const [regionId, setRegionId] = useState("Seoul");
  const [viewMode, setViewMode] = useState<"3d" | "2d" | "table">("3d");
  const [drawer, setDrawer] = useState<{ type: "zone" | "system"; id: string } | null>(null);
  const zones = useMemo(() => createZones(product), [product]);
  const activeZone = zones.find((zone) => zone.id === regionId) ?? zones[0];

  const openZone = (id: string) => {
    setRegionId(id);
    setDrawer({ type: "zone", id });
  };

  return (
    <div className="warehouse-page h-screen min-w-[1440px] flex-1 overflow-hidden bg-[#f8fafc] px-4 pb-9 pt-16 text-slate-900">
      <header className="mx-auto flex max-w-[1760px] items-end justify-between gap-6 py-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">데이터 통합 · {activeZone.name} / {product.name}</h1>
          <p className="mt-1 text-sm text-slate-500">시스템 연동 현황 및 8개 권역 안전재고 모니터링</p>
        </div>
      </header>

      <main className="mx-auto grid h-[calc(100vh-154px)] max-w-[1760px] grid-cols-[280px_minmax(0,1fr)] gap-4">
        <aside className="flex flex-col">
          <div className="mb-4">
            <h2 className="text-lg font-black">시스템 데이터 흐름</h2>
            <p className="mt-1 text-xs text-slate-500">End-to-end integration pipeline</p>
          </div>
          {systemCards.map((system, index) => (
            <div key={system.key} className="contents">
              <SystemFlowCard
                {...system}
                onClick={() => setDrawer({ type: "system", id: system.key })}
              />
              {index < systemCards.length - 1 ? (
                <div className="warehouse-flow-connector" aria-hidden="true">
                  <span><Icon name="check" className="text-[12px]" /></span>
                  <Icon name="south" className="text-[18px]" />
                </div>
              ) : null}
            </div>
          ))}
        </aside>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
          <div className="flex items-start justify-between border-b border-slate-200 px-5 py-3">
            <div>
              <h2 className="text-xl font-black">전체 권역 · {product.name} 시스템 연동 현황</h2>
              <p className="mt-1 text-xs font-black tracking-wide text-green-600">ERP · MES · WMS 통합 연결</p>
            </div>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(["3d", "2d", "table"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  title={mode === "3d" ? "3D 보기" : mode === "2d" ? "2D 보기" : "테이블 보기"}
                  onClick={() => setViewMode(mode)}
                  className={`flex h-9 w-10 items-center justify-center rounded-lg transition ${viewMode === mode ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:bg-white"}`}
                >
                  <Icon name={mode === "3d" ? "view_in_ar" : mode === "2d" ? "grid_view" : "table_view"} className="text-[19px]" />
                </button>
              ))}
            </div>
          </div>

          {viewMode === "table" ? (
            <WarehouseTable zones={zones} onSelect={openZone} />
          ) : (
            <WarehouseTwin zones={zones} product={product} mode={viewMode} onSelect={openZone} />
          )}
        </section>
      </main>

      {drawer ? (
        <DetailDrawer
          drawer={drawer}
          zone={zones.find((zone) => zone.id === drawer.id)}
          records={getProductIntegrationRecords(regionId, product.key)}
          onClose={() => setDrawer(null)}
        />
      ) : null}
    </div>
  );
}

function SystemFlowCard({ key: systemKey, color, description, count, icon, onClick }: (typeof systemCards)[number] & { onClick: () => void }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className={`warehouse-system-icon ${color}`}><Icon name={icon} className="text-[22px]" /></span>
          <div><p className="text-lg font-black">{systemKey}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">System</p></div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-black text-green-600"><span className="h-1.5 w-1.5 rounded-full bg-green-500" /> 연동 정상</span>
      </div>
      <dl className="mt-4 space-y-2 text-xs">
        <InfoRow label="데이터 기준" value="2026-10-28" mono />
        <InfoRow label="연동 데이터" value={description} />
        <InfoRow label="데이터 건수" value={`${count} 건`} mono />
      </dl>
      <button type="button" onClick={onClick} className="mt-4 flex items-center gap-1 text-xs font-black text-blue-600 hover:gap-2">상세 보기 <Icon name="arrow_forward" className="text-[15px]" /></button>
    </article>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className={`${mono ? "font-mono tabular-nums" : ""} text-right font-bold text-slate-800`}>{value}</dd></div>;
}

function WarehouseTwin({ zones, product, mode, onSelect }: { zones: WarehouseZone[]; product: Product; mode: "3d" | "2d"; onSelect: (id: string) => void }) {
  return (
    <div className={`warehouse-stage ${mode === "2d" ? "flat" : ""}`}>
      <div className="warehouse-zone-badges">
        {[ ["local_shipping", "입고", "RECEIVING"], ["inventory_2", "보관", "STORAGE"], ["shopping_cart", "피킹", "PICKING"], ["fire_truck", "출고", "SHIPPING"] ].map(([icon, ko, en]) => (
          <div key={en}><Icon name={icon} className="text-[18px] text-blue-600" /><span><b>{ko}</b><small>{en}</small></span></div>
        ))}
      </div>
      <div className="warehouse-yard">
        <div className="yard-markings" />
        <div className="warehouse-truck left"><span /><i /><i /></div>
        <div className="warehouse-truck right"><span /><i /><i /></div>
        <div className="warehouse-forklift"><Icon name="forklift" className="text-[28px]" /></div>
        <div className="warehouse-rack-grid">
          {zones.map((zone) => <WarehouseRack key={zone.id} zone={zone} onClick={() => onSelect(zone.id)} />)}
        </div>
        <div className="warehouse-control-room">
          <div className="control-room-title"><span className="h-1.5 w-1.5 rounded-full bg-green-400" /> 통합 관제실</div>
          <div className="control-monitors"><i /><i /><i /><i /></div>
        </div>
      </div>
      <div className="warehouse-resource-bar">
        <div className="flex flex-wrap items-center gap-5">
          <b>안전재고 비율 범례</b>
          <Legend color="#dc2626" label="위험 (0~70%)" />
          <Legend color="#eab308" label="주의 (70~100%)" />
          <Legend color="#16a34a" label="정상 (100% 이상)" />
        </div>
        <div className="flex items-center gap-5 text-xs font-bold text-slate-600">
          <span>🚜 지게차</span><span>🤖 AGV</span><span>👷 작업자</span><span>📦 팔레트</span>
        </div>
      </div>
      <span className="sr-only">{product.name} 8개 권역 아이소메트릭 창고</span>
    </div>
  );
}

function WarehouseRack({ zone, onClick }: { zone: WarehouseZone; onClick: () => void }) {
  const meta = getStockMeta(zone.safetyStockRatio);
  return (
    <button type="button" onClick={onClick} className={`warehouse-rack status-${meta.status}`} style={{ "--stock-color": meta.color } as React.CSSProperties}>
      <span className="rack-tooltip"><b>{zone.name} 구역</b><span>재고 {zone.inventory.toLocaleString()} BOX</span><span>리드타임 {zone.leadTime}시간</span><span>갱신 {zone.lastUpdated}</span></span>
      <span className="rack-info"><span><i /> {zone.name} 구역</span><strong className="tabular-nums">안전재고 {zone.safetyStockRatio}%</strong><em>{meta.label}</em></span>
      <span className="rack-object" aria-hidden="true"><span className="rack-top" /><span className="rack-side" /><span className="rack-front">{[0,1,2].map((shelf) => <i key={shelf}>{[0,1,2,3].map((box) => <b key={box} />)}</i>)}</span></span>
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-2 text-xs font-bold text-slate-600"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>;
}

function WarehouseTable({ zones, onSelect }: { zones: WarehouseZone[]; onSelect: (id: string) => void }) {
  return <div className="min-h-[680px] overflow-auto p-6"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="p-4">권역</th><th>안전재고</th><th>상태</th><th>재고량</th><th>리드타임</th><th>최근 갱신</th></tr></thead><tbody>{zones.map((zone) => { const meta = getStockMeta(zone.safetyStockRatio); return <tr key={zone.id} onClick={() => onSelect(zone.id)} className="cursor-pointer border-b border-slate-100 hover:bg-blue-50"><td className="p-4 font-black">{zone.name}</td><td className="font-mono font-black">{zone.safetyStockRatio}%</td><td><span className={`warehouse-table-status ${meta.status}`}>{meta.label}</span></td><td className="font-mono">{zone.inventory.toLocaleString()} BOX</td><td>{zone.leadTime}시간</td><td className="font-mono">{zone.lastUpdated}</td></tr>; })}</tbody></table></div>;
}

function DetailDrawer({ drawer, zone, records, onClose }: { drawer: { type: "zone" | "system"; id: string }; zone?: WarehouseZone; records: ReturnType<typeof getIntegrationRecords>; onClose: () => void }) {
  const isZone = drawer.type === "zone" && zone;
  return <div className="fixed inset-0 z-[600] bg-slate-950/20" onMouseDown={onClose}><aside onMouseDown={(event) => event.stopPropagation()} className="warehouse-drawer">
    <header className="flex items-center justify-between border-b border-slate-200 p-6"><div><p className="text-xs font-black uppercase tracking-widest text-blue-600">{isZone ? "Region detail" : "System detail"}</p><h2 className="mt-1 text-2xl font-black">{isZone ? `${zone.name} 구역` : `${drawer.id} 연동 상세`}</h2></div><button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100"><Icon name="close" className="text-[22px]" /></button></header>
    <div className="space-y-5 overflow-y-auto p-6">
      {isZone ? <><div className="grid grid-cols-2 gap-3"><DrawerMetric label="안전재고" value={`${zone.safetyStockRatio}%`} /><DrawerMetric label="현재 재고" value={`${zone.inventory.toLocaleString()} BOX`} /><DrawerMetric label="리드타임" value={`${zone.leadTime}시간`} /><DrawerMetric label="최근 갱신" value={zone.lastUpdated} /></div><MiniInventoryChart /></> : null}
      <section><h3 className="mb-3 font-black">ERP · MES · WMS 스냅샷</h3>{records.filter((record) => isZone || record.system === drawer.id).map((record) => <div key={record.system} className="mb-2 rounded-xl border border-slate-200 p-4"><div className="flex justify-between"><b>{record.system}</b><span className="text-xs font-bold text-green-600">● {record.status}</span></div><p className="mt-2 font-mono text-sm">{record.qty} BOX</p><p className="mt-1 text-xs text-slate-500">{record.note}</p></div>)}</section>
    </div>
  </aside></div>;
}

function DrawerMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-mono text-sm font-black tabular-nums">{value}</p></div>; }
function MiniInventoryChart() { return <section className="rounded-2xl border border-slate-200 p-5"><div className="flex justify-between"><b>일별 재고 추이</b><span className="text-xs text-green-600">최근 7일</span></div><svg className="mt-4 h-32 w-full" viewBox="0 0 360 120" preserveAspectRatio="none"><defs><linearGradient id="miniFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2563eb" stopOpacity=".28"/><stop offset="1" stopColor="#2563eb" stopOpacity="0"/></linearGradient></defs><path d="M0 88 L60 76 L120 82 L180 54 L240 62 L300 35 L360 28 L360 120 L0 120Z" fill="url(#miniFill)"/><path d="M0 88 L60 76 L120 82 L180 54 L240 62 L300 35 L360 28" fill="none" stroke="#2563eb" strokeWidth="3"/></svg></section>; }
