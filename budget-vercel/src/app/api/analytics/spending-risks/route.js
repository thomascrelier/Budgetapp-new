import { NextResponse } from 'next/server';
import { getAllTransactions } from '@/lib/sheets';

// Categories that represent money movement, not actual spending
const NON_SPENDING_CATEGORIES = [
  'Transfer',
  'Transfers & Payments',
  'Investments',
  'Income',
  'Rental Income',
];

// Number of prior months to use for average calculation
const AVG_WINDOW = 3;
// Number of months of history to return for sparklines (including current)
const HISTORY_WINDOW = 5;
// Maximum number of risk items to return
const MAX_RISKS = 6;
// Minimum current-month spend to consider (avoid noise)
const MIN_SPEND = 20;
// Minimum months of history required to compute a meaningful average
const MIN_HISTORY_MONTHS = 3;

function getMonthStr(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Generate an array of YYYY-MM strings going back `count` months from `now`.
 * Index 0 = oldest, last index = most recent.
 */
function getMonthRange(now, count) {
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    let year = now.getFullYear();
    let month = now.getMonth() + 1 - i;
    while (month <= 0) {
      month += 12;
      year -= 1;
    }
    months.push(getMonthStr(year, month));
  }
  return months;
}

function getRiskLevel(deltaPct) {
  if (deltaPct <= 10) return 'normal';
  if (deltaPct <= 50) return 'elevated';
  if (deltaPct <= 100) return 'high';
  return 'critical';
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountIdsParam = searchParams.get('account_ids');
    const accountIds = accountIdsParam
      ? accountIdsParam.split(',').map(Number)
      : null;

    let transactions = await getAllTransactions();

    // Filter by account if specified
    if (accountIds) {
      transactions = transactions.filter(t => accountIds.includes(t.account_id));
    }

    const now = new Date();
    const currentMonth = getMonthStr(now.getFullYear(), now.getMonth() + 1);

    // We need: current month + 3 prior (for avg) + extra for sparkline history
    // Sparkline shows last 5 months total, avg uses 3 prior months
    // So we need max(HISTORY_WINDOW, AVG_WINDOW + 1) months
    const totalMonthsNeeded = Math.max(HISTORY_WINDOW, AVG_WINDOW + 1);
    const allMonths = getMonthRange(now, totalMonthsNeeded);
    const avgMonths = allMonths.slice(-AVG_WINDOW - 1, -1); // 3 months before current

    // Filter transactions to the months we care about
    const monthSet = new Set(allMonths);
    const relevantTransactions = transactions.filter(
      t => monthSet.has(t.date.substring(0, 7)) && !NON_SPENDING_CATEGORIES.includes(t.category)
    );

    // Group by category x month, summing only negative amounts (expenses)
    // We store as positive numbers for display (absolute value of expenses)
    const categoryMonthMap = {}; // { category: { 'YYYY-MM': totalSpend } }

    for (const t of relevantTransactions) {
      if (t.amount >= 0) continue; // only expenses (negative amounts)

      const month = t.date.substring(0, 7);
      const cat = t.category || 'Uncategorized';

      if (!categoryMonthMap[cat]) {
        categoryMonthMap[cat] = {};
      }
      if (!categoryMonthMap[cat][month]) {
        categoryMonthMap[cat][month] = 0;
      }
      categoryMonthMap[cat][month] += Math.abs(t.amount);
    }

    const risks = [];
    let onTrackCount = 0;
    let totalCategories = 0;

    for (const [category, monthData] of Object.entries(categoryMonthMap)) {
      const currentSpend = monthData[currentMonth] || 0;

      // Only count categories that have spending this month
      if (currentSpend <= 0) continue;
      totalCategories++;

      // Calculate how many of the avg window months have data
      const monthsWithData = avgMonths.filter(m => (monthData[m] || 0) > 0).length;

      // Skip categories without enough history
      if (monthsWithData < MIN_HISTORY_MONTHS) continue;

      // Calculate 3-month rolling average from the prior months
      const avgSpend =
        avgMonths.reduce((sum, m) => sum + (monthData[m] || 0), 0) / AVG_WINDOW;

      // Avoid division by zero
      if (avgSpend <= 0) continue;

      const deltaDollars = currentSpend - avgSpend;
      const deltaPct = Math.round((deltaDollars / avgSpend) * 100);
      const level = getRiskLevel(deltaPct);

      // Skip low-spend categories
      if (currentSpend < MIN_SPEND) {
        if (level === 'normal' || deltaPct <= 10) onTrackCount++;
        continue;
      }

      // Build monthly history for sparklines (all months in the window)
      const monthlyHistory = allMonths.map(m => Math.round(monthData[m] || 0));

      if (level === 'normal' || deltaPct <= 10) {
        onTrackCount++;
        continue;
      }

      risks.push({
        category,
        current_spend: Math.round(currentSpend),
        avg_spend: Math.round(avgSpend),
        months_of_data: monthsWithData + (currentSpend > 0 ? 1 : 0), // include current month
        delta_dollars: Math.round(deltaDollars),
        delta_percent: deltaPct,
        level,
        monthly_history: monthlyHistory,
      });
    }

    // Sort by delta_percent descending, take top N
    risks.sort((a, b) => b.delta_percent - a.delta_percent);
    const topRisks = risks.slice(0, MAX_RISKS);

    return NextResponse.json({
      current_month: currentMonth,
      risks: topRisks,
      on_track_count: onTrackCount,
      total_categories: totalCategories,
    });
  } catch (error) {
    console.error('Error fetching spending risks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
