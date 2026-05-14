FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS builder
WORKDIR /build
COPY minigames/package*.json ./
RUN npm ci
COPY minigames/ .
RUN npm run build

FROM registry.access.redhat.com/ubi9/nginx-124:latest
COPY frontend/index.html /opt/app-root/src/
COPY frontend/public/ /opt/app-root/src/
COPY --from=builder /build/dist/ /opt/app-root/src/minigames/
COPY frontend/nginx.d/ /opt/app-root/etc/nginx.d/
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
