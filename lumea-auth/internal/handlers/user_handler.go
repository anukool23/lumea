package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"lumea-auth/internal/middleware"
	"lumea-auth/internal/models"
	"lumea-auth/internal/services"
)

type UserHandler struct {
	userSvc *services.UserService
}

func NewUserHandler(userSvc *services.UserService) *UserHandler {
	return &UserHandler{userSvc: userSvc}
}

// GetProfile godoc
//
//	@Summary		Get own profile
//	@Description	Returns the authenticated user's full profile from the database.
//	@Tags			users
//	@Security		BearerAuth
//	@Security		APIKeyAuth
//	@Produce		json
//	@Success		200		{object}	models.UserProfile
//	@Failure		401		{object}	models.ErrorResponse
//	@Failure		404		{object}	models.ErrorResponse
//	@Router			/users/profile [get]
func (h *UserHandler) GetProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)

	profile, err := h.userSvc.GetMyProfile(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, profile)
}

// UpdateProfile godoc
//
//	@Summary		Update profile
//	@Description	Updates bio, tagline, username, social links, interests. All fields optional.
//	@Tags			users
//	@Security		BearerAuth
//	@Security		APIKeyAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.UpdateProfileRequest		true	"Fields to update"
//	@Success		200		{object}	models.UserProfile
//	@Failure		400		{object}	models.ErrorResponse	"Validation or username conflict"
//	@Failure		401		{object}	models.ErrorResponse
//	@Router			/users/profile [put]
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	profile, err := h.userSvc.UpdateProfile(userID, &req)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "username already taken" {
			status = http.StatusConflict
		}
		c.JSON(status, models.ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, profile)
}

// UpdateAvatar godoc
//
//	@Summary		Update profile picture
//	@Description	Updates the profile picture URL (URL should be a Cloudinary CDN URL uploaded via Media Service).
//	@Tags			users
//	@Security		BearerAuth
//	@Security		APIKeyAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.UpdateAvatarRequest	true	"Profile picture URL"
//	@Success		200		{object}	models.MessageResponse
//	@Failure		400		{object}	models.ErrorResponse
//	@Failure		401		{object}	models.ErrorResponse
//	@Router			/users/profile/avatar [patch]
func (h *UserHandler) UpdateAvatar(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req models.UpdateAvatarRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	if err := h.userSvc.UpdateAvatar(userID, req.ProfilePicture); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "failed to update avatar"})
		return
	}

	c.JSON(http.StatusOK, models.MessageResponse{Message: "profile picture updated"})
}

// UpdateCover godoc
//
//	@Summary		Update cover image
//	@Description	Updates the cover image URL.
//	@Tags			users
//	@Security		BearerAuth
//	@Security		APIKeyAuth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.UpdateCoverRequest	true	"Cover image URL"
//	@Success		200		{object}	models.MessageResponse
//	@Failure		400		{object}	models.ErrorResponse
//	@Failure		401		{object}	models.ErrorResponse
//	@Router			/users/profile/cover [patch]
func (h *UserHandler) UpdateCover(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req models.UpdateCoverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	if err := h.userSvc.UpdateCover(userID, req.CoverImage); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "failed to update cover"})
		return
	}

	c.JSON(http.StatusOK, models.MessageResponse{Message: "cover image updated"})
}

// GetPublicProfile godoc
//
//	@Summary		Get public profile
//	@Description	Returns a publicly visible profile by username or UUID. Optional auth header populates is_following.
//	@Tags			users
//	@Produce		json
//	@Param			handle	path		string	true	"Username or user UUID"
//	@Success		200		{object}	models.PublicProfile
//	@Failure		404		{object}	models.ErrorResponse
//	@Failure		410		{object}	models.ErrorResponse	"Account suspended"
//	@Security		APIKeyAuth
//	@Router			/users/{handle} [get]
func (h *UserHandler) GetPublicProfile(c *gin.Context) {
	handle := c.Param("id")
	viewerID := middleware.GetUserID(c) // empty string if not authed

	profile, err := h.userSvc.GetPublicProfile(handle, viewerID)
	if err != nil {
		status := http.StatusNotFound
		if err.Error() == "this account has been suspended" {
			status = http.StatusGone
		}
		c.JSON(status, models.ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, profile)
}

// Follow godoc
//
//	@Summary		Follow a user
//	@Description	Follow another user. Updates follower/following counts atomically.
//	@Tags			users
//	@Security		BearerAuth
//	@Produce		json
//	@Param			userId	path		string	true	"Target user UUID"
//	@Success		200		{object}	models.MessageResponse
//	@Failure		400		{object}	models.ErrorResponse	"Already following / self-follow"
//	@Failure		401		{object}	models.ErrorResponse
//	@Failure		404		{object}	models.ErrorResponse
//	@Security		BearerAuth
//	@Security		APIKeyAuth
//	@Router			/users/{userId}/follow [post]
func (h *UserHandler) Follow(c *gin.Context) {
	followerID := middleware.GetUserID(c)
	followingID := c.Param("id")

	if err := h.userSvc.Follow(followerID, followingID); err != nil {
		status := http.StatusBadRequest
		if err.Error() == "user not found" {
			status = http.StatusNotFound
		}
		c.JSON(status, models.ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.MessageResponse{Message: "followed successfully"})
}

// Unfollow godoc
//
//	@Summary		Unfollow a user
//	@Description	Unfollow a user. Updates follower/following counts atomically.
//	@Tags			users
//	@Security		BearerAuth
//	@Produce		json
//	@Param			userId	path		string	true	"Target user UUID"
//	@Success		200		{object}	models.MessageResponse
//	@Failure		400		{object}	models.ErrorResponse	"Not following"
//	@Failure		401		{object}	models.ErrorResponse
//	@Security		BearerAuth
//	@Security		APIKeyAuth
//	@Router			/users/{userId}/follow [delete]
func (h *UserHandler) Unfollow(c *gin.Context) {
	followerID := middleware.GetUserID(c)
	followingID := c.Param("id")

	if err := h.userSvc.Unfollow(followerID, followingID); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.MessageResponse{Message: "unfollowed successfully"})
}

// GetSuggested godoc
//
//	@Summary		Suggested users to follow
//	@Description	Returns up to 10 users ordered by followers count, excluding those already followed.
//	@Tags			users
//	@Security		BearerAuth
//	@Security		APIKeyAuth
//	@Produce		json
//	@Success		200		{array}		models.PublicProfile
//	@Failure		401		{object}	models.ErrorResponse
//	@Router			/users/suggested [get]
func (h *UserHandler) GetSuggested(c *gin.Context) {
	userID := middleware.GetUserID(c)

	profiles, err := h.userSvc.GetSuggested(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "failed to fetch suggestions"})
		return
	}

	c.JSON(http.StatusOK, profiles)
}

// GetFollowers godoc
//
//	@Summary		Get user's followers
//	@Description	Returns paginated list of users who follow the given user.
//	@Tags			users
//	@Produce		json
//	@Param			userId	path		string	true	"User UUID"
//	@Param			page	query		int		false	"Page number (default 1)"
//	@Param			limit	query		int		false	"Items per page (default 20, max 50)"
//	@Success		200		{object}	object{data=[]models.PublicProfile,total=int,page=int}
//	@Failure		404		{object}	models.ErrorResponse
//	@Security		APIKeyAuth
//	@Router			/users/{userId}/followers [get]
func (h *UserHandler) GetFollowers(c *gin.Context) {
	userID := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	profiles, total, err := h.userSvc.GetFollowers(userID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "failed to fetch followers"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  profiles,
		"total": total,
		"page":  page,
	})
}

// GetFollowing godoc
//
//	@Summary		Get users followed by user
//	@Description	Returns paginated list of users the given user follows.
//	@Tags			users
//	@Produce		json
//	@Param			userId	path		string	true	"User UUID"
//	@Param			page	query		int		false	"Page number (default 1)"
//	@Param			limit	query		int		false	"Items per page (default 20, max 50)"
//	@Success		200		{object}	object{data=[]models.PublicProfile,total=int,page=int}
//	@Failure		404		{object}	models.ErrorResponse
//	@Security		APIKeyAuth
//	@Router			/users/{userId}/following [get]
func (h *UserHandler) GetFollowing(c *gin.Context) {
	userID := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	profiles, total, err := h.userSvc.GetFollowing(userID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "failed to fetch following"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  profiles,
		"total": total,
		"page":  page,
	})
}
