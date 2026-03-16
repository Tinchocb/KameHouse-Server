package handlers

import (
	"errors"
	"kamehouse/internal/database/db"
	"path/filepath"

	"kamehouse/internal/database/models/dto"
	"strconv"

	"github.com/labstack/echo/v4"
)

// HandleRunAutoDownloader
//
//	@summary tells the AutoDownloader to check for new episodes if enabled.
//	@desc This will run the AutoDownloader if it is enabled.
//	@desc It does nothing if the AutoDownloader is disabled.
//	@route /api/v1/auto-downloader/run [POST]
//	@returns bool
func (h *Handler) HandleRunAutoDownloader(c echo.Context) error {

	h.App.AutoDownloader.Run()

	return h.RespondWithData(c, true)
}

// HandleRunAutoDownloader
//
//	@summary runs the AutoDownloader in simulation mode and returns the results.
//	@desc It does nothing if the AutoDownloader is disabled.
//	@route /api/v1/auto-downloader/run/simulation [POST]
//	@returns []autodownloader.SimulationResult
func (h *Handler) HandleRunAutoDownloaderSimulation(c echo.Context) error {
	type body struct {
		RuleIds []uint `json:"ruleIds"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	h.App.AutoDownloader.RunCheck()
	res := h.App.AutoDownloader.GetSimulationResults()
	h.App.AutoDownloader.ClearSimulationResults()

	return h.RespondWithData(c, res)
}

// HandleGetAutoDownloaderRule
//
//	@summary returns the rule with the given DB id.
//	@desc This is used to get a specific rule, useful for editing.
//	@route /api/v1/auto-downloader/rule/{id} [GET]
//	@param id - int - true - "The DB id of the rule"
//	@returns dto.AutoDownloaderRule
func (h *Handler) HandleGetAutoDownloaderRule(c echo.Context) error {

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return h.RespondWithError(c, errors.New("invalid id"))
	}

	rule, err := db.GetAutoDownloaderRule(h.App.Database, uint(id))
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, rule)
}

// HandleGetAutoDownloaderRulesByAnime
//
//	@summary returns the rules with the given media id.
//	@route /api/v1/auto-downloader/rule/anime/{id} [GET]
//	@param id - int - true - "The anime id of the rules"
//	@returns []dto.AutoDownloaderRule
func (h *Handler) HandleGetAutoDownloaderRulesByAnime(c echo.Context) error {

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return h.RespondWithError(c, errors.New("invalid id"))
	}

	rules := db.GetAutoDownloaderRulesByMediaId(h.App.Database, id)
	return h.RespondWithData(c, rules)
}

// HandleGetAutoDownloaderRules
//
//	@summary returns all rules.
//	@desc This is used to list all rules. It returns an empty slice if there are no rules.
//	@route /api/v1/auto-downloader/rules [GET]
//	@returns []dto.AutoDownloaderRule
func (h *Handler) HandleGetAutoDownloaderRules(c echo.Context) error {
	rules, err := db.GetAutoDownloaderRules(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, rules)
}

// HandleCreateAutoDownloaderRule
//
//	@summary creates a new rule.
//	@desc This is used to create a new rule.
//	@route /api/v1/auto-downloader/rule [POST]
//	@param rule - dto.AutoDownloaderRule - true - "The rule to create"
//	@returns dto.AutoDownloaderRule
func (h *Handler) HandleCreateAutoDownloaderRule(c echo.Context) error {

	var rule dto.AutoDownloaderRule
	if err := c.Bind(&rule); err != nil {
		return h.RespondWithError(c, err)
	}

	rule.Destination = filepath.ToSlash(rule.Destination)

	err := db.InsertAutoDownloaderRule(h.App.Database, &rule)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, rule)
}

// HandleUpdateAutoDownloaderRule
//
//	@summary updates the rule with the given DB id.
//	@desc This is used to update a specific rule.
//	@route /api/v1/auto-downloader/rule [PATCH]
//	@param rule - dto.AutoDownloaderRule - true - "The rule to update"
//	@returns dto.AutoDownloaderRule
func (h *Handler) HandleUpdateAutoDownloaderRule(c echo.Context) error {

	var rule dto.AutoDownloaderRule
	if err := c.Bind(&rule); err != nil {
		return h.RespondWithError(c, err)
	}

	rule.Destination = filepath.ToSlash(rule.Destination)

	err := db.UpdateAutoDownloaderRule(h.App.Database, rule.DbID, &rule)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, rule)
}

// HandleDeleteAutoDownloaderRule
//
//	@summary deletes the rule with the given DB id.
//	@desc This is used to delete a specific rule.
//	@route /api/v1/auto-downloader/rule/{id} [DELETE]
//	@param id - int - true - "The DB id of the rule"
//	@returns bool
func (h *Handler) HandleDeleteAutoDownloaderRule(c echo.Context) error {

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return h.RespondWithError(c, errors.New("invalid id"))
	}

	err = db.DeleteAutoDownloaderRule(h.App.Database, uint(id))
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, true)
}

// HandleGetAutoDownloaderItem
//
//	@summary returns the item with the given DB id.
//	@desc This is used to get a specific item, useful for editing.
//	@route /api/v1/auto-downloader/item/{id} [GET]
//	@param id - int - true - "The DB id of the item"
//	@returns dto.AutoDownloaderItem
func (h *Handler) HandleGetAutoDownloaderItem(c echo.Context) error {

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return h.RespondWithError(c, errors.New("invalid id"))
	}

	item, err := h.App.Database.GetAutoDownloaderItem(uint(id))
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, item)
}

// HandleGetAutoDownloaderItems
//
//	@summary returns all items.
//	@desc This is used to list all items. It returns an empty slice if there are no items.
//	@route /api/v1/auto-downloader/items [GET]
//	@returns []dto.AutoDownloaderItem
func (h *Handler) HandleGetAutoDownloaderItems(c echo.Context) error {
	items, err := h.App.Database.GetAutoDownloaderItems()
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, items)
}

// HandleDeleteAutoDownloaderItem
//
//	@summary deletes the item with the given DB id.
//	@desc This is used to delete a specific item.
//	@route /api/v1/auto-downloader/item/{id} [DELETE]
//	@param id - int - true - "The DB id of the item"
//	@returns bool
func (h *Handler) HandleDeleteAutoDownloaderItem(c echo.Context) error {

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return h.RespondWithError(c, errors.New("invalid id"))
	}

	err = h.App.Database.DeleteAutoDownloaderItem(uint(id))
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, true)
}
