package util

import (
	"math"
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

func StringToIntMust(str string) int {
	dotIndex := strings.IndexByte(str, '.')
	if dotIndex != -1 {
		str = str[:dotIndex]
	}
	i, err := strconv.Atoi(str)
	if err != nil {
		return 0
	}
	return i
}

// Ordinal returns the ordinal string for a specific integer.
func toOrdinal(number int) string {
	absNumber := int(math.Abs(float64(number)))

	i := absNumber % 100
	if i == 11 || i == 12 || i == 13 {
		return "th"
	}

	switch absNumber % 10 {
	case 1:
		return "st"
	case 2:
		return "nd"
	case 3:
		return "rd"
	default:
		return "th"
	}
}

// IntegerToOrdinal the number by adding the Ordinal to the number.
func IntegerToOrdinal(number int) string {
	return strconv.Itoa(number) + toOrdinal(number)
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
