import { Cause, Effect, Exit, Logger } from 'effect';
import { AppConfig, ConfigLive } from './config';

const program = Effect.gen(function* () {
  const cfg = yield* AppConfig;
  yield* Effect.log('Initialized configuration', cfg);
  const files = [];
  yield* Effect.log(`Found ${files.length} files in folder`);
});

program
  .pipe(
    Effect.provide(ConfigLive),
    Effect.provide(Logger.pretty),
    Effect.runPromiseExit,
  )
  .then((exit) => {
    if (Exit.isFailure(exit)) {
      console.error(Cause.pretty(exit.cause));
    }
  });
