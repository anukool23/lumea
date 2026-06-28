.PHONY: dev swagger build clean db-up db-down db-logs tidy

# ── Local development ─────────────────────────────────────────────────────────
dev:
	@cp -n .env.example .env 2>/dev/null || true
	air

# Start without hot reload
run:
	@cp -n .env.example .env 2>/dev/null || true
	go run .

# ── Docker (local infra) ──────────────────────────────────────────────────────
db-up:
	docker compose up -d
	@echo "⏳ Waiting for Postgres..."
	@sleep 3
	@echo "✅ Postgres + Redis ready"

db-down:
	docker compose down

db-logs:
	docker compose logs -f

db-reset:
	docker compose down -v
	docker compose up -d

# ── Swagger docs generation ───────────────────────────────────────────────────
swagger:
	@which swag > /dev/null || go install github.com/swaggo/swag/cmd/swag@latest
	swag init --parseDependency --parseInternal
	@echo "✅ Swagger docs generated → docs/"

# ── Build ─────────────────────────────────────────────────────────────────────
# Build for local
build:
	go build -o bin/lumea-auth .

# Build for AWS Lambda (linux/amd64)
build-lambda:
	GOOS=linux GOARCH=amd64 go build -tags lambda.norpc -o bin/bootstrap .
	zip -j bin/lumea-auth-lambda.zip bin/bootstrap

# ── Tidy ─────────────────────────────────────────────────────────────────────
tidy:
	go mod tidy

# ── Full local setup (first time) ────────────────────────────────────────────
setup: db-up tidy swagger
	@echo ""
	@echo "🚀 Setup complete! Run 'make dev' to start"
	@echo "📖 Swagger UI: http://localhost:8080/docs/index.html"
