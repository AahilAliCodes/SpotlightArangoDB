'use client';

import { useEffect, useRef } from 'react';
import '@arcgis/core/assets/esri/themes/light/main.css';

export default function Earth3D() {
  const mapRef = useRef(null);
  
  useEffect(() => {
    // Dynamic import of ArcGIS modules to avoid SSR issues
    const loadMap = async () => {
      try {
        // Import the required modules
        const [
          Map, 
          SceneView, 
          esriConfig, 
          Point, 
          GraphicsLayer, 
          Graphic, 
          PopupTemplate, 
          SimpleMarkerSymbol
        ] = await Promise.all([
          import('@arcgis/core/Map'),
          import('@arcgis/core/views/SceneView'),
          import('@arcgis/core/config'),
          import('@arcgis/core/geometry/Point'),
          import('@arcgis/core/layers/GraphicsLayer'),
          import('@arcgis/core/Graphic'),
          import('@arcgis/core/PopupTemplate'),
          import('@arcgis/core/symbols/SimpleMarkerSymbol')
        ]);
        
        // Set your API key
        esriConfig.default.apiKey = "AAPTxy8BH1VEsoebNVZXo8HurIeArPNBOEWZDSUZ4sbkY4PHNJXrISDW_Z-CqzwiIt1jzVPlcXXNUs3ULuJTioiIgwN9dYoBCaGxJZt9Py5LxaLZ1cAVeSaUnXSGXrzQNu2VsVFhdtb79w6Qd7VRg4RnOQ2dEIgU6MMEfjKHV2LVLYOq9QZTSNI-wkfdQ2FQTbwuh4vC6AZL3Qzs7yRNdMaT6zAGK6azQbhFSz3RKpLvgZA.AT1_0feYSddk";
        
        // Create the Map
        const map = new Map.default({
          basemap: "hybrid",
          ground: "world-elevation"
        });

        // Create a graphics layer for the data points
        const pointsLayer = new GraphicsLayer.default();
        map.add(pointsLayer);

        // Create the SceneView
        const view = new SceneView.default({
          container: mapRef.current,
          map: map,
          camera: {
            position: {
              spatialReference: {
                wkid: 102100
              },
              x: -11262192.883555487,
              y: 2315246.351026253,
              z: 18161244.728082635
            },
            heading: 0,
            tilt: 0.49
          },
          ui: {
            components: ["zoom", "compass"]
          }
        });

        // Sample JSON datapoint
        const dataPoint = {
          longitude: -122.4194,
          latitude: 37.7749,
          title: "San Francisco",
          content: {
            description: "The cultural, commercial, and financial center of Northern California",
            population: 873965,
            founded: 1776,
            landmarks: ["Golden Gate Bridge", "Alcatraz", "Fisherman's Wharf"],
            climate: {
              type: "Mediterranean",
              averageTemp: 57.3
            }
          }
        };

        // Create a point geometry from the longitude and latitude
        const point = new Point.default({
          longitude: dataPoint.longitude,
          latitude: dataPoint.latitude
        });

        // Create a marker symbol for the point
        const markerSymbol = new SimpleMarkerSymbol.default({
          color: [226, 119, 40],
          outline: {
            color: [255, 255, 255],
            width: 2
          },
          size: 15
        });

        // Create a popup template for the point that displays the JSON content
        const popupTemplate = new PopupTemplate.default({
          title: dataPoint.title,
          content: [
            {
              type: "text",
              text: `<b>Description:</b> ${dataPoint.content.description}<br>
                     <b>Population:</b> ${dataPoint.content.population.toLocaleString()}<br>
                     <b>Founded:</b> ${dataPoint.content.founded}<br>
                     <b>Climate:</b> ${dataPoint.content.climate.type} (Avg. ${dataPoint.content.climate.averageTemp}°F)<br>
                     <b>Notable Landmarks:</b><br>`
            },
            {
              type: "text",
              text: `<ul>${dataPoint.content.landmarks.map(landmark => `<li>${landmark}</li>`).join('')}</ul>`
            }
          ]
        });

        // Create a graphic with the point geometry, marker symbol, and popup template
        const graphic = new Graphic.default({
          geometry: point,
          symbol: markerSymbol,
          popupTemplate: popupTemplate,
          attributes: dataPoint.content
        });

        // Add the graphic to the graphics layer
        pointsLayer.add(graphic);

        // Zoom to the point after the view is ready
        view.when(() => {
          view.goTo({
            target: point,
            zoom: 12
          }, {
            duration: 2000
          });
        });
        
        // Return the view instance in case you need to reference it later
        return view;
      } catch (error) {
        console.error("Error loading ArcGIS modules:", error);
      }
    };
    
    const viewInstance = loadMap();
    
    // Cleanup function
    return () => {
      // Destroy the view when the component unmounts
      viewInstance.then(view => {
        if (view) {
          view.destroy();
        }
      }).catch(err => console.error("Error cleaning up:", err));
    };
  }, []);

  return (
    <div className="w-full h-full">
      <div 
        ref={mapRef} 
        id="viewDiv" 
        className="w-full h-full"
      />
    </div>
  );
}