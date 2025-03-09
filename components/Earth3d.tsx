'use client';

import { useEffect, useRef, useState } from 'react';
import '@arcgis/core/assets/esri/themes/light/main.css';
import axios from 'axios';
import { useRouter } from 'next/navigation';

// Define props interface
interface Earth3DProps {
  height?: number | string;
  width?: number | string;
  initialZoom?: number;
  events?: EventData[]; // Add events prop to accept filtered data
}

// Define the event data interface
interface EventData {
  source: string;
  goldsteinscore: number;
  quadclass: number;
  fullname: string;
  countryCode: string;
  actorCountryCode?: string | null;
  actorFilter?: string | null;
  coordinates: [number, number] | null; // [latitude, longitude]
  time_ago?: string;
}

export default function Earth3D({ 
  height = '100%', 
  width = '100%', 
  initialZoom = 2,  // Default to a more zoomed-out view
  events
}: Earth3DProps) {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const [viewInstance, setViewInstance] = useState<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [eventData, setEventData] = useState<EventData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const graphicsLayerRef = useRef<any>(null);
  
  // Fetch event data if not provided via props
  useEffect(() => {
    if (events) {
      // If events are provided via props, use them
      setEventData(events);
      setIsLoadingData(false);
    } else {
      // Otherwise fetch from API
      const fetchEventData = async () => {
        try {
          setIsLoadingData(true);
          const response = await axios.get('/api/events');
          setEventData(response.data);
          setIsLoadingData(false);
        } catch (error) {
          console.error('Error fetching event data:', error);
          setIsLoadingData(false);
        }
      };
      
      fetchEventData();
    }
  }, [events]);
  
  // Function to handle window resize events
  const handleResize = () => {
    if (viewInstance) {
      if (mapRef.current) {
        // Update the parent container dimensions
        mapRef.current.style.height = typeof height === 'number' ? `${height}px` : height as string;
        mapRef.current.style.width = typeof width === 'number' ? `${width}px` : width as string;
        
        // Trigger a resize event correctly for ArcGIS view
        try {
          // Different ArcGIS versions might have different resize methods
          if (typeof viewInstance.resize === 'function') {
            viewInstance.resize();
          } else if (viewInstance && viewInstance.width !== undefined) {
            // Force the view to update by slightly modifying its dimensions
            const tempWidth = viewInstance.width;
            viewInstance.width = tempWidth + 1;
            setTimeout(() => {
              if (viewInstance) viewInstance.width = tempWidth;
            }, 0);
          }
        } catch (error) {
          console.error("Error resizing map view:", error);
        }
      }
    }
  };

  // Prevent wheel events from propagating outside the map
  const preventWheelPropagation = (e: Event) => {
    // Only stop propagation if the user is interacting with the map
    // This still allows scrolling on the page when not directly interacting with the map
    if (viewInstance && document.activeElement === mapRef.current) {
      e.stopPropagation();
    }
  };

  // Function to get color based on quadclass
  const getColorForQuadclass = (quadclass: number) => {
    switch (quadclass) {
      case 1: // Verbal Cooperation
        return [76, 175, 80]; // Green
      case 2: // Material Cooperation
        return [33, 150, 243]; // Blue
      case 3: // Verbal Conflict
        return [255, 152, 0]; // Orange
      case 4: // Material Conflict
        return [244, 67, 54]; // Red
      default:
        return [158, 158, 158]; // Gray for unknown
    }
  };

  // Function to get size based on goldstein score
  const getSizeForGoldstein = (score: number) => {
    // Adjust size based on score significance (absolute value)
    const absScore = Math.abs(score);
    return Math.max(8, Math.min(20, 10 + absScore));
  };

  // Function to get event type name based on quadclass
  const getEventTypeName = (quadClass: number) => {
    switch (quadClass) {
      case 1: return 'Verbal Cooperation';
      case 2: return 'Material Cooperation';
      case 3: return 'Verbal Conflict';
      case 4: return 'Material Conflict';
      default: return 'Unknown Event Type';
    }
  };
  
  // Function to navigate to the insights page
  const navigateToInsights = (event: EventData) => {
    localStorage.setItem('selectedEvent', JSON.stringify(event));
    router.push(`/workflows?source=${encodeURIComponent(event.source || '')}`);
  };

  // Update map points when event data changes
  useEffect(() => {
    if (viewInstance && graphicsLayerRef.current && eventData.length > 0 && isMapLoaded) {
      updateMapPoints();
    }
  }, [eventData, isMapLoaded]);

  // Function to update map points
  const updateMapPoints = async () => {
    if (!graphicsLayerRef.current || !viewInstance) return;
    
    try {
      // Clear existing graphics
      graphicsLayerRef.current.removeAll();
      
      // Import necessary modules
      const [Point, Graphic, PopupTemplate, SimpleMarkerSymbol, CustomContent] = await Promise.all([
        import('@arcgis/core/geometry/Point'),
        import('@arcgis/core/Graphic'),
        import('@arcgis/core/PopupTemplate'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol'),
        import('@arcgis/core/popup/content/CustomContent')
      ]);
      
      // Add event data points to the map
      eventData.forEach(event => {
        // Skip events without coordinates
        if (!event.coordinates || event.coordinates.length !== 2) {
          return;
        }

        // Create a point geometry from the coordinates
        // Note: event.coordinates is [latitude, longitude]
        const point = new Point.default({
          latitude: event.coordinates[0],
          longitude: event.coordinates[1]
        });

        // Create a marker symbol for the point
        const markerSymbol = new SimpleMarkerSymbol.default({
          color: getColorForQuadclass(event.quadclass),
          outline: {
            color: [255, 255, 255],
            width: 1
          },
          size: getSizeForGoldstein(event.goldsteinscore)
        });

        // Format the source URL for display
        let sourceDomain = event.source;
        try {
          const urlObj = new URL(event.source);
          sourceDomain = urlObj.hostname;
        } catch (e) {
          // Keep original if parsing fails
        }

        // Create basic info content
        let basicInfo = `<b>Location:</b> ${event.fullname}<br>
                        <b>Country:</b> ${event.countryCode}<br>
                        <b>Goldstein Scale:</b> ${event.goldsteinscore.toFixed(1)}<br>`;
        
        // Add actor information if available
        if (event.actorFilter) {
          basicInfo += `<b>Actor Type:</b> ${event.actorFilter}<br>`;
        }
        
        if (event.actorCountryCode) {
          basicInfo += `<b>Actor Country:</b> ${event.actorCountryCode}<br>`;
        }
        
        // Add time and source if available
        if (event.time_ago) {
          basicInfo += `<b>Reported:</b> ${event.time_ago}<br>`;
        }
        
        basicInfo += `<b>Source:</b> <a href="${event.source}" target="_blank">${sourceDomain}</a>`;

        // Create a unique ID for this event
        const eventId = `event-${event.source.replace(/[^a-z0-9]/gi, '-')}`;

        // Create a custom action button that will work with ArcGIS
        const customActionContent = new CustomContent.default({
          outFields: ["*"],
          creator: (graphic: any) => {
            // Create a div to hold our button
            const div = document.createElement("div");
            div.className = "esri-popup__content";
            div.style.marginTop = "10px";
            
            // Create the button
            const button = document.createElement("button");
            button.id = eventId;
            button.className = "esri-button esri-button--primary";
            button.style.backgroundColor = "#4F46E5";
            button.style.color = "white";
            button.style.padding = "8px 16px";
            button.style.borderRadius = "8px";
            button.style.width = "100%";
            button.style.marginTop = "8px";
            button.style.display = "flex";
            button.style.alignItems = "center";
            button.style.justifyContent = "center";
            button.style.cursor = "pointer";
            button.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px">
                <path d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              Generate AI Insights
            `;
            
            // Add click event listener
            button.addEventListener("click", () => {
              navigateToInsights(event);
            });
            
            div.appendChild(button);
            return div;
          }
        });

        // Create a popup template with both basic info and the custom button
        const popupTemplate = new PopupTemplate.default({
          title: getEventTypeName(event.quadclass),
          content: [
            {
              type: "text",
              text: basicInfo
            },
            customActionContent
          ],
          outFields: ["*"]
        });

        // Create a graphic with the point geometry, marker symbol, and popup template
        const graphic = new Graphic.default({
          geometry: point,
          symbol: markerSymbol,
          popupTemplate: popupTemplate,
          attributes: {
            ...event
          }
        });

        // Add the graphic to the graphics layer
        graphicsLayerRef.current.add(graphic);
      });

      // If we have valid data points, zoom to fit all points
      if (graphicsLayerRef.current.graphics.length > 0) {
        // Zoom to display all the points
        viewInstance.goTo(graphicsLayerRef.current.graphics.toArray(), {
          duration: 1000
        }).catch((err: any) => {
          console.warn("Zoom failed", err);
          // Fallback to initial zoom level
          viewInstance.zoom = initialZoom;
        });
      } else {
        // Set default view if no points
        viewInstance.zoom = initialZoom;
      }
    } catch (error) {
      console.error("Error updating map points:", error);
    }
  };

  useEffect(() => {
    // Only load the map if we have data or if loading has failed
    if (eventData.length > 0 || !isLoadingData) {
      // Dynamic import of ArcGIS modules to avoid SSR issues
      const loadMap = async () => {
        try {
          // Import the required modules
          const [
            Map, 
            SceneView, 
            esriConfig, 
            GraphicsLayer
          ] = await Promise.all([
            import('@arcgis/core/Map'),
            import('@arcgis/core/views/SceneView'),
            import('@arcgis/core/config'),
            import('@arcgis/core/layers/GraphicsLayer')
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
          graphicsLayerRef.current = pointsLayer;

          // Create the SceneView with dynamic dimensions and navigation options
          const view = new SceneView.default({
            container: mapRef.current,
            map: map,
            camera: {
              position: {
                spatialReference: {
                  wkid: 102100
                },
                x: 0, // centered on globe
                y: 0,
                z: 20000000 // high altitude view
              },
              heading: 0,
              tilt: 0
            },
            ui: {
              components: ["zoom", "compass"]
            },
            // Prevent map navigation from interfering with page scrolling
            navigation: {
              mouseWheelZoomEnabled: true,
              browserTouchPanEnabled: true
            },
            // Enable popup interaction
            popup: {
              dockEnabled: true,
              dockOptions: {
                buttonEnabled: true,
                breakpoint: false,
                position: "top-right"
              }
            }
          });

          // Set map as loaded after initialization
          view.when(() => {
            setIsMapLoaded(true);
            setViewInstance(view);
            updateMapPoints(); // Initial population of points
          });
          
          // Return the view instance
          return view;
        } catch (error) {
          console.error("Error loading ArcGIS modules:", error);
          setIsMapLoaded(true); // Set as loaded even if there's an error
        }
      };
      
      loadMap();
    }
    
    // Add event listeners
    window.addEventListener('resize', handleResize);
    
    // Clean up function
    return () => {
      window.removeEventListener('resize', handleResize);
      
      // Destroy the view when the component unmounts
      if (viewInstance) {
        try {
          viewInstance.destroy();
        } catch (error) {
          console.error("Error destroying view:", error);
        }
      }
    };
  }, [initialZoom, isLoadingData, router]); // Add router to dependencies

  // Apply dimension changes when props change
  useEffect(() => {
    handleResize();
  }, [height, width, viewInstance]);

  // Handle wheel events to prevent page scrolling issues
  useEffect(() => {
    const mapElement = mapRef.current;
    
    if (mapElement) {
      // Add wheel event handlers with capture phase to handle events before they bubble up
      mapElement.addEventListener('wheel', (e) => {
        // Only prevent default when map is actively being interacted with
        if (document.activeElement === mapElement || mapElement.contains(document.activeElement)) {
          e.stopPropagation();
        }
      }, { passive: true });

      // Ensure map container doesn't block page scrolling
      mapElement.addEventListener('mouseleave', () => {
        // Release focus when mouse leaves the map
        if (document.activeElement === mapElement) {
          mapElement.blur();
        }
      });
    }
    
    return () => {
      // Clean up event listeners
      if (mapElement) {
        mapElement.removeEventListener('wheel', preventWheelPropagation);
        mapElement.removeEventListener('mouseleave', () => {});
      }
    };
  }, [mapRef.current]);

  return (
    <div 
      className="relative w-full h-full"
      style={{ 
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
      }}
    >
      <div 
        ref={mapRef}
        id="viewDiv" 
        tabIndex={0} // Make the div focusable for better event handling
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          right: 0
        }}
        // Add accessibility attributes
        aria-label="Interactive 3D Earth Map showing global events"
        role="application"
      />
      {(!isMapLoaded || isLoadingData) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
          <div className="text-white">Loading map data...</div>
        </div>
      )}
      {isMapLoaded && eventData.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
          <div className="text-white">No events match your current filter criteria</div>
        </div>
      )}
    </div>
  );
}