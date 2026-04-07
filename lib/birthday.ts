const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type BirthdayFields = {
  birthdayDay?: number | null;
  birthdayMonth?: number | null;
  birthdayYear?: number | null;
};

export function formatBirthday(b: BirthdayFields): string | null {
  const { birthdayDay: d, birthdayMonth: m, birthdayYear: y } = b;
  if (!d && !m && !y) return null;

  const monthName = m ? MONTHS[m - 1] : null;

  if (monthName && d && y) return `${monthName} ${d}, ${y}`;
  if (monthName && d)      return `${monthName} ${d}`;
  if (monthName && y)      return `${monthName} ${y}`;
  if (monthName)           return monthName;
  if (y)                   return `${y}`;
  if (d)                   return `Day ${d}`;
  return null;
}

/** Returns true if we have enough info to generate a yearly birthday event (need at least month + day) */
export function hasBirthdayEvent(b: BirthdayFields): boolean {
  return !!(b.birthdayMonth && b.birthdayDay);
}

/** Returns the next occurrence date for a birthday given month+day. Needs hasBirthdayEvent === true. */
export function nextBirthdayDate(month: number, day: number, from: Date): Date {
  const thisYear = new Date(from.getFullYear(), month - 1, day);
  return thisYear >= from ? thisYear : new Date(from.getFullYear() + 1, month - 1, day);
}
