/** Calendar events are evaluated in the visitor's local time zone. */
export function seasonalThemeId(date: Date): string | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if ((month === 12 && day >= 31) || (month === 1 && day <= 2)) return 'devshub-new-year';
  if (month === 2 && day === 14) return 'devshub-valentine';
  if (month === 3 && day === 8) return 'devshub-womens-day';
  if (month === 4 && day === 7) return 'devshub-health-day';
  if (month === 10 && day === 31) return 'devshub-halloween';
  if (month === 10) return 'devshub-pink-october';
  if (month === 11) {
    const first = new Date(date.getFullYear(), 10, 1).getDay();
    const fourthThursday = 1 + ((4 - first + 7) % 7) + 21;
    if (day === fourthThursday + 1) return 'devshub-black-friday';
  }
  return null;
}
