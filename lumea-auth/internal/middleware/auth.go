package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"lumea-auth/internal/services"
)

const (
	CtxUserID          = "user_id"
	CtxUserEmail       = "user_email"
	CtxUserUsername    = "user_username"
	CtxUserRole        = "user_role"
	CtxUserPlan        = "user_plan"
	CtxUserIsPartner   = "user_is_partner"
	CtxJTI             = "jti"
	CtxJWTExpiry       = "jwt_expiry"
)

// RequireAuth validates JWT and injects claims into context
func RequireAuth(authSvc *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			return
		}

		tokenStr := services.StripBearer(header)
		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "bearer token required"})
			return
		}

		claims, err := authSvc.ParseToken(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		// Check blacklist
		blacklisted, err := authSvc.IsTokenBlacklisted(claims.ID)
		if err != nil || blacklisted {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token has been revoked"})
			return
		}

		c.Set(CtxUserID, claims.UserID)
		c.Set(CtxUserEmail, claims.Email)
		c.Set(CtxUserUsername, claims.Username)
		c.Set(CtxUserRole, claims.Role)
		c.Set(CtxUserPlan, claims.SupporterStatus)
		c.Set(CtxUserIsPartner, claims.IsPartner)
		c.Set(CtxJTI, claims.ID)
		c.Set(CtxJWTExpiry, claims.ExpiresAt.Time)

		c.Next()
	}
}

// RequireRole restricts access to specific roles
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, _ := c.Get(CtxUserRole)
		role, _ := userRole.(string)

		for _, r := range roles {
			if strings.EqualFold(role, r) {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
	}
}

// GetUserID is a helper to extract user ID from context
func GetUserID(c *gin.Context) string {
	v, _ := c.Get(CtxUserID)
	id, _ := v.(string)
	return id
}
