/**
 * Date utilities for integration tests
 */

/**
 * Get tomorrow's date in YYYY-MM-DD format
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getTomorrowDateString() {
  return getFutureDateString(1);
}

/**
 * Get date N days from now in YYYY-MM-DD format
 * @param {number} daysFromNow - Number of days to add to current date
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function getFutureDateString(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

/**
 * Get current timestamp (useful for unique test data)
 * @returns {number} Current timestamp in milliseconds
 */
export function getTimestamp() {
  return Date.now();
}

/**
 * Get current ISO timestamp string
 * @returns {string} ISO timestamp string
 */
export function getCurrentISOString() {
  return new Date().toISOString();
}
