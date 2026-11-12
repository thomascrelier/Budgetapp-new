import { NextResponse } from 'next/server';
import { getAccounts, getAllTransactions, getSettings } from '@/lib/sheets';
import { rentalAccount } from '@/lib/scope';
import { classify } from '@/lib/classify';
import { currentMonth, monthOf } from '@/lib/dates';
import { round2 } from '@/lib/analytics';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EMPTY_SUMMARY = { total_income: 0, total_expenses: 0, net_income: 0 };

// Income = 'income'; expenses = 'expense' minus 'refund'; transfers and investments ignored.
function flows(t) {
  const kind = classify(t);
  if (kind === 'income') return { income: t.amount, expense: 0 };
  if (kind === 'expense' || kind === 'refund') return { income: 0, expense: -t.amount };
  return null;
}

function annualSummary(txns) {
  let income = 0;
  let expenses = 0;
  for (const t of txns) {
    const f = flows(t);
    if (!f) continue;
    income += f.income;
    expenses += f.expense;
  }
  return { total_income: round2(income), total_expenses: round2(expenses), net_income: round2(income - expenses) };
}

function monthlyData(year, txns) {
  return MONTH_NAMES.map((name, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    const s = annualSummary(txns.filter((t) => monthOf(t.date) === month));
    return { month, month_name: name, income: s.total_income, expenses: s.total_expenses, net: s.net_income };
  });
}

function categoryTotals(txns) {
  const out = {};
  for (const t of txns) {
    const f = flows(t);
    if (!f) continue;
    const c = t.category || 'Uncategorized';
    const e = (out[c] ||= { total: 0, count: 0, is_income: false });
    e.total += f.income - f.expense;
    e.count += 1;
    if (f.income) e.is_income = true;
  }
  return out;
}

function calcDelta(current, previous) {
  return {
    dollars: round2(current - previous),
    percent: previous !== 0 ? round2(((current - previous) / previous) * 100) : null,
  };
}

function categoryBreakdown(sel, prev, monthsElapsed) {
  const cats = new Set([...Object.keys(sel), ...Object.keys(prev)]);
  const rows = [...cats].map((category) => {
    const s = sel[category] || { total: 0, count: 0, is_income: false };
    const p = prev[category] || { total: 0, count: 0, is_income: false };
    const selAbs = Math.abs(s.total);
    const prevAbs = Math.abs(p.total);
    const d = calcDelta(selAbs, prevAbs);
    return {
      category,
      selected_year_total: round2(selAbs),
      prev_year_total: round2(prevAbs),
      monthly_avg: round2(selAbs / monthsElapsed),
      transaction_count: s.count,
      delta_dollars: d.dollars,
      delta_percent: d.percent,
      is_income: s.is_income || p.is_income,
    };
  });
  rows.sort((a, b) => b.selected_year_total - a.selected_year_total);
  return rows;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const thisMonth = currentMonth();
    const thisYear = parseInt(thisMonth.slice(0, 4), 10);
    const year = parseInt(searchParams.get('year'), 10) || thisYear;
    const prevYear = year - 1;

    const [accounts, settings] = await Promise.all([getAccounts(true), getSettings()]);
    const rental = rentalAccount(accounts, settings);
    if (!rental) {
      return NextResponse.json({
        error: 'Rental account not found',
        year,
        prev_year: prevYear,
        annual_summary: EMPTY_SUMMARY,
        prev_annual_summary: EMPTY_SUMMARY,
        monthly_data: [],
        prev_monthly_data: [],
        category_breakdown: [],
      });
    }

    const rentalTxns = (await getAllTransactions()).filter((t) => t.account_id === rental.id);
    const selected = rentalTxns.filter((t) => String(t.date).startsWith(`${year}-`));
    const previous = rentalTxns.filter((t) => String(t.date).startsWith(`${prevYear}-`));
    // Months elapsed in the current year (Toronto calendar); full years use 12.
    const monthsElapsed = year === thisYear ? parseInt(thisMonth.slice(5, 7), 10) : 12;

    return NextResponse.json({
      year,
      prev_year: prevYear,
      annual_summary: annualSummary(selected),
      prev_annual_summary: annualSummary(previous),
      monthly_data: monthlyData(year, selected),
      prev_monthly_data: monthlyData(prevYear, previous),
      category_breakdown: categoryBreakdown(categoryTotals(selected), categoryTotals(previous), monthsElapsed),
    });
  } catch (error) {
    console.error('Error fetching rental property analytics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
