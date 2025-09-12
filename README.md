# 🚴 Maps en la Bici - Mendoza

Generador de archivos KML para mostrar estaciones de bicicletas públicas de Mendoza en Google Maps con disponibilidad en tiempo real.

## 🎯 ¿Qué hace?

Esta aplicación consulta la API GBFS de Mendoza para obtener información actualizada de las estaciones de bicicletas públicas y genera un archivo KML que puedes usar directamente en Google Maps.

## 🚀 Instalación y Uso

### 1. Instalar dependencias
```bash
npm install
```

### 2. Ejecutar el servidor
```bash
npm start
```

Para desarrollo (con auto-reload):
```bash
npm run dev
```

### 3. Usar en Google Maps

Una vez que el servidor esté ejecutándose, puedes usar estos links:

**Para desarrollo local:**
```
https://www.google.com/maps?q=http://localhost:3000/mendozabike.kml
```

**Para producción (reemplaza TU-DOMINIO):**
```
https://www.google.com/maps?q=https://TU-DOMINIO.com/mendozabike.kml
```

## 📡 API Endpoints

- `GET /mendozabike.kml` - Archivo KML con las estaciones de bicicletas
- `GET /` - Información del servidor y uso
- `POST /refresh` - Fuerza la actualización del cache de datos

## 🎨 Características

### Iconos y Colores
- 🟢 **Verde**: Más de 5 bicicletas disponibles
- 🟡 **Amarillo**: 1-5 bicicletas disponibles  
- 🔴 **Rojo**: Sin bicicletas disponibles

### Información Mostrada
- Nombre de la estación
- Bicicletas disponibles
- Espacios disponibles
- Total de espacios
- Dirección (si está disponible)
- Última actualización

### Cache Inteligente
- Los datos se actualizan automáticamente cada 5 minutos
- Puedes forzar una actualización con `POST /refresh`
- Respuesta rápida gracias al sistema de cache

## 🌐 Despliegue

### Opción 1: Railway
1. Conecta tu repositorio a Railway
2. Railway detectará automáticamente que es una app Node.js
3. Usa la URL proporcionada por Railway en el link de Google Maps

### Opción 2: Vercel
1. Instala Vercel CLI: `npm i -g vercel`
2. Ejecuta: `vercel`
3. Sigue las instrucciones para desplegar

### Opción 3: Heroku
1. Crea una app en Heroku
2. Conecta tu repositorio
3. Despliega

## 📊 Datos de la API

La aplicación consume dos endpoints de la API GBFS de Mendoza:

- **Estado de estaciones**: `https://api.mendoza.smod.io/v1/gbfs/station_status.json`
- **Información de estaciones**: `https://api.mendoza.smod.io/v1/gbfs/station_information.json`

## 🔧 Configuración

Puedes modificar estos parámetros en `server.js`:

- `updateInterval`: Intervalo de actualización del cache (por defecto: 5 minutos)
- `PORT`: Puerto del servidor (por defecto: 3000)

## 📱 Uso en Móvil

El link de Google Maps funciona perfectamente en dispositivos móviles. Los usuarios pueden:

1. Abrir el link en su navegador móvil
2. Google Maps se abrirá automáticamente
3. Ver todas las estaciones con sus estados actuales
4. Navegar a cualquier estación

## 🛠️ Desarrollo

### Estructura del Proyecto
```
├── server.js          # Servidor principal
├── package.json       # Dependencias y scripts
└── README.md         # Documentación
```

### Dependencias Principales
- **express**: Servidor web
- **node-fetch**: Cliente HTTP para la API
- **xml2js**: Generador de XML/KML

## 📄 Licencia

MIT
