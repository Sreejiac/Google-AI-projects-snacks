import { DailyTrialMetric } from '../types/business';

export interface TrialSummary {
  enteredDaysCount: number;
  totalDaysCount: number;
  totalEnquiries: number | null;
  totalSubmittedRequests: number | null;
  totalTeamAcceptedOrders: number | null;
  totalRepeatCustomers: number | null;
  avgOrderSizeRs: number | null;
  totalWastePieces: number | null;
  totalDeliveryCostRs: number | null;
  totalDirectProfitRs: number | null;
  totalShopProfitRs: number | null;
  profitPerAcceptedOrderRs: number | null;
  directVsShopDiffRs: number | null;
  totalWomenPaidHours: number | null;
  avgEarningsPerWomanRs: number | null;
  missingFieldsCount: number;
}

function sumNullable(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((acc, v) => acc + v, 0);
}

function avgNullable(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((acc, v) => acc + v, 0) / valid.length) * 10) / 10;
}

export function computeTrialSummary(days: DailyTrialMetric[]): TrialSummary {
  const numericFields: (keyof DailyTrialMetric)[] = [
    'enquiries',
    'submittedRequests',
    'teamAcceptedOrders',
    'repeatCustomers',
    'averageOrderSizeRs',
    'wasteUnsoldPieces',
    'deliveryCostRs',
    'directProfitRs',
    'shopProfitRs',
    'womenPaidHours',
    'estimatedEarningsPerWomanRs',
  ];

  let missingFieldsCount = 0;
  let enteredDaysCount = 0;

  for (const day of days) {
    let dayHasData = false;
    for (const field of numericFields) {
      if (day[field] === null) {
        missingFieldsCount += 1;
      } else {
        dayHasData = true;
      }
    }
    if (dayHasData) enteredDaysCount += 1;
  }

  const totalEnquiries = sumNullable(days.map((d) => d.enquiries));
  const totalSubmittedRequests = sumNullable(days.map((d) => d.submittedRequests));
  const totalTeamAcceptedOrders = sumNullable(days.map((d) => d.teamAcceptedOrders));
  const totalRepeatCustomers = sumNullable(days.map((d) => d.repeatCustomers));
  const avgOrderSizeRs = avgNullable(days.map((d) => d.averageOrderSizeRs));
  const totalWastePieces = sumNullable(days.map((d) => d.wasteUnsoldPieces));
  const totalDeliveryCostRs = sumNullable(days.map((d) => d.deliveryCostRs));
  const totalDirectProfitRs = sumNullable(days.map((d) => d.directProfitRs));
  const totalShopProfitRs = sumNullable(days.map((d) => d.shopProfitRs));
  const totalWomenPaidHours = sumNullable(days.map((d) => d.womenPaidHours));
  const avgEarningsPerWomanRs = avgNullable(days.map((d) => d.estimatedEarningsPerWomanRs));

  const profitPerAcceptedOrderRs =
    totalDirectProfitRs !== null && totalTeamAcceptedOrders !== null && totalTeamAcceptedOrders > 0
      ? Math.round((totalDirectProfitRs / totalTeamAcceptedOrders) * 10) / 10
      : null;

  const directVsShopDiffRs =
    totalDirectProfitRs !== null && totalShopProfitRs !== null
      ? totalDirectProfitRs - totalShopProfitRs
      : null;

  return {
    enteredDaysCount,
    totalDaysCount: days.length,
    totalEnquiries,
    totalSubmittedRequests,
    totalTeamAcceptedOrders,
    totalRepeatCustomers,
    avgOrderSizeRs,
    totalWastePieces,
    totalDeliveryCostRs,
    totalDirectProfitRs,
    totalShopProfitRs,
    profitPerAcceptedOrderRs,
    directVsShopDiffRs,
    totalWomenPaidHours,
    avgEarningsPerWomanRs,
    missingFieldsCount,
  };
}
