import { z } from 'zod';
import { ALL_TIMEZONES } from '~/generated/timezones';

// ISO helpers
const IsoDate = z.iso.date();
const IsoTime = z.iso.time();
const IanaTZ = z.literal(ALL_TIMEZONES);

// Weekday enums (ISO 8601 mapping)
export const Weekday = z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);
export type Weekday = z.infer<typeof Weekday>;

// Monthly weekday position: 1st, 2nd, 3rd, 4th, last
export const WeekdayPosition = z.enum(['1', '2', '3', '4', 'last']);
export type WeekdayPosition = z.infer<typeof WeekdayPosition>;

// Recurrence rule variants
const RecurrenceNone = z.object({
  kind: z.literal('none'),
});

const RecurrenceDaily = z.object({
  kind: z.literal('daily'),
  interval: z.number().int().positive().default(1).optional(),
  until: IsoDate.optional(),
});

const RecurrenceWeekly = z.object({
  kind: z.literal('weekly'),
  interval: z.number().int().positive().default(1).optional(),
  byDays: z.array(Weekday).nonempty(),
  until: IsoDate.optional(),
});

const RecurrenceMonthlyByDay = z.object({
  kind: z.literal('monthly_by_day'),
  interval: z.number().int().positive().default(1).optional(),
  byMonthDay: z.number().int().min(1).max(31),
  until: IsoDate.optional(),
});

const RecurrenceMonthlyByWeekday = z.object({
  kind: z.literal('monthly_by_weekday'),
  interval: z.number().int().positive().default(1).optional(),
  position: WeekdayPosition,
  weekday: Weekday,
  until: IsoDate.optional(),
});

// Explicit set of dates (irregular repetition)
const RecurrenceExplicitDates = z.object({
  kind: z.literal('xDays'),
  dates: z.array(IsoDate).nonempty(),
});

export const RecurrenceRule = z.discriminatedUnion('kind', [
  RecurrenceNone,
  RecurrenceDaily,
  RecurrenceWeekly,
  RecurrenceMonthlyByDay,
  RecurrenceMonthlyByWeekday,
  RecurrenceExplicitDates,
]);
export type RecurrenceRule = z.infer<typeof RecurrenceRule>;

// Classroom representation
export const Classroom = z.object({
  id: z.string().optional(), // Unique identifier for the classroom
  campus: z.string().optional(),
  building: z.string().optional(),
  room: z.string().min(1),
  capacity: z.number().int().positive().optional(),
  features: z.array(z.string()).default([]),
  notes: z.string().optional(), // Additional information about the classroom
});
export type Classroom = z.infer<typeof Classroom>;

// Per-class meeting definition
export const ClassBlock = z.object({
  id: z.string().optional(), // optional identifier
  title: z.string().min(1),
  location: z.string().optional(),
  description: z.string().optional(),

  // Base timing: first occurrence date + local start/end times
  startDate: IsoDate.optional(), // first valid date of this class block; if not set, use the first day after termStart that matches the weekday
  endDate: IsoDate.optional(), // overall end (term end). If not set, use recurrence.until or schedule.termEnd

  // Different times for different weekdays (optional, overrides startTime/endTime for specific days)
  weekdaySchedule: z.partialRecord(
    Weekday,
    z.object({
      startTime: IsoTime,
      endTime: IsoTime,
    }),
  ),

  // Recurrence definition
  recurrence: RecurrenceRule,

  // Exceptions and overrides
  skipDates: z.array(IsoDate).default([]), // dates to skip
  overrides: z
    .array(
      z.object({
        date: IsoDate, // specific date
        startTime: IsoTime.optional(), // override start time
        endTime: IsoTime.optional(), // override end time
        location: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .default([]),

  // Optional instructor and tags
  instructor: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type ClassBlock = z.infer<typeof ClassBlock>;

// A normalized event instance (resolved occurrence)
// Useful for exporting to calendars or UI preview
export const EventInstance = z.object({
  classId: z.string().optional(),
  title: z.string(),
  date: IsoDate,
  startDateTimeLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/, 'YYYY-MM-DDTHH:MM:00'),
  endDateTimeLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/, 'YYYY-MM-DDTHH:MM:00'),
  location: z.string().optional(),
  description: z.string().optional(),
});
export type EventInstance = z.infer<typeof EventInstance>;

// The overall schedule
export const Schedule = z
  .object({
    timeZone: IanaTZ, // e.g., "Europe/Paris"
    // Academic term boundaries (helpful for generating occurrences)
    termStart: IsoDate.optional(),
    termEnd: IsoDate.optional(),
    classes: z.array(ClassBlock).nonempty(),

    // Optional precomputed instances (if you choose to materialize)
    eventInstances: z.array(EventInstance).optional(),
  })
  .superRefine((val, ctx) => {
    // Basic consistency checks
    if (val.termStart && val.termEnd && val.termEnd < val.termStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['termEnd'],
        message: 'termEnd must be on or after termStart',
      });
    }

    for (const [i, c] of val.classes.entries()) {
      // endDate should not be before startDate if provided
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
