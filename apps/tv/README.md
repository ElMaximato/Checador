# App de TV

Pantalla de anuncios y multimedia. Es una **página web sin build** (HTML + CSS + JS)
que se abre en modo kiosco en el navegador del Android TV.

## Por qué una página web y no una app nativa

- Cero dependencias ni compilación: se actualiza copiando archivos o con `git pull` en el servidor.
- Corre en cualquier pantalla con navegador (Android TV, Fire TV, mini-PC, Raspberry Pi).
- El costo: depende del navegador de la TV. Si fuera muy limitado (autoplay de video con sonido, kiosco), el siguiente paso sería envolverla en una app Android con WebView.

## Cómo usarla

1. Backend arriba (`apps/backend`, `npm run dev`) y la migración de TV aplicada.
2. En el `.env` del backend, agregar el origen desde el que se abre la TV a `CORS_ORIGINS`, por ejemplo:
   `CORS_ORIGINS=http://localhost:5173,http://192.168.1.10:4000`
3. Abrir en la TV: `http://IP_DEL_SERVIDOR:4000/tv/`
4. Aparece un código. En el panel: **Pantallas TV → Emparejar TV**, capturarlo, ponerle nombre y elegir playlist.
5. La TV empieza a reproducir sola.

## Parámetros de la URL

| Parámetro | Efecto |
|---|---|
| `?api=http://servidor:4000` | Dirección del backend si la página no se sirve desde él. Se recuerda. |
| `?reset=1` | Borra el emparejamiento de esa pantalla. |

## Modo kiosco

En Android TV lo más simple es un navegador con modo pantalla completa y "página de inicio" configurable
(o una app tipo *Fully Kiosk Browser*), apuntando a la URL de arriba. En un mini-PC con Chrome:
`chrome --kiosk --autoplay-policy=no-user-gesture-required http://IP:4000/tv/`
(esa opción permite que los videos suenen sin tocar la pantalla).

## Comportamiento

- Imágenes: 10 s, o los segundos indicados en la playlist. Videos y música: completos.
- Cada 3 elementos se intercala un anuncio vigente (entre 10 y 40 s según su largo).
- **Música predeterminada:** si la playlist no trae música propia, suenan de fondo las pistas marcadas como "predeterminada" en Multimedia (volumen al 50 %). Se pausa durante los videos y se reanuda después. Si la playlist incluye música, esa manda.
- Si el navegador bloquea el audio automático, se activa con el primer toque o tecla del control (o con la opción de autoplay del modo kiosco).
- Consulta al servidor cada 60 s; si algo cambió, aplica la cola nueva al terminar el elemento actual.
- Sin conexión sigue con lo que ya tiene; si el admin la revoca, vuelve al emparejamiento.
