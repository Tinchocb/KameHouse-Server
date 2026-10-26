package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"kamehouse/internal/database/models"
	"kamehouse/internal/mediastream/cassette"
	"kamehouse/internal/util"

	"github.com/labstack/echo/v4"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/mem"
)

type AdminTranscodeStatsResponse struct {
	TranscoderInitialized bool                   `json:"transcoderInitialized"`
	Governor              cassette.GovernorStats `json:"governor"`
	PreTranscodeQueue     int                    `json:"preTranscodeQueue"`
	System                SystemStats            `json:"system"`
	GPU                   *GPUStats              `json:"gpu"`
}

type SystemStats struct {
	CPUPercent  float64 `json:"cpuPercent"`
	MemoryUsed  uint64  `json:"memoryUsed"`
	MemoryTotal uint64  `json:"memoryTotal"`
}

type GPUStats struct {
	Utilization int `json:"utilization"`
	Encoder     int `json:"encoder"`
	MemoryUsed  int `json:"memoryUsed"`
	MemoryTotal int `json:"memoryTotal"`
}

type AdminLibraryStatsResponse struct {
	TotalLocalFiles int64 `json:"totalLocalFiles"`
	TotalMedia      int64 `json:"totalMedia"`
}

// HandleGetTranscodeStats returns realtime transcoder and system stats.
//
//	@summary returns realtime transcoder and system stats.
//	@route /api/v1/admin/transcode-stats [GET]
//	@returns handlers.AdminTranscodeStatsResponse
func (h *Handler) HandleGetTranscodeStats(c echo.Context) error {
	res := AdminTranscodeStatsResponse{}

	if h.App.MediastreamRepository != nil {
		if gov, ok := h.App.MediastreamRepository.TranscoderStats(); ok {
			res.TranscoderInitialized = true
			res.Governor = gov
		}

		if pre, ok := h.App.MediastreamRepository.PreTranscoder(); ok {
			res.PreTranscodeQueue = pre.QueueLength()
		}
	}

	// System stats
	if cpus, err := cpu.Percent(0, false); err == nil && len(cpus) > 0 {
		res.System.CPUPercent = cpus[0]
	}
	if v, err := mem.VirtualMemory(); err == nil {
		res.System.MemoryUsed = v.Used
		res.System.MemoryTotal = v.Total
	}

	// GPU stats
	res.GPU = getGPUStats(c.Request().Context())

	return h.RespondWithData(c, res)
}

// HandleGetLibraryStats returns library counts.
//
//	@summary returns library counts.
//	@route /api/v1/admin/library-stats [GET]
//	@returns handlers.AdminLibraryStatsResponse
func (h *Handler) HandleGetLibraryStats(c echo.Context) error {
	if h.App == nil || h.App.Database == nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "database not available")
	}

	reqCtx := c.Request().Context()
	gdb := h.App.Database.Gorm().WithContext(reqCtx)

	var totalLocalFiles int64
	if err := gdb.Model(&models.LocalFile{}).Count(&totalLocalFiles).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	var totalMedia int64
	if err := gdb.Model(&models.LibraryMedia{}).Count(&totalMedia).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return h.RespondWithData(c, AdminLibraryStatsResponse{
		TotalLocalFiles: totalLocalFiles,
		TotalMedia:      totalMedia,
	})
}

func getGPUStats(parentCtx context.Context) *GPUStats {
	ctx, cancel := context.WithTimeout(parentCtx, 2*time.Second)
	defer cancel()

	cmd := util.NewCmdCtx(ctx, "nvidia-smi", "--query-gpu=utilization.gpu,utilization.encoder,memory.used,memory.total", "--format=csv,noheader,nounits")
	out, err := cmd.Output()
	if err != nil {
		return nil
	}

	parts := strings.Split(strings.TrimSpace(string(out)), ",")
	if len(parts) >= 4 {
		return &GPUStats{
			Utilization: parseGPUInt(parts[0]),
			Encoder:     parseGPUInt(parts[1]),
			MemoryUsed:  parseGPUInt(parts[2]),
			MemoryTotal: parseGPUInt(parts[3]),
		}
	}
	return nil
}

func parseGPUInt(s string) int {
	s = strings.TrimSpace(s)
	val, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return val
}
