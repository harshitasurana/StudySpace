FROM node:20-alpine AS builder

ARG VITE_MODE=production

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build -- --mode ${VITE_MODE}

FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# nginx:stable-alpine's stock /etc/nginx/mime.types has no entry for .mjs
# (a newer ES-module extension), so nginx falls back to default_type
# (application/octet-stream) for it. Browsers enforce strict MIME
# checking on <script type="module">, so any .mjs asset — e.g.
# pdfjs-dist's pdf.worker.min.mjs, loaded by the Chapter Reader/NCERT
# Notes/NCERT Solutions PDF viewer — fails to load entirely, breaking
# every PDF-rendering feature identically. Patches the real mime.types
# file directly (adding a line inside its existing "types { ... }"
# block) rather than a `types {}` override in default.conf, which would
# replace — not extend — the whole table for every other asset (css,
# images, regular .js) too.
RUN sed -i '/application\/javascript.*js;/a\    application/javascript                          mjs;' /etc/nginx/mime.types

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
