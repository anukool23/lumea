package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ── JSONB helpers ─────────────────────────────────────────────────────────────

type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	return json.Marshal(s)
}

func (s *StringSlice) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("cannot scan type %T into StringSlice", value)
	}
	return json.Unmarshal(bytes, s)
}

// ── Enums ─────────────────────────────────────────────────────────────────────

type AuthProvider string

const (
	AuthProviderLocal  AuthProvider = "LOCAL"
	AuthProviderGoogle AuthProvider = "GOOGLE"
)

type UserRole string

const (
	RoleUser   UserRole = "USER"
	RoleEditor UserRole = "EDITOR"
	RoleAdmin  UserRole = "ADMIN"
)

type SupporterStatus string

const (
	SupporterNone      SupporterStatus = "NONE"
	SupporterBronze    SupporterStatus = "BRONZE"
	SupporterSilver    SupporterStatus = "SILVER"
	SupporterGold      SupporterStatus = "GOLD"
	SupporterPlatinum  SupporterStatus = "PLATINUM"
	SupporterLifetime  SupporterStatus = "LIFETIME"
	SupporterFounding  SupporterStatus = "FOUNDING"
)

// ── User model (maps to auth.users) ──────────────────────────────────────────

type User struct {
	ID             string       `gorm:"primaryKey;column:id;type:uuid;default:gen_random_uuid()" json:"id"`
	Email          string       `gorm:"uniqueIndex;column:email;not null" json:"email"`
	PasswordHash   *string      `gorm:"column:password_hash" json:"-"`
	Username       string       `gorm:"uniqueIndex;column:username;not null" json:"username"`
	Name           *string      `gorm:"column:name" json:"name"`
	FirstName      *string      `gorm:"column:first_name" json:"first_name"`
	LastName       *string      `gorm:"column:last_name" json:"last_name"`
	ProfilePicture *string      `gorm:"column:profile_picture" json:"profile_picture"`
	CoverImage     *string      `gorm:"column:cover_image" json:"cover_image"`
	Bio            *string      `gorm:"column:bio" json:"bio"`
	Tagline        *string      `gorm:"column:tagline" json:"tagline"`
	AuthProvider   AuthProvider `gorm:"column:auth_provider;default:LOCAL" json:"auth_provider"`
	Role           UserRole     `gorm:"column:role;default:USER" json:"role"`
	IsVerified     bool         `gorm:"column:is_verified;default:false" json:"is_verified"`
	EmailVerified  bool         `gorm:"column:email_verified;default:false" json:"email_verified"`

	// Gamification
	InkScore       int         `gorm:"column:ink_score;default:0" json:"ink_score"`
	Badges         StringSlice `gorm:"column:badges;type:jsonb;default:'[]'" json:"badges"`
	FollowersCount int         `gorm:"column:followers_count;default:0" json:"followers_count"`
	FollowingCount int         `gorm:"column:following_count;default:0" json:"following_count"`

	// Monetization
	IsPartner            bool            `gorm:"column:is_partner;default:false" json:"is_partner"`
	SupporterStatus      SupporterStatus `gorm:"column:supporter_status;default:NONE" json:"supporter_status"`
	SupporterExpiryDate  *time.Time      `gorm:"column:supporter_expiry_date" json:"supporter_expiry_date"`
	EarningsBalance      float64         `gorm:"column:earnings_balance;default:0" json:"earnings_balance"`
	TotalEarned          float64         `gorm:"column:total_earned;default:0" json:"total_earned"`
	UPIID                *string         `gorm:"column:upi_id" json:"upi_id,omitempty"`
	BankAccountNumber    *string         `gorm:"column:bank_account_number" json:"-"`
	IFSCCode             *string         `gorm:"column:ifsc_code" json:"-"`
	AccountHolderName    *string         `gorm:"column:account_holder_name" json:"-"`

	// Platform restrictions
	IsBanned                  bool       `gorm:"column:is_banned;default:false" json:"is_banned"`
	Strikes                   int        `gorm:"column:strikes;default:0" json:"strikes"`
	PostsPublishedThisMonth   int        `gorm:"column:posts_published_this_month;default:0" json:"posts_published_this_month"`
	LastPublishWindowStart    *time.Time `gorm:"column:last_publish_window_start" json:"last_publish_window_start,omitempty"`
	IsCommentingRestricted    bool       `gorm:"column:is_commenting_restricted;default:false" json:"is_commenting_restricted"`
	CommentingRestrictionEnd  *time.Time `gorm:"column:commenting_restriction_end" json:"commenting_restriction_end,omitempty"`
	CommentingRestrictionReason *string  `gorm:"column:commenting_restriction_reason" json:"commenting_restriction_reason,omitempty"`

	// Interests & social links
	Interests StringSlice `gorm:"column:interests;type:jsonb;default:'[]'" json:"interests"`
	Twitter   *string     `gorm:"column:twitter" json:"twitter,omitempty"`
	GitHub    *string     `gorm:"column:github" json:"github,omitempty"`
	LinkedIn  *string     `gorm:"column:linkedin" json:"linkedin,omitempty"`
	Website   *string     `gorm:"column:website" json:"website,omitempty"`

	JoinedAt    time.Time  `gorm:"column:joined_at;autoCreateTime" json:"joined_at"`
	LastLoginAt *time.Time `gorm:"column:last_login_at" json:"last_login_at,omitempty"`
	CreatedAt   time.Time  `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (User) TableName() string {
	return "auth.users"
}

// ── Follow model ──────────────────────────────────────────────────────────────

type Follow struct {
	FollowerID  string    `gorm:"primaryKey;column:follower_id" json:"follower_id"`
	FollowingID string    `gorm:"primaryKey;column:following_id" json:"following_id"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
}

func (Follow) TableName() string {
	return "auth.follows"
}

// ── Session model ─────────────────────────────────────────────────────────────

type Session struct {
	ID        string    `gorm:"primaryKey;column:id;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID    string    `gorm:"column:user_id;not null" json:"user_id"`
	JTI       string    `gorm:"uniqueIndex;column:jti;not null" json:"jti"`
	IssuedAt  time.Time `gorm:"column:issued_at;autoCreateTime" json:"issued_at"`
	ExpiresAt time.Time `gorm:"column:expires_at;not null" json:"expires_at"`
	IPAddress *string   `gorm:"column:ip_address" json:"ip_address,omitempty"`
	UserAgent *string   `gorm:"column:user_agent" json:"user_agent,omitempty"`
	IsActive  bool      `gorm:"column:is_active;default:true" json:"is_active"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
}

func (Session) TableName() string {
	return "auth.sessions"
}
