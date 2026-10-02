// Package util implements helper functions for strings, math, file structures, and cryptography.
package util

import (
	"crypto/md5"
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"golang.org/x/crypto/argon2"
)

type Argon2Params struct {
	Memory      uint32
	Iterations  uint32
	Parallelism uint8
	SaltLength  uint32
	KeyLength   uint32
}

// DefaultArgon2Params define los parámetros recomendados para Argon2id.
var DefaultArgon2Params = Argon2Params{
	Memory:      64 * 1024, // 64 MB
	Iterations:  3,
	Parallelism: 2,
	SaltLength:  16,
	KeyLength:   32,
}

// HashPasswordArgon2 hashea una contraseña utilizando Argon2id con parámetros seguros.
func HashPasswordArgon2(password string) (string, error) {
	params := DefaultArgon2Params
	salt := make([]byte, params.SaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	hash := argon2.IDKey([]byte(password), salt, params.Iterations, params.Memory, params.Parallelism, params.KeyLength)

	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)

	encoded := fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, params.Memory, params.Iterations, params.Parallelism, b64Salt, b64Hash)

	return encoded, nil
}

// CreateMD5 returns the lowercase hex-encoded MD5 hash of the given string.
func CreateMD5(s string) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(s)))
}
