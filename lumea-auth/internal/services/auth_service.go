package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"lumea-auth/internal/config"
	"lumea-auth/internal/models"
	"lumea-auth/internal/repository"
)

// Redis key prefixes
const (
	keyOTP        = "otp:"   // otp:{email}   → 6-digit OTP
	keyResetToken = "reset:" // reset:{token} → user email
	keyBlacklist  = "bl:"    // bl:{jti}      → "1" (JWT blacklisted)
)

// ── JWT Claims ────────────────────────────────────────────────────────────────

type LumeaClaims struct {
	UserID          string `json:"user_id"`
	Email           string `json:"email"`
	Username        string `json:"username"`
	Role            string `json:"role"`
	SupporterStatus string `json:"plan"`
	IsPartner       bool   `json:"is_partner"`
	jwt.RegisteredClaims
}

// ── Service ───────────────────────────────────────────────────────────────────

type AuthService struct {
	cfg   *config.Config
	repo  *repository.UserRepository
	redis *redis.Client
	log   *zap.Logger
}

func NewAuthService(cfg *config.Config, repo *repository.UserRepository, rdb *redis.Client, log *zap.Logger) *AuthService {
	return &AuthService{
		cfg:   cfg,
		repo:  repo,
		redis: rdb,
		log:   log.With(zap.String("component", "auth_service")),
	}
}

// Register creates an unverified user and sends OTP.
func (s *AuthService) Register(req *models.RegisterRequest) (*models.OTPDebugResponse, error) {
	exists, err := s.repo.EmailExists(req.Email)
	if err != nil {
		s.log.Error("register: failed to check email existence",
			zap.String("email", req.Email), zap.Error(err))
		return nil, err
	}
	if exists {
		s.log.Warn("register: email already registered", zap.String("email", req.Email))
		return nil, errors.New("email already registered")
	}

	usernameExists, err := s.repo.UsernameExists(req.Username)
	if err != nil {
		s.log.Error("register: failed to check username existence",
			zap.String("username", req.Username), zap.Error(err))
		return nil, err
	}
	if usernameExists {
		s.log.Warn("register: username already taken", zap.String("username", req.Username))
		return nil, errors.New("username already taken")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		s.log.Error("register: failed to hash password", zap.Error(err))
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	hashStr := string(hash)
	fullName := req.FirstName + " " + req.LastName

	user := &models.User{
		Email:         req.Email,
		PasswordHash:  &hashStr,
		Username:      req.Username,
		Name:          &fullName,
		FirstName:     &req.FirstName,
		LastName:      &req.LastName,
		AuthProvider:  models.AuthProviderLocal,
		Role:          models.RoleUser,
		EmailVerified: false,
		IsVerified:    false,
	}

	if err := s.repo.Create(user); err != nil {
		if errors.Is(err, repository.ErrDuplicate) {
			s.log.Warn("register: duplicate user on create",
				zap.String("email", req.Email), zap.String("username", req.Username))
			return nil, errors.New("email or username already taken")
		}
		s.log.Error("register: failed to create user",
			zap.String("email", req.Email), zap.Error(err))
		return nil, err
	}

	otp, err := s.generateAndStoreOTP(req.Email)
	if err != nil {
		return nil, err
	}

	s.sendOTP(req.Email, otp)

	s.log.Info("register: user created, OTP sent",
		zap.String("email", req.Email),
		zap.String("username", req.Username),
		zap.String("user_id", user.ID),
	)

	resp := &models.OTPDebugResponse{
		Message: "Registration successful. Please verify your email with the OTP sent.",
	}
	if s.cfg.Debug {
		resp.OTP = otp
	}
	return resp, nil
}

// VerifyOTP verifies email OTP and returns auth token.
func (s *AuthService) VerifyOTP(req *models.VerifyOTPRequest, ip, ua string) (*models.AuthResponse, error) {
	ctx := context.Background()
	key := keyOTP + req.Email

	storedOTP, err := s.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		s.log.Warn("verify_otp: OTP expired or not found", zap.String("email", req.Email))
		return nil, errors.New("OTP expired or not found")
	}
	if err != nil {
		s.log.Error("verify_otp: redis error", zap.String("email", req.Email), zap.Error(err))
		return nil, fmt.Errorf("redis error: %w", err)
	}
	if storedOTP != req.OTP {
		s.log.Warn("verify_otp: invalid OTP attempt", zap.String("email", req.Email))
		return nil, errors.New("invalid OTP")
	}

	s.redis.Del(ctx, key)

	user, err := s.repo.FindByEmail(req.Email)
	if err != nil {
		s.log.Error("verify_otp: user not found after OTP match",
			zap.String("email", req.Email), zap.Error(err))
		return nil, errors.New("user not found")
	}

	user.EmailVerified = true
	user.IsVerified = true
	user.InkScore += 5
	if err := s.repo.Update(user); err != nil {
		s.log.Error("verify_otp: failed to update user",
			zap.String("user_id", user.ID), zap.Error(err))
		return nil, err
	}

	s.log.Info("verify_otp: email verified, token issued",
		zap.String("user_id", user.ID),
		zap.String("email", user.Email),
		zap.String("ip", ip),
	)

	return s.issueToken(user, ip, ua)
}

// ResendOTP regenerates and resends OTP.
func (s *AuthService) ResendOTP(email string) (*models.OTPDebugResponse, error) {
	_, err := s.repo.FindByEmail(email)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			s.log.Warn("resend_otp: email not registered", zap.String("email", email))
			return nil, errors.New("email not registered")
		}
		s.log.Error("resend_otp: db error", zap.String("email", email), zap.Error(err))
		return nil, err
	}

	otp, err := s.generateAndStoreOTP(email)
	if err != nil {
		return nil, err
	}

	s.sendOTP(email, otp)
	s.log.Info("resend_otp: OTP resent", zap.String("email", email))

	resp := &models.OTPDebugResponse{Message: "OTP resent successfully"}
	if s.cfg.Debug {
		resp.OTP = otp
	}
	return resp, nil
}

// Login authenticates with email+password.
func (s *AuthService) Login(req *models.LoginRequest, ip, ua string) (*models.AuthResponse, error) {
	user, err := s.repo.FindByEmail(req.Email)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			s.log.Warn("login: email not found", zap.String("email", req.Email), zap.String("ip", ip))
			return nil, errors.New("invalid email or password")
		}
		s.log.Error("login: db error", zap.String("email", req.Email), zap.Error(err))
		return nil, err
	}

	if user.IsBanned {
		s.log.Warn("login: banned account attempt",
			zap.String("user_id", user.ID), zap.String("email", user.Email), zap.String("ip", ip))
		return nil, errors.New("your account has been suspended")
	}

	if !user.EmailVerified {
		s.log.Warn("login: email not verified",
			zap.String("email", req.Email), zap.String("ip", ip))
		return nil, errors.New("email not verified. Please verify your email first")
	}

	if user.PasswordHash == nil {
		s.log.Warn("login: google-only account tried password login",
			zap.String("user_id", user.ID), zap.String("email", user.Email))
		return nil, errors.New("this account uses Google sign-in. Please login with Google")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password)); err != nil {
		s.log.Warn("login: invalid password",
			zap.String("email", req.Email), zap.String("ip", ip))
		return nil, errors.New("invalid email or password")
	}

	s.log.Info("login: success",
		zap.String("user_id", user.ID),
		zap.String("email", user.Email),
		zap.String("ip", ip),
		zap.String("role", string(user.Role)),
	)

	return s.issueToken(user, ip, ua)
}

// Logout blacklists the JWT in Redis.
func (s *AuthService) Logout(jti string, expiry time.Time) error {
	ctx := context.Background()
	ttl := time.Until(expiry)
	if ttl <= 0 {
		s.log.Debug("logout: token already expired, skipping blacklist", zap.String("jti", jti))
		return nil
	}
	if err := s.redis.Set(ctx, keyBlacklist+jti, "1", ttl).Err(); err != nil {
		s.log.Error("logout: failed to blacklist token", zap.String("jti", jti), zap.Error(err))
		return err
	}
	s.log.Info("logout: token blacklisted", zap.String("jti", jti))
	return nil
}

// IsTokenBlacklisted checks Redis JWT blacklist.
func (s *AuthService) IsTokenBlacklisted(jti string) (bool, error) {
	ctx := context.Background()
	result, err := s.redis.Exists(ctx, keyBlacklist+jti).Result()
	if err != nil {
		return false, err
	}
	return result > 0, nil
}

// ForgotPassword generates a reset token and sends it.
func (s *AuthService) ForgotPassword(email string) (*models.OTPDebugResponse, error) {
	_, err := s.repo.FindByEmail(email)
	if err != nil {
		// Don't reveal whether email exists — but log it internally
		s.log.Debug("forgot_password: email not found (not disclosed to caller)",
			zap.String("email", email))
		return &models.OTPDebugResponse{
			Message: "If your email is registered, you will receive a password reset link.",
		}, nil
	}

	token := uuid.NewString()
	ctx := context.Background()
	ttl := time.Duration(s.cfg.ResetTokenExpiryMinutes) * time.Minute

	if err := s.redis.Set(ctx, keyResetToken+token, email, ttl).Err(); err != nil {
		s.log.Error("forgot_password: failed to store reset token",
			zap.String("email", email), zap.Error(err))
		return nil, fmt.Errorf("failed to store reset token: %w", err)
	}

	s.sendPasswordReset(email, token)
	s.log.Info("forgot_password: reset token generated", zap.String("email", email))

	resp := &models.OTPDebugResponse{
		Message: "If your email is registered, you will receive a password reset link.",
	}
	if s.cfg.Debug {
		resp.OTP = token
	}
	return resp, nil
}

// ResetPassword validates reset token and updates password.
func (s *AuthService) ResetPassword(req *models.ResetPasswordRequest) error {
	ctx := context.Background()
	key := keyResetToken + req.Token

	email, err := s.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		s.log.Warn("reset_password: token expired or invalid")
		return errors.New("reset token expired or invalid")
	}
	if err != nil {
		s.log.Error("reset_password: redis error", zap.Error(err))
		return fmt.Errorf("redis error: %w", err)
	}

	user, err := s.repo.FindByEmail(email)
	if err != nil {
		s.log.Error("reset_password: user not found for email",
			zap.String("email", email), zap.Error(err))
		return errors.New("user not found")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		s.log.Error("reset_password: failed to hash password", zap.Error(err))
		return fmt.Errorf("failed to hash password: %w", err)
	}

	hashStr := string(hash)
	user.PasswordHash = &hashStr
	if err := s.repo.Update(user); err != nil {
		s.log.Error("reset_password: failed to update user",
			zap.String("user_id", user.ID), zap.Error(err))
		return err
	}

	s.redis.Del(ctx, key)
	s.repo.DeactivateAllSessions(user.ID)

	s.log.Info("reset_password: password updated, all sessions invalidated",
		zap.String("user_id", user.ID), zap.String("email", user.Email))

	return nil
}

// ParseToken parses and validates a JWT, returning claims.
func (s *AuthService) ParseToken(tokenStr string) (*LumeaClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &LumeaClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*LumeaClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

// ── Private helpers ───────────────────────────────────────────────────────────

func (s *AuthService) issueToken(user *models.User, ip, ua string) (*models.AuthResponse, error) {
	jti := uuid.NewString()
	now := time.Now()
	expiry := now.Add(time.Duration(s.cfg.JWTExpiryHours) * time.Hour)

	claims := LumeaClaims{
		UserID:          user.ID,
		Email:           user.Email,
		Username:        user.Username,
		Role:            string(user.Role),
		SupporterStatus: string(user.SupporterStatus),
		IsPartner:       user.IsPartner,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiry),
			Issuer:    "lumea-auth",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		s.log.Error("issue_token: failed to sign JWT",
			zap.String("user_id", user.ID), zap.Error(err))
		return nil, fmt.Errorf("failed to sign token: %w", err)
	}

	ipStr := ip
	uaStr := ua
	session := &models.Session{
		UserID:    user.ID,
		JTI:       jti,
		ExpiresAt: expiry,
		IPAddress: &ipStr,
		UserAgent: &uaStr,
	}
	s.repo.CreateSession(session)
	s.repo.UpdateFields(user.ID, map[string]interface{}{"last_login_at": now})
	user.LastLoginAt = &now

	s.log.Debug("issue_token: JWT issued",
		zap.String("user_id", user.ID),
		zap.String("jti", jti),
		zap.Time("expires_at", expiry),
	)

	return &models.AuthResponse{
		Token: tokenStr,
		User:  models.ToUserProfile(user),
	}, nil
}

func (s *AuthService) generateAndStoreOTP(email string) (string, error) {
	otp := fmt.Sprintf("%06d", rand.Intn(1000000))
	ctx := context.Background()
	ttl := time.Duration(s.cfg.OTPExpiryMinutes) * time.Minute
	if err := s.redis.Set(ctx, keyOTP+email, otp, ttl).Err(); err != nil {
		s.log.Error("generate_otp: failed to store in redis",
			zap.String("email", email), zap.Error(err))
		return "", fmt.Errorf("failed to store OTP: %w", err)
	}
	s.log.Debug("generate_otp: OTP stored", zap.String("email", email))
	return otp, nil
}

func (s *AuthService) sendOTP(email, otp string) {
	if s.cfg.Debug || s.cfg.CommsServiceURL == "" {
		s.log.Info("send_otp: [DEBUG] OTP logged to console",
			zap.String("email", email), zap.String("otp", otp))
		return
	}
	go s.callCommsService("/internal/send-otp", map[string]string{
		"email": email,
		"otp":   otp,
	})
}

func (s *AuthService) sendPasswordReset(email, token string) {
	if s.cfg.Debug || s.cfg.CommsServiceURL == "" {
		s.log.Info("send_reset: [DEBUG] reset token logged to console",
			zap.String("email", email), zap.String("token", token))
		return
	}
	go s.callCommsService("/internal/send-password-reset", map[string]string{
		"email": email,
		"token": token,
	})
}

func (s *AuthService) callCommsService(path string, payload map[string]string) {
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, s.cfg.CommsServiceURL+path, bytes.NewBuffer(body))
	if err != nil {
		s.log.Error("comms_service: failed to build request",
			zap.String("path", path), zap.Error(err))
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", s.cfg.InternalServiceToken)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		s.log.Error("comms_service: request failed",
			zap.String("path", path), zap.Error(err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		s.log.Warn("comms_service: non-2xx response",
			zap.String("path", path), zap.Int("status", resp.StatusCode))
	} else {
		s.log.Debug("comms_service: request ok",
			zap.String("path", path), zap.Int("status", resp.StatusCode))
	}
}

// StripBearer removes "Bearer " prefix from Authorization header value.
func StripBearer(header string) string {
	if strings.HasPrefix(header, "Bearer ") {
		return header[7:]
	}
	return header
}
