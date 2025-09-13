import { generateObject } from 'ai';
import { Effect } from 'effect';

import type { IanaMediaType } from '~/generated/iana-media-types';
import { Schedule } from '~/schemas/schedule';
import { AIProvider } from '~/services/ai';

const SYSTEM_PROMPT = `
You are an expert at parsing university timetables from unstructured text extracted from PDFs. Your task is to extract the entire schedule into a structured JSON object that strictly conforms to the provided Zod schema for "Schedule". Do not add extra fields or deviate from the schema. Output only the validated JSON object—no explanations, no additional text.

Key guidelines for extraction:
- **timeZone**: Use "Atlantic/Canary" (the timezone for Universidad de La Laguna in Tenerife, Spain).
- **termStart** and **termEnd**: This is for the first semester (primer cuatrimestre) of the 2025-2026 academic year. Set termStart to "2025-09-09" (official start of classes) and termEnd to "2025-12-19" (end of first semester teaching period). Ignore second semester.
- **classes**: Create one ClassBlock per unique subject (e.g., "VISIÓN POR COMPUTADOR", "ROBÓTICA COMPUTACIONAL", etc.). Use the full Spanish subject name as the "title". 
  - For each subject, model the weekly recurring sessions across Monday (MO) to Friday (FR). Use "recurrence" as { kind: "weekly", interval: 1, byDays: array of relevant weekdays (e.g., ['MO', 'TU']) }.
  - Use "weekdaySchedule" to specify different startTime/endTime per weekday if the schedule varies (times in ISO 8601 format like "09:00:00" or "09:55:00"—assume seconds as :00).
  - Ignore one-off notes like room changes or approvals (e.g., "20250506: Aprobado...", "** La docencia..."). Do not model exceptions or overrides unless explicitly date-specific (there are none here).
  - "location": Parse room names (e.g., "Aula 1.1", "CajaCanarias - P1", "Sala 2.4"). If multiple rooms per subject, use the most common or note variations in "description". For codes like PE101 (practices), TU101 (theory), treat as part of the session (e.g., description: "PE101 (8h)").
  - "instructor": Not provided—leave as undefined.
  - "tags": Add relevant tags like ["theory", "practice"] if codes indicate (e.g., TU=theory, PE=practice), or ["fourth year", "first semester"].
  - "startDate" and "endDate": Leave undefined (use term boundaries via recurrence.until if needed, but schema allows optional).
  - Do not create eventInstances—leave as undefined.
- Handle ambiguities: 
  - Slots with multiple overlapping sessions (e.g., same time on different days) belong to different subjects—split into separate ClassBlocks.
  - Hours like "(8h)" or "(14h)" indicate session length or credits—incorporate into "description" if relevant, but prioritize time slots.
  - The schedule is for "Cuarto curso - Primer cuatrimestre - Computación - Grupo 1" (Fourth year, first semester, Computing group 1).
- Ensure all times are in local timezone (no UTC conversion).
- Validate against schema: Dates as YYYY-MM-DD, times as HH:MM:SS, weekdays as MO/TU/WE/TH/FR, etc. No relative dates—use absolute if needed.
`;

export class ScheduleOCR extends Effect.Service<ScheduleOCR>()('scheduleocr', {
  effect: Effect.gen(function* () {
    function extractFromBytes(input: Uint8Array, mediaType: IanaMediaType) {
      return Effect.gen(function* () {
        const provider = yield* AIProvider;
        const response = yield* Effect.promise(() =>
          generateObject({
            model: provider.model('google/gemini-2.5-flash-lite'),
            schema: Schedule,
            temperature: 0,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: SYSTEM_PROMPT,
                  },
                  {
                    type: 'file',
                    data: input,
                    mediaType: mediaType,
                  },
                ],
              },
            ],
          }),
        );
        return response;
      });
    }
    return {
      extractFromBytes,
    } as const;
  }),
}) {}
