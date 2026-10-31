# ==============================================================================
# Base Stage
# ==============================================================================
FROM node:20-alpine AS base

WORKDIR /app

# Ensure /app and node_modules are owned by node user so Vite can write .vite cache
RUN mkdir -p /app/node_modules && chown -R node:node /app

# Copy dependency specifications for layer caching
COPY --chown=node:node package*.json ./

# ==============================================================================
# Development Stage (Vite Dev Server on Port 3000 with HMR & Polling)
# ==============================================================================
FROM base AS development

ENV NODE_ENV=development
# CHOKIDAR_USEPOLLING ensures instant HMR updates across Docker Windows bind mounts
ENV CHOKIDAR_USEPOLLING=true

RUN npm install

COPY --chown=node:node . .

USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# ==============================================================================
# Build Stage for Production Static Assets
# ==============================================================================
# Build Stage for Production Static Assets
# ==============================================================================
FROM base AS build

# When VITE_API_URL is empty (default), client requests use same-origin relative
# paths (/api), which are proxied to the backend upstream by Nginx at runtime.
# If an explicit public API URL is provided, it is injected into the bundle.
ARG VITE_API_URL=""
ARG VITE_RECOMMENDATION_API_URL=""
ARG VITE_RAZORPAY_API_KEY=""

ENV VITE_API_URL=$VITE_API_URL \
    VITE_RECOMMENDATION_API_URL=$VITE_RECOMMENDATION_API_URL \
    VITE_RAZORPAY_API_KEY=$VITE_RAZORPAY_API_KEY

RUN npm ci

COPY . .

RUN npm run build

# ==============================================================================
# Production Stage (Nginx Alpine Reverse Proxy & Static SPA Server)
# ==============================================================================
FROM nginx:alpine AS production

RUN mkdir -p /etc/nginx/templates

# Copy template for dynamic runtime upstream substitution via entrypoint
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy compiled production bundle
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 10000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-80}/healthz || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
