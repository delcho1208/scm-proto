import type { SystemRecord } from "@/data/scm";
import { tamivirDashboard } from "@/data/dashboard-scenario";

type WmsSnapshot = {
  warehouse: string;
  region: string;
  stock: number;
  safetyStock: number;
  incoming: number;
  transferable: number;
  f2aTarget: number;
};

const wmsByRegion: Record<string, WmsSnapshot> = {
  Seoul: { warehouse: "WH-Zone1-01", region: "Zone1_서울", stock: 48627, safetyStock: 70968, incoming: 300, transferable: 930, f2aTarget: 709684 },
  Gyeonggi: { warehouse: "WH-Zone2-01", region: "Zone2_경기/인천", stock: 101494, safetyStock: 142760, incoming: 500, transferable: 350, f2aTarget: 1427607 },
  Gangwon: { warehouse: "WH-Zone3-01", region: "Zone3_강원", stock: 12198, safetyStock: 15225, incoming: 100, transferable: 650, f2aTarget: 152259 },
  Chungcheong: { warehouse: "WH-Zone4-01", region: "Zone4_충청", stock: 32546, safetyStock: 41946, incoming: 200, transferable: 743, f2aTarget: 419468 },
  Honam: { warehouse: "WH-Zone5-01", region: "Zone5_광주/전라", stock: 28924, safetyStock: 30065, incoming: 200, transferable: 908, f2aTarget: 300655 },
  Daegu: { warehouse: "WH-Zone6-01", region: "Zone6_대구/경북", stock: 23245, safetyStock: 24976, incoming: 200, transferable: 741, f2aTarget: 249766 },
  Busan: { warehouse: "WH-Zone7-01", region: "Zone7_부울경", stock: 29544, safetyStock: 37971, incoming: 300, transferable: 519, f2aTarget: 379710 },
  Jeju: { warehouse: "WH-Zone8-01", region: "Zone8_제주", stock: 3743, safetyStock: 4129, incoming: 100, transferable: 538, f2aTarget: 41290 },
};

export function getTamivirIntegrationRecords(regionId: string): SystemRecord[] {
  const wms = wmsByRegion[regionId] ?? wmsByRegion.Seoul;
  const simRegion = tamivirDashboard?.regions[regionId];
  const stock = simRegion ? Math.round(simRegion.current_stock) : wms.stock;
  const safetyCoveragePct = (stock / wms.safetyStock) * 100;


  return [
    {
      system: "ERP",
      docNo: "RM-타미-2642",
      status: "동기화 완료",
      qty: (3089).toLocaleString("ko-KR"),
      updatedAt: "2026-10-19",
      note: "오셀타미비르 원료 · 스위스 수입 · 대체 공급업체 있음",
      dataType: "ERP 원료·구매 실적",
      calculationBasis: "주차별 60건 최신값 · 리드타임 2주(변동성 0.5주) · 안전재고 21일 · 최소주문량 1,000",
    },
    {
      system: "MES",
      docNo: "261005-L1",
      status: "동기화 완료",
      qty: (27300).toLocaleString("ko-KR"),
      updatedAt: "2026-10-07",
      note: "천안공장 L1 · 정상가동 · 품질검사 합격 · 출하 승인 완료",
      dataType: "MES 생산·품질 실적",
      calculationBasis: "일별 생산 400건 최신값 · 최대생산능력 30,483 · 가동률 89.6% · 원료 LOT RM-타미-2640",
    },
    {
      system: "WMS",
      docNo: `${wms.warehouse} / 261028-L1`,
      status: "동기화 완료",
      qty: wms.stock.toLocaleString("ko-KR"),
      updatedAt: "2026-10-28",
      note: `${wms.region} · 안전재고 ${safetyCoveragePct < 100 ? "미달" : "충족"} · 입고예정 ${wms.incoming.toLocaleString("ko-KR")} BOX · 운송가능 ${wms.transferable.toLocaleString("ko-KR")} BOX · 외부충격 감지`,
      dataType: "WMS 일별 재고 실적",
      calculationBasis: `2025-09-01~2026-10-28 일별 데이터 최신값 · 안전재고 ${wms.safetyStock.toLocaleString("ko-KR")} BOX(${safetyCoveragePct.toFixed(1)}%) · F2A 목표 ${wms.f2aTarget.toLocaleString("ko-KR")} BOX`,
    },
  ];
}
