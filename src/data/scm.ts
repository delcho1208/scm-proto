export type RiskLevel = "safe" | "warning" | "danger";

export type Product = {
  key: string;
  name: string;
  icon: string;
  subtitle: string;
  forecastTitle: string;
  annualDemand: string;
  yoyGrowth: string;
  stock: string;
  stockout: string;
  capa: string;
  utilization: string;
  roi: string;
  paths: { actual: string; prediction: string };
  dots: [number, number, number, number];
};

export const products: Product[] = [
  {
    key: "리피로우",
    name: "리피로우",
    icon: "medication",
    subtitle: "이상지질혈증 치료제",
    forecastTitle: "2025 리피로우 Regional Forecast",
    annualDemand: "1,124,000",
    yoyGrowth: "+2.4% YoY",
    stock: "124,000",
    stockout: "8.4%",
    capa: "1,200,000",
    utilization: "93.6%",
    roi: "+12.4%",
    paths: {
      actual: "M0,190 L40,185 L80,180 L120,175 L160,170 L200,165 L240,160 L300,155",
      prediction: "M300,155 L340,150 L380,145 L400,140",
    },
    dots: [160, 130, 90, 80],
  },
  {
    key: "타미비어",
    name: "타미비어",
    icon: "vaccines",
    subtitle: "항바이러스제",
    forecastTitle: "2025 타미비어 Regional Forecast",
    annualDemand: "980,000",
    yoyGrowth: "-1.2% YoY",
    stock: "85,000",
    stockout: "12.6%",
    capa: "1,050,000",
    utilization: "88.2%",
    roi: "+8.7%",
    paths: {
      actual: "M0,150 L40,155 L80,160 L120,165 L160,150 L200,140 L240,130 L300,120",
      prediction: "M300,120 L340,115 L380,110 L400,105",
    },
    dots: [140, 155, 120, 110],
  },
  {
    key: "세파졸린",
    name: "세파졸린",
    icon: "science",
    subtitle: "항생제",
    forecastTitle: "2025 세파졸린 Regional Forecast",
    annualDemand: "1,450,000",
    yoyGrowth: "+5.8% YoY",
    stock: "310,000",
    stockout: "4.2%",
    capa: "1,500,000",
    utilization: "96.7%",
    roi: "+15.1%",
    paths: {
      actual: "M0,180 L40,170 L80,165 L120,150 L160,130 L200,110 L240,100 L300,80",
      prediction: "M300,80 L340,70 L380,60 L400,55",
    },
    dots: [170, 140, 80, 60],
  },
];

export type Region = {
  id: string;
  name: string;
  shortName?: string;
  title: string;
  stock: string;
  riskText: string;
  riskLevel: RiskLevel;
  desc: string;
  img: string;
  /** marker box on the map, in percent */
  box?: { top: string; left: string; width: string; height: string };
  /** stacking order for overlapping markers */
  z?: number;
};

export const regions: Record<string, Region> = {
  National: {
    id: "National",
    name: "전국 통합",
    title: "전국 통합 SCM 모니터링",
    stock: "1,145,000",
    riskText: "주의 (Warning)",
    riskLevel: "warning",
    desc: "수도권 물량 과다로 인한 전국 단위 재배치 권고",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDf2PWMAnwQxSTcTDj8AgCDuDOuNFTmuTX0WejuCdYvo5D6MgCeu9QMXck1uzRZrZKpE71nIVYb5scgl31dhADDUZXOtW0XsFqS3gLy6mFSSh1_iY2bqRbuOC6VV7-uS-czAwIZz_mKyDMqaCRlKR6BJLf2UMhqYtQeCEybkBJJtkydKXWI02USz33uqYyb8PWKSjC9v6YIpiWE2dF7_DeSSG58g3QLLk9BkCLcgOfxNBnYXzQP9-R1hy01Z97OIffNv1WYisqq6Os",
  },
  Seoul: {
    id: "Seoul",
    name: "서울",
    shortName: "서울",
    title: "서울 권역 SCM 모니터링",
    stock: "186,000",
    riskText: "위험 (Danger)",
    riskLevel: "danger",
    desc: "약국 채널 수요 급증, 긴급 보충 필요",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAvsjrtDFtei5WC28QqT6I-N2RowTU0Rw_NQcXW73HHNv42f8GqHDo98Lxj7KiwPU8ZofphhNE_wEn8nlALQPVFCkp9BjOlJ3yZkyZwyA3yF3kozGGTr-0yDv-ianOqL6507w0I1g6YeP2SxbJsKvBOVB05sefTcOw--OnYz96XRVGVmXlr6LQHRz8mIbK38hVXHpYAogIKInwcZoonnuNHGG7pJpfmteZ8eyk2UtzZRQoirVkUqHrryc1fDxxXzJw9WPON_l4GLaw",
    box: { top: "20.0%", left: "26.5%", width: "14%", height: "5%" }, z: 40,
  },
  Gyeonggi: {
    id: "Gyeonggi",
    name: "수도권",
    shortName: "수도권",
    title: "수도권 권역 SCM 모니터링",
    stock: "496,000",
    riskText: "주의 (Warning)",
    riskLevel: "warning",
    desc: "물류 허브 포화 상태, 증설 검토 대상",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCpAzmF-SOd1URighgtK48VR_2hbOOyIYjVdscTKhUi57qjFZmAkAWB-ALr3NYy9QmE25pH6E0DT5U8XNIXwzX1YGjdneTrQZhWhIqUkfDtm2iPgGzzE-0ciagW48IUqRf84QDkSiZisA1tRdj52jZT3dbDOJ6-jTu8BTk-2dfgzFtuvHhKOEOBysn-M7kc-_3y6TZ6uxnsjMJU9LHsYf12Id_dTfOxs0gnPjld9OsbjSm3Vep-Aw_4XRZdY1U8I8g3w5nHNx-KkEA",
    box: { top: "27.5%", left: "34.0%", width: "16%", height: "5%" }, z: 20,
  },
  Gangwon: {
    id: "Gangwon",
    name: "강원",
    shortName: "강원",
    title: "강원 권역 SCM 모니터링",
    stock: "124,000",
    riskText: "안전 (Safe)",
    riskLevel: "safe",
    desc: "안정적인 수급 및 재고 수준 유지 중",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDB33fn5oVHaumb3CNYPjdPIkvb3HVUlML1bniG6_E9_6qBR25IGSysypwj7to7Dc7Use3sDF644Z1ObFK4zA0Qhb0Kh30NIO3CfmpqyH7qyWz8TbvSgu_e9kzp4IlHMQBS2AVvc8541nsIJb-Stkp4JmwgMtQLRn6x3KJtgwbh9-BysCwJj4axquNeKAnxD00P09QTiwjImfcrOh1z7h7E8WddlEvRXRP1ZitIBNlHRKIah6KXM7fiJkwa_JebjYPYOW7gt4IryXs",
    box: { top: "17.5%", left: "59.0%", width: "14%", height: "5%" }, z: 20,
  },
  Chungcheong: {
    id: "Chungcheong",
    name: "충청",
    shortName: "충청",
    title: "충청 권역 SCM 모니터링",
    stock: "168,000",
    riskText: "주의 (Warning)",
    riskLevel: "warning",
    desc: "천안 물류 거점 입고 지연 발생 우려",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDp7ZMKQSg_hc58_kgkd9CPg-RLlbiQlzKPgTPPAAzWbnFXM6249IOSC5uimTqy7PRZAQS6jI9GV_PRzMSQLPyzDe8IOb9b5__w1BfdwJ9OkTUA77a7bsGJMy45VjMMwKP8YcG9vIxj0zGaAb3i9fw204Jhm5UkBg8LYBjoIU--OBvjWv2CrUpjMyXLwzWr7-C3w9oSNGsVikGK9oNe8cZsrld4EDGtkehaF9zUrXSTcYZWKytFciUoQm7KphWlBARRK8ensLFHku4",
    box: { top: "38.5%", left: "34.0%", width: "14%", height: "5%" }, z: 20,
  },
  Daegu: {
    id: "Daegu",
    name: "대구/경북",
    shortName: "대구/경북",
    title: "대구/경북 권역 SCM 모니터링",
    stock: "178,000",
    riskText: "안전 (Safe)",
    riskLevel: "safe",
    desc: "안정적 운영, 경북 외곽 배송 경로 최적화 필요",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBs9CdZfGJ3yM5WkkQWjP-gDfZ3UMCuJM8OjGUL8LmxUHVWLLQJ99XyTMODRCNW7kzuAf_BSMG6rhSQ-qN5Rw65Q_hJ926nfE5_Aur-MvNLF0q_QLOZ3iogKoHJmBSHxYBOWJ0j5Q870Aja52VdqekoiiFCYDD0HI0b4gqGBBJqTGCzCZaevldN5ahZCjc_VYAsaxPyyKqJ__qSuIR4iu9WuQXx9bUT9DGbbpKL9tnidfzx2SDOCnb9aQ0NiIxJXxNGFr1ALD4260Q",
    box: { top: "41.5%", left: "61.0%", width: "18%", height: "5%" }, z: 20,
  },
  Honam: {
    id: "Honam",
    name: "호남",
    shortName: "호남",
    title: "호남 권역 SCM 모니터링",
    stock: "156,000",
    riskText: "안전 (Safe)",
    riskLevel: "safe",
    desc: "광주 센터 배송 리드타임 개선 완료",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBOSHTY0eBrvZVBcBlO8mv1r8hPeYfSw7E5-ZRwKiy2xc_FEtzqcx45ybdazMca-nB7oq6ZmZ-tU4C4lkykSp813ZyKZa74rkl-6vpF2IRhcfmNVLgUxMVvR7YgumMCPyozg3Ld9gR3AJWXpkgrcBnDtpsfuG9OGCh_S4QIKIwrzWIQLqC_X0aepanE2iIjb_aRnfJfIvkpGWe8ZMa_3YcV3mUgpsLoxzrSSAnmQYM-kF59VjbSWSMBakPUM8beI6KfzIWnhUrkgak",
    box: { top: "57.5%", left: "30.0%", width: "14%", height: "5%" }, z: 20,
  },
  Busan: {
    id: "Busan",
    name: "부산/울산/경남권",
    shortName: "부산/경남",
    title: "부산/울산/경남 권역 SCM 모니터링",
    stock: "209,000",
    riskText: "위험 (Danger)",
    riskLevel: "danger",
    desc: "해상 수입 자재 수급 상황 상시 모니터링",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuActC-YMLFDOXtxEVNvPpjSTIHD71_93NwHJoRB1I4hADNavtze1KFZOeSa3Zcscq2AhFa9vRmvxHiNiJcWc2ZxHctvudyJewXPOGpPB-EycW2ZCJxj0M4ICyqyyitDA_9mor9LVtghZ81AoZP4RIdn0fEPE3iX5ZGaaOAJrDsSAqzvN5tlqhIbswO3BkzKg4mp_vuyY3Y_0opQ-0WQnc2_Hrb21boFb4x0Vpu8P3jKvKHJ-7gA4Czae4_DRbALbAmaucgr2GubijU",
    box: { top: "61.5%", left: "57.0%", width: "18%", height: "5%" }, z: 20,
  },
  Jeju: {
    id: "Jeju",
    name: "제주",
    shortName: "제주",
    title: "제주 권역 SCM 모니터링",
    stock: "18,000",
    riskText: "안전 (Safe)",
    riskLevel: "safe",
    desc: "기상 악화 대비 선제적 재고 확보 권고",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBCP0B7kojFpz0zABxgp4pHYJHRoojB9pQy2DvOvF6j1_PJ609O553_ypw-tEQI1-zsdDLImmejL4RA2XRfZ_5-5fSlK_kdoW_vlRs2Ar9mJNA4nHcSC7uyV44KVm6NIsFkAKpXA2cFThOJrmMlMVopqWuJ0_06vPQB8s1IVqcJ_1m7KsHX30tgCD3cm7A2qgAxHBHZkPiquTjrqfEp1t4H_FVeUv__WKAnIzf6qbgCeT8lnKmMzcbMVknkAMrvLLNICxdnTJ_0isk",
    box: { top: "89.5%", left: "22.0%", width: "14%", height: "5%" }, z: 20,
  },
};

export const markerOrder = [
  "Seoul",
  "Gyeonggi",
  "Gangwon",
  "Chungcheong",
  "Daegu",
  "Honam",
  "Busan",
  "Jeju",
];

export const riskFactors = [
  { label: "감염병 확산", score: "85/100", color: "var(--scm-error)" },
  { label: "공급 지연 가능성", score: "80/100", color: "#faad14" },
  { label: "원자재 수급 불안", score: "65/100", color: "#fadb14" },
  { label: "생산 CAPA 부족", score: "70/100", color: "var(--scm-primary)" },
];

export const brandLogo =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB1LKVuQtpI1jLGmHDfVMPMt7ADuLDiB5goL-09hc5SISdGqx7hz_z89VQfVfzdBcK1-Z8-rMDGv_2RCTGpELMnYKwTBD3g4BLXLqtupQjnpuyoqVqRlep8q6OnrcOBnU2sqT9SssGqZVrPiYB6x1ABdv-SaLgrmFqVm_eT-YFFP_f-AsSq3D8_7QqSQ0RRLonPGLzXvZK3Cm-rkHGjOmiTCv89bbGPEQBAcIpEP3AHzoDaRF3YxXMbOjWlplUwiMUz6w";

export const userAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBMhfWnVew7lLmHcID3MKUn1H8hGbTrRcJQiekw0X3ShLjGMja38esWzhJT9eEZlbfvafVw3o_qJhO75AhiyLY5x5iBXnWi8LKqX9Pwu3Ifk_7pcxkrqoUinMg7lZfTemydDtU7SRX-Bfv6sY3N4DrBpB-mSE1Z7a--r-IRzrbJGwcCk_a2t1Dkov_FIbmx9WJE_AGKS7BDt3U1pWACWFpFVMEtR1Z-rqWnHwRnLyQem-e0yl8C9mgReSnvBl-XONXYw7H4--Krc2s";

/* ===== 권역별 · 제품별 시스템 연동 데이터 (ERP / MES / WMS) ===== */

export type SystemKey = "ERP" | "MES" | "WMS";

export type SystemRecord = {
  system: SystemKey;
  docNo: string;
  status: "동기화 완료" | "처리중" | "지연";
  qty: string;
  updatedAt: string;
  note: string;
};

const statuses: SystemRecord["status"][] = ["동기화 완료", "처리중", "지연"];

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

const systemMeta: Record<SystemKey, { prefix: string; notes: string[] }> = {
  ERP: {
    prefix: "PO",
    notes: ["구매 발주 승인 완료", "판매 오더 마감 대기", "월 마감 전표 반영"],
  },
  MES: {
    prefix: "WO",
    notes: ["생산 지시 진행중", "품질 검사 합격", "설비 예방 정비 예정"],
  },
  WMS: {
    prefix: "SH",
    notes: ["출고 피킹 완료", "입고 검수 진행", "재고 실사 반영 필요"],
  },
};

export function getIntegrationRecords(regionId: string, productKey: string): SystemRecord[] {
  return (Object.keys(systemMeta) as SystemKey[]).map((system, idx) => {
    const seed = hash(`${regionId}-${productKey}-${system}`);
    const meta = systemMeta[system];
    return {
      system,
      docNo: `${meta.prefix}-2025-${(1000 + (seed % 8999)).toString()}`,
      status: statuses[(seed >>> 3) % statuses.length],
      qty: (2000 + ((seed >>> 5) % 48000)).toLocaleString(),
      updatedAt: `2025-07-1${(seed % 5) + 1} ${String(8 + ((seed >>> 7) % 10)).padStart(2, "0")}:${String((seed >>> 2) % 60).padStart(2, "0")}`,
      note: meta.notes[(seed >>> 9) % meta.notes.length],
    };
  }).map((r, i) => ({ ...r, system: (["ERP", "MES", "WMS"] as SystemKey[])[i] }));
}

export const systemColumns: Record<SystemKey, { title: string; desc: string; icon: string }> = {
  ERP: { title: "ERP", desc: "전사 자원 관리 (발주 · 판매 · 회계)", icon: "account_balance" },
  MES: { title: "MES", desc: "제조 실행 시스템 (생산 · 품질)", icon: "precision_manufacturing" },
  WMS: { title: "WMS", desc: "창고 관리 시스템 (입출고 · 재고)", icon: "warehouse" },
};
