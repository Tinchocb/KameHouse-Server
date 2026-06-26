package cache

import (
    "sync"
    "time"
    db "kamehouse/internal/database/db"
    "kamehouse/internal/database/models"
)

type SettingsCache struct {
    settingsMutex sync.RWMutex
    settings     *models.Settings
    settingsTime time.Time
    ttl         time.Duration
}

func NewSettingsCache(ttl time.Duration) *SettingsCache {
    return &SettingsCache{ttl: ttl}
}

func (c *SettingsCache) GetSettings(database *db.Database) (*models.Settings, error) {
    c.settingsMutex.RLock()
    if c.settings != nil {
        if time.Since(c.settingsTime) < c.ttl {
            c.settingsMutex.RUnlock()
            return c.settings, nil
        }
    }
    c.settingsMutex.RUnlock()

    c.settingsMutex.Lock()
    defer c.settingsMutex.Unlock()

    if c.settings != nil && time.Since(c.settingsTime) < c.ttl {
        return c.settings, nil
    }

    var settings models.Settings
    err := database.Gorm().Where("id = ?", 1).First(&settings).Error
    if err != nil {
        return nil, err
    }
    c.settings = &settings
    c.settingsTime = time.Now()
    return &settings, nil
}

func (c *SettingsCache) Invalidate() {
    c.settingsMutex.Lock()
    defer c.settingsMutex.Unlock()
    c.settings = nil
}
