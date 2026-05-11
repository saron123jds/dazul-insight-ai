
const fs = require('fs');
const path = require('path');

const pasta = 'S:\\';

function scan(dir) {
  try {
    const arquivos = fs.readdirSync(dir);

    arquivos.forEach((arquivo) => {
      const full = path.join(dir, arquivo);

      if (fs.statSync(full).isDirectory()) {
        scan(full);
      } else {
        console.log(full);
      }
    });
  } catch (err) {
    console.error(err);
  }
}

scan(pasta);
