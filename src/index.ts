import { Command } from '@effect/cli';
import { BunContext } from '@effect/platform-bun';
import { Cause, Effect, Exit, Logger } from 'effect';

import { FileSystem } from '@effect/platform';
import { AppConfig, ConfigLive } from '~/config';
import { AIProvider } from './services/ai';
import { ScheduleOCR } from './services/ocr';

const program = Effect.gen(function* () {
  const cfg = yield* AppConfig;
  yield* Effect.log('Initialized configuration', cfg);
  const ocr = yield* ScheduleOCR;
  const fs = yield* FileSystem.FileSystem;
  const buffer = yield* fs.readFile('/Users/hadronomy/Downloads/G026_HOR_2025-2026-1C-4-1.pdf');
  const response = yield* ocr.extractFromBytes(
    buffer,
    'application/pdf',
  );
  yield* Effect.log(response.object);
});

const command = Command.make('schedule', {}, () => program);

const cli = Command.run(command, {
  name: 'scheduler',
  version: 'v1.0.0',
});

cli(process.argv)
  .pipe(
    Effect.provide(ScheduleOCR.Default),
    Effect.provide(AIProvider.Default),
    Effect.provide(BunContext.layer),
    Effect.provide(ConfigLive),
    Effect.provide(Logger.pretty),
    Effect.runPromiseExit,
  )
  .then((exit) => {
    if (Exit.isFailure(exit)) {
      console.error(Cause.pretty(exit.cause));
    }
  });
