import {
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform';
import { BunHttpServer } from '@effect/platform-bun';
import { Context, Data, Deferred, Effect, Layer, Redacted } from 'effect';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'node:crypto';

import { AppConfig } from '~/config';
import type { GOOGLE_OAUTH_SCOPES } from '~/generated/google-scopes';

export class GoogleAuthError extends Data.TaggedError('GoogleAuthError')<{
  message: string;
}> {}

export namespace CodeDeferred {
  export class CodeDeferred extends Context.Tag('CodeDeferred')<
    CodeDeferred,
    Deferred.Deferred<string, Error>
  >() {}

  export const layer = Layer.effect(
    CodeDeferred,
    Effect.gen(function* () {
      const deferred = yield* Deferred.make<string, Error>();
      return deferred;
    }),
  );
}

export const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/auth/google/callback',
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest;
      const codeDeferred = yield* CodeDeferred.CodeDeferred;

      // Build a URL from the request URL; base can be anything valid
      const url = new URL(req.url, 'http://localhost');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        // Notify waiter with failure and return 400 to the browser window
        yield* Deferred.fail(
          codeDeferred,
          new GoogleAuthError({ message: error }),
        );
        return HttpServerResponse.text(
          'OAuth error. You can close this window.',
          { status: 400 },
        );
      }

      if (!code) {
        return HttpServerResponse.text('Missing code', { status: 400 });
      }

      // Complete the Deferred and return success page
      yield* Deferred.succeed(codeDeferred, code);
      return HttpServerResponse.text(
        'Authentication complete. You can close this window.',
      );
    }),
  ),
);

export namespace GoogleAuth {
  export interface Service {
    readonly getClient: Effect.Effect<OAuth2Client>;
    readonly getAuthURL: Effect.Effect<{
      readonly url: string;
    }>;
  }

  export class GoogleAuth extends Effect.Tag('GoogleAuth')<
    GoogleAuth,
    Service
  >() {}

  const app = router.pipe(HttpServer.serve(), HttpServer.withLogAddress);
  const port = 8686;

  export const layerWithoutDependencies = Layer.scoped(
    GoogleAuth,
    Effect.gen(function* () {
      const cfg = yield* AppConfig.AppConfig;
      const state = crypto.randomUUID();
      yield* Effect.forkScoped(
        app.pipe(Layer.provide(BunHttpServer.layer({ port })), Layer.launch),
      );

      const client = new OAuth2Client({
        clientId: cfg.GOOGLE_CLIENT_ID,
        clientSecret: Redacted.value(cfg.GOOGLE_CLIENT_SECRET),
        redirectUri: cfg.GOOGLE_REDIRECT_URI.toString(),
      });

      const getClient = Effect.gen(function* () {
        return client;
      });

      const scope = Effect.fn(function* (...scopes: typeof GOOGLE_OAUTH_SCOPES[number][]) {
        return scopes.join(' ');
      });

      const getAuthURL = Effect.gen(function* () {
        yield* Effect.log('Generating auth url');
        const scopes = yield* scope(
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/calendar'
        );
        const authorizeUrl = client.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent',
          scope: scopes,
          redirect_uri: `http://localhost:${port}/auth/google/callback`,
          state,
        });
        return {
          url: authorizeUrl,
        } as const;
      });

      return {
        getClient,
        getAuthURL,
      };
    }),
  );

  export const layer = layerWithoutDependencies.pipe(
    Layer.provide(CodeDeferred.layer),
  );
}
