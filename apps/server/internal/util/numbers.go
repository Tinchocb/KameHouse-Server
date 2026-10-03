package util

import (
	"strconv"
	"strings"
)

func StringToInt(str string) (int, bool) {
	dotIndex := strings.IndexByte(str, '.')
	if dotIndex != -1 {
		str = str[:dotIndex]
	}
	i, err := strconv.Atoi(str)
	if err != nil {
		return 0, false
	}
	return i, true
}

// ClosestEven rounds n up to the nearest even number
func ClosestEven(n int32) int32 {
	if n%2 != 0 {
		return n + 1
	}
	return n
}

// Abs32 returns the absolute value of an int32
func Abs32(x int32) int32 {
	if x < 0 {
		return -x
	}
	return x
}
