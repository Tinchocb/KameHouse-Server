package handlers

import "github.com/labstack/echo/v4"

// localAccountID es la cuenta implícita de la instalación single-user (sin
// login real). Todos los writers y readers de continuidad deben resolver la
// cuenta con currentAccountID para que no vuelva el split-brain 0/1.
//
// No depende de Database.GetAccount(): esa cuenta solo existe con sesión de
// Platform (Username+Token+Viewer) y sin ella el fallback terminaba en 0.
const localAccountID uint = 1

// currentAccountID devuelve la cuenta del request: el user_id inyectado por un
// middleware de auth si existe (futuro multi-usuario), si no la cuenta local.
func currentAccountID(c echo.Context) uint {
	if c != nil {
		if id, ok := c.Get("user_id").(uint); ok && id > 0 {
			return id
		}
	}
	return localAccountID
}
