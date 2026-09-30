package core

import "testing"

func TestResolveCorsOriginsIncluyeElWebviewDeEscritorio(t *testing.T) {
	cases := []struct {
		name string
		env  map[string]string
	}{
		{"producción (como lo arranca el sidecar)", map[string]string{"KAMEHOUSE_ENV": "production"}},
		{"desarrollo", map[string]string{"KAMEHOUSE_ENV": "development"}},
		{"orígenes de desarrollo del sidecar", map[string]string{"KAMEHOUSE_ENV": "production", "KAMEHOUSE_DEV_CORS_ORIGINS": "http://localhost:43210"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, k := range []string{"KAMEHOUSE_ENV", "KAMEHOUSE_DEV_CORS_ORIGINS", "KAMEHOUSE_CORS_ALLOWED_ORIGINS", "KAMEHOUSE_ALLOW_LAN"} {
				t.Setenv(k, "")
			}
			for k, v := range tc.env {
				t.Setenv(k, v)
			}
			cfg := &Config{}
			cfg.Server.Port = 43211
			resolveCorsOrigins(cfg)

			for _, want := range []string{"http://tauri.localhost", "https://tauri.localhost", "tauri://localhost", "http://127.0.0.1:43211"} {
				if !containsString(cfg.Server.CorsOrigins, want) {
					t.Errorf("falta %q en %v", want, cfg.Server.CorsOrigins)
				}
			}
		})
	}
}

func TestResolveCorsOriginsNoAceptaOrigenesAjenosNiComodin(t *testing.T) {
	for _, k := range []string{"KAMEHOUSE_ENV", "KAMEHOUSE_DEV_CORS_ORIGINS", "KAMEHOUSE_CORS_ALLOWED_ORIGINS", "KAMEHOUSE_ALLOW_LAN"} {
		t.Setenv(k, "")
	}
	t.Setenv("KAMEHOUSE_ENV", "production")
	cfg := &Config{}
	cfg.Server.Port = 43211
	resolveCorsOrigins(cfg)
	for _, o := range cfg.Server.CorsOrigins {
		if o == "*" || o == "https://evil.example" {
			t.Errorf("origen inesperado %q", o)
		}
	}
}

func TestResolveCorsOriginsNoDuplica(t *testing.T) {
	for _, k := range []string{"KAMEHOUSE_ENV", "KAMEHOUSE_DEV_CORS_ORIGINS", "KAMEHOUSE_CORS_ALLOWED_ORIGINS", "KAMEHOUSE_ALLOW_LAN"} {
		t.Setenv(k, "")
	}
	t.Setenv("KAMEHOUSE_CORS_ALLOWED_ORIGINS", "http://tauri.localhost, http://127.0.0.1")
	cfg := &Config{}
	resolveCorsOrigins(cfg)
	n := 0
	for _, o := range cfg.Server.CorsOrigins {
		if o == "http://tauri.localhost" {
			n++
		}
	}
	if n != 1 {
		t.Errorf("http://tauri.localhost aparece %d veces", n)
	}
}
