# syntax=docker/dockerfile:1
# spec-lab4 §4: образ для стейджу (Render, runtime: docker)

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
# SHA для /version, якщо платформа не передає його сама (Render передає RENDER_GIT_COMMIT).
# Без значення за замовчуванням: заглушка "unknown" перекривала RENDER_GIT_COMMIT (spec-lab4 AC19)
ARG GIT_SHA
ENV GIT_SHA=${GIT_SHA}
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
