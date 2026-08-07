/** SCM 모니터링 권역 → 감염병 통계 지역명 매핑 */
export const infectiousRegionMap: Record<string, string[]> = {
  National: [],
  Seoul: ["서울특별시"],
  Gyeonggi: ["서울특별시", "경기도", "인천광역시"],
  Gangwon: ["강원특별자치도"],
  Chungcheong: ["대전광역시", "세종특별자치시", "충청북도", "충청남도"],
  Honam: ["광주광역시", "전북특별자치도", "전라북도", "전라남도"],
  Daegu: ["대구광역시", "경상북도"],
  Busan: ["부산광역시", "울산광역시", "경상남도"],
  Jeju: ["제주특별자치도"],
};

export function getInfectiousRegionNames(regionId: string): string[] {
  return infectiousRegionMap[regionId] ?? [];
}

export type InfectiousRiskLevel = "normal" | "attention" | "warning";

export function getInfectiousRiskLevel(momChange: number): InfectiousRiskLevel {
  if (momChange > 15) return "warning";
  if (momChange >= 5) return "attention";
  return "normal";
}

export const infectiousRiskLabel: Record<InfectiousRiskLevel, string> = {
  normal: "정상",
  attention: "주의",
  warning: "경고",
};

export type InfectiousSummary = {
  selected_region: string;
  selected_region_label: string;
  latest_date: string;
  selected_region_total_patients: number;
  nationwide_total_patients: number;
  mom_change: number;
  risk_level: InfectiousRiskLevel;
};
