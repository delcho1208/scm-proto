import rawDashboard from "@/data/cefazolin-dashboard.json";

export type CefazolinWorkflowStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  status: "완료" | "준비" | "승인 필요" | "잠금";
  icon: string;
  evidence: string[];
};

const s1 = rawDashboard.scenarios.find((scenario) => scenario.id === "S1_무대응");
const s3 = rawDashboard.scenarios.find((scenario) => scenario.id === "S3_통합대응");
const syncedCount = rawDashboard.integration.filter((record) => record.status === "동기화 완료").length;
const emergencyQuantity = rawDashboard.procurement
  .filter((record) => record.scenarioId === "S3_통합대응" && record.receiptType === "긴급조달")
  .reduce((sum, record) => sum + record.totalReceiptQuantity, 0);

if (!s1 || !s3) throw new Error("세파졸린 AI 운영흐름에 필요한 S1·S3 데이터가 없습니다.");

export const cefazolinWorkflowSteps: CefazolinWorkflowStep[] = [
  {
    id: "FLOW-01",
    order: 1,
    title: "ERP·MES·WMS·수요 데이터 수집",
    description: "합성 원천 데이터와 권역별 월별 수요를 분석 입력으로 사용합니다.",
    status: "완료",
    icon: "database",
    evidence: [`시스템 연동 ${rawDashboard.integration.length}건`, `권역 월별 수요 ${rawDashboard.regionalMonthly.length}건`],
  },
  {
    id: "FLOW-02",
    order: 2,
    title: "데이터 통합·품질 처리",
    description: "시스템 키, 권역 키와 필수 수치의 완전성을 검사합니다.",
    status: "완료",
    icon: "account_tree",
    evidence: [`동기화 완료 ${syncedCount}/${rawDashboard.integration.length}건`, "전국 및 8개 권역 키 정규화"],
  },
  {
    id: "FLOW-03",
    order: 3,
    title: "분석 준비성 판단",
    description: "수요·시나리오·모델 검증 데이터가 분석 가능한 상태인지 확인합니다.",
    status: "완료",
    icon: "fact_check",
    evidence: [`S0~S3 ${rawDashboard.scenarios.length}개 시나리오`, `모델 학습 ${rawDashboard.modelValidation.trainingRows.toLocaleString("ko-KR")}행`],
  },
  {
    id: "FLOW-04",
    order: 4,
    title: "수요예측·XGBoost·SHAP 분석",
    description: "권역 수요와 사전 검증된 모델 결과로 공급 위험 요인을 설명합니다.",
    status: "완료",
    icon: "model_training",
    evidence: [`ROC-AUC ${rawDashboard.modelValidation.rocAuc.toFixed(3)}`, `F1 ${rawDashboard.modelValidation.f1.toFixed(3)}`],
  },
  {
    id: "FLOW-05",
    order: 5,
    title: "S0~S3 시뮬레이션",
    description: "서비스율, 미충족 수요, 부족 주차와 조달비를 동일 기준으로 비교합니다.",
    status: "완료",
    icon: "science",
    evidence: rawDashboard.scenarios.map((scenario) => `${scenario.id} · 서비스율 ${scenario.serviceRatePct.toFixed(2)}% · 부족 ${scenario.shortageWeeks}주`),
  },
  {
    id: "FLOW-06",
    order: 6,
    title: "S2·S3 대응안 비교·권고",
    description: "권역 재고 재배분과 원료 추가 발주를 비교해 S3 통합대응을 권고합니다.",
    status: "준비",
    icon: "recommend",
    evidence: [`S1 미충족 ${Math.round(s1.totalUnmetDemand).toLocaleString("ko-KR")} BOX`, `S3 미충족 ${Math.round(s3.totalUnmetDemand).toLocaleString("ko-KR")} BOX`],
  },
  {
    id: "FLOW-07",
    order: 7,
    title: "근거 기반 XAI",
    description: "시뮬레이션 결과와 SHAP 변수를 실행안의 판단 근거로 제공합니다.",
    status: "준비",
    icon: "psychology",
    evidence: rawDashboard.modelValidation.topFeatures.slice(0, 3).map((feature) => feature.label),
  },
  {
    id: "FLOW-08",
    order: 8,
    title: "담당자 검토·승인",
    description: "SCM 담당자가 실행안과 근거를 확인한 뒤 승인 또는 보류합니다.",
    status: "승인 필요",
    icon: "verified_user",
    evidence: ["Human-in-the-loop 승인 필요", "승인자·시각·검토 의견 기록"],
  },
  {
    id: "FLOW-09",
    order: 9,
    title: "가상 발주·생산·재고이동",
    description: "승인 이후 원료 발주와 권역 재배분을 가상으로 실행합니다.",
    status: "잠금",
    icon: "play_circle",
    evidence: [`긴급조달 ${Math.round(emergencyQuantity).toLocaleString("ko-KR")} BOX`, "승인 전 실제 시스템 전송 없음"],
  },
  {
    id: "FLOW-10",
    order: 10,
    title: "결과 피드백·모니터링",
    description: "실행 전후 KPI를 비교하고 다음 추천 주기에 반영합니다.",
    status: "잠금",
    icon: "monitoring",
    evidence: [`서비스율 ${s1.serviceRatePct.toFixed(2)}% → ${s3.serviceRatePct.toFixed(2)}%`, `부족 ${s1.shortageWeeks}주 → ${s3.shortageWeeks}주`],
  },
];
