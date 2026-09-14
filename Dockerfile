# Production image for Cloud Run service phenomatch-web.
# Builds the Vite UI, then serves it from the Node matching API on $PORT.
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
# Vite + tsc import the Antiporn detector and Anon WebRTC helpers from here.
COPY shared ./shared
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV GCP_PROJECT_ID=devo-holding
ENV GCP_REGION=us-west1
ENV CLOUD_RUN_SERVICE=phenomatch-web
ENV FIRESTORE_DATABASE=(default)
ENV PHENOMATCH_STORE=firestore

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
# server/umingle.mjs loads ../shared/anon-live.mjs at startup.
COPY shared ./shared
COPY --from=build /app/dist ./dist

EXPOSE 8080
USER node
CMD ["node", "server/index.mjs"]
