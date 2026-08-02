"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const node_path_1 = require("node:path");
const InterAuthService_1 = require("./InterAuthService");
dotenv_1.default.config({ path: (0, node_path_1.resolve)(__dirname, '..', '.env') });
async function main() {
    const scopes = process.argv.slice(2);
    if (scopes.length === 0) {
        throw new InterAuthService_1.InterAuthError('Informe pelo menos um escopo. Exemplo: npm run example:inter -- boleto-cobranca.read');
    }
    const authService = InterAuthService_1.InterAuthService.fromEnv();
    await authService.getValidToken(scopes);
    console.log('Token OAuth do Banco Inter obtido com sucesso. Token não exibido por segurança.');
}
void main().catch((error) => {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    console.error(`Falha ao autenticar no Banco Inter: ${message}`);
    process.exitCode = 1;
});
