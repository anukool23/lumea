package services

import (
	"errors"

	"go.uber.org/zap"

	"lumea-auth/internal/models"
	"lumea-auth/internal/repository"
)

type UserService struct {
	repo *repository.UserRepository
	log  *zap.Logger
}

func NewUserService(repo *repository.UserRepository, log *zap.Logger) *UserService {
	return &UserService{
		repo: repo,
		log:  log.With(zap.String("component", "user_service")),
	}
}

func (s *UserService) GetMyProfile(userID string) (*models.UserProfile, error) {
	user, err := s.repo.FindByID(userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, errors.New("user not found")
		}
		s.log.Error("get_profile: db error", zap.String("user_id", userID), zap.Error(err))
		return nil, err
	}
	profile := models.ToUserProfile(user)
	return &profile, nil
}

func (s *UserService) UpdateProfile(userID string, req *models.UpdateProfileRequest) (*models.UserProfile, error) {
	user, err := s.repo.FindByID(userID)
	if err != nil {
		return nil, errors.New("user not found")
	}

	if req.Username != nil && *req.Username != user.Username {
		exists, err := s.repo.UsernameExists(*req.Username)
		if err != nil {
			s.log.Error("update_profile: username check failed",
				zap.String("user_id", userID), zap.Error(err))
			return nil, err
		}
		if exists {
			s.log.Warn("update_profile: username taken",
				zap.String("user_id", userID), zap.String("username", *req.Username))
			return nil, errors.New("username already taken")
		}
		user.Username = *req.Username
	}

	if req.Name != nil      { user.Name = req.Name }
	if req.FirstName != nil { user.FirstName = req.FirstName }
	if req.LastName != nil  { user.LastName = req.LastName }
	if req.Bio != nil       { user.Bio = req.Bio }
	if req.Tagline != nil   { user.Tagline = req.Tagline }
	if req.Twitter != nil   { user.Twitter = req.Twitter }
	if req.GitHub != nil    { user.GitHub = req.GitHub }
	if req.LinkedIn != nil  { user.LinkedIn = req.LinkedIn }
	if req.Website != nil   { user.Website = req.Website }
	if req.Interests != nil { user.Interests = req.Interests }

	if err := s.repo.Update(user); err != nil {
		s.log.Error("update_profile: db error", zap.String("user_id", userID), zap.Error(err))
		return nil, err
	}

	s.log.Info("update_profile: profile updated", zap.String("user_id", userID))
	profile := models.ToUserProfile(user)
	return &profile, nil
}

func (s *UserService) UpdateAvatar(userID, url string) error {
	if err := s.repo.UpdateFields(userID, map[string]interface{}{"profile_picture": url}); err != nil {
		s.log.Error("update_avatar: failed", zap.String("user_id", userID), zap.Error(err))
		return err
	}
	s.log.Info("update_avatar: updated", zap.String("user_id", userID))
	return nil
}

func (s *UserService) UpdateCover(userID, url string) error {
	if err := s.repo.UpdateFields(userID, map[string]interface{}{"cover_image": url}); err != nil {
		s.log.Error("update_cover: failed", zap.String("user_id", userID), zap.Error(err))
		return err
	}
	s.log.Info("update_cover: updated", zap.String("user_id", userID))
	return nil
}

func (s *UserService) GetPublicProfile(handle, viewerID string) (*models.PublicProfile, error) {
	var user *models.User
	var err error

	if len(handle) == 36 {
		user, err = s.repo.FindByID(handle)
	} else {
		user, err = s.repo.FindByUsername(handle)
	}

	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, errors.New("user not found")
		}
		s.log.Error("get_public_profile: db error", zap.String("handle", handle), zap.Error(err))
		return nil, err
	}

	if user.IsBanned {
		s.log.Warn("get_public_profile: suspended account accessed",
			zap.String("user_id", user.ID), zap.String("viewer_id", viewerID))
		return nil, errors.New("this account has been suspended")
	}

	isFollowing := false
	if viewerID != "" && viewerID != user.ID {
		isFollowing, _ = s.repo.IsFollowing(viewerID, user.ID)
	}

	profile := models.ToPublicProfile(user, isFollowing)
	return &profile, nil
}

func (s *UserService) Follow(followerID, followingID string) error {
	if followerID == followingID {
		return errors.New("cannot follow yourself")
	}

	target, err := s.repo.FindByID(followingID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return errors.New("user not found")
		}
		return err
	}
	if target.IsBanned {
		return errors.New("cannot follow a suspended account")
	}

	err = s.repo.Follow(followerID, followingID)
	if errors.Is(err, repository.ErrDuplicate) {
		return errors.New("already following this user")
	}
	if err != nil {
		s.log.Error("follow: db error",
			zap.String("follower_id", followerID), zap.String("following_id", followingID), zap.Error(err))
		return err
	}

	s.log.Info("follow: followed",
		zap.String("follower_id", followerID), zap.String("following_id", followingID))
	return nil
}

func (s *UserService) Unfollow(followerID, followingID string) error {
	if followerID == followingID {
		return errors.New("cannot unfollow yourself")
	}
	err := s.repo.Unfollow(followerID, followingID)
	if errors.Is(err, repository.ErrNotFound) {
		return errors.New("not following this user")
	}
	if err != nil {
		s.log.Error("unfollow: db error",
			zap.String("follower_id", followerID), zap.String("following_id", followingID), zap.Error(err))
		return err
	}

	s.log.Info("unfollow: unfollowed",
		zap.String("follower_id", followerID), zap.String("following_id", followingID))
	return nil
}

func (s *UserService) GetSuggested(userID string) ([]models.PublicProfile, error) {
	users, err := s.repo.GetSuggested(userID, 10)
	if err != nil {
		s.log.Error("get_suggested: db error", zap.String("user_id", userID), zap.Error(err))
		return nil, err
	}
	profiles := make([]models.PublicProfile, len(users))
	for i, u := range users {
		u := u
		profiles[i] = models.ToPublicProfile(&u, false)
	}
	return profiles, nil
}

func (s *UserService) GetFollowers(userID string, page, limit int) ([]models.PublicProfile, int64, error) {
	if page < 1  { page = 1 }
	if limit < 1 || limit > 50 { limit = 20 }

	users, total, err := s.repo.GetFollowers(userID, page, limit)
	if err != nil {
		s.log.Error("get_followers: db error", zap.String("user_id", userID), zap.Error(err))
		return nil, 0, err
	}
	profiles := make([]models.PublicProfile, len(users))
	for i, u := range users {
		u := u
		profiles[i] = models.ToPublicProfile(&u, false)
	}
	return profiles, total, nil
}

func (s *UserService) GetFollowing(userID string, page, limit int) ([]models.PublicProfile, int64, error) {
	if page < 1  { page = 1 }
	if limit < 1 || limit > 50 { limit = 20 }

	users, total, err := s.repo.GetFollowing(userID, page, limit)
	if err != nil {
		s.log.Error("get_following: db error", zap.String("user_id", userID), zap.Error(err))
		return nil, 0, err
	}
	profiles := make([]models.PublicProfile, len(users))
	for i, u := range users {
		u := u
		profiles[i] = models.ToPublicProfile(&u, false)
	}
	return profiles, total, nil
}
