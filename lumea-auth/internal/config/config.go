package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port    string
	RunMode string
	Debug   bool

	PostgresDSN string

	RedisURL string

	JWTSecret      string
	JWTExpiryHours int

	ResetTokenExpiryMinutes int
	OTPExpiryMinutes        int

	CommsServiceURL      string
	InternalServiceToken string

	FirebaseCredentials string

	AllowedOrigins []string

	// API keys — split from API_KEYS env var on "-"
	APIKeys []string
}

func Load() *Config {
	jwtExpiry, _ := strconv.Atoi(getEnv("JWT_EXPIRY_HOURS", "168"))
	resetExpiry, _ := strconv.Atoi(getEnv("RESET_TOKEN_EXPIRY_MINUTES", "60"))
	otpExpiry, _ := strconv.Atoi(getEnv("OTP_EXPIRY_MINUTES", "10"))

	originsRaw := getEnv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001")
	origins := strings.Split(originsRaw, ",")
	for i, o := range origins {
		origins[i] = strings.TrimSpace(o)
	}

	return &Config{
		Port:    getEnv("PORT", "8080"),
		RunMode: getEnv("RUN_MODE", "local"),
		Debug:   getEnv("DEBUG_OTP", "false") == "true",

		PostgresDSN: getEnv("POSTGRES_DSN", "postgres://lumea:lumea_secret@localhost:5432/lumea_auth?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),

		JWTSecret:      getEnv("JWT_SECRET", "dev-secret-change-in-production-must-be-32+chars"),
		JWTExpiryHours: jwtExpiry,

		ResetTokenExpiryMinutes: resetExpiry,
		OTPExpiryMinutes:        otpExpiry,

		CommsServiceURL:      getEnv("COMMS_SERVICE_URL", ""),
		InternalServiceToken: getEnv("INTERNAL_SERVICE_TOKEN", ""),

		FirebaseCredentials: getEnv("FIREBASE_CREDENTIALS", ""),

		AllowedOrigins: origins,
		APIKeys:        strings.Split(getEnv("API_KEYS", ""), "-"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
