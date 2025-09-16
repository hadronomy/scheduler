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

/**
 * Recurrence rule (RRULE-like, simplified)
 */
export const RecurrenceRule = z
  .object({
    freq: z
      .enum(['daily', 'weekly', 'monthly', 'yearly'])
      .describe('Base frequency'),
    interval: z
      .number()
      .int()
      .positive()
      .default(1)
      .optional()
      .describe('Step size (e.g., every 2 weeks)'),
    byWeekday: z
      .array(Weekday)
      .nonempty()
      .optional()
      .describe('Applicable weekdays (for weekly rules)'),
    byMonthday: z
      .array(z.number().int().min(1).max(31))
      .optional()
      .describe('Applicable month days (for monthly rules)'),
    byMonth: z
      .array(z.number().int().min(1).max(12))
      .optional()
      .describe('Applicable months (for yearly rules)'),
    nthWeekdayOfMonth: z
      .array(
        z.object({
          weekday: Weekday,
          nth: z.union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
            z.literal(-1), // last
          ]),
        }),
      )
      .optional()
      .describe('Nth weekday-of-month patterns'),
  })
  .describe('Recurrence rule definition');

export const OccurrenceOverride = z
  .union([
    z.object({ cancel: z.literal(true) }),
    z.object({
      start: IsoTime.optional(),
      end: IsoTime.optional(),
      title: z.string().optional(),
      location: z.string().optional(),
      description: z.string().optional(),
      color: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  ])
  .describe('Per-date override (or cancellation)');

/**
 * Series registry (shared metadata + allowed variants)
 */
export const SeriesEntry = z
  .object({
    title: z.string().min(1).describe('Base subject name'),
    description: z.string().optional(),
    color: z.string().optional(),
    location: z.string().optional(),
    tags: z.array(z.string()).default([]),
    meta: z.record(z.string(), z.unknown()).optional(),
    variants: z
      .array(z.string().min(1))
      .nonempty()
      .describe('Allowed variant keys for this series (e.g., PE101, PA101)'),
  })
  .describe('Shared series metadata and allowed variants');

export const SeriesRegistry = z
  .record(z.string(), SeriesEntry)
  .describe(
    'Series registry keyed by seriesId (stable slug); each value lists allowed variants',
  );

/**
 * Variant info attached to events
 */
export const VariantInfo = z
  .object({
    key: z.string().min(1).describe('Variant key (must be in series.variants)'),
    name: z.string().optional(),
    audienceId: z.string().optional(),
    capacity: z.number().int().positive().optional(),
  })
  .describe('Variant metadata bound to a series');

/**
 * Base item fields
 */
export const BaseItem = z.object({
  id: z.string().optional().describe('Item ID (optional)'),
  title: z.string().optional().describe('Optional display title override'),
  description: z.string().optional(),
  location: z.string().optional(),
  color: z.string().optional(),
  tags: z.array(z.string()).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),

  // Variant binding (enforced via superRefine):
  seriesId: z.string().optional(),
  variant: VariantInfo.optional(),
});

/**
 * Single event (absolute local datetimes)
 */
export const SingleEvent = BaseItem.extend({
  kind: z.literal('single'),
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, 'YYYY-MM-DDTHH:MM:SS')
    .describe('Local start datetime (no timezone offset)'),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, 'YYYY-MM-DDTHH:MM:SS')
    .describe('Local end datetime (no timezone offset)'),
  allDay: z.boolean().optional(),
}).describe('Single (non-recurring) event');

/**
 * Recurring event (weekly, etc.), local to schedule.timeZone
 */
export const RecurringEvent = BaseItem.extend({
  kind: z.literal('recurring'),
  on: RecurrenceRule.describe('Recurrence rule'),
  startTime: IsoTime.describe('Local start time for each occurrence'),
  endTime: IsoTime.describe('Local end time for each occurrence'),
  startOn: IsoDate.optional().describe('First valid date (inclusive)'),
  endOn: IsoDate.optional().describe('Last valid date (inclusive)'),
  exclude: z.array(IsoDate).default([]).describe('Dates to cancel'),
  overrides: z
    .record(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
        .describe('Date key in YYYY-MM-DD'),
      OccurrenceOverride,
    )
    .optional()
    .describe('Per-date overrides keyed by YYYY-MM-DD'),
}).describe('Recurring event');

/**
 * Item union
 */
export const ScheduleItem = z
  .discriminatedUnion('kind', [SingleEvent, RecurringEvent])
  .describe('Schedule item (single or recurring)');

/**
 * Overall schedule
 */
export const Schedule = z
  .object({
    id: z.string().optional().describe('Schedule ID (optional)'),
    timeZone: IanaTZ.describe('Schedule timezone (IANA)'),
    termStart: IsoDate.optional().describe('Optional term start date'),
    termEnd: IsoDate.optional().describe('Optional term end date'),
    series: SeriesRegistry.default({}).describe('Series registry'),
    items: z.array(ScheduleItem).describe('List of schedule items'),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.termStart && val.termEnd && val.termEnd < val.termStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['termEnd'],
        message: 'termEnd must be on or after termStart',
      });
    }

    // Validate items
    for (const [i, item] of val.items.entries()) {
      // series/variant pairing: both present or both absent
      const hasSeries = !!item.seriesId;
      const hasVariant = !!item.variant;
      if (hasSeries !== hasVariant) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', i, hasSeries ? 'variant' : 'seriesId'],
          message:
            'If seriesId is provided, variant must be provided (and vice versa)',
        });
      }

      // If bound, ensure seriesId exists and variant.key is allowed
      if (hasSeries && hasVariant) {
        const seriesEntry = val.series[item.seriesId as string];
        if (!seriesEntry) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', i, 'seriesId'],
            message: `seriesId "${item.seriesId}" not found in schedule.series`,
          });
          // biome-ignore lint/suspicious/noExplicitAny: allowed for now
        } else if (!seriesEntry.variants.includes((item.variant as any).key)) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', i, 'variant', 'key'],
            message:
              'variant.key must be one of series[seriesId].variants for this series',
          });
        }
      }

      // Per-item validations
      if (item.kind === 'recurring') {
        // Time window sanity: endTime > startTime (lexical compare on HH:MM:SS)
        if (item.endTime <= item.startTime) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', i, 'endTime'],
            message: 'endTime must be strictly after startTime',
          });
        }
        // startOn <= endOn
        if (item.startOn && item.endOn && item.endOn < item.startOn) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', i, 'endOn'],
            message: 'endOn must be on or after startOn',
          });
        }
        // Weekly rules should specify byWeekday
        if (
          item.on.freq === 'weekly' &&
          (!item.on.byWeekday || item.on.byWeekday.length === 0)
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', i, 'on', 'byWeekday'],
            message: 'Weekly recurrence must specify non-empty byWeekday',
          });
        }
      } else if (item.kind === 'single') {
        // end > start (lexical compare on full timestamp)
        if (item.end <= item.start) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', i, 'end'],
            message: 'end must be strictly after start',
          });
        }
      }
    }
  })
  .describe('Variant-aware schedule with series registry and items');

export type Schedule = z.infer<typeof Schedule>;
