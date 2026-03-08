package jellyfin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	httputil "kamehouse/internal/util/http"
	"kamehouse/internal/util/retry"

	"github.com/rs/zerolog"
)

type Client struct {
	ServerURL  string
	APIKey     string
	Username   string
	Client     string
	Device     string
	DeviceID   string
	Version    string
	Logger     *zerolog.Logger
	httpClient *http.Client

	itemsMapMu sync.RWMutex
	itemsMap   map[int]string
}

type AddVirtualFolderRequest struct {
	Name           string   `json:"Name"`
	CollectionType string   `json:"CollectionType"`
	Paths          []string `json:"Paths"`
	RefreshLibrary bool     `json:"RefreshLibrary"`
}

type AuthRequest struct {
	Name           string   `json:"Name"`
	CollectionType string   `json:"CollectionType"`
	Paths          []string `json:"Paths"`
	RefreshLibrary bool     `json:"RefreshLibrary"`
}

type VirtualFolderInfo struct {
	Name           string   `json:"name"`
	CollectionType string   `json:"collectionType"`
	Locations      []string `json:"locations,omitempty"`
	ItemID         string   `json:"itemId,omitempty"`
	RefreshStatus  string   `json:"refreshStatus,omitempty"`
}

type LibraryOptions struct {
	EnableRealtimeMonitor   bool `json:"EnableRealtimeMonitor"`
	EnableArchiveMediaFiles bool `json:"EnableArchiveMediaFiles"`
	SaveLocalMetadata       bool `json:"SaveLocalMetadata"`
	DownloadImagesInAdvance bool `json:"DownloadImagesInAdvance"`
}

type MediaPathInfo struct {
	Path string `json:"Path"`
}

type ItemSearchResult struct {
	Name        string            `json:"name"`
	Id          string            `json:"id"`
	Type        string            `json:"type"`
	ImageTags   map[string]string `json:"imageTags,omitempty"`
	ProviderIds map[string]string `json:"providerIds,omitempty"`
}

type SearchHintsResult struct {
	Items []ItemSearchResult `json:"items"`
	Total int                `json:"totalRecordCount"`
}

type UserItem struct {
	Id                string            `json:"Id"`
	Name              string            `json:"Name"`
	ServerId          string            `json:"ServerId"`
	Type              string            `json:"Type"` // Series, Movie, Episode
	RunTimeTicks      int64             `json:"RunTimeTicks,omitempty"`
	ProductionYear    int               `json:"ProductionYear,omitempty"`
	IndexNumber       int               `json:"IndexNumber,omitempty"`
	ParentIndexNumber int               `json:"ParentIndexNumber,omitempty"`
	SeriesName        string            `json:"SeriesName,omitempty"`
	Overview          string            `json:"Overview,omitempty"`
	ImageTags         map[string]string `json:"ImageTags,omitempty"`
	ProviderIds       map[string]string `json:"ProviderIds,omitempty"`
	UserData          *UserData         `json:"UserData,omitempty"`
}

type UserData struct {
	Played                bool  `json:"Played"`
	PlaybackPositionTicks int64 `json:"PlaybackPositionTicks"`
	PlayCount             int   `json:"PlayCount"`
	IsFavorite            bool  `json:"IsFavorite"`
}

type GetUserItemsResponse struct {
	Items []UserItem `json:"Items"`
	Total int        `json:"TotalRecordCount"`
}

type AuthResponse struct {
	AccessToken string `json:"AccessToken"`
	User        User   `json:"User"`
}

type User struct {
	ID       string `json:"Id"`
	Username string `json:"Name"`
}

type WebhookPayload struct {
	NotificationType string `json:"NotificationType"`
	ItemName         string `json:"ItemName"`
	ItemId           string `json:"ItemId"`
	User             string `json:"User,omitempty"`
	Message          string `json:"Message,omitempty"`
}

func NewClient(serverURL, apiKey, username string, logger *zerolog.Logger) *Client {
	return &Client{
		ServerURL:  serverURL,
		APIKey:     apiKey,
		Username:   username,
		Client:     "KameHouse",
		Device:     "KameHouse-Server",
		DeviceID:   "kamehouse-server",
		Version:    "1.0.0",
		Logger:     logger,
		httpClient: httputil.DefaultClient(),
	}
}

func NewClientWithTimeout(serverURL, apiKey, username string, timeout time.Duration, logger *zerolog.Logger) *Client {
	return &Client{
		ServerURL:  serverURL,
		APIKey:     apiKey,
		Username:   username,
		Client:     "KameHouse",
		Device:     "KameHouse-Server",
		DeviceID:   "kamehouse-server",
		Version:    "1.0.0",
		Logger:     logger,
		httpClient: httputil.NewClientWithTimeout(timeout),
		itemsMap:   make(map[int]string),
	}
}

func (c *Client) RegisterItemId(mediaId int, itemId string) {
	if c == nil {
		return
	}
	c.itemsMapMu.Lock()
	defer c.itemsMapMu.Unlock()
	if c.itemsMap == nil {
		c.itemsMap = make(map[int]string)
	}
	c.itemsMap[mediaId] = itemId
}

func (c *Client) GetItemId(mediaId int) (string, bool) {
	if c == nil {
		return "", false
	}
	c.itemsMapMu.RLock()
	defer c.itemsMapMu.RUnlock()
	if c.itemsMap == nil {
		return "", false
	}
	id, ok := c.itemsMap[mediaId]
	return id, ok
}

func (c *Client) doWithRetry(ctx context.Context, req *http.Request) (*http.Response, error) {
	return retry.DoWithResult(ctx, retry.DefaultOptions(), func() (*http.Response, error) {
		return c.httpClient.Do(req)
	})
}

func (c *Client) buildURL(endpoint string) string {
	base, _ := url.JoinPath(c.ServerURL, endpoint)
	return base
}

func (c *Client) addAuthHeader(req *http.Request) {
	authHeader := fmt.Sprintf(`MediaBrowser Token="%s", Client="%s", Device="%s", DeviceId="%s", Version="%s"`,
		c.APIKey, c.Client, c.Device, c.DeviceID, c.Version)
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("Content-Type", "application/json")
}

func (c *Client) GetVirtualFolders(ctx context.Context) ([]VirtualFolderInfo, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.buildURL("/Library/VirtualFolders"), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeader(req)

	resp, err := c.doWithRetry(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var folders []VirtualFolderInfo
	if err := json.NewDecoder(resp.Body).Decode(&folders); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return folders, nil
}

func (c *Client) AddVirtualFolder(ctx context.Context, req AddVirtualFolderRequest) error {
	query := url.Values{}
	query.Set("name", req.Name)
	if req.CollectionType != "" {
		query.Set("collectionType", req.CollectionType)
	}
	for _, p := range req.Paths {
		query.Add("paths", p)
	}
	if req.RefreshLibrary {
		query.Set("refreshLibrary", "true")
	}

	builtUrl := c.buildURL("/Library/VirtualFolders") + "?" + query.Encode()

	httpReq, err := http.NewRequestWithContext(ctx, "POST", builtUrl, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeader(httpReq)

	resp, err := c.doWithRetry(ctx, httpReq)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(respBody))
	}

	c.Logger.Info().Str("name", req.Name).Msg("jellyfin: Added virtual folder")

	if req.RefreshLibrary {
		if err := c.RefreshLibrary(ctx); err != nil {
			return fmt.Errorf("failed to refresh library: %w", err)
		}
	}

	return nil
}

func (c *Client) RemoveVirtualFolder(ctx context.Context, name string) error {
	req, err := http.NewRequestWithContext(ctx, "DELETE", c.buildURL(fmt.Sprintf("/Library/VirtualFolders?name=%s", url.QueryEscape(name))), nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeader(req)

	resp, err := c.doWithRetry(ctx, req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	c.Logger.Info().Str("name", name).Msg("jellyfin: Removed virtual folder")

	return nil
}

func (c *Client) RefreshLibrary(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "POST", c.buildURL("/Library/Refresh"), nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeader(req)

	resp, err := c.doWithRetry(ctx, req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	c.Logger.Info().Msg("jellyfin: Library refresh triggered")

	return nil
}

func (c *Client) SearchItems(ctx context.Context, query string, limit int) ([]ItemSearchResult, error) {
	searchURL := fmt.Sprintf("/Search/Hints?SearchTerm=%s&Limit=%d", url.QueryEscape(query), limit)
	req, err := http.NewRequestWithContext(ctx, "GET", c.buildURL(searchURL), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeader(req)

	resp, err := c.doWithRetry(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var result SearchHintsResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Items, nil
}

// GetUserItems fetches the user's library items (Series, Movies) based on the specified item types.
func (c *Client) GetUserItems(ctx context.Context, userID string, includeItemTypes string) ([]UserItem, error) {
	// Fields to include in the response to map to models.LibraryMedia
	fields := "ProviderIds,Overview,DateCreated,Path,MediaSources,UserData"

	query := url.Values{}
	query.Set("Recursive", "true")
	query.Set("Fields", fields)

	if includeItemTypes != "" {
		query.Set("IncludeItemTypes", includeItemTypes)
	}

	endpoint := fmt.Sprintf("/Users/%s/Items?%s", url.PathEscape(userID), query.Encode())

	req, err := http.NewRequestWithContext(ctx, "GET", c.buildURL(endpoint), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeader(req)

	resp, err := c.doWithRetry(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var result GetUserItemsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Items, nil
}

func (c *Client) GetCurrentUser(ctx context.Context) (*User, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.buildURL("/Users"), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeader(req)

	resp, err := c.doWithRetry(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var users []User
	if err := json.NewDecoder(resp.Body).Decode(&users); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	for _, u := range users {
		if strings.EqualFold(u.Username, c.Username) {
			return &u, nil
		}
	}

	return nil, fmt.Errorf("user not found")
}

func (c *Client) SearchItemsByFilename(ctx context.Context, userId string, filename string) ([]ItemSearchResult, error) {
	searchURL := fmt.Sprintf("/Users/%s/Items?Recursive=true&SearchTerm=%s", url.PathEscape(userId), url.QueryEscape(filename))
	req, err := http.NewRequestWithContext(ctx, "GET", c.buildURL(searchURL), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeader(req)

	resp, err := c.doWithRetry(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var result SearchHintsResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Items, nil
}

func (c *Client) MarkItemAsPlayed(ctx context.Context, userId string, itemId string, played bool) error {
	method := "POST"
	if !played {
		method = "DELETE"
	}
	urlPath := fmt.Sprintf("/Users/%s/PlayedItems/%s", url.PathEscape(userId), url.PathEscape(itemId))
	req, err := http.NewRequestWithContext(ctx, method, c.buildURL(urlPath), nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeader(req)

	resp, err := c.doWithRetry(ctx, req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	return nil
}

func (c *Client) AuthenticateByName(ctx context.Context, username, password string) (*AuthResponse, error) {
	authData := map[string]string{
		"username": username,
		"pw":       password,
	}

	body, err := json.Marshal(authData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal auth data: %w", err)
	}

	authHeader := fmt.Sprintf(`MediaBrowser Client="%s", Device="%s", DeviceId="%s", Version="%s"`,
		c.Client, c.Device, c.DeviceID, c.Version)

	req, err := http.NewRequestWithContext(ctx, "POST", c.buildURL("/Users/AuthenticateByName"), bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", authHeader)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.doWithRetry(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("authentication failed: status %d, body: %s", resp.StatusCode, string(body))
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	c.APIKey = authResp.AccessToken
	c.Username = username
	c.Logger.Info().Str("username", username).Msg("jellyfin: Authenticated successfully")

	return &authResp, nil
}

func (c *Client) GetItem(ctx context.Context, itemID string) (*ItemSearchResult, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.buildURL(fmt.Sprintf("/Items/%s", itemID)), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeader(req)

	resp, err := c.doWithRetry(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var item ItemSearchResult
	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &item, nil
}

func (c *Client) CreateAPIKey(ctx context.Context, name string) (string, error) {
	keyData := map[string]string{
		"Id":   fmt.Sprintf("kamehouse-%s", name),
		"Name": name,
	}

	body, err := json.Marshal(keyData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.buildURL("/Auth/Keys"), bytes.NewBuffer(body))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeader(req)

	resp, err := c.doWithRetry(ctx, req)
	if err != nil {
		return "", fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Key string `json:"Key"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Key, nil
}
