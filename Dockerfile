# ---- Build Stage ----
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

# ---- Production Stage ----
FROM node:20-slim

WORKDIR /app

# Copy only production dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

# Copy built app and static files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data
COPY --from=builder /app/config.example.env ./

ENV NODE_ENV=production
EXPOSE 3872

# Use a non-root user for security
RUN useradd --user-group --create-home --shell /bin/false appuser
USER appuser

CMD ["node", "dist/index.js"]
