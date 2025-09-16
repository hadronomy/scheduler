import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { Effect, Redacted } from 'effect';

import { AppConfig } from '~/config';

export class AIProviders extends Effect.Service<AIProviders>()('AIProvider', {
  effect: Effect.gen(function* () {
    const cfg = yield* AppConfig;
    yield* Effect.log('Initialized OpenRouter AIProvider');
    const openrouter = createOpenRouter({
      apiKey: Redacted.value(cfg.OPENROUTER_API_KEY),
      headers: {
        'X-Title': 'scheduler',
        'HTTP-Referer': 'https://scheduler.hadronomy.com',
      },
      extraBody: {
        require_parameters: true,
      },
    });
    yield* Effect.log('Initialized OpenAI AIProvider');
    const ai = createOpenAI({
      apiKey: Redacted.value(cfg.OPENAI_API_KEY),
    });
    return {
      openrouter,
      ai,
    } as const;
  }),
}) {}
