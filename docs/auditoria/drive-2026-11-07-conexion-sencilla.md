# Conexión sencilla de la cuenta de Google Drive

## Comportamiento

El panel muestra «Conectar con Google» como acción principal. Los campos OAuth y las instrucciones técnicas quedan dentro de «Configuración avanzada». La carpeta puede elegirse después de conectar, pegando su enlace.

El servidor informa `oauthConfigured` en el estado de Drive. Cuando hay credenciales preparadas, el botón solicita el enlace de autorización sin pasar credenciales por la URL ni exigir que estén rellenadas en el formulario. No vuelve a guardar las credenciales sin cambios. Si falta la activación inicial, muestra esa limitación y abre el apartado avanzado; no simula una conexión posible.

Se conserva cargar el JSON de Google para completar los campos. En lugar de cuatro direcciones fijas se muestra una dirección de retorno calculada con el mismo servidor que utiliza la aplicación. Ese enlace es para registrar el retorno, no para abrirlo como enlace de autorización.

Mientras la autorización está pendiente, la pantalla consulta el estado cada tres segundos durante dos minutos, para detectar el resultado en el navegador externo del escritorio. Al terminar o desmontarse se limpian los temporizadores. Si transcurren dos minutos, vuelve a permitir reintentar; el enlace manual sigue disponible y el estado habitual continúa actualizándose. Los avisos del popup se aceptan solo desde el origen de retorno esperado y se verifica la conexión con el servidor. Si el navegador bloquea la apertura, se indica usar el enlace manual.

## Preparación de la instalación

Además de las credenciales guardadas existentes, el servidor admite preparar la aplicación OAuth una sola vez mediante:

- `KAMEHOUSE_GOOGLE_DRIVE_CLIENT_ID`
- `KAMEHOUSE_GOOGLE_DRIVE_CLIENT_SECRET`

Se requiere el par completo; no se mezcla una mitad de entorno con una mitad guardada. Se aplica a los ajustes efectivos. La conexión y el callback usan esas credenciales y guardan el token de la cuenta sin copiar las credenciales de entorno al registro persistido durante este flujo. El estado de configuración solo expone un booleano.

Para un cliente OAuth de aplicación web, debe registrarse en Google Cloud el retorno exacto que muestra esta instalación. La aplicación OAuth, sus permisos y el acceso a Drive deben estar preparados en Google. Documentación de referencia: [OAuth para aplicaciones](https://developers.google.com/identity/protocols/oauth2/native-app).

No se han creado credenciales ni registrado una aplicación en Google Cloud. Estos cambios por sí solos no activan una instalación cuya configuración de Google esté vacía.

## Verificación

- Pruebas de interfaz: autorización con credenciales solo en el servidor, activación pendiente, detección desde navegador externo y rechazo de mensajes de otro origen.
- Prueba del par de variables de entorno completo e incompleto.
- Prueba del recorrido enlace de autorización → callback → cliente Drive inicializado, usando un intercambio de tokens simulado localmente. Comprueba estado firmado, retorno, ausencia del secreto en respuestas y credenciales de aplicación no persistidas por el callback.
- Comprobación TypeScript y ESLint de los archivos de interfaz modificados.
- Suite corta integrada del servidor (`go test -short . ./internal/... ./codegen/...`), `go vet ./...` y `go build -buildvcs=false ./...` aprobados.

No se verificó una autorización real de Google ni se hizo revisión visual en navegador de la pantalla completa. No se reinició la instancia habitual ni se reemplazó su ejecutable.
