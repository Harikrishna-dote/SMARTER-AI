FROM node:22-alpine AS builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend ./
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY deployment/nginx/nginx.conf /etc/nginx/conf.d/default.conf:ro
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

FROM node:22-alpine AS dev
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend ./
CMD ["npm", "run", "dev"]
