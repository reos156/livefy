#!/bin/bash
set -e

rm -f /run/pulse/pid

echo "Iniciando PulseAudio..."
pulseaudio --system --disallow-exit --disallow-module-loading --disable-shm --exit-idle-time=-1 &
for i in $(seq 1 15); do
    if [ -S /run/pulse/native ]; then echo "PulseAudio listo."; break; fi
    sleep 1
done
[ ! -S /run/pulse/native ] && { echo "ERROR: PulseAudio no se inició."; exit 1; }

pactl set-default-sink tiktok_sink 2>/dev/null || echo "Aviso: no se pudo establecer sink"

echo "Iniciando Xvfb..."
Xvfb $DISPLAY -screen 0 ${SCREEN_RESOLUTION}x24 &
for i in $(seq 1 10); do
    if xdpyinfo -display $DISPLAY >/dev/null 2>&1; then echo "Xvfb listo."; break; fi
    sleep 1
done

fluxbox -display $DISPLAY &

echo "Iniciando Chrome..."
export PULSE_SINK=tiktok_sink
chromium --no-sandbox --disable-gpu \
         --disable-dbus --disable-notifications \
         --alsa-output-device=default \
         --window-size=${SCREEN_RESOLUTION} \
         --app=https://www.tiktok.com/@jdenglish20/live \
         --display=$DISPLAY &

sleep 5

echo "Iniciando x11vnc en 5900..."
x11vnc -display $DISPLAY -forever -nopw -shared -rfbport 5900 &

echo "Iniciando websockify (puerto 3000 → VNC 5900)..."
websockify --web /opt/noVNC 0.0.0.0:3000 localhost:5900 &

# Servidor de audio + página combinada (puerto 3001)
cd /app
node audio-server.js &

wait