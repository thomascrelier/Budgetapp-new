import { NextResponse } from 'next/server';
import { createTransactions, getAllTransactions, getAccountById } from '@/lib/sheets';
import Papa from 'papaparse';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const accountId = parseInt(formData.get('account_id'));

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!accountId) {
      return NextResponse.json({ error: 'No account_id provided' }, { status: 400 });
    }

    // Verify account exists
    const account = await getAccountById(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Read file content
    const text = await file.text();

    // Parse CSV
    const { data: rows, errors } = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
    });

    if (errors.length > 0) {
      return NextResponse.json({
        error: 'CSV parsing errors',
        details: errors
      }, { status: 400 });
    }

    // Get existing transactions for duplicate detection
    const existingTransactions = await getAllTransactions();
    const existingKeys = new Set(
      existingTransactions.map(t => `${t.account_id}-${t.date}-${t.description}-${t.amount}`)
    );

    // Generate batch ID
    const batchId = `batch_${Date.now()}`;

    // Process rows
    const transactions = [];
    let skippedDuplicates = 0;

    for (const row of rows) {
      // Try to find date, description, amount in various column names
      const date = row.date || row.transaction_date || row['transaction date'] || '';
      const description = row.description || row.memo || row.details || row.name || '';
      let amount = row.amount || row.value || '0';

      // Handle debit/credit columns
      if (row.debit && row.credit) {
        const debit = parseFloat(row.debit) || 0;
        const credit = parseFloat(row.credit) || 0;
        amount = credit - debit;
      } else {
        // Clean and parse amount
        amount = String(amount).replace(/[$,]/g, '');
        amount = parseFloat(amount) || 0;
      }

      // Skip invalid rows
      if (!date || !description) continue;

      // Normalize date format (support various formats)
      let normalizedDate = date;
      if (date.includes('/')) {
        const parts = date.split('/');
        if (parts.length === 3) {
          // MM/DD/YYYY or DD/MM/YYYY
          const [a, b, c] = parts;
          if (c.length === 4) {
            // Assume MM/DD/YYYY
            normalizedDate = `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
          } else if (a.length === 4) {
            // YYYY/MM/DD
            normalizedDate = `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
          }
        }
      }

      // Check for duplicate
      const key = `${accountId}-${normalizedDate}-${description}-${amount}`;
      if (existingKeys.has(key)) {
        skippedDuplicates++;
        continue;
      }

      // Determine category based on description
      const category = categorizeTransaction(description);

      transactions.push({
        account_id: accountId,
        date: normalizedDate,
        description: description.trim(),
        amount,
        category,
        is_verified: false,
        import_batch_id: batchId,
      });

      // Add to existing keys to prevent duplicates within same upload
      existingKeys.add(key);
    }

    // Save transactions
    const created = await createTransactions(transactions);

    return NextResponse.json({
      success: true,
      created,
      skipped_duplicates: skippedDuplicates,
      batch_id: batchId,
    });
  } catch (error) {
    console.error('Error uploading CSV:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Simple categorization based on keywords
function categorizeTransaction(description) {
  const desc = description.toLowerCase();

  const categories = {
    'Groceries': ['grocery', 'supermarket', 'whole foods', 'trader joe', 'safeway', 'kroger', 'walmart', 'costco', 'food'],
    'Dining': ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'pizza', 'uber eats', 'doordash', 'grubhub'],
    'Transportation': ['gas', 'shell', 'chevron', 'uber', 'lyft', 'parking', 'transit', 'metro'],
    'Utilities': ['electric', 'gas', 'water', 'internet', 'comcast', 'verizon', 'att', 'utility'],
    'Entertainment': ['netflix', 'spotify', 'hulu', 'movie', 'theater', 'concert', 'game'],
    'Shopping': ['amazon', 'target', 'best buy', 'clothing', 'shoes', 'mall'],
    'Healthcare': ['pharmacy', 'doctor', 'hospital', 'medical', 'cvs', 'walgreens', 'insurance'],
    'Income': ['deposit', 'payroll', 'salary', 'transfer in', 'refund', 'direct dep'],
    'Rent': ['rent', 'lease', 'tenant'],
    'Electricity': ['hydro', 'electric', 'power'],
    'Insurance': ['insurance', 'geico', 'state farm', 'progressive'],
    'Maintenance': ['repair', 'maintenance', 'plumber', 'electrician', 'handyman'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(kw => desc.includes(kw))) {
      return category;
    }
  }

  return 'Uncategorized';
}
