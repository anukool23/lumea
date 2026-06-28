package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RequireAPIKey validates the X-API-Key header against the provided set of valid keys.
// Keys come from config.APIKeys (split from the API_KEYS env var on "-").
// /health and /docs/* are always exempted so infra health checks still work.
func RequireAPIKey(validKeys []string) gin.HandlerFunc {
	keySet := make(map[string]struct{}, len(validKeys))
	for _, k := range validKeys {
		if k != "" {
			keySet[k] = struct{}{}
		}
	}

	return func(c *gin.Context) {
		path := c.Request.URL.Path

		// Exempt health check and Swagger — these don't carry a BFF key
		if path == "/health" || len(path) >= 5 && path[:5] == "/docs" {
			c.Next()
			return
		}

		// If no keys are configured (e.g. local dev without env set), skip check
		if len(keySet) == 0 {
			c.Next()
			return
		}

		key := c.GetHeader("X-API-Key")
		if _, ok := keySet[key]; !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or missing API key"})
			return
		}

		c.Next()
	}
}
