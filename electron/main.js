
const { app, BrowserWindow } = require('electron');

function createWindow() {

    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true
        }
    });

    win.loadFile('frontend/index.html');

}

app.whenReady().then(() => {
    createWindow();
});
