const express = require('express');
const fetch = require('node-fetch');
const { Builder } = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar CORS para permitir acceso desde Google Maps
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Cache para los datos de las estaciones (se actualiza cada 5 minutos)
let stationCache = {
  data: null,
  lastUpdate: 0,
  updateInterval: 5 * 60 * 1000 // 5 minutos
};

// Función para obtener datos de la API GBFS
async function getStationData() {
  try {
    console.log('Obteniendo datos de estaciones desde la API...');
    const response = await fetch('https://api.mendoza.smod.io/v1/gbfs/station_status.json');
    
    if (!response.ok) {
      throw new Error(`Error en la API: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Datos obtenidos: ${data.data.stations.length} estaciones`);
    return data;
  } catch (error) {
    console.error('Error obteniendo datos de la API:', error.message);
    throw error;
  }
}

// Función para obtener información detallada de las estaciones
async function getStationInfo() {
  try {
    const response = await fetch('https://api.mendoza.smod.io/v1/gbfs/station_information.json');
    
    if (!response.ok) {
      throw new Error(`Error en la API de información: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error obteniendo información de estaciones:', error.message);
    return null;
  }
}

// Función para generar el archivo KML
function generateKML(stationStatus, stationInfo = null) {
  const builder = new Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' }
  });

  // Crear diccionario de información de estaciones para búsqueda rápida
  const stationInfoMap = {};
  if (stationInfo && stationInfo.data && stationInfo.data.stations) {
    stationInfo.data.stations.forEach(station => {
      stationInfoMap[station.station_id] = station;
    });
  }

  const kmlObject = {
    kml: {
      $: {
        xmlns: 'http://www.opengis.net/kml/2.2'
      },
      Document: {
        name: 'Estaciones de Bicicletas - Mendoza',
        description: 'Estaciones de bicicletas públicas de Mendoza con disponibilidad en tiempo real',
        Style: [
          {
            $: { id: 'station-many' },
            IconStyle: {
              color: 'ff00ff00', // Verde
              scale: '1.0',
              Icon: {
                href: 'http://maps.google.com/mapfiles/kml/shapes/bicycle.png'
              }
            }
          },
          {
            $: { id: 'station-few' },
            IconStyle: {
              color: 'ff00ffff', // Amarillo
              scale: '1.0',
              Icon: {
                href: 'http://maps.google.com/mapfiles/kml/shapes/bicycle.png'
              }
            }
          },
          {
            $: { id: 'station-empty' },
            IconStyle: {
              color: 'ff0000ff', // Rojo
              scale: '1.0',
              Icon: {
                href: 'http://maps.google.com/mapfiles/kml/shapes/bicycle.png'
              }
            }
          }
        ],
        Folder: {
          name: 'Estaciones de Bicicletas',
          Placemark: stationStatus.data.stations.map(station => {
            const info = stationInfoMap[station.station_id] || {};
            const bikesAvailable = station.num_bikes_available || 0;
            const docksAvailable = station.num_docks_available || 0;
            const totalDocks = station.num_docks_available + station.num_bikes_available || 0;
            
            // Determinar el estilo según la disponibilidad
            let styleUrl = '#station-empty';
            if (bikesAvailable > 5) {
              styleUrl = '#station-many';
            } else if (bikesAvailable > 0) {
              styleUrl = '#station-few';
            }

            const description = `
              <div style="font-family: Arial, sans-serif;">
                <h3>${info.name || `Estación ${station.station_id}`}</h3>
                <p><strong>Bicicletas disponibles:</strong> ${bikesAvailable}</p>
                <p><strong>Espacios disponibles:</strong> ${docksAvailable}</p>
                <p><strong>Total de espacios:</strong> ${totalDocks}</p>
                ${info.address ? `<p><strong>Dirección:</strong> ${info.address}</p>` : ''}
                <p><strong>Última actualización:</strong> ${new Date(station.last_reported * 1000).toLocaleString('es-AR')}</p>
              </div>
            `;

            return {
              name: `${info.name || `Estación ${station.station_id}`} (${bikesAvailable} bicis)`,
              description: description,
              styleUrl: styleUrl,
              Point: {
                coordinates: `${info.lon || 0},${info.lat || 0},0`
              }
            };
          }).filter(placemark => placemark.Point.coordinates !== '0,0,0') // Filtrar estaciones sin coordenadas
        }
      }
    }
  };

  return builder.buildObject(kmlObject);
}

// Middleware para servir el KML
app.get('/mendozabike.kml', async (req, res) => {
  try {
    // Verificar si necesitamos actualizar el cache
    const now = Date.now();
    if (!stationCache.data || (now - stationCache.lastUpdate) > stationCache.updateInterval) {
      console.log('Actualizando cache de estaciones...');
      
      // Obtener datos de estado e información en paralelo
      const [stationStatus, stationInfo] = await Promise.all([
        getStationData(),
        getStationInfo()
      ]);
      
      stationCache.data = { stationStatus, stationInfo };
      stationCache.lastUpdate = now;
    }

    // Generar KML
    const kml = generateKML(stationCache.data.stationStatus, stationCache.data.stationInfo);
    
    // Configurar headers para KML
    res.set({
      'Content-Type': 'application/vnd.google-earth.kml+xml',
      'Content-Disposition': 'inline; filename="mendozabike.kml"',
      'Cache-Control': 'public, max-age=300' // Cache por 5 minutos
    });
    
    res.send(kml);
    console.log('KML servido exitosamente');
    
  } catch (error) {
    console.error('Error generando KML:', error);
    res.status(500).json({ 
      error: 'Error generando el archivo KML',
      message: error.message 
    });
  }
});

// Endpoint de información
app.get('/', (req, res) => {
  res.json({
    message: 'Servidor de KML para estaciones de bicicletas de Mendoza',
    endpoints: {
      kml: '/mendozabike.kml',
      info: '/'
    },
    usage: {
      googleMaps: 'https://www.google.com/maps?q=https://TU-DOMINIO/mendozabike.kml',
      description: 'Usa el link de arriba reemplazando TU-DOMINIO con la URL de tu servidor'
    },
    lastUpdate: stationCache.lastUpdate ? new Date(stationCache.lastUpdate).toISOString() : 'Nunca'
  });
});

// Endpoint para forzar actualización del cache
app.post('/refresh', async (req, res) => {
  try {
    stationCache.data = null;
    stationCache.lastUpdate = 0;
    
    const [stationStatus, stationInfo] = await Promise.all([
      getStationData(),
      getStationInfo()
    ]);
    
    stationCache.data = { stationStatus, stationInfo };
    stationCache.lastUpdate = Date.now();
    
    res.json({ 
      message: 'Cache actualizado exitosamente',
      stations: stationStatus.data.stations.length,
      lastUpdate: new Date(stationCache.lastUpdate).toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error actualizando cache',
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚴 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`📱 KML disponible en: http://localhost:${PORT}/mendozabike.kml`);
  console.log(`🗺️  Link para Google Maps: https://www.google.com/maps?q=http://localhost:${PORT}/mendozabike.kml`);
});
