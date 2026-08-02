"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const node_test_1 = __importDefault(require("node:test"));
const InterAuthService_1 = require("./InterAuthService");
function createService(options = {}) {
    const certificateDirectory = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'inter-auth-test-'));
    const certPath = (0, node_path_1.join)(certificateDirectory, 'client.crt');
    const keyPath = (0, node_path_1.join)(certificateDirectory, 'client.key');
    (0, node_fs_1.writeFileSync)(certPath, 'test-certificate');
    (0, node_fs_1.writeFileSync)(keyPath, 'test-private-key');
    return {
        service: new InterAuthService_1.InterAuthService({
            tokenUrl: 'https://example.test/oauth/token',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            certPath,
            keyPath,
            ...options,
        }),
        cleanup: () => (0, node_fs_1.rmSync)(certificateDirectory, { force: true, recursive: true }),
    };
}
function replaceHttp(service, post) {
    service.http = { post };
}
(0, node_test_1.default)('reutiliza token ainda fora da margem de expiração', async () => {
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
        strict_1.default.equal(first, 'cached-token');
        strict_1.default.equal(second, 'cached-token');
        strict_1.default.equal(requestCount, 1);
    }
    finally {
        cleanup();
    }
});
(0, node_test_1.default)('renova token dentro da margem de cinco minutos', async () => {
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
        strict_1.default.equal(renewedToken, 'token-2');
        strict_1.default.equal(requestCount, 2);
    }
    finally {
        cleanup();
    }
});
(0, node_test_1.default)('compartilha uma única solicitação para escopos iguais em paralelo', async () => {
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
        strict_1.default.equal(first, 'parallel-token');
        strict_1.default.equal(second, 'parallel-token');
        strict_1.default.equal(requestCount, 1);
    }
    finally {
        cleanup();
    }
});
(0, node_test_1.default)('tenta novamente após HTTP 503', async () => {
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
        strict_1.default.equal(token, 'retry-token');
        strict_1.default.equal(requestCount, 2);
    }
    finally {
        cleanup();
    }
});
(0, node_test_1.default)('rejeita lista vazia de escopos', async () => {
    const { service, cleanup } = createService();
    try {
        await strict_1.default.rejects(service.getValidToken([]), InterAuthService_1.InterAuthError);
    }
    finally {
        cleanup();
    }
});
(0, node_test_1.default)('informa erro quando certificado não pode ser lido', () => {
    strict_1.default.throws(() => new InterAuthService_1.InterAuthService({
        tokenUrl: 'https://example.test/oauth/token',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        certPath: (0, node_path_1.join)((0, node_os_1.tmpdir)(), 'arquivo-inexistente.crt'),
        keyPath: (0, node_path_1.join)((0, node_os_1.tmpdir)(), 'arquivo-inexistente.key'),
    }), InterAuthService_1.InterAuthError);
});
