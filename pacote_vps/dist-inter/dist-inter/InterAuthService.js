"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterAuthService = exports.InterAuthError = void 0;
const axios_1 = __importDefault(require("axios"));
const node_fs_1 = require("node:fs");
const node_https_1 = require("node:https");
const TOKEN_EXPIRATION_MARGIN_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_503_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 750;
class InterAuthError extends Error {
    status;
    code;
    oauthError;
    constructor(message, details = {}) {
        super(message);
        this.name = 'InterAuthError';
        this.status = details.status;
        this.code = details.code;
        this.oauthError = details.oauthError;
    }
}
exports.InterAuthError = InterAuthError;
class InterAuthService {
    tokenUrl;
    clientId;
    clientSecret;
    http;
    max503Retries;
    retryDelayMs;
    tokenCache = new Map();
    pendingRequests = new Map();
    constructor(options) {
        this.tokenUrl = validateHttpsUrl(options.tokenUrl);
        this.clientId = requireValue(options.clientId, 'clientId');
        this.clientSecret = requireValue(options.clientSecret, 'clientSecret', false);
        const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.max503Retries = options.max503Retries ?? DEFAULT_MAX_503_RETRIES;
        this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
        validateInteger(timeoutMs, 'timeoutMs', 1);
        validateInteger(this.max503Retries, 'max503Retries', 0);
        validateInteger(this.retryDelayMs, 'retryDelayMs', 1);
        let cert;
        let key;
        try {
            cert = (0, node_fs_1.readFileSync)(requireValue(options.certPath, 'certPath'));
            key = (0, node_fs_1.readFileSync)(requireValue(options.keyPath, 'keyPath'));
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : 'erro desconhecido';
            throw new InterAuthError(`Falha ao carregar certificado mTLS: ${reason}`);
        }
        const httpsAgent = new node_https_1.Agent({
            cert,
            key,
            passphrase: options.keyPassphrase || undefined,
            rejectUnauthorized: true,
            keepAlive: true,
            minVersion: 'TLSv1.2',
        });
        this.http = axios_1.default.create({
            httpsAgent,
            timeout: timeoutMs,
            maxRedirects: 0,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    }
    static fromEnv(env = process.env) {
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
    async getValidToken(scopes) {
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
        }
        finally {
            if (this.pendingRequests.get(cacheKey) === request) {
                this.pendingRequests.delete(cacheKey);
            }
        }
    }
    async requestNewToken(scopes, cacheKey) {
        const formBody = new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'client_credentials',
            scope: scopes.join(' '),
        }).toString();
        for (let attempt = 0; attempt <= this.max503Retries; attempt += 1) {
            const requestStartedAt = Date.now();
            try {
                const response = await this.http.post(this.tokenUrl, formBody);
                const data = response.data;
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
            }
            catch (error) {
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
exports.InterAuthService = InterAuthService;
function normalizeScopes(scopes) {
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
function isInterTokenResponse(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate = value;
    return (typeof candidate.access_token === 'string' &&
        candidate.access_token.length > 0 &&
        typeof candidate.token_type === 'string' &&
        candidate.token_type.length > 0 &&
        typeof candidate.expires_in === 'number' &&
        Number.isFinite(candidate.expires_in) &&
        candidate.expires_in > 0 &&
        (candidate.scope === undefined || typeof candidate.scope === 'string'));
}
function isAxios503Error(error) {
    return axios_1.default.isAxiosError(error) && error.response?.status === 503;
}
function toInterAuthError(error) {
    if (error instanceof InterAuthError) {
        return error;
    }
    if (axios_1.default.isAxiosError(error)) {
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
function parseOAuthError(value) {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    const candidate = value;
    const error = typeof candidate.error === 'string' ? candidate.error : undefined;
    const errorDescription = typeof candidate.error_description === 'string' ? candidate.error_description : undefined;
    if (!error && !errorDescription) {
        return undefined;
    }
    return {
        error,
        error_description: errorDescription,
    };
}
function validateHttpsUrl(value) {
    const rawUrl = requireValue(value, 'tokenUrl');
    let url;
    try {
        url = new URL(rawUrl);
    }
    catch {
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
function requireEnv(env, name, trim = true) {
    const value = env[name];
    if (value === undefined || value.length === 0) {
        throw new InterAuthError(`Variável obrigatória ausente: ${name}`);
    }
    return trim ? value.trim() : value;
}
function requireValue(value, name, trim = true) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new InterAuthError(`Configuração obrigatória ausente: ${name}`);
    }
    return trim ? value.trim() : value;
}
function parseOptionalInteger(value, name, minimum) {
    if (value === undefined || value.trim() === '') {
        return undefined;
    }
    const parsed = Number(value);
    validateInteger(parsed, name, minimum);
    return parsed;
}
function validateInteger(value, name, minimum) {
    if (!Number.isInteger(value) || value < minimum) {
        throw new InterAuthError(`${name} deve ser um inteiro maior ou igual a ${minimum}`);
    }
}
function sleep(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}
