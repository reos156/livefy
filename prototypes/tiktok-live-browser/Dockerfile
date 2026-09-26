FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    x11vnc \
    fluxbox \
    pulseaudio pulseaudio-utils \
    ffmpeg \
    wget \
    unzip \
    nodejs npm \
    chromium \
    chromium-l10n \
    websockify \
    && rm -rf /var/lib/apt/lists/*

# noVNC
RUN wget -qO- https://github.com/novnc/noVNC/archive/refs/tags/v1.4.0.tar.gz | tar xz -C /opt \
    && mv /opt/noVNC-1.4.0 /opt/noVNC \
    && ln -s /opt/noVNC/vnc.html /opt/noVNC/index.html

# PulseAudio
RUN mkdir -p /run/pulse && chmod 777 /run/pulse
RUN echo "load-module module-native-protocol-unix auth-anonymous=1 socket=/run/pulse/native" > /etc/pulse/system.pa && \
    echo "load-module module-null-sink sink_name=tiktok_sink" >> /etc/pulse/system.pa && \
    echo "load-module module-always-sink" >> /etc/pulse/system.pa

ENV PULSE_SERVER=unix:/run/pulse/native
ENV DISPLAY=:99
ENV SCREEN_RESOLUTION=1280x720

WORKDIR /app
COPY package.json /app/package.json
RUN npm install

COPY entrypoint.sh /entrypoint.sh
COPY audio-server.js /app/audio-server.js
RUN chmod +x /entrypoint.sh

EXPOSE 3000 3001
ENTRYPOINT ["/entrypoint.sh"]