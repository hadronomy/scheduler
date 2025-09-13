import { z } from 'zod';

/**
 * ISO helpers: keep explicit regex to avoid model confusion with z.iso.*.
 * Accepts YYYY-MM-DD and HH:MM:SS (seconds required).
 */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

export const IsoTime = z
  .string()
  .regex(/^\d{2}:\d{2}:\d{2}$/, 'HH:MM:SS');

export const IanaTZ = z
  .string()
  .min(1)
  .regex(
    /^[A-Za-z_]+(?:\/[A-Za-z0-9_\-+]+)+$/,
    'IANA timezone like Atlantic/Canary'
  );

/**
 * Weekday enums (ISO 8601 mapping)
 */
export const Weekday = z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);
export type Weekday = z.infer<typeof Weekday>;

export const WeekdayPosition = z.enum(['1', '2', '3', '4', 'last']);
export type WeekdayPosition = z.infer<typeof WeekdayPosition>;

/**
 * Advanced recurrence (rare). Keep original power behind a single discriminator,
 * but the normal path uses simple weekly recurrence below.
 */
const AdvRecurrenceDaily = z.object({
  kind: z.literal('daily'),
  interval: z.number().int().positive().default(1).optional(),
  until: IsoDate.optional(),
});

const AdvRecurrenceWeekly = z.object({
  kind: z.literal('weekly'),
  interval: z.number().int().positive().default(1).optional(),
  byDays: z.array(Weekday).nonempty(),
  until: IsoDate.optional(),
});

const AdvRecurrenceMonthlyByDay = z.object({
  kind: z.literal('monthly_by_day'),
  interval: z.number().int().positive().default(1).optional(),
  byMonthDay: z.number().int().min(1).max(31),
  until: IsoDate.optional(),
});

const AdvRecurrenceMonthlyByWeekday = z.object({
  kind: z.literal('monthly_by_weekday'),
  interval: z.number().int().positive().default(1).optional(),
  position: WeekdayPosition,
  weekday: Weekday,
  until: IsoDate.optional(),
});

const AdvRecurrenceExplicitDates = z.object({
  kind: z.literal('xDays'),
  dates: z.array(IsoDate).nonempty(),
});

export const AdvancedRecurrenceRule = z.discriminatedUnion('kind', [
  AdvRecurrenceDaily,
  AdvRecurrenceWeekly,
  AdvRecurrenceMonthlyByDay,
  AdvRecurrenceMonthlyByWeekday,
  AdvRecurrenceExplicitDates,
]);
export type AdvancedRecurrenceRule = z.infer<typeof AdvancedRecurrenceRule>;

/**
 * Classroom (optional, attachable via locationDetails)
 */
export const Classroom = z.object({
  id: z.string().optional(),
  campus: z.string().optional(),
  building: z.string().optional(),
  room: z.string().min(1),
  capacity: z.number().int().positive().optional(),
  features: z.array(z.string()).default([]),
  notes: z.string().optional(),
});
export type Classroom = z.infer<typeof Classroom>;

/**
 * Simple weekly recurrence (happy path).
 * - byDays: which weekdays
 * - startTime/endTime: base times (HH:MM:SS)
 * - until: optional end date; if omitted, schedule.termEnd applies
 */
export const RecurrenceWeeklySimple = z.object({
  byDays: z.array(Weekday).nonempty(),
  startTime: IsoTime,
  endTime: IsoTime,
  interval: z.number().int().positive().default(1).optional(),
  until: IsoDate.optional(),
});

/**
 * Optional weekday-specific overrides for time and/or location variations.
 * If present for a weekday, it overrides the base times.
 */
export const WeekdayOverride = z.object({
  weekday: Weekday,
  startTime: IsoTime.optional(),
  endTime: IsoTime.optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});
export type WeekdayOverride = z.infer<typeof WeekdayOverride>;

/**
 * Per-class meeting definition (simplified).
 * - Prefer recurrenceWeekly (simple weekly). If not weekly, use advancedRecurrence.
 */
export const ClassBlock = z.object({
  id: z.string().optional(),
  title: z.string().min(1),

  // Location: either a simple string or structured details.
  location: z.string().optional(),
  locationDetails: Classroom.optional(),

  description: z.string().optional(),

  // Date bounds (optional). If unset, use schedule.termStart/termEnd + recurrence logic.
  startDate: IsoDate.optional(),
  endDate: IsoDate.optional(),

  // Simple weekly recurrence (common case).
  recurrenceWeekly: RecurrenceWeeklySimple.optional(),

  // If not weekly or needs special patterns, use this instead.
  advancedRecurrence: AdvancedRecurrenceRule.optional(),

  // Per-weekday overrides (e.g., different times/rooms on certain days)
  weekdayOverrides: z.array(WeekdayOverride).default([]),

  // Exceptions and overrides
  skipDates: z.array(IsoDate).default([]),
  overrides: z
    .array(
      z.object({
        date: IsoDate,
        startTime: IsoTime.optional(),
        endTime: IsoTime.optional(),
        location: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .default([]),

  instructor: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type ClassBlock = z.infer<typeof ClassBlock>;

/**
 * A normalized event instance for exporting/preview
 */
export const EventInstance = z.object({
  classId: z.string().optional(),
  title: z.string(),
  date: IsoDate,
  startDateTimeLocal: z.string().regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/,
    'YYYY-MM-DDTHH:MM:00'
  ),
  endDateTimeLocal: z.string().regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/,
    'YYYY-MM-DDTHH:MM:00'
  ),
  location: z.string().optional(),
  description: z.string().optional(),
});
export type EventInstance = z.infer<typeof EventInstance>;

/**
 * Overall schedule
 * - termStart/termEnd optional to allow minimal fallback generation
 */
export const Schedule = z
  .object({
    timeZone: IanaTZ,
    termStart: IsoDate.optional(),
    termEnd: IsoDate.optional(),
    classes: z.array(ClassBlock),
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
      // Require at least one recurrence path
      if (!c.recurrenceWeekly && !c.advancedRecurrence) {
        ctx.addIssue({
          code: 'custom',
          path: ['classes', i],
          message:
            'Provide recurrenceWeekly (simple) or advancedRecurrence (fallback).',
        });
      }

      // If weekly provided, ensure time order
      if (c.recurrenceWeekly) {
        const { startTime, endTime } = c.recurrenceWeekly;
        if (endTime <= startTime) {
          ctx.addIssue({
            code: 'custom',
            path: ['classes', i, 'recurrenceWeekly', 'endTime'],
            message: 'endTime must be after startTime',
          });
        }
      }

      // Date consistency
      if (c.startDate && c.endDate && c.endDate < c.startDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['classes', i, 'endDate'],
          message: 'endDate must be on or after startDate',
        });
      }
    }
  });

export type Schedule = z.infer<typeof Schedule>;