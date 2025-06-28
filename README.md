# consultaCausas
Aplicacion para consultar causas y no olvidarse ninguna

## Scripts

### Login y descarga de notificaciones

Instalar dependencias (requiere internet):

```bash
npm install
```

Ejecutar el proceso de login para todas las cuentas definidas en `accounts.json`:

```bash
node scripts/pjnLogin.js
```

Para ver el intento de login en una ventana de navegador establezca la variable
de entorno `HEADLESS=false`:

```bash
HEADLESS=false node scripts/pjnLogin.js
```

El script guarda las notificaciones nuevas y registra el acceso de cada abogado en la base de datos Postgres configurada en `scripts/pjnLogin.js`.
Por defecto se conecta al servidor `192.168.1.56:5433` usando la base `PJN` y el usuario `postgres`.
