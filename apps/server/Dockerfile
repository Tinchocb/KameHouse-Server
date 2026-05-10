# Stage 1: Build the React Application
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY apps/web/package*.json ./apps/web/
# Assuming monorepo root config if any, but lets just install from the web directory
WORKDIR /app/apps/web
RUN npm install
COPY apps/web/ .
RUN npm run build

# Stage 2: Build the Go Backend
FROM golang:1.23-alpine AS backend-builder
WORKDIR /app
# Install build dependencies
RUN apk add --no-cache make gcc musl-dev
COPY . .
# Copy the built React app into the server directory so go:embed catches it
COPY --from=frontend-builder /app/apps/web/out ./apps/server/web

WORKDIR /app/apps/server
RUN go mod download
# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-w -s" -o kamehouse .

# Stage 3: Final Minimal Image
FROM alpine:latest
WORKDIR /app
RUN apk --no-cache add ca-certificates tzdata

# Copy the static binary from backend-builder
COPY --from=backend-builder /app/apps/server/kamehouse .

# Set environment variables for the server
ENV PORT=43000
ENV GIN_MODE=release

# Expose the API and Web port
EXPOSE 43000

# Run the binary
CMD ["./kamehouse", "--datadir", "/data"]
