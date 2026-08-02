import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { InterAuthError, InterAuthService } from './InterAuthService';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

async function main(): Promise<void> {
  const scopes = process.argv.slice(2);

  if (scopes.length === 0) {
    throw new InterAuthError('Informe pelo menos um escopo. Exemplo: npm run example:inter -- boleto-cobranca.read');
  }

  const authService = InterAuthService.fromEnv();

  await authService.getValidToken(scopes);

  console.log('Token OAuth do Banco Inter obtido com sucesso. Token não exibido por segurança.');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';

  console.error(`Falha ao autenticar no Banco Inter: ${message}`);
  process.exitCode = 1;
});
