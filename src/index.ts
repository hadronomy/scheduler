import { Command } from '@effect/cli';
import { BunContext } from '@effect/platform-bun';
import { Cause, Effect, Exit, Logger } from 'effect';

import { AppConfig, ConfigLive } from '~/config';

const program = Effect.gen(function* () {
  const cfg = yield* AppConfig;
  yield* Effect.log('Initialized configuration', cfg);
  const files = [];
  yield* Effect.log(`Found ${files.length} files in folder`);
});

const command = Command.make('schedule', {}, () => program);

const cli = Command.run(command, {
  name: 'scheduler',
  version: 'v1.0.0',
});

cli(process.argv)
  .pipe(
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
