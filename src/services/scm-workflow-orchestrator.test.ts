import assert from "node:assert/strict";
import {
  createWorkflowRunState,
  selectRecommendedScenario,
  type ScenarioMetrics,
} from "./scm-workflow-orchestrator";

const scenarios: ScenarioMetrics[] = [
  {
    id: "S1_무대응",
    serviceRatePct: 95,
    totalUnmetDemand: 284_355,
    shortageWeeks: 20,
    minimumRegionalServiceRatePct: 60.7,
    emergencyProcurementQuantity: 0,
    totalProcurementCostKrw: 37_330_308_121,
  },
  {
    id: "S2_내부대응",
    serviceRatePct: 95.08,
    totalUnmetDemand: 279_707,
    shortageWeeks: 20,
    minimumRegionalServiceRatePct: 65,
    emergencyProcurementQuantity: 0,
    totalProcurementCostKrw: 37_330_308_121,
  },
  {
    id: "S3_통합대응",
    serviceRatePct: 100,
    totalUnmetDemand: 0,
    shortageWeeks: 0,
    minimumRegionalServiceRatePct: 100,
    emergencyProcurementQuantity: 414_079,
    totalProcurementCostKrw: 40_944_607_795,
  },
];

const recommendation = selectRecommendedScenario(scenarios);
assert.equal(recommendation.recommendedScenarioId, "S3_통합대응");
assert.equal(recommendation.excludedScenarios.length, 2);

const baseInput = {
  runId: "SCM-CEFA-20250929-001",
  scenarios,
  dataReady: true,
  qualityProcessed: true,
  analysisAvailable: true,
  modelValidated: true,
  simulationReady: true,
  lastUpdatedAt: "2025-09-29",
} as const;

const pending = createWorkflowRunState({
  ...baseInput,
  hitlStatus: "pending",
  executionStatus: "locked",
});
assert.deepEqual(pending.completedSteps, [1, 2, 3, 4, 5, 6, 7]);
assert.equal(pending.currentStep, 8);
assert.equal(pending.stepStatuses[8], "approval_pending");
assert.equal(pending.stepStatuses[9], "locked");

const approved = createWorkflowRunState({
  ...baseInput,
  hitlStatus: "approved",
  executionStatus: "ready",
});
assert.equal(approved.currentStep, 9);
assert.equal(approved.stepStatuses[9], "available");
assert.equal(approved.stepStatuses[10], "locked");

const executed = createWorkflowRunState({
  ...baseInput,
  hitlStatus: "approved",
  executionStatus: "executed",
});
assert.equal(executed.currentStep, 10);
assert.equal(executed.stepStatuses[9], "executed");
assert.equal(executed.stepStatuses[10], "available");
assert.deepEqual(executed.completedSteps, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
assert.equal(executed.feedbackStatus, "ready");

const kpiConfirmed = createWorkflowRunState({
  ...baseInput,
  hitlStatus: "approved",
  executionStatus: "executed",
  kpiConfirmed: true,
});
assert.equal(kpiConfirmed.stepStatuses[10], "verified");
assert.deepEqual(kpiConfirmed.completedSteps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

console.log("SCM workflow orchestrator tests passed");
