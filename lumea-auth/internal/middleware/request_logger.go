package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"lumea-auth/internal/logger"
)

const CtxRequestID = "request_id"

// RequestLogger replaces gin.Logger() with structured JSON logging.
// Every request gets a unique request_id that's also sent back as X-Request-ID header —
// useful for correlating frontend errors with backend logs in OpenSearch.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Attach request ID to context and response header
		requestID := uuid.NewString()
		c.Set(CtxRequestID, requestID)
		c.Header("X-Request-ID", requestID)

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		fields := []zap.Field{
			zap.String("request_id", requestID),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.String("query", c.Request.URL.RawQuery),
			zap.Int("status", status),
			zap.Int64("latency_ms", latency.Milliseconds()),
			zap.String("ip", c.ClientIP()),
			zap.String("user_agent", c.Request.UserAgent()),
		}

		// Attach user_id if the request was authenticated
		if uid, exists := c.Get(CtxUserID); exists && uid != "" {
			fields = append(fields, zap.String("user_id", uid.(string)))
		}

		// Attach any errors gin collected
		if len(c.Errors) > 0 {
			fields = append(fields, zap.String("gin_errors", c.Errors.String()))
		}

		switch {
		case status >= 500:
			logger.Error("request", fields...)
		case status >= 400:
			logger.Warn("request", fields...)
		default:
			logger.Info("request", fields...)
		}
	}
}

// GetRequestID pulls the request_id from gin context.
func GetRequestID(c *gin.Context) string {
	if v, ok := c.Get(CtxRequestID); ok {
		if id, ok := v.(string); ok {
			return id
		}
	}
	return ""
}
