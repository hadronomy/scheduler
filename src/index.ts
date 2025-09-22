import { Command } from '@effect/cli';
import { FileSystem } from '@effect/platform';
import { BunContext } from '@effect/platform-bun';
import { Cause, Deferred, Effect, Exit, Logger } from 'effect';
import open from 'open';

import { AppConfig } from '~/config';
import { AIProviders } from '~/services/ai';
import { CodeDeferred, GoogleAuth } from '~/services/google/auth';
import { ScheduleOCR } from '~/services/ocr';

const program = Effect.gen(function* () {
  const ocr = yield* ScheduleOCR;
  const auth = yield* GoogleAuth.GoogleAuth;
  const code = yield* CodeDeferred.CodeDeferred;
  const authURL = yield* auth.getAuthURL;
  open(authURL.url);
  const token = yield* Deferred.await(code);
  yield* Effect.log('Token', token);
  const fs = yield* FileSystem.FileSystem;
  const buffer = yield* fs.readFile(
    '/Users/hadronomy/Downloads/G026_HOR_2025-2026-1C-4-1.pdf',
  );
  yield* Effect.log('Extracting data from document');
  const { object: schedule } = yield* ocr.extractFromBytes(
    buffer,
    'application/pdf',
  );
  yield* Effect.log(schedule);
  yield* Effect.log(
    'Number of distinct classes',
    Object.keys(schedule.series).length,
  );
});

const command = Command.make('schedule', {}, () => program);

const cli = Command.run(command, {
  name: 'scheduler',
  version: 'v1.0.0',
});

cli(process.argv)
  .pipe(
    Effect.provide(ScheduleOCR.Default),
    Effect.provide(AIProviders.Default),
    Effect.provide(GoogleAuth.layerWithoutDependencies),
    Effect.provide(CodeDeferred.layer),
    Effect.provide(BunContext.layer),
    Effect.provide(AppConfig.layer),
    Effect.provide(Logger.pretty),
    Effect.runPromiseExit,
  )
  .then((exit) => {
    if (Exit.isFailure(exit)) {
      console.error(Cause.pretty(exit.cause));
    }
  });
