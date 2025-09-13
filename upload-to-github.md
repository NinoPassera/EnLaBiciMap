# Cómo subir el KML a GitHub para que funcione con Google Maps

## Paso 1: Crear un repositorio en GitHub
1. Ve a https://github.com
2. Haz clic en "New repository"
3. Nombra el repositorio "mendoza-bike-kml"
4. Hazlo público
5. Crea el repositorio

## Paso 2: Subir el archivo KML
1. En el repositorio, haz clic en "uploading an existing file"
2. Arrastra el archivo `mendozabike.kml`
3. Commit changes

## Paso 3: Obtener la URL del archivo
1. Haz clic en el archivo KML
2. Haz clic en "Raw"
3. Copia la URL (será algo como: https://raw.githubusercontent.com/tuusuario/mendoza-bike-kml/main/mendozabike.kml)

## Paso 4: Usar en Google Maps
Usa esta URL en Google Maps:
```
https://www.google.com/maps?q=https://raw.githubusercontent.com/tuusuario/mendoza-bike-kml/main/mendozabike.kml
```

## Para actualizar automáticamente:
Cada vez que quieras actualizar los datos:
1. Descarga el KML actualizado: `curl -o mendozabike.kml https://web-production-be984.up.railway.app/mendozabike.kml`
2. Sube el archivo actualizado a GitHub
3. Los cambios se reflejarán automáticamente en Google Maps
