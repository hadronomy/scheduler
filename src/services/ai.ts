import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { Effect, Redacted } from 'effect';
import { AppConfig } from '~/config';

export class AIProvider extends Effect.Service<AIProvider>()('AIProvider', {
  effect: Effect.gen(function* () {
    yield* Effect.log('Initialized OpenRouter AIProvider');
    const cfg = yield* AppConfig;
    const openrouter = createOpenRouter({
      apiKey: Redacted.value(cfg.OPENROUTER_API_KEY),
      extraBody: {
        require_parameters: true,
      },
    });
    return {
      name: 'openrouter',
      model: openrouter,
    } as const;
  }),
}) {}
