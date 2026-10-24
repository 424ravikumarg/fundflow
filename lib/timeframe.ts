export interface TimeframeMonth {
  key: string;       // e.g. "2026-07"
  label: string;     // e.g. "July 2026"
  year: number;      // e.g. 2026
  count?: number;    // e.g. 28
}

export interface AvailablePeriods {
  years: number[];
  months: TimeframeMonth[];
}

export function parseLocalDate(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const clean = dateStr.split("T")[0];
  const parts = clean.split("-").map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

/**
 * Checks whether a given transaction date falls within the selected timeframe.
 */
export function isDateInTimeframe(
  dateStr: string,
  timeframe: string,
  now: Date = new Date()
): boolean {
  if (!dateStr || timeframe === "all_time") return true;

  const parsed = parseLocalDate(dateStr);
  if (!parsed) return false;

  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth(); // 0-indexed (0 = Jan, 9 = Oct)

  // 1. This Month
  if (timeframe === "this_month") {
    return parsed.year === nowYear && parsed.month === nowMonth;
  }

  // 2. Last Month
  if (timeframe === "last_month") {
    const lastMonth = nowMonth === 0 ? 11 : nowMonth - 1;
    const lastMonthYear = nowMonth === 0 ? nowYear - 1 : nowYear;
    return parsed.year === lastMonthYear && parsed.month === lastMonth;
  }

  // 3. Last Quarter (previous calendar quarter, e.g. Q3 if currently Q4)
  if (timeframe === "last_quarter") {
    const currentQuarter = Math.floor(nowMonth / 3);
    const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
    const targetYear = currentQuarter === 0 ? nowYear - 1 : nowYear;
    const startMonth = lastQuarter * 3;
    const endMonth = startMonth + 2;
    return parsed.year === targetYear && parsed.month >= startMonth && parsed.month <= endMonth;
  }

  // 4. Half Year (Past 6 calendar months including current)
  if (timeframe === "half_year") {
    const monthDiff = (nowYear - parsed.year) * 12 + (nowMonth - parsed.month);
    return monthDiff >= 0 && monthDiff < 6;
  }

  // 5. This Year (Current calendar year)
  if (timeframe === "this_year") {
    return parsed.year === nowYear;
  }

  // 6. Last Year (Previous calendar year)
  if (timeframe === "last_year") {
    return parsed.year === nowYear - 1;
  }

  // 7. This Financial Year (Standard Indian/accounting FY: April 1 to March 31)
  if (timeframe === "this_fy") {
    const fyStartYear = nowMonth >= 3 ? nowYear : nowYear - 1;
    const fyEndYear = fyStartYear + 1;
    return (
      (parsed.year === fyStartYear && parsed.month >= 3) ||
      (parsed.year === fyEndYear && parsed.month < 3)
    );
  }

  // 8. Specific Statement Month (e.g. "month:2026-07")
  if (timeframe.startsWith("month:")) {
    const target = timeframe.slice(6);
    const [y, m] = target.split("-").map(Number);
    return parsed.year === y && parsed.month === m - 1;
  }

  // 9. Specific Statement Year (e.g. "year:2026")
  if (timeframe.startsWith("year:")) {
    const targetYear = parseInt(timeframe.slice(5), 10);
    return parsed.year === targetYear;
  }

  return true;
}

/**
 * Returns a human-friendly label for any timeframe string.
 */
export function getTimeframeLabel(timeframe: string, now: Date = new Date()): string {
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  if (timeframe === "all_time") return "All Time";
  if (timeframe === "this_month") return `This Month (${monthNames[nowMonth]} ${nowYear})`;
  if (timeframe === "last_month") {
    const lastMonth = nowMonth === 0 ? 11 : nowMonth - 1;
    const lastYear = nowMonth === 0 ? nowYear - 1 : nowYear;
    return `Last Month (${monthNames[lastMonth]} ${lastYear})`;
  }
  if (timeframe === "last_quarter") {
    const currentQuarter = Math.floor(nowMonth / 3);
    const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
    const targetYear = currentQuarter === 0 ? nowYear - 1 : nowYear;
    return `Last Quarter (Q${lastQuarter + 1} ${targetYear})`;
  }
  if (timeframe === "half_year") return "Half Year (Last 6 Months)";
  if (timeframe === "this_year") return `This Year (${nowYear})`;
  if (timeframe === "last_year") return `Last Year (${nowYear - 1})`;
  if (timeframe === "this_fy") {
    const fyStartYear = nowMonth >= 3 ? nowYear : nowYear - 1;
    return `This Financial Year (FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)})`;
  }
  if (timeframe.startsWith("month:")) {
    const target = timeframe.slice(6);
    const [y, m] = target.split("-").map(Number);
    if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
      return `${monthNames[m - 1]} ${y}`;
    }
    return target;
  }
  if (timeframe.startsWith("year:")) {
    return `Year ${timeframe.slice(5)}`;
  }
  return timeframe;
}
