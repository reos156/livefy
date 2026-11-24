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
Xvfb "$DISPLAY" -screen 0 "${SCREEN_RESOLUTION}x24" &
for i in $(seq 1 10); do
    if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then echo "Xvfb listo."; break; fi
    sleep 1
done

fluxbox -display "$DISPLAY" &

# Keep the X server available only to its root-owned clients and Chromium.
xhost +SI:localuser:root +SI:localuser:chromium

echo "Iniciando Chrome..."
export PULSE_SINK=tiktok_sink
runuser --user chromium -- env \
    HOME=/home/chromium \
    XDG_CONFIG_HOME=/home/chromium/.config \
    XDG_CACHE_HOME=/home/chromium/.cache \
    DISPLAY="$DISPLAY" \
    SCREEN_RESOLUTION="$SCREEN_RESOLUTION" \
    PULSE_SERVER="$PULSE_SERVER" \
    PULSE_SINK="$PULSE_SINK" \
    chromium --disable-gpu \
         --disable-setuid-sandbox \
         --disable-dbus --disable-notifications \
         --alsa-output-device=default \
         --user-data-dir=/home/chromium/profile \
         --window-size="$SCREEN_RESOLUTION" \
         --app=https://www.tiktok.com/@jdenglish20/live \
         --display="$DISPLAY" &

sleep 5

echo "Iniciando x11vnc en 5900..."
x11vnc -display $DISPLAY -forever -nopw -shared -rfbport 5900 &

echo "Iniciando websockify (puerto 3000 → VNC 5900)..."
websockify --web /opt/noVNC 0.0.0.0:3000 localhost:5900 &

# Servidor de audio + página combinada (puerto 3001)
cd /app
node audio-server.js &

wait