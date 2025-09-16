import { generateObject, NoObjectGeneratedError } from 'ai';
import { Effect } from 'effect';

import type { IanaMediaType } from '~/generated/iana-media-types';
import { Schedule } from '~/schemas/schedule';
import { AIProviders as AIProvider } from '~/services/ai';

const SYSTEM_PROMPT = `
You are an expert at parsing university timetables from unstructured text extracted from PDFs. Your task is to extract the entire schedule into a structured JSON object that strictly conforms to the provided Zod schema for "Schedule". Do not add extra fields or deviate from the schema. Output only the validated JSON object—no explanations, no additional text.

Schema reminders (must follow exactly):
- Schedule.timeZone: IANA string.
- Schedule.termStart/termEnd: YYYY-MM-DD.
- Schedule.classes: array of ClassBlock.
- ClassBlock.title: string (subject full Spanish name).
- ClassBlock.group: optional; either a single string OR a non-empty list of strings. Preserve tokens exactly as printed, e.g., "PE101", "PA101", "TU101", "(1)". Use this to distinguish variants.
- ClassBlock.recurrence: discriminated union. Choose exactly one:
  - { "kind": "simpleWeekly", "byDays": [...], "startTime": "HH:MM:SS", "endTime": "HH:MM:SS", "interval"?: 1, "until"?: "YYYY-MM-DD" }
  - { "kind": "weekly", "byDays": [...], "interval"?: 1, "until"?: "YYYY-MM-DD" }
  - Other kinds exist but are not needed here (daily, monthlyByDay, monthlyByWeekday, xDays).
- ClassBlock.weekdayOverrides: array to set weekday-specific time/location variations. Each item:
  { "weekday": "MO"|"TU"|"WE"|"TH"|"FR"|"SA"|"SU", "startTime"?: "HH:MM:SS", "endTime"?: "HH:MM:SS", "location"?: string, "description"?: string }.
- Dates must be YYYY-MM-DD; times must be HH:MM:SS (assume :00 seconds).

Critical formatting rules:
- Never repeat the title inside description. The description must not start with the subject name.
- Always extract and populate group if codes like PE101, PA101, TU101, or "(1)" appear. Do not leave these codes only in description.
- If a single timetable cell clearly lists multiple distinct group tokens for the same subject instance, set group as a list, e.g., ["PE101", "TU101"]. Otherwise, use a single string.
- Preserve group tokens exactly as printed (no added spaces or normalization).

Key guidelines for extraction:
- timeZone: Use "Atlantic/Canary" (timezone for Universidad de La Laguna in Tenerife, Spain).
- termStart and termEnd: First semester (primer cuatrimestre) of the 2025-2026 academic year.
  - termStart: "2025-09-09"
  - termEnd: "2025-12-19"
  - Ignore second semester.

- classes: Create one ClassBlock per subject variant, where variants are distinguished by the "group" field.
  - Variant separation rule (critical):
    - Entries like "Algoritmia PE101 (8h)", "Algoritmia PA101", "Algoritmia PE105" are separate ClassBlocks.
    - title: base subject name only (e.g., "ALGORITMIA").
    - group: the exact group token(s) present for that entry, e.g., "PE101", "PA101", "(1)". If both "PE101" and "TU101" are clearly tied to the same instance, use ["PE101", "TU101"].
    - description: include auxiliary notes like "(8h)" or other brief clarifications. Do not include the subject title here.

  - Recurrence modeling:
    - Same time on all listed days → use:
      { "recurrence": { "kind": "simpleWeekly", "byDays": [...], "startTime": "HH:MM:SS", "endTime": "HH:MM:SS" } }
    - Different times by weekday → use:
      { "recurrence": { "kind": "weekly", "byDays": [...] }, "weekdayOverrides": [ { "weekday": "...", "startTime": "...", "endTime": "..." }, ... ] }
    - Use interval: 1 and omit "until" (term bounds apply).

  - location: Parse room names (e.g., "Aula 1.1", "CajaCanarias - P1", "Sala 2.4"). If multiple rooms are listed across different weekdays for the same variant, set the most common one in "location" and specify others via weekdayOverrides.location. If no dominant room exists, leave "location" undefined and set per-override locations.

  - instructor: Not provided—leave undefined.

  - tags: Add relevant tags such as:
    - ["theory"] for "(1)", PA codes
    - ["practice"] for PE or TU codes
    - and optionally ["fourth year", "first semester"].

  - startDate and endDate: Leave undefined (term boundaries govern).
  - skipDates and overrides: Do not create any unless explicitly date-specific (none here).

Handling ambiguities:
- Overlapping slots across different subject variants belong to separate ClassBlocks.
- Durational hints like "(8h)" or "(14h)" go in description; prioritize explicit weekday/time slots.
- This schedule is for: "Cuarto curso - Primer cuatrimestre - Computación - Grupo 1".

Validation rules to respect:
- Weekdays must be one of: MO, TU, WE, TH, FR (weekend usually not used).
- Times must be local and formatted as HH:MM:SS (e.g., "09:00:00", "09:55:00").
- For simpleWeekly, endTime must be strictly after startTime.
- Use only fields defined by the schema; do not invent fields like "weekdaySchedule".

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
