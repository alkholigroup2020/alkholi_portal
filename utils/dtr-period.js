// DTR reporting periods run from the 21st of a month to the 20th of the next.
// Dates use the display format the DTR pages keep in the store: DD-MM-YYYY.
const PERIOD_START_DAY = 21
const PERIOD_END_DAY = 20

function pad(value) {
  return String(value).padStart(2, '0')
}

// The period that starts on the 21st of the given month (1-12).
export function periodStartingIn(year, month) {
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  return {
    start: `${PERIOD_START_DAY}-${pad(month)}-${year}`,
    end: `${PERIOD_END_DAY}-${pad(endMonth)}-${endYear}`,
  }
}

// The period containing a day: up to the 20th it started the month before.
export function periodContaining(year, month, day) {
  if (day > PERIOD_END_DAY) return periodStartingIn(year, month)
  return month === 1
    ? periodStartingIn(year - 1, 12)
    : periodStartingIn(year, month - 1)
}

// The period `months` after (or, when negative, before) the one that starts
// on `start`.
export function shiftPeriod(start, months) {
  const [, month, year] = start.split('-').map(Number)
  const index = year * 12 + (month - 1) + months
  return periodStartingIn(Math.floor(index / 12), (index % 12) + 1)
}

// Month and year numbers of both ends, for building the calendar dates.
export function periodParts(start, end) {
  const [, startMonth, startYear] = start.split('-').map(Number)
  const [, endMonth, endYear] = end.split('-').map(Number)
  return { startMonth, startYear, endMonth, endYear }
}
