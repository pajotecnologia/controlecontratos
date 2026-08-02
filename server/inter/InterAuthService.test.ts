import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { InterAuthError, InterAuthService } from './InterAuthService';

type HttpStub = {
  post: () => Promise<unknown>;
};

function createService(options: { max503Retries?: number; retryDelayMs?: number } = {}): {
  service: InterAuthService;
  cleanup: () => void;
} {
  const certificateDirectory = mkdtempSync(join(tmpdir(), 'inter-auth-test-'));
  const certPath = join(certificateDirectory, 'client.crt');
  const keyPath = join(certificateDirectory, 'client.key');

  writeFileSync(certPath, 'test-certificate');
  writeFileSync(keyPath, 'test-private-key');

  return {
    service: new InterAuthService({
      tokenUrl: 'https://example.test/oauth/token',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      certPath,
      keyPath,
      ...options,
    }),
    cleanup: () => rmSync(certificateDirectory, { force: true, recursive: true }),
  };
}

function replaceHttp(service: InterAuthService, post: HttpStub['post']): void {
  (service as unknown as { http: HttpStub }).http = { post };
}

test('reutiliza token ainda fora da margem de expiração', async () => {
  const { service, cleanup } = createService();
  let requestCount = 0;

  replaceHttp(service, async () => {
    requestCount += 1;
    return {
      data: {
        access_token: 'cached-token',
        token_type: 'Bearer',
        expires_in: 3600,
      },
    };
  });

  try {
    const first = await service.getValidToken(['boleto-cobranca.read']);
    const second = await service.getValidToken(['boleto-cobranca.read']);

    assert.equal(first, 'cached-token');
    assert.equal(second, 'cached-token');
    assert.equal(requestCount, 1);
  } finally {
    cleanup();
  }
});

test('renova token dentro da margem de cinco minutos', async () => {
  const { service, cleanup } = createService();
  let requestCount = 0;

  replaceHttp(service, async () => {
    requestCount += 1;
    return {
      data: {
        access_token: `token-${requestCount}`,
        token_type: 'Bearer',
        expires_in: 300,
      },
    };
  });

  try {
    await service.getValidToken(['boleto-cobranca.read']);
    const renewedToken = await service.getValidToken(['boleto-cobranca.read']);

    assert.equal(renewedToken, 'token-2');
    assert.equal(requestCount, 2);
  } finally {
    cleanup();
  }
});

test('compartilha uma única solicitação para escopos iguais em paralelo', async () => {
  const { service, cleanup } = createService();
  let requestCount = 0;

  replaceHttp(service, async () => {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));

    return {
      data: {
        access_token: 'parallel-token',
        token_type: 'Bearer',
        expires_in: 3600,
      },
    };
  });

  try {
    const [first, second] = await Promise.all([
      service.getValidToken(['boleto-cobranca.read', 'pix.read']),
      service.getValidToken(['pix.read', 'boleto-cobranca.read']),
    ]);

    assert.equal(first, 'parallel-token');
    assert.equal(second, 'parallel-token');
    assert.equal(requestCount, 1);
  } finally {
    cleanup();
  }
});

test('tenta novamente após HTTP 503', async () => {
  const { service, cleanup } = createService({ max503Retries: 1, retryDelayMs: 1 });
  let requestCount = 0;

  replaceHttp(service, async () => {
    requestCount += 1;

    if (requestCount === 1) {
      throw {
        isAxiosError: true,
        code: 'ERR_BAD_RESPONSE',
        response: {
          status: 503,
          statusText: 'Service Unavailable',
          data: { error: 'temporarily_unavailable' },
        },
      };
    }

    return {
      data: {
        access_token: 'retry-token',
        token_type: 'Bearer',
        expires_in: 3600,
      },
    };
  });

  try {
    const token = await service.getValidToken(['boleto-cobranca.read']);

    assert.equal(token, 'retry-token');
    assert.equal(requestCount, 2);
  } finally {
    cleanup();
  }
});

test('rejeita lista vazia de escopos', async () => {
  const { service, cleanup } = createService();

  try {
    await assert.rejects(service.getValidToken([]), InterAuthError);
  } finally {
    cleanup();
  }
});

test('informa erro quando certificado não pode ser lido', () => {
  assert.throws(
    () =>
      new InterAuthService({
        tokenUrl: 'https://example.test/oauth/token',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        certPath: join(tmpdir(), 'arquivo-inexistente.crt'),
        keyPath: join(tmpdir(), 'arquivo-inexistente.key'),
      }),
    InterAuthError,
  );
});
