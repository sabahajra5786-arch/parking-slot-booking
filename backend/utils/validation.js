const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidTime(value) {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

function validatePeriod(date, startTime, endTime) {
  if (!isValidDate(date) || !isValidTime(startTime) || !isValidTime(endTime)) {
    return 'Provide a valid date and times in YYYY-MM-DD and HH:MM format.';
  }
  if (startTime >= endTime) return 'Leave-by time must be later than arrival time.';
  return null;
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

module.exports = { validatePeriod, cleanText, isValidDate };
