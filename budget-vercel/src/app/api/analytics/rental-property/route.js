import { NextResponse } from 'next/server';
import { getAllTransactions, getAccountByName } from '@/lib/sheets';

// CRA T776 Rental Income Tax Form groupings
// Tenant utility tracking constants
const BRANDON_BASE_RENT = 2050;
const MADISON_MAX_UTILITY = 500; // Madison pays rent via Chexy; direct e-transfers over this are rent, not utilities

const T776_GROUPS = [
  { name: 'Gross Rental Income', categories: ['Rental Income'], isIncome: true },
  { name: 'Mortgage', categories: ['Mortgage'], isIncome: false },
  { name: 'Property Taxes', categories: ['Property Tax'], isIncome: false },
  { name: 'Insurance', categories: ['Insurance'], isIncome: false },
  { name: 'Repairs & Maintenance', categories: ['Repairs & Maintenance', 'Renovations'], isIncome: false },
  { name: 'Utilities', categories: ['Electricity', 'Gas', 'Water', 'Internet'], isIncome: false },
  { name: 'Management & Admin', categories: ['Fees & Charges'], isIncome: false },
  { name: 'Other Expenses', categories: ['Income Tax', 'Transfers & Payments', 'Other', 'Uncategorized'], isIncome: false },
];

function computeCategoryTotals(txns) {
  const result = {};
  for (const t of txns) {
    const cat = t.category || 'Uncategorized';
    if (!result[cat]) {
      result[cat] = { total: 0, transaction_count: 0 };
    }
    result[cat].total += t.amount;
    result[cat].transaction_count += 1;
  }
  return result;
}

function computeAnnualSummary(txns) {
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const t of txns) {
    if (t.amount > 0) totalIncome += t.amount;
    else totalExpenses += Math.abs(t.amount);
  }
  return {
    total_income: Math.round(totalIncome * 100) / 100,
    total_expenses: Math.round(totalExpenses * 100) / 100,
    net_income: Math.round((totalIncome - totalExpenses) * 100) / 100,
  };
}

function buildMonthlyData(year, txns) {
  const monthly = [];
  for (let month = 1; month <= 12; month++) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const monthTxns = txns.filter(t => t.date.startsWith(monthStr));

    let income = 0;
    let expenses = 0;
    for (const t of monthTxns) {
      if (t.amount > 0) income += t.amount;
      else expenses += Math.abs(t.amount);
    }

    monthly.push({
      month: monthStr,
      month_name: new Date(year, month - 1).toLocaleString('en-US', { month: 'short' }),
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      net: Math.round((income - expenses) * 100) / 100,
    });
  }
  return monthly;
}

function buildCategoryToGroupMap(allCategories) {
  const map = {};
  const knownCategories = new Set();

  for (const group of T776_GROUPS) {
    for (const cat of group.categories) {
      map[cat] = group.name;
      knownCategories.add(cat);
    }
  }

  // Any category not in a T776 group goes to "Other Expenses"
  for (const cat of allCategories) {
    if (!knownCategories.has(cat)) {
      map[cat] = 'Other Expenses';
    }
  }

  return map;
}

function calcDelta(current, previous) {
  const dollars = Math.round((current - previous) * 100) / 100;
  const percent = previous !== 0
    ? Math.round(((current - previous) / previous) * 10000) / 100
    : null;
  return { dollars, percent };
}

function buildT776Summary(selectedTotals, prevTotals, allCategories) {
  const categoryToGroup = buildCategoryToGroupMap(allCategories);
  const summary = [];

  for (const group of T776_GROUPS) {
    // Find all categories that map to this group and exist in data
    const relevantCategories = [...allCategories].filter(
      cat => categoryToGroup[cat] === group.name
    );

    let selectedTotal = 0;
    let prevTotal = 0;
    const children = [];

    for (const cat of relevantCategories) {
      const sel = selectedTotals[cat];
      const prev = prevTotals[cat];

      let selAmount, prevAmount;
      if (group.isIncome) {
        selAmount = sel ? sel.total : 0;
        prevAmount = prev ? prev.total : 0;
      } else {
        selAmount = sel ? Math.abs(sel.total) : 0;
        prevAmount = prev ? Math.abs(prev.total) : 0;
      }

      selectedTotal += selAmount;
      prevTotal += prevAmount;

      const delta = calcDelta(selAmount, prevAmount);
      children.push({
        category: cat,
        selected_year_total: Math.round(selAmount * 100) / 100,
        prev_year_total: Math.round(prevAmount * 100) / 100,
        delta_dollars: delta.dollars,
        delta_percent: delta.percent,
        transaction_count: sel ? sel.transaction_count : 0,
      });
    }

    // Only include groups that have data in either year
    if (selectedTotal === 0 && prevTotal === 0) continue;

    const delta = calcDelta(selectedTotal, prevTotal);
    summary.push({
      group_name: group.name,
      is_income: group.isIncome,
      selected_year_total: Math.round(selectedTotal * 100) / 100,
      prev_year_total: Math.round(prevTotal * 100) / 100,
      delta_dollars: delta.dollars,
      delta_percent: delta.percent,
      children: children.filter(c => c.selected_year_total > 0 || c.prev_year_total > 0),
    });
  }

  return summary;
}

function buildCategoryBreakdown(selectedTotals, prevTotals, allCategories) {
  const breakdown = [];

  for (const cat of allCategories) {
    const sel = selectedTotals[cat] || { total: 0, transaction_count: 0 };
    const prev = prevTotals[cat] || { total: 0, transaction_count: 0 };

    const isIncome = sel.total > 0 || prev.total > 0;
    const selAbs = Math.abs(sel.total);
    const prevAbs = Math.abs(prev.total);
    const delta = calcDelta(selAbs, prevAbs);

    breakdown.push({
      category: cat,
      selected_year_total: Math.round(selAbs * 100) / 100,
      prev_year_total: Math.round(prevAbs * 100) / 100,
      monthly_avg: Math.round((selAbs / 12) * 100) / 100,
      transaction_count: sel.transaction_count,
      delta_dollars: delta.dollars,
      delta_percent: delta.percent,
      is_income: isIncome,
    });
  }

  breakdown.sort((a, b) => b.selected_year_total - a.selected_year_total);
  return breakdown;
}

function buildUtilityTracker(allRentalTxns, year) {
  const UTILITY_CATEGORIES = ['Electricity', 'Gas', 'Water'];

  // Collect utility bills by month and tenant payments by month
  // We need data from the year AND the first month of next year (for the last month's matching)
  const utilityByMonth = {};
  const paymentsByMonth = {};

  for (const tx of allRentalTxns) {
    const month = tx.date.substring(0, 7); // YYYY-MM

    // Utility expenses (negative amounts)
    if (UTILITY_CATEGORIES.includes(tx.category) && tx.amount < 0) {
      if (!utilityByMonth[month]) utilityByMonth[month] = { electricity: 0, gas: 0, water: 0 };
      const cat = tx.category.toLowerCase();
      utilityByMonth[month][cat] += Math.abs(tx.amount);
    }

    // Rental income - identify Brandon and Madison
    if (tx.category === 'Rental Income' && tx.amount > 0) {
      if (!paymentsByMonth[month]) paymentsByMonth[month] = { brandon: 0, madison: 0 };
      const desc = tx.description.toLowerCase();
      if (desc.includes('brandon')) {
        // Brandon's utility contribution = amount over base rent
        const contribution = Math.max(0, tx.amount - BRANDON_BASE_RENT);
        paymentsByMonth[month].brandon += contribution;
      } else if (desc.includes('madison')) {
        // Only count small e-transfers as utility contributions;
        // large amounts (e.g. $2,450) are rent payments, not utilities
        if (tx.amount <= MADISON_MAX_UTILITY) {
          paymentsByMonth[month].madison += tx.amount;
        }
      }
    }
  }

  // Build tracker rows: only months in the selected year that have utility bills
  const months = Object.keys(utilityByMonth)
    .filter(m => m.startsWith(String(year)))
    .sort();

  let runningBalance = 0;
  const tracker = [];

  for (const month of months) {
    const u = utilityByMonth[month];
    const totalBilled = Math.round((u.electricity + u.gas + u.water) * 100) / 100;

    // Tenants pay same month as the bill arrives (0 offset).
    // Elec+gas is recovered same month; water (quarterly) recovery is bundled
    // into the next month's rent, so the running balance dips on water months
    // and recovers the following month — this is expected behaviour.
    const payments = paymentsByMonth[month] || { brandon: 0, madison: 0 };
    const totalCollected = Math.round((payments.brandon + payments.madison) * 100) / 100;
    const delta = Math.round((totalCollected - totalBilled) * 100) / 100;
    runningBalance = Math.round((runningBalance + delta) * 100) / 100;

    // Pending if no payments received yet
    const pending = totalCollected === 0 && totalBilled > 0;

    const [y, m] = month.split('-').map(Number);
    const monthDate = new Date(y, m - 1);
    const monthLabel = monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });

    tracker.push({
      month,
      month_label: monthLabel,
      electricity: Math.round(u.electricity * 100) / 100,
      gas: Math.round(u.gas * 100) / 100,
      water: Math.round(u.water * 100) / 100,
      total_billed: totalBilled,
      brandon_contribution: Math.round(payments.brandon * 100) / 100,
      madison_contribution: Math.round(payments.madison * 100) / 100,
      total_collected: totalCollected,
      delta,
      running_balance: runningBalance,
      pending,
    });
  }

  return tracker;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year')) || new Date().getFullYear();
    const prevYear = year - 1;

    // Get CIBC Rental account
    const rentalAccount = await getAccountByName('CIBC Rental');
    if (!rentalAccount) {
      return NextResponse.json({
        error: 'CIBC Rental account not found',
        year,
        prev_year: prevYear,
        annual_summary: { total_income: 0, total_expenses: 0, net_income: 0 },
        prev_annual_summary: { total_income: 0, total_expenses: 0, net_income: 0 },
        t776_summary: [],
        monthly_data: [],
        prev_monthly_data: [],
        category_breakdown: [],
        t776_pie_data: [],
        utility_tracker: [],
      });
    }

    const transactions = await getAllTransactions();
    const allRentalTxns = transactions.filter(t => t.account_id === rentalAccount.id);
    const selectedYearTxns = allRentalTxns.filter(t => t.date.startsWith(String(year)));
    const prevYearTxns = allRentalTxns.filter(t => t.date.startsWith(String(prevYear)));

    // Discover all categories across both years
    const allCategories = new Set();
    for (const t of [...selectedYearTxns, ...prevYearTxns]) {
      allCategories.add(t.category || 'Uncategorized');
    }

    // Compute totals
    const selectedTotals = computeCategoryTotals(selectedYearTxns);
    const prevTotals = computeCategoryTotals(prevYearTxns);

    // Build all data
    const t776Summary = buildT776Summary(selectedTotals, prevTotals, allCategories);

    return NextResponse.json({
      year,
      prev_year: prevYear,
      annual_summary: computeAnnualSummary(selectedYearTxns),
      prev_annual_summary: computeAnnualSummary(prevYearTxns),
      t776_summary: t776Summary,
      monthly_data: buildMonthlyData(year, selectedYearTxns),
      prev_monthly_data: buildMonthlyData(prevYear, prevYearTxns),
      category_breakdown: buildCategoryBreakdown(selectedTotals, prevTotals, allCategories),
      t776_pie_data: t776Summary
        .filter(g => !g.is_income && g.selected_year_total > 0)
        .map(g => ({ name: g.group_name, value: g.selected_year_total })),
      utility_tracker: buildUtilityTracker(allRentalTxns, year),
    });
  } catch (error) {
    console.error('Error fetching rental property analytics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
