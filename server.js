const http = require('node:http');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.AUDIO_CONVERTER_SECRET || '';
const MAX_BYTES = Number(process.env.MAX_INPUT_BYTES || 25 * 1024 * 1024);

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        reject(new Error('Input file is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function convertMp3ToOgg(mp3) {
  return new Promise((resolve, reject) => {
    const input = crypto.randomBytes(16).toString('hex');
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'mp3', '-i', 'pipe:0',
      '-map_metadata', '-1',
      '-vn',
      '-c:a', 'libopus',
      '-application', 'voip',
      '-b:a', '32k',
      '-ar', '48000',
      '-ac', '1',
      '-f', 'ogg',
      'pipe:1'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    const out = [];
    const errors = [];
    ffmpeg.stdout.on('data', chunk => out.push(chunk));
    ffmpeg.stderr.on('data', chunk => errors.push(chunk));
    ffmpeg.on('error', err => reject(new Error(`FFmpeg could not start: ${err.message}`)));
    ffmpeg.on('close', code => {
      if (code !== 0) {
        reject(new Error(`FFmpeg conversion failed (${input}): ${Buffer.concat(errors).toString().slice(0, 1200)}`));
        return;
      }
      resolve(Buffer.concat(out));
    });
    ffmpeg.stdin.end(mp3);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, 'ok');
  }

  if (req.method !== 'POST' || req.url !== '/convert') {
    return send(res, 404, 'Not found');
  }

  if (SECRET && req.headers.authorization !== `Bearer ${SECRET}`) {
    return send(res, 401, 'Unauthorized');
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('audio/mpeg') && !contentType.includes('audio/mp3') && !contentType.includes('application/octet-stream')) {
    return send(res, 415, 'Expected an MP3 body with Content-Type audio/mpeg.');
  }

  try {
    const mp3 = await readBody(req);
    if (!mp3.length) return send(res, 400, 'Empty input.');
    const ogg = await convertMp3ToOgg(mp3);
    res.writeHead(200, {
      'Content-Type': 'audio/ogg',
      'Content-Length': String(ogg.length),
      'Content-Disposition': 'attachment; filename="voice-message.ogg"',
      'Cache-Control': 'no-store'
    });
    res.end(ogg);
  } catch (err) {
    console.error(err);
    send(res, 500, err?.message || 'Conversion failed.');
  }
});

server.listen(PORT, () => console.log(`Audio converter listening on ${PORT}`));
