require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const app = require('./src/app');
const { initSocket } = require('./src/config/socket');

const PORT = process.env.PORT || 4000;
const HTTP_REDIRECT_PORT = process.env.HTTP_REDIRECT_PORT || 4080;

const KEY_PATH = process.env.HTTPS_KEY_PATH || path.join(__dirname, 'certs', 'key.pem');
const CERT_PATH = process.env.HTTPS_CERT_PATH || path.join(__dirname, 'certs', 'cert.pem');

const certsExist = fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH);

if (!certsExist) {
  console.error('✘ No se encontraron los certificados TLS.');
  console.error(`  Esperados en: ${KEY_PATH} y ${CERT_PATH}`);
  console.error('  Genera un certificado local de prueba con:');
  console.error('    bash scripts/generar-certificado.sh');
  process.exit(1);
}

const httpsOptions = {
  key: fs.readFileSync(KEY_PATH),
  cert: fs.readFileSync(CERT_PATH)
};

const httpsServer = https.createServer(httpsOptions, app);

// Los videos se transcodifican en el mismo request (sharp/ffmpeg), lo cual
// puede tardar varios minutos en archivos grandes. Se amplian los timeouts
// por defecto de Node para que esa espera no corte la conexion a mitad de camino.
httpsServer.timeout = 15 * 60 * 1000; // 15 minutos
httpsServer.requestTimeout = 15 * 60 * 1000;
httpsServer.headersTimeout = 15 * 60 * 1000 + 5000;

// Socket.io funciona sobre el mismo servidor HTTPS y mismo puerto
initSocket(httpsServer, process.env.CLIENT_URL || '*');

httpsServer.listen(PORT, () => {
  console.log(`Servidor HTTPS escuchando en https://localhost:${PORT}`);
  console.log('Socket.io listo para conexiones en tiempo real (wss://)');
  console.log('Certificado autofirmado: el navegador mostrara una advertencia la primera vez, es normal en desarrollo.');
});

// Redirige cualquier peticion HTTP en texto plano hacia HTTPS,
// para que nunca se filtren credenciales/tokens sin cifrar por error.
if (process.env.DISABLE_HTTP_REDIRECT !== 'true') {
  http
    .createServer((req, res) => {
      const host = (req.headers.host || `localhost:${PORT}`).split(':')[0];
      res.writeHead(301, { Location: `https://${host}:${PORT}${req.url}` });
      res.end();
    })
    .listen(HTTP_REDIRECT_PORT, () => {
      console.log(`Redirección HTTP -> HTTPS activa en el puerto ${HTTP_REDIRECT_PORT}`);
    });
}
