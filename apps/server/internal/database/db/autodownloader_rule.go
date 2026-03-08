package db

import (
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"

	"github.com/goccy/go-json"
)

var CurrAutoDownloaderRules []*dto.AutoDownloaderRule

func GetAutoDownloaderRules(db *Database) ([]*dto.AutoDownloaderRule, error) {

	//if CurrAutoDownloaderRules != nil {
	//	return CurrAutoDownloaderRules, nil
	//}

	var res []*models.AutoDownloaderRule
	err := db.Gorm().Find(&res).Error
	if err != nil {
		return nil, err
	}

	// Unmarshal the data
	var rules []*dto.AutoDownloaderRule
	for _, r := range res {
		smBytes := r.Value
		var sm dto.AutoDownloaderRule
		if err := json.Unmarshal(smBytes, &sm); err != nil {
			return nil, err
		}
		sm.DbID = r.ID
		rules = append(rules, &sm)
	}

	//CurrAutoDownloaderRules = rules

	return rules, nil
}

func GetAutoDownloaderRule(db *Database, id uint) (*dto.AutoDownloaderRule, error) {
	var res models.AutoDownloaderRule
	err := db.Gorm().First(&res, id).Error
	if err != nil {
		return nil, err
	}

	// Unmarshal the data
	smBytes := res.Value
	var sm dto.AutoDownloaderRule
	if err := json.Unmarshal(smBytes, &sm); err != nil {
		return nil, err
	}
	sm.DbID = res.ID

	return &sm, nil
}

func GetAutoDownloaderRulesByMediaId(db *Database, mediaId int) (ret []*dto.AutoDownloaderRule) {
	rules, err := GetAutoDownloaderRules(db)
	if err != nil {
		return
	}

	for _, rule := range rules {
		if rule.MediaId == mediaId {
			ret = append(ret, rule)
		}
	}

	return
}

func InsertAutoDownloaderRule(db *Database, sm *dto.AutoDownloaderRule) error {

	CurrAutoDownloaderRules = nil

	// Marshal the data
	bytes, err := json.Marshal(sm)
	if err != nil {
		return err
	}

	// Save the data
	return db.Gorm().Create(&models.AutoDownloaderRule{
		Value: bytes,
	}).Error
}

func DeleteAutoDownloaderRule(db *Database, id uint) error {

	CurrAutoDownloaderRules = nil

	return db.Gorm().Delete(&models.AutoDownloaderRule{}, id).Error
}

func UpdateAutoDownloaderRule(db *Database, id uint, sm *dto.AutoDownloaderRule) error {

	CurrAutoDownloaderRules = nil

	// Marshal the data
	bytes, err := json.Marshal(sm)
	if err != nil {
		return err
	}

	// Save the data
	return db.Gorm().Model(&models.AutoDownloaderRule{}).Where("id = ?", id).Update("value", bytes).Error
}
