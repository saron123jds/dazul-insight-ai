# Dazul Insight AI v5

## O que mudou

- Interface reformulada com status de conexão do servidor.
- Busca com feedback de carregamento e envio por Enter.
- Endpoint `/health` para diagnosticar se backend está online.
- Busca com fallback automático de pasta:
  - Usa `SEARCH_ROOT` se existir.
  - Se não existir, usa `~/Documents`.
  - Se `Documents` não existir, usa `~`.
- Erros do Ollama agora mostram dica clara para teste no terminal.

## Como usar

1. Inicie o Ollama:
   - `ollama serve`
2. Baixe o modelo (uma vez):
   - `ollama pull llama3.1`
3. Teste o modelo local:
   - `ollama run llama3.1`
4. Inicie o sistema:
   - `npm install`
   - `npm start`
5. Abra `http://localhost:3333`

## Variáveis de ambiente

- `PORT` (padrão: `3333`)
- `OLLAMA_URL` (padrão: `http://127.0.0.1:11434/api/generate`)
- `OLLAMA_MODEL` (padrão: `llama3.1`)
- `SEARCH_ROOT` (padrão: `S:\`)
- `SEARCH_LIMIT` (padrão: `200`)

## Diagnóstico rápido

- Backend online: `http://localhost:3333/health`
- Se clicar em **Pesquisar** e nada acontecer:
  - confira se o backend está rodando;
  - confira se o Ollama está ativo;
  - teste no terminal com `ollama run llama3.1`.
