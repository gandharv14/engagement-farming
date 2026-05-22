export function parseDateOnly(value: string, label: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new Error(`${label} must be a valid date.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`${label} must be a valid date.`);
  }

  return date;
}

export function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getSprintEndDateFromDuration(sprintStartDate: Date, durationDays: number) {
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new Error("Sprint duration must be at least 1 day.");
  }

  const sprintEndDate = new Date(sprintStartDate);
  sprintEndDate.setUTCDate(sprintStartDate.getUTCDate() + durationDays - 1);
  return sprintEndDate;
}
