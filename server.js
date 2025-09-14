const express = require('express');
const fetch = require('node-fetch');
const { Builder, parseString } = require('xml2js');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Servir archivos estáticos
app.use(express.static('public'));

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

// Función para leer y parsear las ciclovías desde el archivo KML
async function getBikePaths() {
  try {
    const kmlContent = await fs.readFile('doc.kml', 'utf8');
    
    return new Promise((resolve, reject) => {
      parseString(kmlContent, (err, result) => {
        if (err) {
          console.error('Error parseando KML de ciclovías:', err);
          reject(err);
          return;
        }

        try {
          const bikePaths = [];
          const placemarks = result.kml.Document[0].Folder[0].Placemark || [];

          placemarks.forEach(placemark => {
            const extendedData = placemark.ExtendedData?.[0]?.SchemaData?.[0]?.SimpleData || [];
            const name = extendedData.find(item => item.$.name === 'NOMBRE')?.['_'] || 'Ciclovía';
            const depto = extendedData.find(item => item.$.name === 'DPTO')?.['_'] || '';
            const length = extendedData.find(item => item.$.name === 'LONG')?.['_'] || '0';
            
            // Buscar coordenadas en LineString o MultiGeometry
            let coordinates = [];
            if (placemark.MultiGeometry?.[0]?.LineString?.[0]?.coordinates?.[0]) {
              coordinates = placemark.MultiGeometry[0].LineString[0].coordinates[0].split(' ');
            } else if (placemark.LineString?.[0]?.coordinates?.[0]) {
              coordinates = placemark.LineString[0].coordinates[0].split(' ');
            }
            
            if (coordinates.length > 0) {
              const pathCoordinates = coordinates.map(coord => {
                const [lon, lat] = coord.split(',');
                return { lat: parseFloat(lat), lng: parseFloat(lon) };
              }).filter(coord => !isNaN(coord.lat) && !isNaN(coord.lng));

              if (pathCoordinates.length > 0) {
                bikePaths.push({
                  name: name,
                  depto: depto,
                  length: parseFloat(length),
                  coordinates: pathCoordinates,
                  type: 'bikepath'
                });
              }
            }
          });

          console.log(`Ciclovías cargadas: ${bikePaths.length}`);
          resolve(bikePaths);
        } catch (parseErr) {
          console.error('Error procesando ciclovías:', parseErr);
          reject(parseErr);
        }
      });
    });
  } catch (error) {
    console.error('Error leyendo archivo de ciclovías:', error.message);
    return [];
  }
}

// Función para leer y parsear los puntos de reparación desde el archivo KML
async function getRepairStations() {
  try {
    const kmlContent = await fs.readFile('repair_stations.kml', 'utf8');
    
    return new Promise((resolve, reject) => {
      parseString(kmlContent, (err, result) => {
        if (err) {
          console.error('Error parseando KML de reparación:', err);
          reject(err);
          return;
        }

        try {
          const repairStations = [];
          const placemarks = result.kml.Document[0].Placemark || [];

          placemarks.forEach(placemark => {
            const name = placemark.name ? placemark.name[0] : 'Punto de Reparación';
            const description = placemark.description ? placemark.description[0] : '';
            const coordinates = placemark.Point[0].coordinates[0].trim().split(',');
            
            if (coordinates.length >= 2) {
              const lon = parseFloat(coordinates[0]);
              const lat = parseFloat(coordinates[1]);
              
              repairStations.push({
                name: name,
                description: description,
                lat: lat,
                lon: lon,
                type: 'repair'
              });
            }
          });

          console.log(`Puntos de reparación cargados: ${repairStations.length}`);
          resolve(repairStations);
        } catch (parseErr) {
          console.error('Error procesando puntos de reparación:', parseErr);
          reject(parseErr);
        }
      });
    });
  } catch (error) {
    console.error('Error leyendo archivo de reparación:', error.message);
    return [];
  }
}

// Función para generar el archivo KML
function generateKML(stationStatus, stationInfo = null, repairStations = [], bikePaths = []) {
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
            $: { id: 'station' },
            IconStyle: {
              color: 'fff44336', // Rojo uniforme
              scale: '1.2',
              Icon: {
                href: 'http://maps.google.com/mapfiles/kml/shapes/bicycle.png'
              }
            }
          },
          {
            $: { id: 'repair-station' },
            IconStyle: {
              color: 'ff9c27b0', // Púrpura
              scale: '1.2',
              Icon: {
                href: 'http://maps.google.com/mapfiles/kml/shapes/wrench.png'
              }
            }
          },
          {
            $: { id: 'bikepath' },
            LineStyle: {
              color: 'ff0098ff', // Naranja
              width: '4'
            }
          }
        ],
        Folder: [
          {
            name: 'Estaciones de Bicicletas',
            Placemark: stationStatus.data.stations.map(station => {
            const info = stationInfoMap[station.station_id] || {};
            const bikesAvailable = station.num_bikes_available || 0;
            const docksAvailable = station.num_docks_available || 0;
            const totalDocks = station.num_docks_available + station.num_bikes_available || 0;
            
            // Usar un solo estilo rojo para todas las estaciones
            const styleUrl = '#station';
            const totalCapacity = info.capacity || null;
            const occupancyPercentage = totalCapacity ? Math.round((bikesAvailable / totalCapacity) * 100) : null;
            
            const description = `
              <div style="font-family: Arial, sans-serif;">
                <h3>${info.name || `Estación ${station.station_id}`}</h3>
                <p><strong>Bicicletas disponibles:</strong> ${bikesAvailable}</p>
                <p><strong>Espacios disponibles:</strong> ${docksAvailable}</p>
                <p><strong>Total de espacios:</strong> ${totalDocks}</p>
                ${occupancyPercentage !== null ? `<p><strong>Ocupación:</strong> ${occupancyPercentage}%</p>` : ''}
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
          },
          {
            name: 'Puntos de Reparación',
            Placemark: repairStations.map(repairStation => {
              const description = `
                <div style="font-family: Arial, sans-serif;">
                  <h3>🔧 ${repairStation.name}</h3>
                  <p><strong>Tipo:</strong> Punto de Reparación</p>
                  ${repairStation.description ? `<p><strong>Información:</strong> ${repairStation.description}</p>` : ''}
                  <p><strong>Servicios:</strong> Reparación de bicicletas</p>
                </div>
              `;

              return {
                name: `🔧 ${repairStation.name}`,
                description: description,
                styleUrl: '#repair-station',
                Point: {
                  coordinates: `${repairStation.lon},${repairStation.lat},0`
                }
              };
            })
          },
          {
            name: 'Ciclovías',
            Placemark: bikePaths.map(bikePath => {
              const coordinates = bikePath.coordinates.map(coord => `${coord.lng},${coord.lat},0`).join(' ');
              
              return {
                name: bikePath.name,
                description: `
                  <div style="font-family: Arial, sans-serif;">
                    <h3>🚴 ${bikePath.name}</h3>
                    <p><strong>Tipo:</strong> Ciclovía</p>
                    <p><strong>Departamento:</strong> ${bikePath.depto}</p>
                    <p><strong>Longitud:</strong> ${bikePath.length} metros</p>
                    <p><strong>Estado:</strong> Disponible</p>
                  </div>
                `,
                styleUrl: '#bikepath',
                LineString: {
                  coordinates: coordinates
                }
              };
            })
          }
        ]
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
      
      // Obtener datos de estado, información, puntos de reparación y ciclovías en paralelo
      const [stationStatus, stationInfo, repairStations, bikePaths] = await Promise.all([
        getStationData(),
        getStationInfo(),
        getRepairStations(),
        getBikePaths()
      ]);
      
      stationCache.data = { stationStatus, stationInfo, repairStations, bikePaths };
      stationCache.lastUpdate = now;
    }

    // Generar KML
    const kml = generateKML(stationCache.data.stationStatus, stationCache.data.stationInfo, stationCache.data.repairStations, stationCache.data.bikePaths);
    
    // Configurar headers para KML con mejor compatibilidad
    res.set({
      'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
      'Content-Disposition': 'inline; filename="mendozabike.kml"',
      'Cache-Control': 'public, max-age=300', // Cache por 5 minutos
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Last-Modified': new Date(stationCache.lastUpdate).toUTCString(),
      'ETag': `"${stationCache.lastUpdate}"`
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

// Endpoint para obtener datos en formato JSON
app.get('/api/stations', async (req, res) => {
  try {
    // Verificar si necesitamos actualizar el cache
    const now = Date.now();
    if (!stationCache.data || (now - stationCache.lastUpdate) > stationCache.updateInterval) {
      console.log('Actualizando cache de estaciones...');
      
      const [stationStatus, stationInfo, repairStations, bikePaths] = await Promise.all([
        getStationData(),
        getStationInfo(),
        getRepairStations(),
        getBikePaths()
      ]);
      
      stationCache.data = { stationStatus, stationInfo, repairStations, bikePaths };
      stationCache.lastUpdate = now;
    }

    // Crear respuesta con datos procesados
    const stationInfoMap = {};
    if (stationCache.data.stationInfo && stationCache.data.stationInfo.data && stationCache.data.stationInfo.data.stations) {
      stationCache.data.stationInfo.data.stations.forEach(station => {
        stationInfoMap[station.station_id] = station;
      });
    }

    const stations = stationCache.data.stationStatus.data.stations.map(station => {
      const info = stationInfoMap[station.station_id] || {};
      
      // Calcular espacios libres: capacidad total - bicicletas disponibles
      const totalCapacity = info.capacity || null;
      const bikesAvailable = station.num_bikes_available || 0;
      const docksAvailable = totalCapacity ? Math.max(0, totalCapacity - bikesAvailable) : null;
      
      // Corregir fecha si está en el futuro (problema conocido de la API)
      let lastReported = new Date(station.last_reported * 1000);
      const currentYear = new Date().getFullYear();
      if (lastReported.getFullYear() > currentYear) {
        lastReported.setFullYear(lastReported.getFullYear() - 1);
      }
      
      return {
        id: station.station_id,
        name: info.name || `Estación ${station.station_id}`,
        address: info.address || null,
        lat: info.lat || null,
        lon: info.lon || null,
        bikesAvailable: bikesAvailable,
        docksAvailable: docksAvailable,
        totalDocks: totalCapacity,
        lastReported: lastReported.toISOString(),
        status: bikesAvailable > 5 ? 'many' : bikesAvailable > 0 ? 'few' : 'empty'
      };
    }).filter(station => {
      // Filtrar estaciones que no queremos mostrar
      const excludedStations = ['Hub-prueba', 'TALLER BICITRAN'];
      return station.lat && station.lon && !excludedStations.includes(station.name);
    });

    // Procesar puntos de reparación
    const repairPoints = stationCache.data.repairStations.map(repairStation => ({
      id: `repair_${repairStation.name.replace(/\s+/g, '_').toLowerCase()}`,
      name: repairStation.name,
      description: repairStation.description,
      lat: repairStation.lat,
      lon: repairStation.lon,
      type: 'repair',
      status: 'available'
    }));

    // Procesar ciclovías
    const bikePaths = stationCache.data.bikePaths.map(bikePath => ({
      id: `path_${bikePath.name.replace(/\s+/g, '_').toLowerCase()}`,
      name: bikePath.name,
      depto: bikePath.depto,
      length: bikePath.length,
      coordinates: bikePath.coordinates,
      type: 'bikepath',
      status: 'available'
    }));

    res.json({
      lastUpdate: new Date(stationCache.lastUpdate).toISOString(),
      totalStations: stations.length,
      totalRepairPoints: repairPoints.length,
      totalBikePaths: bikePaths.length,
      stations: stations,
      repairPoints: repairPoints,
      bikePaths: bikePaths
    });
    
  } catch (error) {
    console.error('Error obteniendo datos de estaciones:', error);
    res.status(500).json({ 
      error: 'Error obteniendo datos de estaciones',
      message: error.message 
    });
  }
});

// Redirigir la página principal a map.html
app.get('/', (req, res) => {
  res.redirect('/map.html');
});

// Endpoint para forzar actualización del cache
app.post('/refresh', async (req, res) => {
  try {
    stationCache.data = null;
    stationCache.lastUpdate = 0;
    
    const [stationStatus, stationInfo, repairStations, bikePaths] = await Promise.all([
      getStationData(),
      getStationInfo(),
      getRepairStations(),
      getBikePaths()
    ]);
    
    stationCache.data = { stationStatus, stationInfo, repairStations, bikePaths };
    stationCache.lastUpdate = Date.now();
    
    res.json({ 
      message: 'Cache actualizado exitosamente',
      stations: stationStatus.data.stations.length,
      repairPoints: repairStations.length,
      bikePaths: bikePaths.length,
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
  console.log(`🗺️  Mapa interactivo: http://localhost:${PORT}/map.html`);
  console.log(`📊 API de datos: http://localhost:${PORT}/api/stations`);
});
