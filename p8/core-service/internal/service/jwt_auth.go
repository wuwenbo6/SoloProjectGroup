package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
)

const (
	TokenExpiryTime    = 24 * time.Hour
	RefreshTokenExpiry = 7 * 24 * time.Hour
	contextKeyUser     = "user"
)

type UserClaims struct {
	UserID    string   `json:"user_id"`
	Username  string   `json:"username"`
	Roles     []string `json:"roles"`
	Devices   []string `json:"devices"`
	jwt.RegisteredClaims
}

type AuthService struct {
	logger        *zap.Logger
	jwtSecret     []byte
	userDevices   map[string][]string
	userMutex     sync.RWMutex
	refreshTokens map[string]time.Time
	tokenMutex    sync.RWMutex
}

func NewAuthService(jwtSecret string, logger *zap.Logger) *AuthService {
	return &AuthService{
		logger:        logger,
		jwtSecret:     []byte(jwtSecret),
		userDevices:   make(map[string][]string),
		refreshTokens: make(map[string]time.Time),
	}
}

func (a *AuthService) GenerateToken(userID, username string, roles []string, devices []string) (string, string, error) {
	now := time.Now()

	accessClaims := &UserClaims{
		UserID:   userID,
		Username: username,
		Roles:    roles,
		Devices:  devices,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(TokenExpiryTime)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "iot-core-service",
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString(a.jwtSecret)
	if err != nil {
		return "", "", fmt.Errorf("failed to sign access token: %w", err)
	}

	refreshClaims := &jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(now.Add(RefreshTokenExpiry)),
		IssuedAt:  jwt.NewNumericDate(now),
		Issuer:    "iot-core-service",
		Subject:   userID,
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString(a.jwtSecret)
	if err != nil {
		return "", "", fmt.Errorf("failed to sign refresh token: %w", err)
	}

	a.tokenMutex.Lock()
	a.refreshTokens[refreshTokenString] = now.Add(RefreshTokenExpiry)
	a.tokenMutex.Unlock()

	a.userMutex.Lock()
	a.userDevices[userID] = devices
	a.userMutex.Unlock()

	return accessTokenString, refreshTokenString, nil
}

func (a *AuthService) ValidateToken(tokenString string) (*UserClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return a.jwtSecret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if claims, ok := token.Claims.(*UserClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

func (a *AuthService) RefreshToken(refreshTokenString string) (string, string, error) {
	a.tokenMutex.RLock()
	expiry, exists := a.refreshTokens[refreshTokenString]
	a.tokenMutex.RUnlock()

	if !exists || time.Now().After(expiry) {
		return "", "", errors.New("refresh token expired or invalid")
	}

	token, err := jwt.ParseWithClaims(refreshTokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (interface{}, error) {
		return a.jwtSecret, nil
	})

	if err != nil {
		return "", "", fmt.Errorf("failed to parse refresh token: %w", err)
	}

	if claims, ok := token.Claims.(*jwt.RegisteredClaims); ok && token.Valid {
		userID := claims.Subject

		a.userMutex.RLock()
		devices, exists := a.userDevices[userID]
		a.userMutex.RUnlock()

		if !exists {
			devices = []string{}
		}

		a.tokenMutex.Lock()
		delete(a.refreshTokens, refreshTokenString)
		a.tokenMutex.Unlock()

		return a.GenerateToken(userID, claims.Subject, []string{"user"}, devices)
	}

	return "", "", errors.New("invalid refresh token")
}

func (a *AuthService) RevokeToken(refreshTokenString string) {
	a.tokenMutex.Lock()
	delete(a.refreshTokens, refreshTokenString)
	a.tokenMutex.Unlock()
}

func (a *AuthService) CanAccessDevice(claims *UserClaims, deviceID string) bool {
	if claims == nil {
		return false
	}

	for _, role := range claims.Roles {
		if role == "admin" || role == "superuser" {
			return true
		}
	}

	for _, d := range claims.Devices {
		if d == "*" || d == deviceID {
			return true
		}
		if strings.HasSuffix(d, "*") {
			prefix := strings.TrimSuffix(d, "*")
			if strings.HasPrefix(deviceID, prefix) {
				return true
			}
		}
	}

	return false
}

func (a *AuthService) GetAccessibleDevices(claims *UserClaims) []string {
	if claims == nil {
		return []string{}
	}

	for _, role := range claims.Roles {
		if role == "admin" || role == "superuser" {
			return []string{"*"}
		}
	}

	return claims.Devices
}

func (a *AuthService) AddUserDevice(userID, deviceID string) {
	a.userMutex.Lock()
	defer a.userMutex.Unlock()

	if _, exists := a.userDevices[userID]; !exists {
		a.userDevices[userID] = []string{}
	}

	for _, d := range a.userDevices[userID] {
		if d == deviceID {
			return
		}
	}

	a.userDevices[userID] = append(a.userDevices[userID], deviceID)
}

func (a *AuthService) RemoveUserDevice(userID, deviceID string) {
	a.userMutex.Lock()
	defer a.userMutex.Unlock()

	if devices, exists := a.userDevices[userID]; exists {
		newDevices := make([]string, 0, len(devices))
		for _, d := range devices {
			if d != deviceID {
				newDevices = append(newDevices, d)
			}
		}
		a.userDevices[userID] = newDevices
	}
}

func (a *AuthService) ExtractTokenFromHeader(authHeader string) string {
	if authHeader == "" {
		return ""
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return ""
	}

	return parts[1]
}

func (a *AuthService) ContextWithUser(ctx context.Context, claims *UserClaims) context.Context {
	return context.WithValue(ctx, contextKeyUser, claims)
}

func (a *AuthService) UserFromContext(ctx context.Context) (*UserClaims, bool) {
	claims, ok := ctx.Value(contextKeyUser).(*UserClaims)
	return claims, ok
}
