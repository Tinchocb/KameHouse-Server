# Actualizaciones de KameHouse Desktop para Windows x64

## Configurar la firma una vez

Desde la raíz del repositorio, ejecutá en PowerShell:

```powershell
pnpm --filter kamehouse-desktop tauri signer generate -w "$env:USERPROFILE/kamehouse-updater.key"
```

Elegí una contraseña y guardá una copia privada de la clave y de la contraseña. Las instalaciones existentes confían en esta clave para verificar las siguientes versiones.

En **Settings → Secrets and variables → Actions** del repositorio configurá:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| Variable | KAMEHOUSE_UPDATER_PUBLIC_KEY | Contenido completo del archivo .key.pub |
| Secret | TAURI_SIGNING_PRIVATE_KEY | Contenido completo del archivo .key |
| Secret | TAURI_SIGNING_PRIVATE_KEY_PASSWORD | Contraseña elegida |

## Publicar una versión

1. Subí a GitHub el commit que querés distribuir, incluyendo el workflow.
2. Creá y subí una etiqueta estable sobre ese commit. Por ejemplo, para publicar 0.2.0 desde el commit actual, ejecutá `git tag v0.2.0` y después `git push origin v0.2.0`.
3. En **Actions**, esperá a que termine **Publicar KameHouse Desktop**. La etiqueta determina la versión del instalador y del manifiesto.
4. En **Releases**, abrí el borrador y verificá que incluya el instalador .exe, la firma .sig y latest.json. Publicalo como la release estable más reciente.
5. Instalá manualmente esa primera versión. Para comprobar el ciclo completo, publicá otra etiqueta superior y abrí la versión anterior. Elegí **Más tarde** para posponer la instalación hasta el próximo inicio o **Actualizar** para descargar, verificar e instalar la nueva versión.
