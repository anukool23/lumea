package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"lumea-auth/internal/middleware"
	"lumea-auth/internal/models"
	"lumea-auth/internal/services"
)

type AuthHandler struct {
	authSvc *services.AuthService
}

func NewAuthHandler(authSvc *services.AuthService) *AuthHandler {
	return &AuthHandler{authSvc: authSvc}
}

// Register godoc
//
//	@Summary		Register new user
//	@Description	Creates an unverified account and sends a 6-digit OTP to the email. Use /verify-otp to activate.
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.RegisterRequest		true	"Registration payload"
//	@Success		201		{object}	models.OTPDebugResponse		"OTP sent (otp field only present when DEBUG_OTP=true)"
//	@Failure		400		{object}	models.ErrorResponse		"Validation error"
//	@Failure		409		{object}	models.ErrorResponse		"Email or username taken"
//	@Failure		500		{object}	models.ErrorResponse		"Internal error"
//	@Security		APIKeyAuth
//	@Router			/auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	resp, err := h.authSvc.Register(&req)
	if err != nil {
		status := http.StatusInternalServerError
		if isClientError(err.Error()) {
			status = http.StatusConflict
		}
		c.JSON(status, models.ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// VerifyOTP godoc
//
//	@Summary		Verify email OTP
//	@Description	Verifies the 6-digit OTP sent during registration. Returns a JWT on success.
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.VerifyOTPRequest		true	"OTP payload"
//	@Success		200		{object}	models.AuthResponse
//	@Failure		400		{object}	models.ErrorResponse		"Invalid or expired OTP"
//	@Failure		404		{object}	models.ErrorResponse		"User not found"
//	@Security		APIKeyAuth
//	@Router			/auth/verify-otp [post]
func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var req models.VerifyOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	ip := c.ClientIP()
	ua := c.GetHeader("User-Agent")

	resp, err := h.authSvc.VerifyOTP(&req, ip, ua)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ResendOTP godoc
//
//	@Summary		Resend OTP
//	@Description	Generates and resends a new OTP. The previous OTP is overwritten.
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.ResendOTPRequest		true	"Email"
//	@Success		200		{object}	models.OTPDebugResponse
//	@Failure		400		{object}	models.ErrorResponse
//	@Failure		404		{object}	models.ErrorResponse		"Email not registered"
//	@Security		APIKeyAuth
//	@Router			/auth/resend-otp [post]
func (h *AuthHandler) ResendOTP(c *gin.Context) {
	var req models.ResendOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	resp, err := h.authSvc.ResendOTP(req.Email)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Login godoc
//
//	@Summary		Email / password login
//	@Description	Authenticates user with email and password. Returns JWT + user profile.
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.LoginRequest		true	"Login credentials"
//	@Success		200		{object}	models.AuthResponse
//	@Failure		400		{object}	models.ErrorResponse	"Validation error"
//	@Failure		401		{object}	models.ErrorResponse	"Invalid credentials / email not verified / account suspended"
//	@Security		APIKeyAuth
//	@Router			/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	ip := c.ClientIP()
	ua := c.GetHeader("User-Agent")

	resp, err := h.authSvc.Login(&req, ip, ua)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Logout godoc
//
//	@Summary		Logout
//	@Description	Blacklists the current JWT in Redis. The token cannot be used after this.
//	@Tags			auth
//	@Security		BearerAuth
//	@Security		APIKeyAuth
//	@Produce		json
//	@Success		200		{object}	models.MessageResponse
//	@Failure		401		{object}	models.ErrorResponse	"Not authenticated"
//	@Router			/auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	jti, _ := c.Get(middleware.CtxJTI)
	expiryVal, _ := c.Get(middleware.CtxJWTExpiry)

	jtiStr, _ := jti.(string)
	expiry, _ := expiryVal.(time.Time)

	if err := h.authSvc.Logout(jtiStr, expiry); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "logout failed"})
		return
	}

	c.JSON(http.StatusOK, models.MessageResponse{Message: "logged out successfully"})
}

// ForgotPassword godoc
//
//	@Summary		Forgot password
//	@Description	Sends a password reset token to the registered email. Always returns 200 to prevent email enumeration.
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.ForgotPasswordRequest	true	"Email"
//	@Success		200		{object}	models.OTPDebugResponse
//	@Failure		400		{object}	models.ErrorResponse
//	@Security		APIKeyAuth
//	@Router			/auth/forgot-password [post]
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req models.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	resp, err := h.authSvc.ForgotPassword(req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "failed to process request"})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ResetPassword godoc
//
//	@Summary		Reset password
//	@Description	Resets the password using the token received via email. All active sessions are invalidated.
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.ResetPasswordRequest		true	"Reset token and new password"
//	@Success		200		{object}	models.MessageResponse
//	@Failure		400		{object}	models.ErrorResponse	"Invalid/expired token or weak password"
//	@Security		APIKeyAuth
//	@Router			/auth/reset-password [post]
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req models.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	if err := h.authSvc.ResetPassword(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.MessageResponse{Message: "password reset successfully. Please login with your new password."})
}

// Me godoc
//
//	@Summary		Get current user
//	@Description	Returns the authenticated user's full profile (decoded from JWT + DB lookup).
//	@Tags			auth
//	@Security		BearerAuth
//	@Security		APIKeyAuth
//	@Produce		json
//	@Success		200		{object}	models.UserProfile
//	@Failure		401		{object}	models.ErrorResponse
//	@Router			/auth/me [get]
func (h *AuthHandler) Me(c *gin.Context) {
	userID := middleware.GetUserID(c)
	// Return the claims directly (no DB round-trip needed for /me)
	email, _ := c.Get(middleware.CtxUserEmail)
	username, _ := c.Get(middleware.CtxUserUsername)
	role, _ := c.Get(middleware.CtxUserRole)
	plan, _ := c.Get(middleware.CtxUserPlan)
	isPartner, _ := c.Get(middleware.CtxUserIsPartner)

	c.JSON(http.StatusOK, gin.H{
		"id":               userID,
		"email":            email,
		"username":         username,
		"role":             role,
		"supporter_status": plan,
		"is_partner":       isPartner,
	})
}

// ── helpers ───────────────────────────────────────────────────────────────────

func isClientError(msg string) bool {
	clientErrors := []string{
		"already registered",
		"already taken",
		"already exists",
	}
	for _, e := range clientErrors {
		if len(msg) >= len(e) {
			for i := 0; i <= len(msg)-len(e); i++ {
				if msg[i:i+len(e)] == e {
					return true
				}
			}
		}
	}
	return false
}
