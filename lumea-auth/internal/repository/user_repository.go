package repository

import (
	"errors"

	"gorm.io/gorm"

	"lumea-auth/internal/models"
)

var ErrNotFound = errors.New("record not found")
var ErrDuplicate = errors.New("record already exists")

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(user *models.User) error {
	result := r.db.Create(user)
	if result.Error != nil {
		if isDuplicateKeyError(result.Error) {
			return ErrDuplicate
		}
		return result.Error
	}
	return nil
}

func (r *UserRepository) FindByID(id string) (*models.User, error) {
	var user models.User
	result := r.db.Where("id = ?", id).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, result.Error
	}
	return &user, nil
}

func (r *UserRepository) FindByEmail(email string) (*models.User, error) {
	var user models.User
	result := r.db.Where("email = ?", email).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, result.Error
	}
	return &user, nil
}

func (r *UserRepository) FindByUsername(username string) (*models.User, error) {
	var user models.User
	result := r.db.Where("username = ?", username).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, result.Error
	}
	return &user, nil
}

func (r *UserRepository) Update(user *models.User) error {
	return r.db.Save(user).Error
}

func (r *UserRepository) UpdateFields(id string, fields map[string]interface{}) error {
	return r.db.Model(&models.User{}).Where("id = ?", id).Updates(fields).Error
}

func (r *UserRepository) EmailExists(email string) (bool, error) {
	var count int64
	err := r.db.Model(&models.User{}).Where("email = ?", email).Count(&count).Error
	return count > 0, err
}

func (r *UserRepository) UsernameExists(username string) (bool, error) {
	var count int64
	err := r.db.Model(&models.User{}).Where("username = ?", username).Count(&count).Error
	return count > 0, err
}

// ── Follow operations ─────────────────────────────────────────────────────────

func (r *UserRepository) Follow(followerID, followingID string) error {
	follow := models.Follow{
		FollowerID:  followerID,
		FollowingID: followingID,
	}
	result := r.db.Create(&follow)
	if result.Error != nil {
		if isDuplicateKeyError(result.Error) {
			return ErrDuplicate
		}
		return result.Error
	}

	// Increment counters atomically
	r.db.Model(&models.User{}).Where("id = ?", followerID).
		UpdateColumn("following_count", gorm.Expr("following_count + 1"))
	r.db.Model(&models.User{}).Where("id = ?", followingID).
		UpdateColumn("followers_count", gorm.Expr("followers_count + 1"))

	return nil
}

func (r *UserRepository) Unfollow(followerID, followingID string) error {
	result := r.db.Where("follower_id = ? AND following_id = ?", followerID, followingID).
		Delete(&models.Follow{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}

	// Decrement counters
	r.db.Model(&models.User{}).Where("id = ? AND following_count > 0", followerID).
		UpdateColumn("following_count", gorm.Expr("following_count - 1"))
	r.db.Model(&models.User{}).Where("id = ? AND followers_count > 0", followingID).
		UpdateColumn("followers_count", gorm.Expr("followers_count - 1"))

	return nil
}

func (r *UserRepository) IsFollowing(followerID, followingID string) (bool, error) {
	var count int64
	err := r.db.Model(&models.Follow{}).
		Where("follower_id = ? AND following_id = ?", followerID, followingID).
		Count(&count).Error
	return count > 0, err
}

// GetSuggested returns users the given user doesn't follow yet, ordered by followers
func (r *UserRepository) GetSuggested(userID string, limit int) ([]models.User, error) {
	var users []models.User

	subQuery := r.db.Model(&models.Follow{}).
		Select("following_id").
		Where("follower_id = ?", userID)

	result := r.db.Where("id != ? AND id NOT IN (?) AND is_banned = false", userID, subQuery).
		Order("followers_count DESC").
		Limit(limit).
		Find(&users)

	return users, result.Error
}

// GetFollowers returns users who follow the given user
func (r *UserRepository) GetFollowers(userID string, page, limit int) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	subQuery := r.db.Model(&models.Follow{}).
		Select("follower_id").
		Where("following_id = ?", userID)

	r.db.Model(&models.User{}).Where("id IN (?)", subQuery).Count(&total)

	result := r.db.Where("id IN (?)", subQuery).
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&users)

	return users, total, result.Error
}

// GetFollowing returns users the given user follows
func (r *UserRepository) GetFollowing(userID string, page, limit int) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	subQuery := r.db.Model(&models.Follow{}).
		Select("following_id").
		Where("follower_id = ?", userID)

	r.db.Model(&models.User{}).Where("id IN (?)", subQuery).Count(&total)

	result := r.db.Where("id IN (?)", subQuery).
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&users)

	return users, total, result.Error
}

// ── Session operations ────────────────────────────────────────────────────────

func (r *UserRepository) CreateSession(session *models.Session) error {
	return r.db.Create(session).Error
}

func (r *UserRepository) DeactivateSession(jti string) error {
	return r.db.Model(&models.Session{}).
		Where("jti = ?", jti).
		Update("is_active", false).Error
}

func (r *UserRepository) DeactivateAllSessions(userID string) error {
	return r.db.Model(&models.Session{}).
		Where("user_id = ?", userID).
		Update("is_active", false).Error
}

// ── helpers ───────────────────────────────────────────────────────────────────

func isDuplicateKeyError(err error) bool {
	return err != nil && (containsString(err.Error(), "duplicate key") ||
		containsString(err.Error(), "unique constraint") ||
		containsString(err.Error(), "23505"))
}

func containsString(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && containsSubstring(s, sub))
}

func containsSubstring(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
