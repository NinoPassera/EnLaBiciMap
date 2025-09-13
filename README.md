# 🚴 Maps En La Bici - Mendoza

Aplicación web que muestra las estaciones de bicicletas de Mendoza en tiempo real en un mapa interactivo de Google Maps.

## 🎯 Características

- **Mapa interactivo** con estaciones de bicicletas en tiempo real
- **Actualización automática** cada 5 minutos desde la API GBFS de Mendoza
- **Marcadores de colores** según disponibilidad de bicicletas
- **Estadísticas en vivo** del sistema
- **Diseño responsive** compatible con móviles

## 🚀 Instalación y uso

### Desarrollo local:

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start

# Abrir en navegador
http://localhost:3000
```

### Producción (Railway):

```
https://web-production-be984.up.railway.app
```

## 📁 Estructura del proyecto

```
mapsEnLaBici/
├── server.js              # Servidor principal (Node.js/Express)
├── package.json           # Configuración del proyecto
├── public/
│   └── map.html           # Aplicación web con mapa interactivo
├── Procfile               # Configuración para Railway
├── railway.json           # Configuración para Railway
└── README.md              # Este archivo
```

## 🔧 API Endpoints

- **`/`** - Redirige a `/map.html`
- **`/map.html`** - Aplicación web principal con mapa interactivo
- **`/api/stations`** - API JSON con datos de estaciones
- **`/mendozabike.kml`** - Archivo KML para Google Maps
- **`/refresh`** - Forzar actualización de datos (POST)

## 🗺️ Configuración de Google Maps

Para usar la aplicación necesitas configurar una API Key de Google Maps:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o selecciona uno existente
3. Habilita la **Maps JavaScript API**
4. Crea una API Key
5. Configura las restricciones de la API Key:
   - **Aplicaciones web**: Agrega `http://localhost:3000/*` y `https://web-production-be984.up.railway.app/*`
6. Edita `public/map.html` y reemplaza `TU_API_KEY_AQUI` con tu API Key

## 📊 Fuente de datos

Los datos se obtienen de la API GBFS oficial de Mendoza:
- **API**: `https://api.mendoza.smod.io/v1/gbfs/station_status.json`
- **Actualización**: Automática cada 5 minutos
- **Cache**: Los datos se almacenan en memoria para mejor rendimiento

## 🛠️ Tecnologías utilizadas

- **Backend**: Node.js, Express
- **Frontend**: HTML5, CSS3, JavaScript
- **Mapas**: Google Maps JavaScript API
- **Datos**: API GBFS de Mendoza
- **Deploy**: Railway

## 📝 Licencia

MIT