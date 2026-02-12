import { NextResponse } from 'next/server';
import { getAllTransactions, getAccountByName } from '@/lib/sheets';

// CRA T776 Rental Income Tax Form groupings
const T776_GROUPS = [
  { name: 'Gross Rental Income', categories: ['Income'], isIncome: true },
  { name: 'Property Taxes', categories: ['Property Tax'], isIncome: false },
  { name: 'Insurance', categories: ['Insurance'], isIncome: false },
  { name: 'Repairs & Maintenance', categories: ['Housing', 'Renovations', 'Maintenance'], isIncome: false },
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
    });
  } catch (error) {
    console.error('Error fetching rental property analytics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
