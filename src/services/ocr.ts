import { Effect } from 'effect';
import type { IanaMediaType } from '../generated/iana-media-types';

export class ScheduleOCR extends Effect.Service<ScheduleOCR>()('scheduleocr', {
  effect: Effect.gen(function* () {
    function extractFromBytes(input: Uint8Array, mediaType: IanaMediaType) {
      return Effect.succeed(`${input} is a ${mediaType}`);
    }
    return {
      extractFromBytes,
    } as const;
  }),
}) {}
