# Dashboard

Interfaz web del proyecto, hecha con React, Vite y [shadcn/ui](https://ui.shadcn.com) (tema navideño, oscuro por defecto). Cumple el requisito de "Interfaz gráfica" del enunciado: además de mostrar los datos, los procesa en el navegador para obtener las seis métricas de desempeño del informe (Tabla `tab:metricas`).

Igual que la app, solo habla con API Gateway. Las rutas de la API están en `aws/README.md` del repositorio principal del proyecto.

Publicado en GitHub Pages: https://diegorandolp.github.io/puerta-dashboard/

## Uso

```
npm install
npm run dev              # http://localhost:5173
npm run build            # versión estática en dist/
npm run test:metricas    # pruebas del cálculo de las métricas (Node 23 o más)
```

La URL de la API está en `src/config.ts`. Para usar otra sin tocar el código, se crea `.env.local` con `VITE_API_URL=https://...`.

## Publicación

Cada push a `main` ejecuta `.github/workflows/pages.yml`, que compila con `npm run build` y publica `dist/` en GitHub Pages. `vite.config.ts` usa `base: "./"`, así que la página funciona bajo cualquier ruta. La API responde con `access-control-allow-origin: *`, por lo que no hace falta configurar CORS para este origen.

## Qué muestra

- **Estado actual** (`GET /estado`, cada 10 s): conexión, puerta, cerradura, sistema armado y buzzer, lectura del MQ-2 contra su umbral y RSSI. Arriba salen avisos si la alarma suena, si hay humo o si el nodo dejó de mandar latidos.
- **Métricas de desempeño** de la ventana elegida (1 h, 6 h o 24 h), con `GET /eventos?desde=` y `GET /latidos?desde=` cada 30 s. Cada tarjeta explica su cálculo en el ícono ⓘ.
- **Series de tiempo**: latencia de cada alerta, disponibilidad por intervalo, eventos por sensor (con su tabla), RSSI y gas.
- **Historial de eventos**, con un botón para marcar o desmarcar una alerta como falsa (`POST /falsa_alarma`, con el PIN).
- **Comandos**: abrir, armar, desarmar y silenciar (`POST /comando`), con el mismo PIN de la app. El PIN no se guarda: solo queda en memoria mientras la pestaña esté abierta.

## Las seis métricas

El cálculo está en `src/lib/metricas.ts`, en funciones puras sin React, con pruebas en `src/lib/metricas.test.ts`.

| Métrica | Cálculo |
|---|---|
| Latencia de alerta | `timestamp` (llegada a IoT Core) menos `ts_evento` (ESP32, NTP), solo en alertas del ESP32. Media, mediana, p95 (rango más cercano) y máximo. Meta: p95 menor a 2 s. |
| Pérdida de mensajes | Por cada `boot`, los `seq` que faltan entre el primero y el último que llegaron, uniendo eventos y latidos porque comparten el contador. Se dejan fuera los últimos 15 s, que pueden estar en camino. |
| Disponibilidad | Fracción de la ventana en la que el nodo contaba como conectado: cada latido lo cubre por 70 s, la misma regla de `GET /estado`. También se da desde el primer latido de la ventana. |
| Eventos por sensor | Alertas leves y críticas por sensor, total y por hora. |
| Falsas alarmas | Alertas marcadas como falsas sobre el total de alertas de la ventana. |
| Calidad del enlace | RSSI promedio de los latidos, con bandas de −67 dBm (buena) y −80 dBm (débil). |

Si una consulta llega cortada por el tope de la Lambda (5000 eventos o 6000 latidos), la pérdida y el ritmo por hora se miden solo desde el mensaje más antiguo que llegó completo, y arriba aparece un aviso.

## Si falta desplegar algo en AWS

El dashboard funciona con la API actual, pero solo calcula lo que puede:

- Sin `GET /latidos`, la pérdida, la disponibilidad, el RSSI y el gráfico de gas quedan en "—". API Gateway responde un 404 sin encabezados CORS, y el navegador lo ve como error de red. El dashboard lo interpreta como ruta faltante si `/eventos` sí respondió.
- Sin `?desde=` en `/eventos`, la Lambda vieja devuelve los últimos 100 eventos, y las métricas de eventos cubren solo ese tramo.
- Sin `POST /falsa_alarma`, marcar una alerta da "Sin respuesta".

En cada caso sale un aviso arriba de la página.

## Cómo está hecho

```
src/
├── App.tsx                  página: secciones y estado compartido (ventana, PIN)
├── config.ts                URL de la API, intervalos, umbrales y meta de latencia
├── hooks/use-datos.ts       consultas periódicas, en pausa si la pestaña no se ve
├── lib/
│   ├── api.ts               cliente de la API
│   ├── metricas.ts          procesamiento previo: las seis métricas y las series
│   ├── formato.ts           horas de Lima, números con coma decimal, nombres
│   └── tipos.ts             forma de eventos, latidos y estado
└── components/
    ├── ui/                  componentes de shadcn/ui (se agregan con npx shadcn add)
    ├── estado-actual.tsx, tarjetas-metricas.tsx, graficos.tsx,
    └── tabla-eventos.tsx, panel-comandos.tsx, avisos.tsx, encabezado.tsx
```

- Los colores de los gráficos son una paleta categórica validada para daltonismo en los dos temas (`--chart-1` a `--chart-5` en `src/index.css`), siempre en el mismo orden por sensor. Los estados usan ícono y texto, nunca solo color.
- `InputOTPSlot` (en `components/ui/input-otp.tsx`) tiene una opción `mask` agregada para no mostrar el PIN.
- Para agregar otro componente de shadcn: `npx shadcn@latest add <nombre>`.
