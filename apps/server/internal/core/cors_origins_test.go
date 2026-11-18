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

func TestConfigReloadKeepsOriginPolicyUntilRestart(t *testing.T) {
	a := cleanupTestApp()
	a.Config = &Config{}
	a.Config.Server.Port = 43211
	a.Config.Server.CorsOrigins = []string{"http://tauri.localhost", "http://127.0.0.1:43211"}
	next := &Config{}
	next.Server.CorsOrigins = []string{"null", "https://untrusted.example"}
	a.handleConfigChange(next)
	if len(a.Config.Server.CorsOrigins) != 2 || a.Config.Server.CorsOrigins[0] != "http://tauri.localhost" || a.Config.Server.CorsOrigins[1] != "http://127.0.0.1:43211" {
		t.Fatalf("reload changed active origin policy: %v", a.Config.Server.CorsOrigins)
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

func TestOpaqueOriginsRequirePassword(t *testing.T) {
	for _, password := range []string{"", "test-secret"} {
		t.Run(password, func(t *testing.T) {
			t.Setenv("KAMEHOUSE_ENV", "production")
			t.Setenv("KAMEHOUSE_DEV_CORS_ORIGINS", "")
			t.Setenv("KAMEHOUSE_CORS_ALLOWED_ORIGINS", "")
			cfg := &Config{}
			cfg.Server.Password = password
			// Even an explicit allowlist must not trust opaque origins without auth.
			cfg.Server.CorsOrigins = []string{"null", "file://", "FILE:///app"}
			resolveCorsOrigins(cfg)
			for _, origin := range []string{"null", "file://", "FILE:///app"} {
				if containsString(cfg.Server.CorsOrigins, origin) != (password != "") {
					t.Fatalf("password configured=%v: unexpected policy %v", password != "", cfg.Server.CorsOrigins)
				}
			}
			if !containsString(cfg.Server.CorsOrigins, "http://tauri.localhost") {
				t.Fatal("Tauri origin removed")
			}
		})
	}
}
