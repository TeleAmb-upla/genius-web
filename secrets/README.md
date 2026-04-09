# Credenciales de Earth Engine (OAuth)

Este directorio puede contener una copia del archivo JSON que genera `earthengine authenticate`, para que el pipeline encuentre las credenciales sin volver a iniciar sesión en el navegador.

## Configuración rápida (Windows)

1. Ejecuta una vez en la terminal (con tu entorno Python donde está `earthengine-api`):

   ```bash
   earthengine authenticate
   ```

2. Copia el archivo de credenciales al repo:

   - Origen típico: `%USERPROFILE%\.config\earthengine\credentials`
   - Destino: `secrets\earthengine_credentials.json` (en la raíz del proyecto `genius_upla`)

   En PowerShell, desde la raíz del repo:

   ```powershell
   Copy-Item "$env:USERPROFILE\.config\earthengine\credentials" -Destination "secrets\earthengine_credentials.json"
   ```

3. Ejecuta el pipeline como siempre:

   ```bash
   python -m scripts.gee.pipeline
   ```

El código asigna automáticamente la variable de entorno `EARTHENGINE_CREDENTIALS` a esa ruta **si el archivo existe** y la variable no estaba ya definida.

## Alternativas

- **Variable de entorno** (sin copiar al repo): define `EARTHENGINE_CREDENTIALS` con la ruta absoluta al JSON de OAuth.
- **Otra ruta en disco**: define `EE_CREDENTIALS_FILE` con una ruta (absoluta o relativa a la raíz del repo) al mismo JSON.

## Seguridad

- **No subas** `earthengine_credentials.json` a git ni lo compartas: contiene tokens de acceso y refresh.
- El archivo está listado en `.gitignore` en la raíz del proyecto.

Para automatización en servidores o CI, Google recomienda una **cuenta de servicio** con acceso a Earth Engine; el flujo OAuth de usuario es más adecuado para tu PC de desarrollo.
