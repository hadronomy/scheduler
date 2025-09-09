import { Config, Context, Effect, Layer, Redacted } from 'effect';

export type AppEnv = {
  OPENROUTER_API_KEY: Redacted.Redacted<string>; // redacted for safety
  OCR_BASE_URL: URL;

  GOOGLE_CALENDAR_ID: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: Redacted.Redacted<string>; // redacted
  GOOGLE_REDIRECT_URI: URL;
  GOOGLE_REFRESH_TOKEN: Redacted.Redacted<string>; // redacted
};

const AppEnvConfig: Config.Config<AppEnv> = Config.all([
  Config.redacted(Config.string('OPENROUTER_API_KEY')).pipe(
    Config.validate({
      message: 'OpenRouter API key is required',
      validation: (s) => Redacted.value(s).length > 0,
    }),
  ),

  Config.url('OCR_BASE_URL').pipe(
    Config.withDefault(new URL('http://127.0.0.1:5555')),
  ),

  Config.string('GOOGLE_CALENDAR_ID').pipe(
    Config.validate({
      message: 'Google Calendar ID is required',
      validation: (s) => s.length > 0,
    }),
  ),
  Config.string('GOOGLE_CLIENT_ID').pipe(
    Config.validate({
      message: 'Google Client ID is required',
      validation: (s) => s.length > 0,
    }),
  ),
  Config.redacted(Config.string('GOOGLE_CLIENT_SECRET')).pipe(
    Config.validate({
      message: 'Google Client Secret is required',
      validation: (s) => Redacted.value(s).length > 0,
    }),
  ),
  Config.url('GOOGLE_REDIRECT_URI'),

  Config.redacted(Config.string('GOOGLE_REFRESH_TOKEN')).pipe(
    Config.validate({
      message: 'Google Refresh Token is required',
      validation: (s) => Redacted.value(s).length > 0,
    }),
  ),
]).pipe(
  Config.map(
    ([
      OPENROUTER_API_KEY,
      OCR_BASE_URL,
      GOOGLE_CALENDAR_ID,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI,
      GOOGLE_REFRESH_TOKEN,
    ]) =>
      ({
        OPENROUTER_API_KEY,
        OCR_BASE_URL,
        GOOGLE_CALENDAR_ID,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI,
        GOOGLE_REFRESH_TOKEN,
      }) satisfies AppEnv,
  ),
);

export class AppConfig extends Context.Tag('AppConfig')<AppConfig, AppEnv>() {}

const loadConfig = Effect.gen(function* () {
  const env = yield* AppEnvConfig;
  return env;
});

export const ConfigLive = Layer.effect(AppConfig, loadConfig);

export const getConfig = Effect.flatMap(AppConfig, (cfg) =>
  Effect.succeed(cfg),
);
