const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

const PASTA = 'S:\\';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

app.use(express.static(path.join(__dirname, '../frontend')));

function buscarArquivos(dir, termo, resultados = []) {

    try {

        const arquivos = fs.readdirSync(dir);

        arquivos.forEach((arquivo) => {

            const full = path.join(dir, arquivo);

            try {

                const stat = fs.statSync(full);

                if(stat.isDirectory()){

                    buscarArquivos(full, termo, resultados);

                }else{

                    if(
                        arquivo.toLowerCase().includes(
                            termo.toLowerCase()
                        )
                    ){
                        resultados.push(full);
                    }

                }

            } catch(err){}

        });

    } catch(err){}

    return resultados;
}

async function perguntarOllama(pergunta, resultados = []) {
    const prompt = [
        'Você é o Dazul Insight AI e responde em português do Brasil.',
        'Use os resultados da busca para orientar a resposta quando fizer sentido.',
        resultados.length > 0
            ? `Resultados encontrados:\n${resultados.slice(0, 50).map((item, i) => `${i + 1}. ${item}`).join('\n')}`
            : 'Nenhum arquivo foi encontrado para esta busca.',
        `Pergunta do usuário: ${pergunta}`
    ].join('\n\n');

    const resposta = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            prompt,
            stream: false
        })
    });

    if (!resposta.ok) {
        throw new Error(`Falha ao consultar Ollama (HTTP ${resposta.status})`);
    }

    const dados = await resposta.json();
    return (dados.response || '').trim();
}

app.post('/perguntar', async (req, res) => {

    const pergunta = req.body.pergunta || '';

    const resultados = buscarArquivos(PASTA, pergunta);

    try {
        const respostaIA = await perguntarOllama(pergunta, resultados);

        res.json({
            resultados,
            respostaIA
        });
    } catch (err) {
        res.status(502).json({
            resultados,
            erro: 'Não foi possível conectar ao Ollama. Verifique se o serviço está ativo.',
            detalhe: err.message
        });
    }

});

app.listen(3333, () => {

    console.log('Servidor iniciado na porta 3333');

    const { exec } = require('child_process');

    exec('start http://localhost:3333');

});
