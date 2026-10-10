FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates curl unzip git && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --break-system-packages --no-cache-dir --pre -U "yt-dlp[default]" curl-cffi bgutil-ytdlp-pot-provider

RUN curl -fsSL https://deno.land/install.sh | sh
ENV PATH="/root/.deno/bin:${PATH}"
ENV YTDLP_POT_PROVIDER="http://127.0.0.1:4416"
RUN git clone --depth 1 --branch 2.0.0 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil-ytdlp-pot-provider
RUN cd /opt/bgutil-ytdlp-pot-provider/server && /root/.deno/bin/deno install --allow-scripts=npm\:canvas --frozen

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

RUN mkdir -p /app/downloads /app/uploads /app/data
ENV NODE_ENV=production
EXPOSE 10000
CMD ["sh", "-c", "cd /opt/bgutil-ytdlp-pot-provider/server/node_modules && /root/.deno/bin/deno run --allow-env --allow-net --allow-ffi=. --allow-read=. ../src/main.ts & sleep 3; cd /app && exec npm start"]
