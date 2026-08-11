import rawScenario from "../../lipilou_dashboard_scenario.json";
import type { CefazolinWorkflowStep } from "@/data/cefazolin-ai-workflow";

const scenarios = [...rawScenario.scenarios].sort((a, b) => a.date.localeCompare(b.date));
const alertScenario = scenarios.find((scenario) => "mes_card" in scenario);
const latestScenario = [...scenarios].reverse().find((scenario) => "map_monitoring" in scenario);
const regions = latestScenario && "map_monitoring" in latestScenario ? latestScenario.map_monitoring : [];
const logs = latestScenario && "timeline_logs" in latestScenario ? latestScenario.timeline_logs : [];
const solutions = latestScenario && "ai_solutions" in latestScenario ? latestScenario.ai_solutions : [];
const selectedSolution = solutions?.find((solution) => solution.is_final_selected) ?? solutions?.[0];
const dangerRegion = regions?.find((region) => region.status === "DANGER");
const transferResult = selectedSolution && "expected_after_transfer" in selectedSolution
  ? selectedSolution.expected_after_transfer
  : undefined;

function ev(...items: (string | undefined)[]): string[] {
  return items.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export const lipilouWorkflowSteps: CefazolinWorkflowStep[] = [
  {
    id: "LIPI-FLOW-01",
    order: 1,
    group: "데이터 준비",
    title: "ERP·MES·WMS·수요 데이터 확인",
    shortTitle: "데이터 수집",
    purpose: "생산 품질, 권역별 재고와 목표재고 데이터를 AI 분석 입력으로 수집합니다.",
    description: "생산 품질, 권역별 재고와 목표재고 데이터를 AI 분석 입력으로 수집합니다.",
    status: "완료",
    icon: "database",
    ruleIds: [],
    dataAsOf: latestScenario?.date ?? "",
    evidence: ["S1~S3 시뮬레이션", `전국 8개 권역 재고 수집`],
    warnings: [],
    nextAction: "데이터 통합·정합성 확인",
    synthetic: true,
  },
  {
    id: "LIPI-FLOW-02",
    order: 2,
    group: "데이터 준비",
    title: "데이터 통합·품질 검사",
    shortTitle: "통합·품질 검사",
    purpose: "권역 코드와 재고 단위를 BOX 기준으로 통일하고 누락 여부를 검사합니다.",
    description: "권역 코드와 재고 단위를 BOX 기준으로 통일하고 누락 여부를 검사합니다.",
    status: "완료",
    icon: "account_tree",
    ruleIds: [],
    dataAsOf: latestScenario?.date ?? "",
    evidence: [`권역 데이터 ${regions?.length ?? 0}/8건 정상`, "현재고·목표재고·재고율 정규화"],
    warnings: [],
    nextAction: "품질 이상 신호를 기반으로 Case를 생성합니다.",
    synthetic: true,
  },
  {
    id: "LIPI-FLOW-03",
    order: 3,
    group: "탐지·영향",
    title: "품질 이상 탐지·Case 생성",
    shortTitle: "위험 탐지",
    purpose: "생산 LOT의 품질 재검사와 출하 지연 신호를 공급 위험 이벤트로 등록합니다.",
    description: "생산 LOT의 품질 재검사와 출하 지연 신호를 공급 위험 이벤트로 등록합니다.",
    status: "완료",
    icon: "factory",
    ruleIds: [],
    dataAsOf: alertScenario?.date ?? latestScenario?.date ?? "",
    evidence: alertScenario && "mes_card" in alertScenario && alertScenario.mes_card
      ? [`${alertScenario.mes_card.factory_id} ${alertScenario.mes_card.line}라인`, `LOT ${alertScenario.mes_card.lot_number} · ${alertScenario.mes_card.sub_text}`]
      : ["MES 품질 이벤트 확인"],
    warnings: [],
    nextAction: "생성된 Case의 권역별 재고 영향을 분석합니다.",
    synthetic: true,
  },
  {
    id: "LIPI-FLOW-04",
    order: 4,
    group: "탐지·영향",
    title: "Case 영향 분석",
    shortTitle: "영향 분석",
    purpose: "현재고 대비 목표재고 비율을 계산해 부족 권역을 식별합니다.",
    description: "현재고 대비 목표재고 비율을 계산해 부족 권역을 식별합니다.",
    status: "완료",
    icon: "warning",
    ruleIds: [],
    dataAsOf: latestScenario?.date ?? "",
    evidence: dangerRegion
      ? [`${dangerRegion.region} 재고율 ${dangerRegion.stock_ratio}%`, `현재 ${dangerRegion.current_stock.toLocaleString("ko-KR")} / 목표 ${dangerRegion.target_stock.toLocaleString("ko-KR")} BOX`]
      : ["부족 권역 없음"],
    warnings: [],
    nextAction: "동일 Case 기준으로 S1~S3 대응안을 비교합니다.",
    synthetic: true,
  },
  {
    id: "LIPI-FLOW-05",
    order: 5,
    group: "분석·시뮬레이션",
    title: "S1~S3 시뮬레이션",
    shortTitle: "S1~S3 시뮬레이션",
    purpose: "권역 간 재고 이관과 타 생산라인 증산 대안을 생성해 비교합니다.",
    description: "권역 간 재고 이관과 타 생산라인 증산 대안을 생성해 비교합니다.",
    status: "완료",
    icon: "science",
    ruleIds: [],
    dataAsOf: latestScenario?.date ?? "",
    evidence: solutions?.map((solution) => solution.title) ?? [],
    warnings: [],
    nextAction: "각 대응안의 실행 조건과 제약을 검증합니다.",
    synthetic: true,
  },
  {
    id: "LIPI-FLOW-06",
    order: 6,
    group: "의사결정",
    title: "대응안 실행가능성 검증",
    shortTitle: "실행가능성 검증",
    purpose: "서울 가용재고, 제주 부족량, 운송 일정과 B라인 가용성을 기준으로 각 대응안의 실행 가능성을 검증합니다.",
    description: "서울 가용재고, 제주 부족량, 운송 일정과 B라인 가용성을 기준으로 각 대응안의 실행 가능성을 검증합니다.",
    status: "완료",
    icon: "recommend",
    ruleIds: [],
    dataAsOf: latestScenario?.date ?? "",
    evidence: selectedSolution
      ? ev(selectedSolution.summary ?? selectedSolution.title, `이관량 ${(selectedSolution.transfer_amount ?? 0).toLocaleString("ko-KR")} BOX`)
      : ["추천안 산출 대기"],
    warnings: [],
    nextAction: "검증을 통과한 최종 권고안과 근거를 확인합니다.",
    synthetic: true,
  },
  {
    id: "LIPI-FLOW-07",
    order: 7,
    group: "의사결정",
    title: "최종 권고안 선정·근거",
    shortTitle: "권고안 선정",
    purpose: "실행 가능한 후보 중 최종 권고안을 선정하고 추천 권역과 이관 수량의 판단 근거를 제공합니다.",
    description: "실행 가능한 후보 중 최종 권고안을 선정하고 추천 권역과 이관 수량의 판단 근거를 제공합니다.",
    status: "완료",
    icon: "psychology",
    ruleIds: [],
    dataAsOf: latestScenario?.date ?? "",
    evidence: ev(selectedSolution?.reason, selectedSolution?.xai_explanation),
    warnings: [],
    nextAction: "담당자 검토·승인",
    synthetic: true,
  },
  {
    id: "LIPI-FLOW-08",
    order: 8,
    group: "승인·실행",
    title: "담당자 검토·승인",
    shortTitle: "담당자 승인",
    purpose: "공급관리책임자가 AI 추천안과 예상 결과를 검토하고 최종 승인합니다.",
    description: "공급관리책임자가 AI 추천안과 예상 결과를 검토하고 최종 승인합니다.",
    status: "승인 필요",
    icon: "verified_user",
    ruleIds: [],
    dataAsOf: latestScenario?.date ?? "",
    evidence: ["Human-in-the-loop 승인 필요", "담당자 승인 전 실제 시스템 실행 없음"],
    warnings: [],
    nextAction: "승인된 이관안을 ERP·MES·WMS 실행지시로 변환합니다.",
    synthetic: true,
  },
  {
    id: "LIPI-FLOW-09",
    order: 9,
    group: "승인·실행",
    title: "실행지시 준비",
    shortTitle: "실행지시",
    purpose: "승인된 계획에 따라 공급 권역에서 부족 권역으로 재고를 이동합니다.",
    description: "승인된 계획에 따라 공급 권역에서 부족 권역으로 재고를 이동합니다.",
    status: "준비",
    icon: "local_shipping",
    ruleIds: [],
    dataAsOf: latestScenario?.date ?? "",
    evidence: selectedSolution
      ? ev(`${selectedSolution.from_region} → ${selectedSolution.to_region}`, `${(selectedSolution.transfer_amount ?? 0).toLocaleString("ko-KR")} BOX 이관`)
      : ["승인된 이관 계획 없음"],
    warnings: [],
    nextAction: "실행지시 전송 후 계획 KPI를 확인합니다.",
    synthetic: true,
  },
  {
    id: "LIPI-FLOW-10",
    order: 10,
    group: "승인·실행",
    title: "계획 KPI 확인",
    shortTitle: "계획 KPI",
    purpose: "S1 대비 재고 이관 실행안의 계획 KPI와 서울·제주 권역 개선 효과를 확인합니다.",
    description: "S1 대비 재고 이관 실행안의 계획 KPI와 서울·제주 권역 개선 효과를 확인합니다.",
    status: "잠금",
    icon: "monitoring",
    ruleIds: [],
    dataAsOf: latestScenario?.date ?? "",
    evidence: transferResult
      ? [`서울 ${transferResult.from_region.stock_ratio_after}%`, `제주 ${transferResult.to_region.stock_ratio_after}% · ${transferResult.to_region.status_after}`]
      : (logs?.slice(-2).map((log) => log.message) ?? []),
    warnings: [],
    nextAction: "실제 이관 실적 연계 후 계획 대비 편차를 확인합니다.",
    synthetic: true,
  },
];
