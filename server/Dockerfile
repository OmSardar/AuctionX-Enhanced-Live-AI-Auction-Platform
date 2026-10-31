# ==============================================================================
# Base Stage
# ==============================================================================
FROM node:20-alpine AS base

WORKDIR /app

# Create runtime directories needed for temporary file uploads and Winston logs
RUN mkdir -p /app/uploads /app/logs && chown -R node:node /app

# Copy dependency specifications for layer caching
COPY --chown=node:node package*.json ./

# ==============================================================================
# Development Stage (Supports Nodemon hot-reloading & devDependencies)
# ==============================================================================
FROM base AS development

ENV NODE_ENV=development
ENV PORT=5000

# Install all dependencies (including devDependencies from package.json/package-lock.json)
RUN npm install

# Copy application source code
COPY --chown=node:node . .

USER node

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000) + '/', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["npm", "run", "dev"]

# ==============================================================================
# Production Stage (Lean, hardened container running node directly)
# ==============================================================================
FROM base AS production

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only from package.json/package-lock.json
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source code
COPY --chown=node:node . .

USER node

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000) + '/', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "server.js"]
