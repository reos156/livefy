const http = require('http');
const url = require('url');
const { spawn } = require('child_process');

const server = http.createServer((req, res) => {
  serveHTML(req, res);
});

const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

let audioCapture = null;
let clients = new Set();
let killTimer = null;

function startAudioCapture() {
  if (audioCapture) return;
  console.log('Iniciando captura de audio...');
  const child = spawn('ffmpeg', [
    '-f', 'pulse',
    '-i', 'tiktok_sink.monitor',
    '-f', 's16le',          // PCM 16-bit little-endian
    '-acodec', 'pcm_s16le',
    '-ar', '48000',
    '-ac', '2',
    'pipe:1'
  ]);
  const capture = { child, stopRequested: false, stopSignalSent: false };
  audioCapture = capture;

  child.stdout.on('data', (chunk) => {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(Buffer.from(chunk));
      }
    }
  });

  child.stderr.on('data', (d) => process.stderr.write(d));
  child.on('close', (code, signal) => {
    const isCurrentCapture = audioCapture === capture;
    if (isCurrentCapture) audioCapture = null;

    const exitDetails = `código ${code}, señal ${signal ?? 'ninguna'}`;
    if (capture.stopRequested && capture.stopSignalSent) {
      console.info(`Captura de ffmpeg detenida por la desconexión del último cliente (${exitDetails})`);
    } else if (code !== 0 || signal !== null) {
      console.error(`ffmpeg terminó inesperadamente (${exitDetails})`);
    } else {
      console.log(`ffmpeg terminó correctamente (${exitDetails})`);
    }

    if (isCurrentCapture && clients.size > 0) {
      setTimeout(() => {
        if (clients.size > 0) startAudioCapture();
      }, 1000);
    }
  });
  child.on('error', (err) => {
    console.error('Error en el proceso ffmpeg:', err);
  });
}

function stopAudioCapture() {
  const capture = audioCapture;
  if (capture) {
    capture.stopRequested = true;
    capture.stopSignalSent = capture.child.kill('SIGTERM');
    if (audioCapture === capture) audioCapture = null;
  }
}

wss.on('connection', (ws) => {
  console.log('Cliente conectado al audio');
  clients.add(ws);
  if (clients.size === 1) {
    if (killTimer) {
      clearTimeout(killTimer);
      killTimer = null;
    }
    startAudioCapture();
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Cliente desconectado');
    if (clients.size === 0) {
      killTimer = setTimeout(() => {
        if (clients.size === 0) stopAudioCapture();
      }, 2000);
    }
  });

  ws.on('error', (err) => console.error('WebSocket error:', err));
});

function serveHTML(req, res) {
  const vncUrl = `http://${req.headers.host.split(':')[0]}:3000`;  // noVNC + websockify
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TikTok Live + Audio</title>
  <style>
    body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #000; }
    iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
    #audio-overlay {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.6); z-index: 20; cursor: pointer;
      backdrop-filter: blur(5px);
    }
    #audio-btn {
      background: #e74c3c; color: white; border: none; padding: 20px 40px;
      font-size: 24px; border-radius: 12px; font-weight: bold;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5); cursor: pointer;
      display: flex; align-items: center; gap: 10px;
    }
    #audio-btn:hover { background: #c0392b; }
    #audio-status {
      position: absolute; bottom: 10px; right: 10px;
      background: rgba(0,0,0,0.7); color: white; padding: 5px 10px;
      border-radius: 5px; font-family: sans-serif; font-size: 12px; z-index: 10;
    }
  </style>
</head>
<body>
  <iframe src="${vncUrl}" scrolling="no"></iframe>

  <div id="audio-overlay">
    <button id="audio-btn">🔊 Activar audio</button>
  </div>

  <div id="audio-status">🔇 Audio: esperando activación</div>

  <script>
    (() => {
      const overlay = document.getElementById('audio-overlay');
      const btn = document.getElementById('audio-btn');
      const statusDiv = document.getElementById('audio-status');
      let audioCtx = null;
      let ws = null;
      let audioStarted = false;

      function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(protocol + '//' + window.location.host);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
          console.log('WebSocket conectado para audio');
          statusDiv.innerHTML = '🔊 Audio: conectado (esperando datos)';
        };

        ws.onmessage = (event) => {
          if (!audioCtx || audioCtx.state !== 'running') return;

          const pcm = new Int16Array(event.data);
          const sampleRate = 48000;
          const channels = 2;
          const frameCount = pcm.length / channels;
          if (frameCount === 0) return;

          const buffer = audioCtx.createBuffer(channels, frameCount, sampleRate);
          const left = buffer.getChannelData(0);
          const right = buffer.getChannelData(1);
          for (let i = 0; i < frameCount; i++) {
            left[i] = pcm[i * 2] / 32768;
            right[i] = pcm[i * 2 + 1] / 32768;
          }

          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          source.start();
        };

        ws.onclose = () => {
          console.log('WebSocket cerrado, reintentando...');
          statusDiv.innerHTML = '🔇 Audio: desconectado';
          if (!audioStarted) return;
          setTimeout(connectWebSocket, 2000);
        };

        ws.onerror = (err) => console.error('Error WebSocket:', err);
      }

      // Conectar al WebSocket inmediatamente (no se reproducirá hasta activación)
      connectWebSocket();

      btn.addEventListener('click', async () => {
        try {
          if (!audioCtx) {
            audioCtx = new AudioContext();
          }
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          audioStarted = true;
          overlay.style.display = 'none';
          statusDiv.innerHTML = '🔊 Audio: activo';
          console.log('AudioContext activado, estado:', audioCtx.state);
        } catch (err) {
          console.error('Error al activar audio:', err);
          alert('No se pudo activar el audio. Revisa los permisos del navegador.');
        }
      });

      // También se puede activar tocando el overlay
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) btn.click();
      });
    })();
  </script>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

server.listen(3001, () => {
  console.log('Servidor combinado escuchando en puerto 3001');
});