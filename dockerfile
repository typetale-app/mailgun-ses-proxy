FROM oven/bun:1-alpine

ENV NODE_ENV=production

# Install openssl for Prisma compatibility in Alpine
USER root
RUN apk add --no-cache openssl

WORKDIR /app

# Ensure correct permissions for the bun user
RUN chown -R bun:bun /app

USER bun

# Copy package files and install dependencies
COPY --chown=bun:bun package.json package-lock.json* bun.lockb* ./
RUN bun install

# Copy the rest of the application code
COPY --chown=bun:bun . .

# Run build scripts (Prisma generate, Next build, and custom server build)
RUN DATABASE_URL=mysql://localhost:3306/dummy bun run build

# Expose the application port
EXPOSE 8080

# Run the application using bun
CMD ["bun", "run", "start:bun"]
