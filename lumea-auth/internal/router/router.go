package router

import (
	"net/http"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/redis/go-redis/v9"

	"lumea-auth/internal/config"
	"lumea-auth/internal/handlers"
	"lumea-auth/internal/middleware"
	"lumea-auth/internal/repository"
	"lumea-auth/internal/services"
)

func Setup(cfg *config.Config, db *gorm.DB, rdb *redis.Client, log *zap.Logger) *gin.Engine {
	if cfg.RunMode == "lambda" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.RequestLogger()) // structured JSON → OpenSearch
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(cfg))
	r.Use(middleware.RequireAPIKey(cfg.APIKeys))

	// ── Health / root ──────────────────────────────────────────────────────────
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "lumea-auth",
			"version": "1.0.0",
		})
	})

	// ── Swagger UI ─────────────────────────────────────────────────────────────
	r.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// ── Wire up dependencies ───────────────────────────────────────────────────
	userRepo := repository.NewUserRepository(db)
	authSvc  := services.NewAuthService(cfg, userRepo, rdb, log)
	userSvc  := services.NewUserService(userRepo, log)

	authH := handlers.NewAuthHandler(authSvc)
	userH := handlers.NewUserHandler(userSvc)

	// ── API v1 ─────────────────────────────────────────────────────────────────
	api := r.Group("/api")

	// Auth routes (public)
	auth := api.Group("/auth")
	{
		auth.POST("/register", authH.Register)
		auth.POST("/verify-otp", authH.VerifyOTP)
		auth.POST("/resend-otp", authH.ResendOTP)
		auth.POST("/login", authH.Login)
		auth.POST("/forgot-password", authH.ForgotPassword)
		auth.POST("/reset-password", authH.ResetPassword)

		authProtected := auth.Group("", middleware.RequireAuth(authSvc))
		{
			authProtected.POST("/logout", authH.Logout)
			authProtected.GET("/me", authH.Me)
		}
	}

	// User routes
	users := api.Group("/users")
	{
		users.GET("/:id", optionalAuth(authSvc), userH.GetPublicProfile)
		users.GET("/:id/followers", userH.GetFollowers)
		users.GET("/:id/following", userH.GetFollowing)

		usersProtected := users.Group("", middleware.RequireAuth(authSvc))
		{
			usersProtected.GET("/profile", userH.GetProfile)
			usersProtected.PUT("/profile", userH.UpdateProfile)
			usersProtected.PATCH("/profile/avatar", userH.UpdateAvatar)
			usersProtected.PATCH("/profile/cover", userH.UpdateCover)
			usersProtected.GET("/suggested", userH.GetSuggested)
			usersProtected.POST("/:id/follow", userH.Follow)
			usersProtected.DELETE("/:id/follow", userH.Unfollow)
		}
	}

	return r
}

// optionalAuth injects user context if a valid Bearer token is present,
// but does not reject unauthenticated requests.
func optionalAuth(authSvc *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.Next()
			return
		}
		tokenStr := services.StripBearer(header)
		claims, err := authSvc.ParseToken(tokenStr)
		if err != nil {
			c.Next()
			return
		}
		blacklisted, _ := authSvc.IsTokenBlacklisted(claims.ID)
		if !blacklisted {
			c.Set(middleware.CtxUserID, claims.UserID)
		}
		c.Next()
	}
}
