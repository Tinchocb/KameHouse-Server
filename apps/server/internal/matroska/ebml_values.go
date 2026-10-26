package matroska

import (
	"encoding/binary"
	"math"
)

// ReadUInt reads an unsigned integer from the element's data.
//
// This method interprets the element's data as a big-endian unsigned integer
// and returns its value. If the element's data is empty, it returns 0.
//
// Returns:
//   - The unsigned integer value stored in the element's data
//
// Example usage:
//
//	value := element.ReadUInt()
//	fmt.Printf("Value: %d\n", value)
func (el *EBMLElement) ReadUInt() uint64 {
	if len(el.Data) == 0 {
		return 0
	}

	var result uint64
	for _, b := range el.Data {
		result = (result << 8) | uint64(b)
	}
	return result
}

// ReadInt reads a signed integer from element data
func (el *EBMLElement) ReadInt() int64 {
	if len(el.Data) == 0 {
		return 0
	}

	// Check sign bit
	isNegative := el.Data[0]&0x80 != 0

	var result uint64
	for _, b := range el.Data {
		result = (result << 8) | uint64(b)
	}

	if isNegative {
		// Two's complement for negative numbers
		switch len(el.Data) {
		case 1:
			return int64(int8(result))
		case 2:
			return int64(int16(result))
		case 4:
			return int64(int32(result))
		case 8:
			return int64(result)
		default:
			if len(el.Data) > 8 {
				return int64(result)
			}
			mask := uint64(1<<(uint(len(el.Data))*8-1)) - 1
			return -int64((^result & mask) + 1)
		}
	}

	return int64(result)
}

// ReadFloat reads a floating-point number from the element's data.
//
// This method interprets the element's data as a big-endian floating-point number
// (either 32-bit or 64-bit) and returns its value. If the element's data is empty
// or its length is not 4 or 8 bytes, it returns 0.0.
//
// Returns:
//   - The floating-point value stored in the element's data.
func (el *EBMLElement) ReadFloat() float64 {
	if len(el.Data) == 0 {
		return 0.0
	}

	switch len(el.Data) {
	case 4:
		bits := binary.BigEndian.Uint32(el.Data)
		return float64(math.Float32frombits(bits))
	case 8:
		bits := binary.BigEndian.Uint64(el.Data)
		return math.Float64frombits(bits)
	default:
		return 0.0
	}
}

// ReadString reads a string from the element's data.
//
// This method interprets the element's data as a string (either ASCII or UTF-8)
// and returns its value. Null bytes at the end of the string are trimmed.
//
// Returns:
//   - The string value stored in the element's data.
func (el *EBMLElement) ReadString() string {
	// Trim null bytes from the end of the string
	data := el.Data
	for len(data) > 0 && data[len(data)-1] == 0 {
		data = data[:len(data)-1]
	}
	return string(data)
}

// ReadBytes returns the raw byte slice of the element's data.
//
// This method provides direct access to the uninterpreted byte data
// contained within the EBML element.
//
// Returns:
//   - A byte slice containing the raw data of the element.
func (el *EBMLElement) ReadBytes() []byte {
	return el.Data
}
