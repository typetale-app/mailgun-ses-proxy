FROM node:22-alpine

ENV NODE_ENV=production

# Install openssl for Prisma compatibility in Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /app

USER appuser

# Copy package files and install dependencies
COPY --chown=appuser:appgroup package.json package-lock.json* ./
RUN NODE_ENV=development npm ci

# Copy the rest of the application code
COPY --chown=appuser:appgroup . .

# Run build scripts (Prisma generate, Next build, and custom server build)
RUN DATABASE_URL=mysql://localhost:3306/dummy NEXT_BUILD=true npm run build && \
    npm prune --omit=dev

# Expose the application port
EXPOSE 8080

# Run the application using node
CMD ["npm", "run", "start"]
