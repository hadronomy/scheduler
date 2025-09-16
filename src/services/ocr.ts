import { generateObject, NoObjectGeneratedError } from 'ai';
import { Effect } from 'effect';

import type { IanaMediaType } from '~/generated/iana-media-types';
import { Schedule } from '~/schemas/schedule';
import { AIProviders as AIProvider } from '~/services/ai';

const SYSTEM_PROMPT = `
You are an expert at parsing university timetables from unstructured PDF text.
Extract the entire schedule into a structured JSON object that strictly
conforms to the provided Zod schema "Schedule". Output only the validated JSON
object—no explanations, no extra text.

Schema reminders (must follow exactly):
- Schedule.timeZone: IANA string.
- Schedule.termStart / Schedule.termEnd: YYYY-MM-DD.
- Schedule.series: a registry of subjects (series), keyed by a stable slug.
  Each entry:
    {
      "title": "<base subject name>",
      "variants": ["<variantKey1>", "<variantKey2>", ...],
      "tags"?: [...],
      "description"?: string,
      "location"?: string,
      "color"?: string
    }
- Schedule.items: array of items. For PDF timetables use "recurring" items.
  Each recurring item:
    {
      "kind": "recurring",
      "seriesId": "<key in Schedule.series>",
      "variant": { "key": "<one of series[seriesId].variants>" },
      "on": { "freq": "weekly", "byWeekday": ["MO","WE"], "interval"?: 1 },
      "startTime": "HH:MM:SS",
      "endTime": "HH:MM:SS",
      "startOn"?: "YYYY-MM-DD",
      "endOn"?: "YYYY-MM-DD",
      "exclude": [],
      "overrides"?: { "YYYY-MM-DD": { ... } }
    }

Critical rules:
- Build the "series" registry first:
  - One series per distinct subject (base title).
  - series key (seriesId) = a stable slug from the title:
    - lower-case, ASCII only; remove diacritics; replace spaces with "-";
      remove punctuation.
    - Example: "Algoritmia y Estructuras de Datos" → "algoritmia-y-estructuras-de-datos".
  - series[seriesId].title = the base subject name as printed (keep accents).
  - series[seriesId].variants = list of all group tokens for that subject
    (e.g., "PE101", "PA101", "TU101", "(1)"), preserved exactly as printed.

- Variant binding:
  - Every class entry in items must include both seriesId and variant.
  - variant.key must be exactly one of series[seriesId].variants.

- Variant separation rule (important):
  - If a timetable cell shows multiple group tokens tied to the same
    time slot (e.g., "PE101" and "TU101"), create one recurring item per token
    (duplicate the slot), not a combined variant array.
  - Different time windows for the same subject/variant on different weekdays
    must be split into separate recurring items, each with a uniform time window
    and its own "byWeekday" subset.

- Recurrence modeling (weekly schedules):
  - Use: { "on": { "freq": "weekly", "byWeekday": [...] } }.
  - Always include "byWeekday" for weekly recurrences.
  - Use "interval": 1 (omit if not shown).
  - Set "startOn" = termStart and "endOn" = termEnd unless explicit different
    bounds are printed.

- Times and dates:
  - Times must be HH:MM:SS (assume :00 seconds if not printed).
  - Dates must be YYYY-MM-DD (local).
  - The schedule is local to Schedule.timeZone.

- Location handling:
  - If the same location applies to all listed weekdays for an item, set it on
    the item.
  - If locations differ by weekday, split into multiple items (one per distinct
    time+location set).

- Tags (optional but recommended):
  - Add ["theory"] for "(1)" or "PA" codes.
  - Add ["practice"] for "PE" or "TU" codes.
  - Optionally add ["fourth year", "first semester"].

- Do not include fields not defined by the schema.
- Do not repeat the title inside description. The description must not start
  with the subject name.
- Preserve group tokens exactly as printed in variant.key and in the series
  variants list.

Guidelines for this dataset:
- timeZone: "Atlantic/Canary" (Universidad de La Laguna, Tenerife).
- Term window (Cuarto curso - Primer cuatrimestre - 2025-2026):
  - termStart: "2025-09-09"
  - termEnd: "2025-12-19"
- Only include first semester content.

Output:
- Produce ONLY the JSON object that validates against the schema.
`;

export class ScheduleOCR extends Effect.Service<ScheduleOCR>()('scheduleocr', {
  effect: Effect.gen(function* () {
    function extractFromBytes(input: Uint8Array, mediaType: IanaMediaType) {
      return Effect.gen(function* () {
        const { openrouter } = yield* AIProvider;
        const response = yield* Effect.tryPromise({
          try: async () =>
            await generateObject({
              model: openrouter('google/gemini-2.5-pro'),
              system: SYSTEM_PROMPT,
              schema: Schedule,
              temperature: 0,
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'file',
                      data: input,
                      mediaType: mediaType,
                    },
                  ],
                },
              ],
            }),
          catch: (e) => e,
        }).pipe(
          Effect.tapError((e) =>
            Effect.gen(function* () {
              if (NoObjectGeneratedError.isInstance(e)) {
                yield* Effect.logError('NoObjectGeneratedError', e);
              }
              yield* Effect.logError(e);
            }),
          ),
        );
        return response;
      });
    }
    return {
      extractFromBytes,
    } as const;
  }),
}) {}
