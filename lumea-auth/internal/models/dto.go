package models

import "time"

// ── Request DTOs ──────────────────────────────────────────────────────────────

type RegisterRequest struct {
	Email     string `json:"email"      binding:"required,email"`
	Password  string `json:"password"   binding:"required,min=8"`
	FirstName string `json:"first_name" binding:"required,min=2,max=50"`
	LastName  string `json:"last_name"  binding:"required,min=2,max=50"`
	Username  string `json:"username"   binding:"required,min=3,max=50,alphanum"`
}

type VerifyOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
	OTP   string `json:"otp"   binding:"required,len=6"`
}

type ResendOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type LoginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type GoogleAuthRequest struct {
	IDToken string `json:"id_token" binding:"required"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token"        binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

type UpdateProfileRequest struct {
	Name      *string     `json:"name"`
	FirstName *string     `json:"first_name"`
	LastName  *string     `json:"last_name"`
	Username  *string     `json:"username"   binding:"omitempty,min=3,max=50,alphanum"`
	Bio       *string     `json:"bio"        binding:"omitempty,max=500"`
	Tagline   *string     `json:"tagline"    binding:"omitempty,max=160"`
	Twitter   *string     `json:"twitter"`
	GitHub    *string     `json:"github"`
	LinkedIn  *string     `json:"linkedin"`
	Website   *string     `json:"website"`
	Interests StringSlice `json:"interests"`
}

type UpdateAvatarRequest struct {
	ProfilePicture string `json:"profile_picture" binding:"required,url"`
}

type UpdateCoverRequest struct {
	CoverImage string `json:"cover_image" binding:"required,url"`
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

// AuthResponse is returned on successful login/register/verify
type AuthResponse struct {
	Token string      `json:"token"`
	User  UserProfile `json:"user"`
}

// UserProfile is the authenticated user's full profile
type UserProfile struct {
	ID             string          `json:"id"`
	Email          string          `json:"email"`
	Username       string          `json:"username"`
	Name           *string         `json:"name"`
	FirstName      *string         `json:"first_name"`
	LastName       *string         `json:"last_name"`
	ProfilePicture *string         `json:"profile_picture"`
	CoverImage     *string         `json:"cover_image"`
	Bio            *string         `json:"bio"`
	Tagline        *string         `json:"tagline"`
	Role           UserRole        `json:"role"`
	IsVerified     bool            `json:"is_verified"`
	EmailVerified  bool            `json:"email_verified"`
	InkScore       int             `json:"ink_score"`
	Badges         StringSlice     `json:"badges"`
	FollowersCount int             `json:"followers_count"`
	FollowingCount int             `json:"following_count"`
	IsPartner      bool            `json:"is_partner"`
	SupporterStatus SupporterStatus `json:"supporter_status"`
	SupporterExpiryDate *time.Time `json:"supporter_expiry_date"`
	Interests      StringSlice     `json:"interests"`
	Twitter        *string         `json:"twitter,omitempty"`
	GitHub         *string         `json:"github,omitempty"`
	LinkedIn       *string         `json:"linkedin,omitempty"`
	Website        *string         `json:"website,omitempty"`
	IsBanned       bool            `json:"is_banned"`
	IsCommentingRestricted bool    `json:"is_commenting_restricted"`
	JoinedAt       time.Time       `json:"joined_at"`
	LastLoginAt    *time.Time      `json:"last_login_at"`
}

// PublicProfile is the publicly visible user profile
type PublicProfile struct {
	ID             string          `json:"id"`
	Username       string          `json:"username"`
	Name           *string         `json:"name"`
	ProfilePicture *string         `json:"profile_picture"`
	CoverImage     *string         `json:"cover_image"`
	Bio            *string         `json:"bio"`
	Tagline        *string         `json:"tagline"`
	InkScore       int             `json:"ink_score"`
	Badges         StringSlice     `json:"badges"`
	FollowersCount int             `json:"followers_count"`
	FollowingCount int             `json:"following_count"`
	IsPartner      bool            `json:"is_partner"`
	SupporterStatus SupporterStatus `json:"supporter_status"`
	Interests      StringSlice     `json:"interests"`
	Twitter        *string         `json:"twitter,omitempty"`
	GitHub         *string         `json:"github,omitempty"`
	LinkedIn       *string         `json:"linkedin,omitempty"`
	Website        *string         `json:"website,omitempty"`
	IsFollowing    bool            `json:"is_following"` // populated per-request
	JoinedAt       time.Time       `json:"joined_at"`
}

// MessageResponse is a generic success message
type MessageResponse struct {
	Message string `json:"message"`
}

// ErrorResponse is returned on all errors
type ErrorResponse struct {
	Error string `json:"error"`
}

// OTPDebugResponse is ONLY used in DEBUG_OTP=true mode
type OTPDebugResponse struct {
	Message string `json:"message"`
	OTP     string `json:"otp,omitempty"` // never in prod
}

// ── Mapper helpers ────────────────────────────────────────────────────────────

func ToUserProfile(u *User) UserProfile {
	return UserProfile{
		ID:                      u.ID,
		Email:                   u.Email,
		Username:                u.Username,
		Name:                    u.Name,
		FirstName:               u.FirstName,
		LastName:                u.LastName,
		ProfilePicture:          u.ProfilePicture,
		CoverImage:              u.CoverImage,
		Bio:                     u.Bio,
		Tagline:                 u.Tagline,
		Role:                    u.Role,
		IsVerified:              u.IsVerified,
		EmailVerified:           u.EmailVerified,
		InkScore:                u.InkScore,
		Badges:                  u.Badges,
		FollowersCount:          u.FollowersCount,
		FollowingCount:          u.FollowingCount,
		IsPartner:               u.IsPartner,
		SupporterStatus:         u.SupporterStatus,
		SupporterExpiryDate:     u.SupporterExpiryDate,
		Interests:               u.Interests,
		Twitter:                 u.Twitter,
		GitHub:                  u.GitHub,
		LinkedIn:                u.LinkedIn,
		Website:                 u.Website,
		IsBanned:                u.IsBanned,
		IsCommentingRestricted:  u.IsCommentingRestricted,
		JoinedAt:                u.JoinedAt,
		LastLoginAt:             u.LastLoginAt,
	}
}

func ToPublicProfile(u *User, isFollowing bool) PublicProfile {
	return PublicProfile{
		ID:              u.ID,
		Username:        u.Username,
		Name:            u.Name,
		ProfilePicture:  u.ProfilePicture,
		CoverImage:      u.CoverImage,
		Bio:             u.Bio,
		Tagline:         u.Tagline,
		InkScore:        u.InkScore,
		Badges:          u.Badges,
		FollowersCount:  u.FollowersCount,
		FollowingCount:  u.FollowingCount,
		IsPartner:       u.IsPartner,
		SupporterStatus: u.SupporterStatus,
		Interests:       u.Interests,
		Twitter:         u.Twitter,
		GitHub:          u.GitHub,
		LinkedIn:        u.LinkedIn,
		Website:         u.Website,
		IsFollowing:     isFollowing,
		JoinedAt:        u.JoinedAt,
	}
}
