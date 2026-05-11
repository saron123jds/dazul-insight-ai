const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3333);
const SEARCH_ROOT = process.env.SEARCH_ROOT || 'S:\\';
const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';
const OLLAMA_MODEL = 'llama3.1:latest';
const OLLAMA_TIMEOUT_MS = 180000;
const SEARCH_LIMIT = Number(process.env.SEARCH_LIMIT || 200);
const SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS || 5000);

app.use(express.static(path.join(__dirname, '../frontend')));



function resolverPastaBusca() {
  if (SEARCH_ROOT && fs.existsSync(SEARCH_ROOT)) {
    return SEARCH_ROOT;
  }

  const fallback = path.join(os.homedir(), 'Documents');

  if (fs.existsSync(fallback)) {
    return fallback;
  }

  return os.homedir();
}

function buscarArquivos(dir, termo, resultados = [], opcoes = {}) {
  const limite = opcoes.limite ?? SEARCH_LIMIT;
  const inicio = opcoes.inicio ?? Date.now();
  const timeoutMs = opcoes.timeoutMs ?? SEARCH_TIMEOUT_MS;

  if (Date.now() - inicio > timeoutMs || resultados.length >= limite) {
    return resultados;
  }

  let arquivos;

  try {
    arquivos = fs.readdirSync(dir);
  } catch {
    return resultados;
  }

  for (const arquivo of arquivos) {
    if (resultados.length >= limite || Date.now() - inicio > timeoutMs) {
      break;
    }

    const full = path.join(dir, arquivo);

    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      buscarArquivos(full, termo, resultados, { limite, inicio, timeoutMs });
      continue;
    }

    if (arquivo.toLowerCase().includes(termo.toLowerCase())) {
      resultados.push(full);
    }
  }

  return resultados;
}

async function perguntarOllama(pergunta, resultados = []) {
  const prompt = [
    'Você é o Dazul Insight AI e responde em português do Brasil.',
    'Use os resultados da busca para orientar a resposta quando fizer sentido.',
    resultados.length > 0
      ? `Resultados encontrados:\n${resultados
          .slice(0, 50)
          .map((item, i) => `${i + 1}. ${item}`)
          .join('\n')}`
      : 'Nenhum arquivo foi encontrado para esta busca.',
    `Pergunta do usuário: ${pergunta}`,
  ].join('\n\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    console.log('Consultando Ollama...');

    const resposta = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();

      if (resposta.status === 404) {
        throw new Error(`Modelo não encontrado no Ollama: ${OLLAMA_MODEL}. Detalhe: ${detalhe}`);
      }

      throw new Error(`Falha ao consultar Ollama (HTTP ${resposta.status}). Detalhe: ${detalhe}`);
    }

    const dados = await resposta.json();
    console.log('Resposta recebida');
    const texto = (dados.response || '').trim();

    if (!texto) {
      throw new Error('Ollama respondeu sem conteúdo. Verifique se o modelo está carregado corretamente.');
    }

    return texto;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(err);
      throw new Error(`Tempo limite excedido ao consultar o Ollama (${OLLAMA_TIMEOUT_MS}ms).`);
    }

    console.error(err);

    if (err.code === 'ECONNREFUSED') {
      throw new Error('Conexão recusada pelo Ollama em 127.0.0.1:11434. Verifique se o serviço está online.');
    }

    if (err.cause && err.cause.code === 'ECONNREFUSED') {
      throw new Error('Ollama offline ou inacessível em 127.0.0.1:11434 (ECONNREFUSED).');
    }

    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    porta: PORT,
    pastaBusca: resolverPastaBusca(),
    ollamaUrl: OLLAMA_URL,
    ollamaModel: OLLAMA_MODEL,
  });
});

app.post('/perguntar', async (req, res) => {
  const pergunta = (req.body.pergunta || '').trim();

  if (pergunta.length < 3) {
    return res.status(400).json({
      resultados: [],
      erro: 'Digite pelo menos 3 caracteres para pesquisar.',
    });
  }

  const pastaBusca = resolverPastaBusca();
  const resultados = buscarArquivos(pastaBusca, pergunta);

  try {
    const respostaIA = await perguntarOllama(pergunta, resultados);

    return res.json({
      resultados,
      respostaIA,
      pastaBusca,
    });
  } catch (err) {
    return res.status(502).json({
      resultados,
      erro: 'Não foi possível conectar ao Ollama. Verifique se o serviço está ativo e com modelo baixado.',
      detalhe: err.message,
      dica: `Teste no terminal: ollama run ${OLLAMA_MODEL}`,
      pastaBusca,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
  console.log(`Pasta de busca ativa: ${resolverPastaBusca()}`);

  if (process.platform === 'win32') {
    const { exec } = require('child_process');
    exec(`start http://localhost:${PORT}`);
  }
});
