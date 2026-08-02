import axios, { type AxiosError, type AxiosInstance } from 'axios';
import { readFileSync } from 'node:fs';
import { Agent as HttpsAgent } from 'node:https';

export interface InterTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface InterOAuthErrorResponse {
  error?: string;
  error_description?: string;
}

export interface InterAuthServiceOptions {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  certPath: string;
  keyPath: string;
  keyPassphrase?: string;
  timeoutMs?: number;
  max503Retries?: number;
  retryDelayMs?: number;
}

interface CachedToken {
  token: string;
  refreshAtEpochMs: number;
  expiresAtEpochMs: number;
}

interface InterAuthErrorDetails {
  status?: number;
  code?: string;
  oauthError?: InterOAuthErrorResponse;
}

const TOKEN_EXPIRATION_MARGIN_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_503_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 750;

export class InterAuthError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  public readonly oauthError?: InterOAuthErrorResponse;

  public constructor(message: string, details: InterAuthErrorDetails = {}) {
    super(message);

    this.name = 'InterAuthError';
    this.status = details.status;
    this.code = details.code;
    this.oauthError = details.oauthError;
  }
}

export class InterAuthService {
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly http: AxiosInstance;
  private readonly max503Retries: number;
  private readonly retryDelayMs: number;

  private readonly tokenCache = new Map<string, CachedToken>();
  private readonly pendingRequests = new Map<string, Promise<string>>();

  public constructor(options: InterAuthServiceOptions) {
    this.tokenUrl = validateHttpsUrl(options.tokenUrl);
    this.clientId = requireValue(options.clientId, 'clientId');
    this.clientSecret = requireValue(options.clientSecret, 'clientSecret', false);

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.max503Retries = options.max503Retries ?? DEFAULT_MAX_503_RETRIES;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

    validateInteger(timeoutMs, 'timeoutMs', 1);
    validateInteger(this.max503Retries, 'max503Retries', 0);
    validateInteger(this.retryDelayMs, 'retryDelayMs', 1);

    let cert: Buffer;
    let key: Buffer;

    try {
      cert = readFileSync(requireValue(options.certPath, 'certPath'));
      key = readFileSync(requireValue(options.keyPath, 'keyPath'));
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'erro desconhecido';

      throw new InterAuthError(`Falha ao carregar certificado mTLS: ${reason}`);
    }

    const httpsAgent = new HttpsAgent({
      cert,
      key,
      passphrase: options.keyPassphrase || undefined,
      rejectUnauthorized: true,
      keepAlive: true,
      minVersion: 'TLSv1.2',
    });

    this.http = axios.create({
      httpsAgent,
      timeout: timeoutMs,
      maxRedirects: 0,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  public static fromEnv(env: NodeJS.ProcessEnv = process.env): InterAuthService {
    return new InterAuthService({
      tokenUrl: requireEnv(env, 'INTER_TOKEN_URL'),
      clientId: requireEnv(env, 'INTER_CLIENT_ID'),
      clientSecret: requireEnv(env, 'INTER_CLIENT_SECRET', false),
      certPath: requireEnv(env, 'INTER_CERT_PATH'),
      keyPath: requireEnv(env, 'INTER_KEY_PATH'),
      keyPassphrase: env.INTER_KEY_PASSPHRASE || undefined,
      timeoutMs: parseOptionalInteger(env.INTER_HTTP_TIMEOUT_MS, 'INTER_HTTP_TIMEOUT_MS', 1),
      max503Retries: parseOptionalInteger(env.INTER_MAX_503_RETRIES, 'INTER_MAX_503_RETRIES', 0),
      retryDelayMs: parseOptionalInteger(env.INTER_RETRY_DELAY_MS, 'INTER_RETRY_DELAY_MS', 1),
    });
  }

  public async getValidToken(scopes: string[]): Promise<string> {
    const normalizedScopes = normalizeScopes(scopes);
    const cacheKey = normalizedScopes.join(' ');
    const now = Date.now();
    const cachedToken = this.tokenCache.get(cacheKey);

    if (cachedToken && now < cachedToken.refreshAtEpochMs) {
      return cachedToken.token;
    }

    const pendingRequest = this.pendingRequests.get(cacheKey);

    if (pendingRequest) {
      return pendingRequest;
    }

    const request = this.requestNewToken(normalizedScopes, cacheKey);

    this.pendingRequests.set(cacheKey, request);

    try {
      return await request;
    } finally {
      if (this.pendingRequests.get(cacheKey) === request) {
        this.pendingRequests.delete(cacheKey);
      }
    }
  }

  private async requestNewToken(scopes: string[], cacheKey: string): Promise<string> {
    const formBody = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials',
      scope: scopes.join(' '),
    }).toString();

    for (let attempt = 0; attempt <= this.max503Retries; attempt += 1) {
      const requestStartedAt = Date.now();

      try {
        const response = await this.http.post<InterTokenResponse>(this.tokenUrl, formBody);

        const data: unknown = response.data;

        if (!isInterTokenResponse(data)) {
          throw new InterAuthError('Resposta inválida recebida do endpoint OAuth do Inter');
        }

        const expiresAtEpochMs = requestStartedAt + data.expires_in * 1000;
        const refreshAtEpochMs = expiresAtEpochMs - TOKEN_EXPIRATION_MARGIN_MS;

        this.tokenCache.set(cacheKey, {
          token: data.access_token,
          refreshAtEpochMs,
          expiresAtEpochMs,
        });

        return data.access_token;
      } catch (error: unknown) {
        const mayRetry = isAxios503Error(error) && attempt < this.max503Retries;

        if (mayRetry) {
          const delayMs = this.retryDelayMs * (attempt + 1);

          await sleep(delayMs);
          continue;
        }

        throw toInterAuthError(error);
      }
    }

    throw new InterAuthError('Falha inesperada ao obter token OAuth do Inter');
  }
}

function normalizeScopes(scopes: string[]): string[] {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new InterAuthError('Informe pelo menos um escopo OAuth');
  }

  const normalized = scopes.map((scope) => {
    if (typeof scope !== 'string') {
      throw new InterAuthError('Cada escopo OAuth deve ser uma string');
    }

    const value = scope.trim();

    if (!value || /\s/.test(value)) {
      throw new InterAuthError(`Escopo OAuth inválido: "${scope}"`);
    }

    return value;
  });

  return [...new Set(normalized)].sort();
}

function isInterTokenResponse(value: unknown): value is InterTokenResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<InterTokenResponse>;

  return (
    typeof candidate.access_token === 'string' &&
    candidate.access_token.length > 0 &&
    typeof candidate.token_type === 'string' &&
    candidate.token_type.length > 0 &&
    typeof candidate.expires_in === 'number' &&
    Number.isFinite(candidate.expires_in) &&
    candidate.expires_in > 0 &&
    (candidate.scope === undefined || typeof candidate.scope === 'string')
  );
}

function isAxios503Error(error: unknown): error is AxiosError<InterOAuthErrorResponse> {
  return axios.isAxiosError(error) && error.response?.status === 503;
}

function toInterAuthError(error: unknown): InterAuthError {
  if (error instanceof InterAuthError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const statusText = error.response?.statusText;
    const oauthError = parseOAuthError(error.response?.data);

    let message = 'Falha ao obter token OAuth do Inter';

    if (status) {
      message += ` | HTTP ${status}`;

      if (statusText) {
        message += ` ${statusText}`;
      }
    }

    if (error.code) {
      message += ` | código ${error.code}`;
    }

    const apiDescription = oauthError?.error_description ?? oauthError?.error;

    if (apiDescription) {
      message += ` | ${apiDescription}`;
    }

    return new InterAuthError(message, {
      status,
      code: error.code,
      oauthError,
    });
  }

  const reason = error instanceof Error ? error.message : 'erro desconhecido';

  return new InterAuthError(`Falha inesperada ao obter token OAuth do Inter: ${reason}`);
}

function parseOAuthError(value: unknown): InterOAuthErrorResponse | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const candidate = value as InterOAuthErrorResponse;

  const error = typeof candidate.error === 'string' ? candidate.error : undefined;

  const errorDescription =
    typeof candidate.error_description === 'string' ? candidate.error_description : undefined;

  if (!error && !errorDescription) {
    return undefined;
  }

  return {
    error,
    error_description: errorDescription,
  };
}

function validateHttpsUrl(value: string): string {
  const rawUrl = requireValue(value, 'tokenUrl');

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new InterAuthError('tokenUrl deve ser uma URL válida');
  }

  if (url.protocol !== 'https:') {
    throw new InterAuthError('tokenUrl deve usar HTTPS');
  }

  if (url.username || url.password) {
    throw new InterAuthError('tokenUrl não pode conter credenciais');
  }

  return url.toString();
}

function requireEnv(env: NodeJS.ProcessEnv, name: string, trim = true): string {
  const value = env[name];

  if (value === undefined || value.length === 0) {
    throw new InterAuthError(`Variável obrigatória ausente: ${name}`);
  }

  return trim ? value.trim() : value;
}

function requireValue(value: string, name: string, trim = true): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InterAuthError(`Configuração obrigatória ausente: ${name}`);
  }

  return trim ? value.trim() : value;
}

function parseOptionalInteger(
  value: string | undefined,
  name: string,
  minimum: number,
): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);

  validateInteger(parsed, name, minimum);

  return parsed;
}

function validateInteger(value: number, name: string, minimum: number): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new InterAuthError(`${name} deve ser um inteiro maior ou igual a ${minimum}`);
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
