import { Context, Effect } from 'effect';
import { type IanaMediaType } from '../generated/iana-media-types';

export class ScheduleOCR extends Context.Tag('ScheduleOCR')<
  ScheduleOCR,
  {
    readonly extractFromBytes: (
      input: Uint8Array,
      mediaType: IanaMediaType,
    ) => Effect.Effect<never, Error, never>;
  }
>() {}
