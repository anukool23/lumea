// @title           Lumea Auth Service
// @version         1.0
// @description     User authentication, registration, and profile management for Lumea.ink
// @termsOfService  https://lumea.ink/terms
//
// @contact.name    Lumea Dev Team
// @contact.email   dev@lumea.ink
//
// @license.name    Proprietary
//
// @host            localhost:8080
// @BasePath        /api
//
// @securityDefinitions.apikey BearerAuth
// @in                         header
// @name                       Authorization
// @description                JWT token. Format: "Bearer <token>"
//
// @securityDefinitions.apikey APIKeyAuth
// @in                         header
// @name                       X-API-Key
// @description                BFF API key. Use any one of the 4 keys from API_KEYS env (split on "-").

package main

import (
	"context"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	httpadapter "github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
	"github.com/joho/godotenv"
	"github.com/swaggo/swag"
	"go.uber.org/zap"

	"lumea-auth/internal/config"
	"lumea-auth/internal/database"
	lumeadocs "lumea-auth/docs"
	"lumea-auth/internal/logger"
	"lumea-auth/internal/router"
)

func main() {
	// Explicitly register swagger spec — blank import alone doesn't work with CGO_ENABLED=0
	swag.Register(lumeadocs.SwaggerInfo.InstanceName(), lumeadocs.SwaggerInfo)

	_ = godotenv.Load()

	cfg := config.Load()

	// ── Init structured logger ─────────────────────────────────────────────────
	log := logger.Init(cfg.Debug)
	defer logger.Sync()

	log.Info("starting lumea-auth",
		zap.String("mode", cfg.RunMode),
		zap.String("port", cfg.Port),
	)

	// ── Databases ──────────────────────────────────────────────────────────────
	db  := database.NewPostgres(cfg)
	rdb := database.NewRedis(cfg)

	log.Info("databases connected",
		zap.String("postgres", "ok"),
		zap.String("redis", "ok"),
	)

	r := router.Setup(cfg, db, rdb, log)

	// ── Lambda mode (Function URL uses payload format v2) ─────────────────────
	if os.Getenv("AWS_LAMBDA_RUNTIME_API") != "" {
		log.Info("running in AWS Lambda mode")
		adapter := httpadapter.NewV2(r)
		lambda.Start(func(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
			return adapter.ProxyWithContext(ctx, req)
		})
		return
	}

	// ── Local HTTP server ──────────────────────────────────────────────────────
	log.Info("lumea-auth listening",
		zap.String("url", "http://localhost:"+cfg.Port),
		zap.String("swagger", "http://localhost:"+cfg.Port+"/docs/index.html"),
	)

	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal("server error", zap.Error(err))
	}
}
