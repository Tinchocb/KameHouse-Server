# Presupuesto de caché de Drive

Los bloques de Drive son datos descargados que se pueden reconstruir. No son
la biblioteca, el historial ni la configuración. El límite anterior de 20 GiB
se aplicaba por instalación: producción y desarrollo podían sumar 40 GiB.

## Política actual del servidor

- Máximo predeterminado de 2 GiB por directorio `drive-blocks`.
- Al abrir la caché se reducen los bloques existentes si exceden el límite.
- Antes de guardar un bloque se comprueba que queden al menos 10 GiB libres
  en el volumen que contiene la caché, incluyendo el tamaño del bloque nuevo.
- Se desalojan primero los bloques menos usados. Si no se puede recuperar
  espacio o consultar el volumen, el bloque se sirve desde memoria sin
  persistirlo. Volver a leerlo puede consumir otra descarga de Drive.
- Las escrituras de bloques, el vaciado y la invalidación de metadatos se
  serializan dentro del proceso para coordinar el presupuesto.

El tope cubre bloques; los metadatos pequeños quedan fuera de ese presupuesto
estricto. La reserva es una comprobación previa, no una reserva del sistema de
archivos: otros procesos pueden consumir espacio simultáneamente. No coordina
procesos que compartan el mismo directorio de caché. Desarrollo y producción
deben continuar usando directorios separados.

## Activación

En Ajustes → Sistema → Limpieza de caché → Gestionar, el campo **Carpeta de
caché** permite escribir una ruta o elegirla con el explorador. **Guardar
carpeta** valida escritura y guarda `cache.dir` y `cache.transcodeDir` para el
siguiente inicio. Los archivos anteriores permanecen intactos. El historial de
reproducción conserva su ubicación fija en los datos de KameHouse, incluso
cuando cambia la unidad de caché. Las variables de entorno de estas rutas
tienen prioridad; cuando están presentes, el campo se muestra deshabilitado.

El cambio se activa al ejecutar un servidor recompilado. Editar el repositorio
no actualiza el ejecutable de una instalación existente.

Desde la raíz del repositorio:

```powershell
# Compilar el servidor usado en desarrollo:
pnpm build:server:dev

# Generar una nueva distribución de escritorio con el servidor actualizado:
pnpm build:desktop
```

Cerrar KameHouse antes de reemplazar ejecutables. Con un checkout con cambios
pendientes, revisar esos cambios antes de distribuir: el build los incluirá.
No hace falta borrar bibliotecas, configuración o historial para activar el
nuevo límite. Una caché anterior se reduce al inicializar el acceso a Drive.

## Verificación

```powershell
Set-Location apps/server
go test ./internal/drive -count=1 -timeout=120s
Get-PSDrive C | Select-Object Name, @{N='FreeGiB';E={[math]::Round($_.Free/1GB,2)}}
```

Las pruebas cubren reapertura de caché excedida, escrituras concurrentes,
recuperación de espacio antes de escribir y reproducción sin persistencia
ante poco espacio o fallo de consulta. La reproducción real con la nueva
distribución requiere una comprobación posterior.

`videofiles` tiene poda por antigüedad en el mantenimiento del servidor. Esta
política nueva no agrega un presupuesto global para `videofiles`, `optimized`,
transcodificación, cachés de herramientas ni archivos temporales de Windows.
