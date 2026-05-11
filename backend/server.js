
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

const PASTA = 'S:\\';

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

app.post('/perguntar', (req, res) => {

    const pergunta = req.body.pergunta || '';

    const resultados = buscarArquivos(PASTA, pergunta);

    res.json({
        resultados
    });

});

app.listen(3333, () => {

    console.log('Servidor iniciado na porta 3333');

    const { exec } = require('child_process');

    exec('start http://localhost:3333');

});
