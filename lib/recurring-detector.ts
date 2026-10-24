export type BillingCadence = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'biannual' | 'yearly';

export interface RawTransaction {
  id: string;
  amount: number | string;
  merchant: string;
  category?: string;
  date: string;
  type: 'income' | 'expense';
  description?: string;
}

export interface DetectedRecurringSubscription {
  id: string; // derived unique identifier for UI selection
  merchant: string;
  cleanMerchant: string;
  category: string;
  averageAmount: number;
  cadence: BillingCadence;
  confidenceScore: number; // 0.0 to 1.0 (e.g. 0.95 = 95%)
  confidenceLevel: 'high' | 'medium' | 'low';
  occurrenceCount: number;
  lastBilledDate: string;
  predictedNextRenewalDate: string;
  isVariableAmount: boolean;
  sampleAmounts: number[];
  normalizedMonthlyCost: number;
  normalizedAnnualCost: number;
}

/**
 * Normalizes messy statement merchant strings:
 * Removes transaction IDs, dates, POS identifiers, UPI VPA handles, card digits,
 * payment gateway suffixes (e.g., *RAZORPAY, *BILLDESK, *CASHFREE, *PAYU), etc.
 */
export function cleanMerchantName(raw: string): string {
  if (!raw) return 'Unknown Merchant';

  let cleaned = raw
    // Remove common payment gateway handles and suffixes
    .replace(/\b(razorpay|billdesk|cashfree|payu|ccavenue|instamojo|stripe)\b/gi, '')
    // Remove UPI VPA handles (e.g., merchant@okaxis, user@upi, merchant@paytm)
    .replace(/@[a-zA-Z0-9.\-_]+/g, '')
    // Remove transaction codes, POS identifiers, reference IDs, and digits
    .replace(/\b(pos|ecom|vpa|txn|ref|imps|neft|rtgs|ach|ecs|inb|upi)[\s\-:]*/gi, '')
    .replace(/[#*\/\\_-]+/g, ' ')
    .replace(/\b\d{4,}\b/g, '') // remove long digit sequences
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) cleaned = raw.trim();

  // Convert to Title Case
  return cleaned
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Calculates normalized monthly and annual costs based on cadence
 */
export function calculateNormalizedCosts(
  amount: number,
  cadence: BillingCadence
): { monthly: number; yearly: number } {
  let monthly = 0;
  switch (cadence) {
    case 'daily':
      monthly = amount * 30.417;
      break;
    case 'weekly':
      monthly = (amount * 52) / 12;
      break;
    case 'biweekly':
      monthly = (amount * 26) / 12;
      break;
    case 'monthly':
      monthly = amount;
      break;
    case 'quarterly':
      monthly = amount / 3;
      break;
    case 'biannual':
      monthly = amount / 6;
      break;
    case 'yearly':
      monthly = amount / 12;
      break;
  }

  const roundedMonthly = Math.round(monthly * 100) / 100;
  const roundedYearly = Math.round(monthly * 12 * 100) / 100;
  return { monthly: roundedMonthly, yearly: roundedYearly };
}

/**
 * Computes predicted next renewal date from the latest transaction date and detected cadence
 */
export function predictRenewalDate(lastDateStr: string, cadence: BillingCadence): string {
  const lastDate = new Date(lastDateStr);
  if (isNaN(lastDate.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 30);
    return fallback.toISOString().split('T')[0];
  }

  const nextDate = new Date(lastDate);

  switch (cadence) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'biannual':
      nextDate.setMonth(nextDate.getMonth() + 6);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
  }

  // If next date is already in the past, roll it forward until it is in the future
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  while (nextDate < now) {
    switch (cadence) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'biannual':
        nextDate.setMonth(nextDate.getMonth() + 6);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
  }

  return nextDate.toISOString().split('T')[0];
}

/**
 * Intelligent pattern detection algorithm:
 * Analyzes transaction history to discover recurring payments, subscriptions, and utilities.
 */
export function detectRecurringSubscriptions(
  transactions: RawTransaction[],
  existingSubscriptionNames: string[] = [],
  minOccurrences: number = 2
): DetectedRecurringSubscription[] {
  // Only evaluate expense transactions with valid amounts
  const expenses = transactions.filter(
    (tx) => tx.type === 'expense' && Number(tx.amount) > 0 && tx.merchant
  );

  const existingLower = new Set(
    existingSubscriptionNames.map((n) => cleanMerchantName(n).toLowerCase())
  );

  // Group by cleaned merchant name
  const groups = new Map<string, RawTransaction[]>();
  for (const tx of expenses) {
    const cleaned = cleanMerchantName(tx.merchant);
    const key = cleaned.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(tx);
  }

  const detectedList: DetectedRecurringSubscription[] = [];

  for (const [merchantKey, txs] of groups.entries()) {
    if (txs.length < minOccurrences) continue;

    // Check if user already tracked this subscription
    const isAlreadyTracked = Array.from(existingLower).some(
      (existing) => existing.includes(merchantKey) || merchantKey.includes(existing)
    );
    if (isAlreadyTracked) continue;

    // Sort transactions chronologically
    const sorted = [...txs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate intervals between consecutive billing events
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prevTime = new Date(sorted[i - 1].date).getTime();
      const currTime = new Date(sorted[i].date).getTime();
      const diffDays = Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        intervals.push(diffDays);
      }
    }

    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((acc, curr) => acc + curr, 0) / intervals.length;

    // Determine Cadence from average interval
    let cadence: BillingCadence = 'monthly';
    let targetDays = 30;

    if (avgInterval >= 5 && avgInterval <= 9) {
      cadence = 'weekly';
      targetDays = 7;
    } else if (avgInterval >= 12 && avgInterval <= 16) {
      cadence = 'biweekly';
      targetDays = 14;
    } else if (avgInterval >= 25 && avgInterval <= 35) {
      cadence = 'monthly';
      targetDays = 30;
    } else if (avgInterval >= 80 && avgInterval <= 100) {
      cadence = 'quarterly';
      targetDays = 90;
    } else if (avgInterval >= 170 && avgInterval <= 195) {
      cadence = 'biannual';
      targetDays = 182;
    } else if (avgInterval >= 340 && avgInterval <= 380) {
      cadence = 'yearly';
      targetDays = 365;
    } else {
      // If interval doesn't match a standard cadence, check if close to monthly
      if (avgInterval >= 20 && avgInterval <= 45) {
        cadence = 'monthly';
        targetDays = 30;
      } else {
        // Skip erratic transactions that do not follow a recurring cycle
        continue;
      }
    }

    // Interval variance calculation
    const intervalVariance =
      intervals.reduce((acc, curr) => acc + Math.pow(curr - targetDays, 2), 0) / intervals.length;
    const intervalStdDev = Math.sqrt(intervalVariance);

    // Amount variance calculation
    const amounts = sorted.map((t) => Number(t.amount));
    const avgAmount = amounts.reduce((acc, curr) => acc + curr, 0) / amounts.length;
    const amountVariance =
      amounts.reduce((acc, curr) => acc + Math.pow(curr - avgAmount, 2), 0) / amounts.length;
    const amountStdDev = Math.sqrt(amountVariance);
    const amountCoeffVar = avgAmount > 0 ? amountStdDev / avgAmount : 0;

    const isVariableAmount = amountCoeffVar > 0.08; // More than 8% variance in billed amount (e.g. utility bills)

    // Compute Confidence Score (0.0 - 1.0)
    let score = 0.5;

    // Reward higher frequency of historical matches
    if (sorted.length >= 4) score += 0.25;
    else if (sorted.length >= 3) score += 0.15;
    else score += 0.05;

    // Interval consistency scoring
    if (intervalStdDev <= 2) score += 0.2;
    else if (intervalStdDev <= 5) score += 0.1;
    else score -= 0.1;

    // Amount consistency scoring
    if (!isVariableAmount) {
      score += 0.1;
    } else if (amountCoeffVar <= 0.25) {
      // Acceptable variable billing (e.g. electricity, cloud hosting)
      score += 0.05;
    }

    const clampedScore = Math.min(Math.max(Math.round(score * 100) / 100, 0.4), 0.99);

    const confidenceLevel: 'high' | 'medium' | 'low' =
      clampedScore >= 0.8 ? 'high' : clampedScore >= 0.65 ? 'medium' : 'low';

    const cleanName = cleanMerchantName(sorted[sorted.length - 1].merchant);
    const lastDate = sorted[sorted.length - 1].date;
    const predictedNextDate = predictRenewalDate(lastDate, cadence);
    const costs = calculateNormalizedCosts(avgAmount, cadence);

    const category =
      sorted[sorted.length - 1].category ||
      (cadence === 'yearly' || cadence === 'monthly' ? 'Subscriptions' : 'Utilities');

    detectedList.push({
      id: `detected-${Buffer.from(merchantKey).toString('hex').slice(0, 10)}`,
      merchant: sorted[sorted.length - 1].merchant,
      cleanMerchant: cleanName,
      category,
      averageAmount: Math.round(avgAmount * 100) / 100,
      cadence,
      confidenceScore: clampedScore,
      confidenceLevel,
      occurrenceCount: sorted.length,
      lastBilledDate: lastDate,
      predictedNextRenewalDate: predictedNextDate,
      isVariableAmount,
      sampleAmounts: amounts.slice(-3),
      normalizedMonthlyCost: costs.monthly,
      normalizedAnnualCost: costs.yearly,
    });
  }

  // Sort detected list with highest confidence and occurrence count first
  return detectedList.sort((a, b) => b.confidenceScore - a.confidenceScore || b.occurrenceCount - a.occurrenceCount);
}
