import { z } from 'zod';

/**
 * ISO helpers with explicit regex.
 */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
  .describe('ISO date string in format YYYY-MM-DD');

export const IsoTime = z
  .string()
  .regex(/^\d{2}:\d{2}:\d{2}$/, 'HH:MM:SS')
  .describe('ISO time string in format HH:MM:SS (seconds required)');

export const IanaTZ = z
  .string()
  .min(1)
  .regex(
    /^[A-Za-z_]+(?:\/[A-Za-z0-9_\-+]+)+$/,
    'IANA timezone like Atlantic/Canary',
  )
  .describe('IANA timezone identifier, e.g., Atlantic/Canary');

/**
 * Weekday enums (ISO 8601 mapping)
 */
export const Weekday = z
  .enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])
  .describe('Weekday code (ISO 8601): MO TU WE TH FR SA SU');
export type Weekday = z.infer<typeof Weekday>;

export const WeekdayPosition = z
  .enum(['1', '2', '3', '4', 'last'])
  .describe('Monthly position: 1, 2, 3, 4, or last');
export type WeekdayPosition = z.infer<typeof WeekdayPosition>;

/**
 * Recurrence: unify simple and advanced under one discriminator "kind"
 */
const RecurrenceSimpleWeekly = z
  .object({
    kind: z.literal('simpleWeekly').describe('Simple weekly recurrence'),
    byDays: z
      .array(Weekday)
      .nonempty()
      .describe('Weekdays the class meets (e.g., ["MO","WE"])'),
    startTime: IsoTime.describe('Start time for each occurrence'),
    endTime: IsoTime.describe(
      'End time for each occurrence (must be after startTime)',
    ),
    interval: z
      .number()
      .int()
      .positive()
      .default(1)
      .optional()
      .describe('Weeks between occurrences (default 1)'),
    until: IsoDate.optional().describe('Optional end date for recurrence'),
  })
  .describe('Simple weekly recurrence definition');

const RecurrenceDaily = z
  .object({
    kind: z.literal('daily').describe('Daily recurrence'),
    interval: z
      .number()
      .int()
      .positive()
      .default(1)
      .optional()
      .describe('Days between occurrences (default 1)'),
    until: IsoDate.optional().describe('Optional end date for recurrence'),
  })
  .describe('Advanced recurrence: daily');

const RecurrenceWeekly = z
  .object({
    kind: z.literal('weekly').describe('Weekly recurrence (advanced)'),
    interval: z
      .number()
      .int()
      .positive()
      .default(1)
      .optional()
      .describe('Weeks between occurrences (default 1)'),
    byDays: z.array(Weekday).nonempty().describe('Weekdays the class meets'),
    until: IsoDate.optional().describe('Optional end date for recurrence'),
  })
  .describe('Advanced recurrence: weekly');

const RecurrenceMonthlyByDay = z
  .object({
    kind: z.literal('monthlyByDay').describe('Monthly by day-of-month'),
    interval: z
      .number()
      .int()
      .positive()
      .default(1)
      .optional()
      .describe('Months between occurrences (default 1)'),
    byMonthDay: z.number().int().min(1).max(31).describe('Day of month (1-31)'),
    until: IsoDate.optional().describe('Optional end date for recurrence'),
  })
  .describe('Advanced recurrence: monthly by day-of-month');

const RecurrenceMonthlyByWeekday = z
  .object({
    kind: z
      .literal('monthlyByWeekday')
      .describe('Monthly by position and weekday'),
    interval: z
      .number()
      .int()
      .positive()
      .default(1)
      .optional()
      .describe('Months between occurrences (default 1)'),
    position: WeekdayPosition.describe('Monthly position: 1, 2, 3, 4, or last'),
    weekday: Weekday.describe('Target weekday for monthly recurrence'),
    until: IsoDate.optional().describe('Optional end date for recurrence'),
  })
  .describe('Advanced recurrence: monthly by weekday position');

const RecurrenceExplicitDates = z
  .object({
    kind: z.literal('xDays').describe('Explicit list of dates'),
    dates: z.array(IsoDate).nonempty().describe('List of specific dates'),
  })
  .describe('Advanced recurrence: explicit date list');

export const Recurrence = z
  .discriminatedUnion('kind', [
    RecurrenceSimpleWeekly,
    RecurrenceDaily,
    RecurrenceWeekly,
    RecurrenceMonthlyByDay,
    RecurrenceMonthlyByWeekday,
    RecurrenceExplicitDates,
  ])
  .describe(
    'Recurrence union: choose exactly one kind (simpleWeekly | daily | weekly | monthlyByDay | monthlyByWeekday | xDays)',
  );
export type Recurrence = z.infer<typeof Recurrence>;

/**
 * Classroom (optional, attachable via locationDetails)
 */
export const Classroom = z
  .object({
    id: z.string().optional().describe('Classroom ID (optional)'),
    campus: z.string().optional().describe('Campus name (optional)'),
    building: z.string().optional().describe('Building name (optional)'),
    room: z.string().min(1).describe('Room identifier/number'),
    capacity: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Seating capacity (optional)'),
    features: z
      .array(z.string())
      .default([])
      .describe('List of features/equipment'),
    notes: z.string().optional().describe('Additional notes (optional)'),
  })
  .describe('Structured classroom/location details');
export type Classroom = z.infer<typeof Classroom>;

/**
 * Optional weekday-specific overrides
 */
export const WeekdayOverride = z
  .object({
    weekday: Weekday.describe('Weekday this override applies to'),
    startTime: IsoTime.optional().describe('Override start time (optional)'),
    endTime: IsoTime.optional().describe('Override end time (optional)'),
    location: z.string().optional().describe('Override location (optional)'),
    description: z
      .string()
      .optional()
      .describe('Override description (optional)'),
  })
  .describe(
    'Per-weekday override for time and/or location; overrides base recurrence times',
  );
export type WeekdayOverride = z.infer<typeof WeekdayOverride>;

/**
 * Per-class meeting definition
 * - "group" can be a single string or a non-empty string array.
 * - Preserve tokens exactly as in the timetable (e.g., "PE101", "TU101", "(1)").
 */
export const ClassBlock = z
  .object({
    id: z.string().optional().describe('Class block ID (optional)'),
    title: z.string().min(1).describe('Class title (full subject name)'),

    group: z
      .union([z.string().min(1), z.array(z.string().min(1)).nonempty()])
      .optional()
      .describe(
        'Group/modality token(s) as shown, e.g., "PE101", "PA101", "(1)"; either a single string or a non-empty list',
      ),

    // Location: either simple string or structured details
    location: z.string().optional().describe('Location string (optional)'),
    locationDetails: Classroom.optional().describe(
      'Structured location details (optional)',
    ),

    description: z.string().optional().describe('Class description (optional)'),

    // Optional date bounds
    startDate: IsoDate.optional().describe('Optional class start date'),
    endDate: IsoDate.optional().describe('Optional class end date'),

    // Unified recurrence
    recurrence: Recurrence.describe(
      'Recurrence rule for this class (choose one kind)',
    ),

    // Per-weekday overrides
    weekdayOverrides: z
      .array(WeekdayOverride)
      .default([])
      .describe('List of weekday-specific overrides'),

    // Exceptions and overrides
    skipDates: z
      .array(IsoDate)
      .default([])
      .describe('Dates to skip (no meeting)'),
    overrides: z
      .array(
        z
          .object({
            date: IsoDate.describe('Date of the override'),
            startTime: IsoTime.optional().describe('Override start time'),
            endTime: IsoTime.optional().describe('Override end time'),
            location: z
              .string()
              .optional()
              .describe('Override location (optional)'),
            title: z.string().optional().describe('Override title (optional)'),
            description: z
              .string()
              .optional()
              .describe('Override description (optional)'),
          })
          .describe('Single-date override entry'),
      )
      .default([])
      .describe('Date-specific overrides list'),

    instructor: z.string().optional().describe('Instructor name (optional)'),
    tags: z.array(z.string()).default([]).describe('Tags/labels for the class'),
  })
  .describe(
    'Definition of a class and its recurrence/overrides; "group" distinguishes variants and may be a single token or list',
  );
export type ClassBlock = z.infer<typeof ClassBlock>;

/**
 * A normalized event instance for exporting/preview
 */
export const EventInstance = z
  .object({
    classId: z.string().optional().describe('Originating class ID (optional)'),
    title: z.string().describe('Event title'),
    date: IsoDate.describe('Event date'),
    startDateTimeLocal: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/, 'YYYY-MM-DDTHH:MM:00')
      .describe('Local start datetime in YYYY-MM-DDTHH:MM:00'),
    endDateTimeLocal: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/, 'YYYY-MM-DDTHH:MM:00')
      .describe('Local end datetime in YYYY-MM-DDTHH:MM:00'),
    location: z.string().optional().describe('Event location (optional)'),
    description: z.string().optional().describe('Event description (optional)'),
  })
  .describe('Normalized single event instance for export/preview');
export type EventInstance = z.infer<typeof EventInstance>;

/**
 * Overall schedule
 */
export const Schedule = z
  .object({
    timeZone: IanaTZ.describe('Schedule timezone (IANA)'),
    termStart: IsoDate.optional().describe('Optional term start date'),
    termEnd: IsoDate.optional().describe('Optional term end date'),
    classes: z.array(ClassBlock).describe('List of class blocks'),
  })
  .superRefine((val, ctx) => {
    if (val.termStart && val.termEnd && val.termEnd < val.termStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['termEnd'],
        message: 'termEnd must be on or after termStart',
      });
    }

    for (const [i, c] of val.classes.entries()) {
      if (c.recurrence.kind === 'simpleWeekly') {
        const { startTime, endTime } = c.recurrence;
        if (endTime <= startTime) {
          ctx.addIssue({
            code: 'custom',
            path: ['classes', i, 'recurrence', 'endTime'],
            message: 'endTime must be after startTime',
          });
        }
      }

      if (c.startDate && c.endDate && c.endDate < c.startDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['classes', i, 'endDate'],
          message: 'endDate must be on or after startDate',
        });
      }
    }
  })
  .describe('Overall schedule including timezone, term bounds, and classes');

export type Schedule = z.infer<typeof Schedule>;
