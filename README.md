# Voice-message OGG/Opus converter

Small Node.js HTTP service for the Sanne/Walid Telegram bot.

## Endpoints

- `GET /health` → `ok`
- `POST /convert` → accepts MP3 bytes and returns a genuine OGG container with Opus audio.

## Output

- OGG container
- Opus codec (`libopus`)
- 48 kHz
- mono
- 32 kbps
- filename: `voice-message.ogg`

## Environment

- `PORT` (default 3000)
- `AUDIO_CONVERTER_SECRET` (recommended)
- `MAX_INPUT_BYTES` (default 25 MiB)

## Docker

The Dockerfile installs FFmpeg and runs the Node server. The service is intentionally stateless: audio is kept in memory only for the duration of a request and is not written to disk.
