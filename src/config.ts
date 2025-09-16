import { Config, Context, Effect, Layer, Redacted } from 'effect';

export const AppEnvConfig = Config.all({
  OPENROUTER_API_KEY: requiredRedactedString(
    'OPENROUTER_API_KEY',
    'OpenRouter API key is required',
  ),
  OPENAI_API_KEY: requiredRedactedString(
    'OPENAI_API_KEY',
    'OpenAI API key is required',
  ),
  OCR_BASE_URL: urlWithDefault(
    'OCR_BASE_URL',
    new URL('http://127.0.0.1:5555'),
  ),
  GOOGLE_CALENDAR_ID: requiredString(
    'GOOGLE_CALENDAR_ID',
    'Google Calendar ID is required',
  ),
  GOOGLE_CLIENT_ID: requiredString(
    'GOOGLE_CLIENT_ID',
    'Google Client ID is required',
  ),
  GOOGLE_CLIENT_SECRET: requiredRedactedString(
    'GOOGLE_CLIENT_SECRET',
    'Google Client Secret is required',
  ),
  GOOGLE_REDIRECT_URI: Config.url('GOOGLE_REDIRECT_URI'),
  GOOGLE_REFRESH_TOKEN: requiredRedactedString(
    'GOOGLE_REFRESH_TOKEN',
    'Google Refresh Token is required',
  ),
});

function requiredString(name: string, message: string) {
  return Config.string(name).pipe(
    Config.validate({
      message,
      validation: (s) => s.length > 0,
    }),
  );
}

function requiredRedactedString(name: string, message: string) {
  return Config.redacted(Config.string(name)).pipe(
    Config.validate({
      message,
      validation: (s) => Redacted.value(s).length > 0,
    }),
  );
}

function urlWithDefault(name: string, def: URL) {
  return Config.url(name).pipe(Config.withDefault(def));
}

type InferConfig<T> = T extends Config.Config<infer A> ? A : never;
export type AppEnv = InferConfig<typeof AppEnvConfig>;

export class AppConfig extends Context.Tag('AppConfig')<AppConfig, AppEnv>() {}

const loadConfig = Effect.gen(function* () {
  yield* Effect.log('Initialized configuration')
  const env = yield* AppEnvConfig;
  return env;
});

export const ConfigLive = Layer.effect(AppConfig, loadConfig);

export const getConfig = Effect.flatMap(AppConfig, (cfg) =>
  Effect.succeed(cfg),
);
