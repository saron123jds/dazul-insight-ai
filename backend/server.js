const express = require('express');
const cors = require('cors');
const path = require('path');
const { DataIndexer } = require('./indexer');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3333);
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:latest';
const OLLAMA_TIMEOUT_MS = 180000;

const indexer = new DataIndexer();
indexer.startAutoRefresh();

app.use(express.static(path.join(__dirname, '../frontend')));

async function perguntarOllama(pergunta, evidencias = []) {
  const prompt = [
    'Você é um analista interno da empresa Dazul.',
    'Regra obrigatória: SEMPRE responder com base nos dados reais indexados abaixo.',
    'Nunca responda genericamente. Se faltar dado, explique o que foi encontrado e conclua somente com evidências.',
    'Ao responder perguntas de ranking/vendas/metas/pedidos, monte tabela resumida com valores reais encontrados.',
    `Evidências encontradas (${evidencias.length}):`,
    ...evidencias.slice(0, 80).map((e, i) => `${i + 1}) fonte=${e.source} tipo=${e.type} tabela=${e.table} dado=${e.content}`),
    `Pergunta: ${pergunta}`,
  ].join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const resposta = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: controller.signal,
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      throw new Error(`Falha ao consultar Ollama (HTTP ${resposta.status}). ${detalhe}`);
    }

    const dados = await resposta.json();
    const texto = (dados.response || '').trim();
    if (!texto) throw new Error('Ollama respondeu sem conteúdo.');
    return texto;
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, porta: PORT, ollamaUrl: OLLAMA_URL, ollamaModel: OLLAMA_MODEL, indexador: indexer.status() });
});

app.post('/indexar', (_req, res) => {
  indexer.refresh();
  res.json({ ok: true, indexador: indexer.status() });
});

app.post('/perguntar', async (req, res) => {
  const pergunta = (req.body.pergunta || '').trim();
  if (pergunta.length < 3) {
    return res.status(400).json({ resultados: [], erro: 'Digite pelo menos 3 caracteres para pesquisar.' });
  }

  const resultados = indexer.search(pergunta, 50);

  try {
    const respostaIA = await perguntarOllama(pergunta, resultados);
    return res.json({ resultados, respostaIA, indexador: indexer.status() });
  } catch (err) {
    return res.status(502).json({
      resultados,
      erro: 'Não foi possível conectar ao Ollama. Verifique se o serviço está ativo e com modelo baixado.',
      detalhe: err.message,
      dica: `Teste no terminal: ollama run ${OLLAMA_MODEL}`,
      indexador: indexer.status(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});
