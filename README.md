# DMM Studio

Userscript de Tampermonkey que reemplaza la interfaz de **Debrid Media Manager** por un panel
propio (tema oscuro, rail lateral, biblioteca con filtros, enlaces de descarga y fichas de
**TMDB**), reutilizando la sesión de **Real-Debrid** y las cookies que ya tiene el navegador.

Proyecto independiente: no comparte código ni configuración con `fixture-finder`.

## Instalar con un clic

Con [Tampermonkey](https://www.tampermonkey.net/) ya instalado, abre esta URL:

**<https://raw.githubusercontent.com/zzever/dmm-studio/main/dmm-studio.user.js>**

Tampermonkey reconoce el archivo `.user.js` y muestra su pantalla de instalación; pulsa
*Instalar*. Esa misma URL es la que consulta para las actualizaciones del script, así que no
hace falta volver a pegar el código cuando salga una versión nueva.

## Alojado en la web de TMDB Streaming

DMM Studio también vive en el mismo dominio que el proyecto de streaming:

- Panel de demostración: <https://tmdb-streaming-services.orkestr.run/dmm-studio/>
- Instalar con un clic: <https://tmdb-streaming-services.orkestr.run/dmm-studio.user.js>

## Archivos

| Archivo | Qué es |
| --- | --- |
| `dmm-studio.user.js` | El userscript completo (UI + sesión + API de Real-Debrid + TMDB + modo demo). |
| `index.html` | Página de demostración: simula la biblioteca de DMM y carga el script con datos falsos. |
| `artifacts/` | Capturas del panel (escritorio, móvil, TMDB). |

## Instalar a mano

1. Instala la extensión [Tampermonkey](https://www.tampermonkey.net/) en tu navegador.
2. Crea un script nuevo y pega el contenido de `dmm-studio.user.js` (o arrastra el archivo a
   Tampermonkey). También puedes usar el enlace de instalación de la sección anterior.
3. Entra en <https://debridmediamanager.com/> con tu sesión de Real-Debrid iniciada.
4. Abre el panel con el botón flotante de la esquina o con <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd>.

Atajos: <kbd>Esc</kbd> cierra el panel, <kbd>/</kbd> enfoca el buscador.

## Sesión y cookies

- El script lee el token de Real-Debrid que DMM guarda en `localStorage`
  (`rd:accessToken`, `rd:refreshToken`, `rd:clientId`, `rd:clientSecret`) y lo renueva solo.
- Las cookies de `debridmediamanager.com` (por ejemplo `cf_clearance`) solo se usan para las
  rutas de DMM protegidas por Cloudflare. Se leen en el momento, nunca se guardan en el código.
- Si la sesión no aparece, la vista **Sesión** permite pegar el token a mano o importar un
  `cookies.txt` en formato Netscape.

Ningún token ni cookie va escrito en el repositorio: caducan y no deben compartirse.

## TMDB (opcional)

En la vista **Sesión → TMDB** pega una de estas dos credenciales de
<https://www.themoviedb.org/settings/api>:

- **API Key (v3)**: 32 caracteres hexadecimales.
- **Read Access Token (v4)**: empieza por `eyJ`.

Con la clave se consulta `search/multi` (una petición por título, en español) para mostrar año,
nota, sinopsis y póster. Los resultados se cachean 30 días y las peticiones van de 3 en 3; si la
clave falla, el script deja de consultar en esa sesión y avisa en el panel.

## Vista previa local

La demo no hace ninguna petición a Real-Debrid ni a TMDB: los datos y las fichas son simulados.

```bash
python3 -m http.server 3000 --bind 0.0.0.0 --directory .
# abrir http://localhost:3000/
```
