/**
 * ESLint Configuration - DateTime Strategy Enforcement
 * 
 * This configuration enforces our "UTC Storage + Consistent Display" datetime strategy
 * by preventing use of problematic Date patterns and ensuring consistent usage of
 * utilities from src/utils/dateTime.ts.
 * 
 * Key enforcement areas:
 * - Blocks direct Date constructor usage
 * - Prevents native Date methods (.toISOString, .toLocaleDateString, etc.)
 * - Blocks deprecated utility functions (formatDateTime, formatTime, formatDate)
 * - Prevents timestamp constants and properties (*Ms, *Timestamp)
 * - Prevents problematic Date manipulation patterns
 * - Prevents Date manipulation methods (.setHours, .setMinutes, etc.)
 * 
 * Strategy: Date objects everywhere, UTC storage, consistent timezone display (configured in constants.ts).
 */

import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      // Prevent direct Date constructor usage - enforce utility functions
      "no-restricted-syntax": [
        "error",
        {
          selector: 'NewExpression[callee.name="Date"][arguments.length>0]',
          message: 'Use parse() from src/utils/dateTime.ts instead of new Date() with arguments'
        },
        {
          selector: 'CallExpression[callee.property.name="getTime"]',
          message: 'Use date.valueOf() instead of date.getTime() for better readability'
        },
        {
          selector: 'CallExpression[callee.property.name="getFullYear"]',
          message: 'Use getYear() from src/utils/dateTime.ts to get year in configured timezone'
        },
        {
          selector: 'CallExpression[callee.property.name="getMonth"]',
          message: 'Use format() with month option from src/utils/dateTime.ts for timezone-aware month access'
        },
        {
          selector: 'CallExpression[callee.property.name="getDate"]',
          message: 'Use formatDateOnly() or format() from src/utils/dateTime.ts for timezone-aware date access'
        },
        {
          selector: 'CallExpression[callee.property.name="getHours"]',
          message: 'Use toTimeInput() or format() from src/utils/dateTime.ts for timezone-aware hour access'
        },
        {
          selector: 'CallExpression[callee.property.name="getMinutes"]',
          message: 'Use toTimeInput() or format() from src/utils/dateTime.ts for timezone-aware minute access'
        },
        {
          selector: 'CallExpression[callee.property.name="getSeconds"]',
          message: 'Use format() from src/utils/dateTime.ts for timezone-aware second access'
        },
        {
          selector: 'CallExpression[callee.property.name="toISOString"]',
          message: 'Use format() from src/utils/dateTime.ts for consistent formatting'
        },
        {
          selector: 'CallExpression[callee.property.name="toLocaleDateString"]',
          message: 'Use format() with dateStyle option from src/utils/dateTime.ts for consistent formatting'
        },
        {
          selector: 'CallExpression[callee.property.name="toLocaleTimeString"]',
          message: 'Use format() with timeStyle option from src/utils/dateTime.ts for consistent formatting'
        },
        {
          selector: 'CallExpression[callee.property.name="toLocaleString"]',
          message: 'Use format() from src/utils/dateTime.ts for consistent formatting'
        },
        {
          selector: 'CallExpression[callee.property.name="setHours"]',
          message: 'Use startOfDay(), endOfDay(), or date manipulation utilities from src/utils/dateTime.ts'
        },
        {
          selector: 'CallExpression[callee.property.name="setMinutes"]',
          message: 'Use addMinutes() or time manipulation utilities from src/utils/dateTime.ts'
        },
        {
          selector: 'CallExpression[callee.property.name="setSeconds"]',
          message: 'Use time manipulation utilities from src/utils/dateTime.ts'
        },
        {
          selector: 'CallExpression[callee.property.name="setDate"]',
          message: 'Use addDays() or date manipulation utilities from src/utils/dateTime.ts'
        },
        {
          selector: 'CallExpression[callee.property.name="setMonth"]',
          message: 'Use date manipulation utilities from src/utils/dateTime.ts'
        },
        {
          selector: 'CallExpression[callee.property.name="setYear"]',
          message: 'Use date manipulation utilities from src/utils/dateTime.ts'
        },
        {
          selector: 'CallExpression[callee.property.name="setFullYear"]',
          message: 'Use date manipulation utilities from src/utils/dateTime.ts'
        },
        {
          selector: 'BinaryExpression[operator="*"][left.type="CallExpression"][left.callee.property.name="getTime"]',
          message: 'Avoid timestamp multiplication - use Date objects and utilities from src/utils/dateTime.ts'
        },
        {
          selector: 'BinaryExpression[operator="*"][right.type="CallExpression"][right.callee.property.name="getTime"]',
          message: 'Avoid timestamp multiplication - use Date objects and utilities from src/utils/dateTime.ts'
        },
        {
          selector: 'BinaryExpression[operator="*"] Literal[value=1000], BinaryExpression[operator="/"] Literal[value=1000]',
          message: 'Avoid timestamp conversion constants - use Date objects directly'
        },
        {
          selector: 'Literal[value=86400000]',
          message: 'Avoid day-in-milliseconds constants - use addDays() from src/utils/dateTime.ts'
        },
        {
          selector: 'Literal[value=3600000]',
          message: 'Avoid hour-in-milliseconds constants - use addMinutes() from src/utils/dateTime.ts'
        },
        // Block old utility function names from the TIMEZONE_REFACTOR.md
        {
          selector: 'CallExpression[callee.name="formatDateTime"]',
          message: 'Use format() from src/utils/dateTime.ts instead of formatDateTime()'
        },
        {
          selector: 'CallExpression[callee.name="formatTime"]',
          message: 'Use format(date, { timeStyle: "short" }) from src/utils/dateTime.ts instead of formatTime()'
        },
        {
          selector: 'CallExpression[callee.name="formatDate"]',
          message: 'Use format(date, { dateStyle: "medium" }) from src/utils/dateTime.ts instead of formatDate()'
        },
        {
          selector: 'MemberExpression[property.name="createdAtMs"]',
          message: 'Use createdAt (Date object) instead of createdAtMs property'
        },
        {
          selector: 'MemberExpression[property.name=/.*Ms$/]',
          message: 'Avoid timestamp properties ending in "Ms" - use Date objects directly'
        },
        {
          selector: 'MemberExpression[property.name=/.*Timestamp$/]:not([property.name="eventTimestamp"])',
          message: 'Avoid timestamp properties - use Date objects directly'
        },
        {
          selector: 'Identifier[name=/.*Timestamp$/]:not([name="eventTimestamp"])',
          message: 'Avoid timestamp variables - use Date objects directly'
        }
      ],
      
      // Prevent dangerous date methods
      "no-restricted-globals": [
        "error",
        {
          name: 'Date',
          message: 'Import utilities from src/utils/dateTime.ts instead of using global Date constructor'
        }
      ],
      
      // Note: date-fns-tz is allowed for timezone conversions in dateTime.ts
    }
  },
  {
    // Allow Date constructor in the dateTime utility file itself
    files: ['src/utils/dateTime.ts'],
    rules: {
      'no-restricted-syntax': 'off',
      'no-restricted-globals': 'off'
    }
  },
  {
    // Special rules for action/query files
    files: ['**/actions.ts', '**/queries.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'NewExpression[callee.name="Date"][arguments.length>0]',
          message: 'Use parse() from src/utils/dateTime.ts in actions/queries for consistent Date handling'
        },
        {
          selector: 'CallExpression[callee.name="parseInt"][arguments.0.type="MemberExpression"][arguments.0.property.name=/.*[Tt]ime.*|.*[Dd]ate.*/]',
          message: 'Avoid parseInt on date/time properties - use Date objects directly'
        },
        // Audit logging enforcement - ensure all database mutations include __auditUserId
        {
          selector: 'CallExpression[callee.property.name=/^(create|update|upsert)$/]:not(:has(Property[key.name="__auditUserId"]))',
          message: 'Database mutations must include __auditUserId for audit logging. Add "__auditUserId: context.user.id".'
        }
      ]
    }
  },
  {
    // Exempt seeds, tests, and prismaSetup from audit enforcement
    files: ['**/seeds.ts', '**/prismaSetup.ts', '**/*.test.ts', '**/*.test.js', 'tests/**/*'],
    rules: {
      'no-restricted-syntax': 'off'
    }
  }
];