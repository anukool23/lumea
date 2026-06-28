package logger

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

const ServiceName = "lumea-auth"

var log *zap.Logger

// Init builds and registers the global logger.
// debug=true → human-readable console output (local dev)
// debug=false → JSON output ready for OpenSearch ingestion
func Init(debug bool) *zap.Logger {
	var enc zapcore.EncoderConfig
	var level zapcore.Level

	if debug {
		enc = zap.NewDevelopmentEncoderConfig()
		enc.EncodeLevel = zapcore.CapitalColorLevelEncoder
		enc.EncodeTime = zapcore.ISO8601TimeEncoder
		level = zapcore.DebugLevel
	} else {
		enc = zap.NewProductionEncoderConfig()
		enc.TimeKey = "@timestamp"       // OpenSearch standard
		enc.MessageKey = "message"
		enc.LevelKey = "level"
		enc.CallerKey = "caller"
		enc.EncodeTime = zapcore.ISO8601TimeEncoder
		enc.EncodeLevel = zapcore.LowercaseLevelEncoder
		level = zapcore.InfoLevel
	}

	var encoder zapcore.Encoder
	if debug {
		encoder = zapcore.NewConsoleEncoder(enc)
	} else {
		encoder = zapcore.NewJSONEncoder(enc)
	}

	core := zapcore.NewCore(
		encoder,
		zapcore.AddSync(os.Stdout),
		level,
	)

	log = zap.New(core, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel)).
		With(
			zap.String("service", ServiceName),
		)

	zap.ReplaceGlobals(log)
	return log
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

func Info(msg string, fields ...zap.Field)  { log.Info(msg, fields...) }
func Warn(msg string, fields ...zap.Field)  { log.Warn(msg, fields...) }
func Error(msg string, fields ...zap.Field) { log.Error(msg, fields...) }
func Fatal(msg string, fields ...zap.Field) { log.Fatal(msg, fields...) }
func Debug(msg string, fields ...zap.Field) { log.Debug(msg, fields...) }

// With returns a child logger with additional fields pre-attached.
func With(fields ...zap.Field) *zap.Logger { return log.With(fields...) }

// Sync flushes any buffered log entries (call on shutdown).
func Sync() { _ = log.Sync() }
