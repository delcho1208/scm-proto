import type { SystemRecord } from "@/data/scm";

type WmsSnapshot = {
  warehouse: string;
  region: string;
  lot: string;
  stock: number;
  target: number;
  inventoryStatus: string;
  ratioPct: number;
  incoming: number;
  transferable: number;
};

const wmsByRegion: Record<string, WmsSnapshot> = {
  Seoul: { warehouse: "WH-Zone1-01", region: "Zone1_서울권", lot: "260430-리피", stock: 6478, target: 4000, inventoryStatus: "과잉", ratioPct: 161.9, incoming: 300, transferable: 338 },
  Gyeonggi: { warehouse: "WH-Zone2-01", region: "Zone2_경기인천수도권", lot: "260430-리피", stock: 4420, target: 3000, inventoryStatus: "과잉", ratioPct: 147.3, incoming: 500, transferable: 763 },
  Gangwon: { warehouse: "WH-Zone3-01", region: "Zone3_강원권", lot: "260430-리피", stock: 1804, target: 1200, inventoryStatus: "과잉", ratioPct: 150.3, incoming: 100, transferable: 235 },
  Chungcheong: { warehouse: "WH-Zone4-01", region: "Zone4_대전세종충청권", lot: "260430-리피", stock: 2707, target: 1800, inventoryStatus: "과잉", ratioPct: 150.4, incoming: 0, transferable: 593 },
  Honam: { warehouse: "WH-Zone5-01", region: "Zone5_광주전북전남권", lot: "260430-리피", stock: 2256, target: 1500, inventoryStatus: "과잉", ratioPct: 150.4, incoming: 500, transferable: 575 },
  Daegu: { warehouse: "WH-Zone6-01", region: "Zone6_대구경북권", lot: "260430-리피", stock: 2707, target: 1800, inventoryStatus: "과잉", ratioPct: 150.4, incoming: 0, transferable: 829 },
  Busan: { warehouse: "WH-Zone7-01", region: "Zone7_부산울산경남권", lot: "260430-리피", stock: 3761, target: 2500, inventoryStatus: "과잉", ratioPct: 150.4, incoming: 200, transferable: 337 },
  Jeju: { warehouse: "WH-Zone8-01", region: "Zone8_제주권", lot: "260430-리피", stock: 1174, target: 1000, inventoryStatus: "적정", ratioPct: 117.4, incoming: 200, transferable: 668 },
};

export function getLipilouIntegrationRecords(regionId: string): SystemRecord[] {
  const wms = wmsByRegion[regionId] ?? wmsByRegion.Seoul;

  return [
    {
      system: "ERP",
      docNo: "RM-리피-2603-01",
      status: "동기화 완료",
      qty: (3734).toLocaleString("ko-KR"),
      updatedAt: "2026-04-30 09:00",
      note: "atorvastatin calcium · 국내 조달 · 대체 공급업체 있음",
      dataType: "ERP 원료·구매 실적",
      calculationBasis: "원료 리드타임 2주 · 목표재고 24일 · 최소주문량 1,000",
    },
    {
      system: "MES",
      docNo: "260425-B01",
      status: "동기화 완료",
      qty: (34701).toLocaleString("ko-KR"),
      updatedAt: "2026-04-27 09:00",
      note: "천안공장 B라인 · 품질검사 합격 · 출하 승인 완료",
      dataType: "MES 생산·품질 실적",
      calculationBasis: "2026-04-25 일일생산량 · 최대생산능력 42,000 · 가동률 82.6%",
    },
    {
      system: "WMS",
      docNo: `${wms.warehouse} / ${wms.lot}`,
      status: "동기화 완료",
      qty: wms.stock.toLocaleString("ko-KR"),
      updatedAt: "2026-04-30 23:59",
      note: `${wms.region} · 재고 ${wms.inventoryStatus} · 입고예정 ${wms.incoming.toLocaleString("ko-KR")} BOX · 운송가능 ${wms.transferable.toLocaleString("ko-KR")} BOX`,
      dataType: "WMS 일별 재고 실적",
      calculationBasis: `2026-03-02~04-30 일별 데이터 최신값 · 목표 ${wms.target.toLocaleString("ko-KR")} BOX · 충족률 ${wms.ratioPct.toFixed(1)}%`,
    },
  ];
}
