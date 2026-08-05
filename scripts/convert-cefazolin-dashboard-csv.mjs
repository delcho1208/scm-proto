import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(projectRoot, "data", "cefazolin-dashboard-csv");
const outputPath = path.join(projectRoot, "src", "data", "cefazolin-dashboard.json");

const sourceFiles = {
  overview: "01_dashboard_overview.csv",
  regions: "02_dashboard_regions.csv",
  scenarios: "03_dashboard_scenarios.csv",
  monthlyFlow: "04_dashboard_monthly_flow.csv",
  regionalMonthly: "08_dashboard_region_monthly.csv",
  integration: "05_dashboard_integration.csv",
  procurement: "06_dashboard_procurement.csv",
  modelValidation: "07_dashboard_model_validation.csv",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  if (!headers) return [];
  return dataRows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

async function readCsv(filename) {
  const text = await readFile(path.join(sourceDir, filename), "utf8");
  return parseCsv(text.replace(/^\uFEFF/, ""));
}

function number(value) {
  if (value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid number: ${value}`);
  return parsed;
}

const [
  overviewRows,
  regionRows,
  scenarioRows,
  monthlyRows,
  regionalMonthlyRows,
  integrationRows,
  procurementRows,
  validationRows,
] = await Promise.all(Object.values(sourceFiles).map(readCsv));

if (overviewRows.length !== 1 || validationRows.length !== 1) {
  throw new Error("Expected exactly one overview row and one model-validation row");
}

const overview = overviewRows[0];
const validation = validationRows[0];

const dashboard = {
  schemaVersion: 1,
  source: {
    package: "cefazolin_lovable_dashboard_csv_package (1).zip",
    packageSha256: "5aad3c253ec9663c2d613e87028af471c97663e02f292e9a5edef92e457b8830",
    csvFiles: Object.values(sourceFiles),
    supplementalWorkbook: {
      name: "세파졸린_SCM_목표재고3단계_SHAP_검증완료_최종데이터.xlsx",
      sha256: "65AD23E2CF8F21008F0AD1093953F26DEBE626FE930414E1148DBDCA9D0A6D6B",
      sheets: ["01_권역계획", "02_ERP_원료공급", "04_MES_생산품질", "05_WMS_재고"],
    },
    supplementalNotebook: {
      name: "세파졸린_SCM_목표재고3단계_SHAP_Colab_최종.ipynb",
      sha256: "F27DF0D16A294BC0DDCC62413C0F59B75086CBB3AF2240B587151C28B6CD6894",
      executed: false,
    },
  },
  product: overview["제품명"],
  overview: {
    baselineScenario: overview["기준시나리오"],
    annualForecastDemand: number(overview["연간예측수요량"]),
    nationalCurrentStock: number(overview["전국현재고량"]),
    nationalSafetyStock: number(overview["전국안전재고량"]),
    nationalTargetStock: number(overview["전국목표재고량"]),
    nationalTargetStockCoveragePct: number(overview["전국목표재고충족률(%)"]),
    nationalInventoryStatus: overview["전국현재재고상태"],
    regionCounts: {
      shortage: number(overview["부족권역수"]),
      adequate: number(overview["적정권역수"]),
      excess: number(overview["과잉권역수"]),
    },
    excessTransferableQuantity: number(overview["과잉운송가능량"]),
    averageUtilizationPct: number(overview["평균가동률(%)"]),
    integratedResponse: {
      serviceRatePct: number(overview["S3서비스율(%)"]),
      unmetDemand: number(overview["S3미충족수요량"]),
      unmetDemandRatePct: number(overview["S3미충족수요율(%)"]),
      serviceRateImprovementVsS1PctPoints: number(overview["S1대비서비스율개선폭(%p)"]),
      unmetDemandReductionVsS1Pct: number(overview["S1대비미충족수요감소율(%)"]),
      emergencyProcurementQuantity: number(overview["S3긴급조달입고량"]),
      totalProcurementCostKrw: number(overview["S3총조달비용(원)"]),
    },
    policyRisk: {
      score: number(overview["정책형리스크지수"]),
      grade: overview["정책형리스크등급"],
    },
  },
  regions: regionRows.map((region) => ({
    id: region["권역ID"],
    code: region["권역코드"],
    name: region["권역명"],
    annualForecastDemand: number(region["연간예측수요량"]),
    currentStock: number(region["현재고량"]),
    safetyStock: number(region["안전재고량"]),
    targetStock: number(region["목표재고량"]),
    targetStockCoveragePct: number(region["목표재고충족률(%)"]),
    inventoryStatus: region["현재재고상태"],
    stockStatusCode: region["재고상태코드"],
    transferableQuantity: number(region["운송가능량"]),
    averageLeadTimeHours: number(region["평균리드타임(시간)"]),
    policyRisk: {
      asOf: region["정책형리스크기준일자"],
      score: number(region["정책형리스크지수"]),
      grade: region["정책형리스크등급"],
      causes: [1, 2, 3, 4].map((index) => ({
        label: region[`주요원인${index}`],
        score: number(region[`주요원인${index}점수`]),
      })),
    },
    recommendations: [region["AI추천1"], region["AI추천2"]].filter(Boolean),
  })),
  scenarios: scenarioRows.map((scenario) => ({
    id: scenario["시나리오ID"],
    serviceRatePct: number(scenario["서비스율(%)"]),
    unmetDemandRatePct: number(scenario["미충족수요율(%)"]),
    totalUnmetDemand: number(scenario["총미충족수요량"]),
    shortageWeeks: number(scenario["부족발생주수"]),
    firstShortageWeek: scenario["최초부족주차"] || null,
    maxWeeklyShortage: number(scenario["최대주간부족량"]),
    minimumRegionalServiceRatePct: number(scenario["최저권역서비스율(%)"]),
    emergencyProcurementQuantity: number(scenario["긴급조달입고량"]),
    totalProcurementCostKrw: number(scenario["총조달비용(원)"]),
  })),
  monthlyFlow: monthlyRows.map((month) => ({
    month: month["기준월"],
    scenarioId: month["시나리오ID"],
    forecastDemand: number(month["예측수요량"]),
    approvedShipment: number(month["출하승인량"]),
    availableProduction: number(month["가용생산량"]),
    regionalShipment: number(month["권역출하량"]),
    emergencyProcurementOrder: number(month["긴급조달발주량"]),
    unmetDemand: number(month["미충족수요량"]),
    serviceRatePct: number(month["서비스율(%)"]),
    averageSupplyFulfillmentPct: number(month["S1평균공급이행률(%)"]),
    endingRawMaterialInventory: number(month["월말원료재고량"]),
    endingCentralInventory: number(month["월말중앙재고량"]),
    maxActiveEvents: number(month["최대활성이벤트수"]),
    operatingPhase: month["운영단계"],
  })),
  regionalMonthly: regionalMonthlyRows.map((month) => ({
    month: month["기준월"],
    regionId: month["권역ID"],
    regionCode: month["권역코드"],
    regionName: month["권역명"],
    forecastDemand: number(month["월예측수요량"]),
    safetyStock: number(month["월안전재고량"]),
    targetStock: number(month["월목표재고량"]),
    averageLeadTimeHours: number(month["평균리드타임(시간)"]),
    unit: month["수량단위"],
    dataType: month["데이터구분"],
  })),
  integration: integrationRows.map((record) => ({
    regionId: record["권역ID"],
    regionCode: record["권역코드"],
    regionName: record["권역명"],
    system: record["시스템"],
    documentNumber: record["문서번호"],
    quantity: number(record["수량"]),
    unit: record["수량단위"],
    status: record["연동상태"],
    dataType: record["데이터구분"],
    calculationBasis: record["산출기준"],
    updatedAt: record["최근동기화"],
    note: record["비고"],
  })),
  procurement: procurementRows.map((record) => ({
    scenarioId: record["시나리오ID"],
    supplierId: record["공급사ID"],
    receiptType: record["입고구분"],
    receiptCount: number(record["입고횟수"]),
    totalReceiptQuantity: number(record["총입고량"]),
    totalProcurementCostKrw: number(record["총조달비용(원)"]),
    firstReceiptWeek: record["최초입고주차"],
    lastReceiptWeek: record["최종입고주차"],
  })),
  modelValidation: {
    model: validation["모델명"],
    trainingRows: number(validation["학습데이터행수"]),
    simulationRuns: number(validation["시뮬레이션실행수"]),
    classificationThreshold: number(validation["분류임계값"]),
    rocAuc: number(validation["ROC_AUC"]),
    prAuc: number(validation["PR_AUC"]),
    f1: number(validation["F1"]),
    precision: number(validation["Precision"]),
    recall: number(validation["Recall"]),
    topFeatures: [1, 2, 3].map((index) => ({
      label: validation[`중요변수${index}`],
      meanAbsShap: number(validation[`중요변수${index}평균절대SHAP`]),
    })),
  },
};

await writeFile(outputPath, `${JSON.stringify(dashboard, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(projectRoot, outputPath)}`);
