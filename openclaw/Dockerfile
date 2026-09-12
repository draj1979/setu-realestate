FROM node:22-bookworm-slim

WORKDIR /app

RUN npm install -g openclaw@2026.9.1

COPY openclaw.json /app/openclaw.json
COPY setu-sales-workspace /app/workspace

ENV NODE_ENV=production
ENV PORT=8080
ENV OPENCLAW_STATE_DIR=/app/state
ENV OPENCLAW_CONFIG_PATH=/app/openclaw.json

EXPOSE 8080

CMD ["openclaw", "gateway", "run", "--bind", "lan", "--port", "8080"]
