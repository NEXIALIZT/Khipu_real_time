// Cargar el polyfill localmente por si acaso
require('./polyfill-styletext.js');

const { spawn } = require('child_process');
const path = require('path');

const polyfillPath = path.resolve(__dirname, 'polyfill-styletext.js');

// Convertir a forward-slashes para evitar el problema de barras en NODE_OPTIONS en Windows
const safePolyfillPath = polyfillPath.split(path.sep).join('/');

console.log('Iniciando servidor de Khipu Guia...');

// Usamos "npx expo start --web" con shell:true para que funcione en Windows sin encontrar el binario exacto
const child = spawn('npx', ['expo', 'start', '--web'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_OPTIONS: `--require "${safePolyfillPath}"`
  }
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('Error al iniciar el proceso Expo:', err);
  process.exit(1);
});
