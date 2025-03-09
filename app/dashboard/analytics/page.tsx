'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import _ from 'lodash';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set your Mapbox access token here
// In production, use environment variables
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 'YOUR_MAPBOX_ACCESS_TOKEN';

// Define our event data interface
interface EventData {
  source: string;
  goldsteinscore: number;
  quadclass: number;
  fullname: string;
  countryCode: string;
  actorCountryCode: string | null;
  actorFilter: string | null;
  coordinates: [number, number];
}

// Define patterns that our AI agent might find
interface Pattern {
  id: string;
  name: string;
  description: string;
  confidence: number;
  relatedEvents: number[];
}

// Define the component
function GeoEventAnalysis() {
  // State for events data
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // State for filters
  const [quadClassFilters, setQuadClassFilters] = useState<{[key: number]: boolean}>({
    1: true, // Verbal Cooperation
    2: true, // Material Cooperation 
    3: true, // Verbal Conflict
    4: true  // Material Conflict
  });
  const [intensityFilter, setIntensityFilter] = useState<[number, number]>([-10, 10]); // Goldstein score range
  
  // State for AI-detected patterns
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);

  // Refs for map views
  const quadClassMapRef = useRef<mapboxgl.Map | null>(null);
  const generalMapRef = useRef<mapboxgl.Map | null>(null);
  const countryMapRef = useRef<mapboxgl.Map | null>(null);
  const quadClassMapContainerRef = useRef<HTMLDivElement>(null);
  const generalMapContainerRef = useRef<HTMLDivElement>(null);
  const countryMapContainerRef = useRef<HTMLDivElement>(null);

  // Fetch events data
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/events');
        
        if (!response.ok) {
          throw new Error(`Error fetching events: ${response.status}`);
        }
        
        const data = await response.json();
        setEvents(data);

        // Analyze the data for patterns after receiving it
        analyzePatterns(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Failed to fetch events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Initialize the maps once we have data
  useEffect(() => {
    if (events.length > 0 && !loading) {
      initializeMaps();
    }

    // Cleanup maps on unmount
    return () => {
      if (quadClassMapRef.current) {
        quadClassMapRef.current.remove();
      }
      if (generalMapRef.current) {
        generalMapRef.current.remove();
      }
      if (countryMapRef.current) {
        countryMapRef.current.remove();
      }
    };
  }, [events, loading]);

  // Update maps when filters change
  useEffect(() => {
    if (quadClassMapRef.current && generalMapRef.current && countryMapRef.current) {
      updateMaps();
    }
  }, [quadClassFilters, intensityFilter, selectedPattern]);

  // Initialize Mapbox maps
  const initializeMaps = () => {
    try {
      // Initialize QuadClass Map
      if (quadClassMapContainerRef.current) {
        quadClassMapRef.current = new mapboxgl.Map({
          container: quadClassMapContainerRef.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [0, 20],
          zoom: 1.5
        });

        // Add navigation controls
        quadClassMapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        // Wait for map to load before adding sources and layers
        quadClassMapRef.current.on('load', () => {
          addQuadClassLayers();
        });
      }
      
      // Initialize General Map
      if (generalMapContainerRef.current) {
        generalMapRef.current = new mapboxgl.Map({
          container: generalMapContainerRef.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [0, 20],
          zoom: 1.5
        });

        // Add navigation controls
        generalMapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        // Wait for map to load before adding sources and layers
        generalMapRef.current.on('load', () => {
          addGeneralHeatmapLayer();
        });
      }
      
      // Initialize Country Map
      if (countryMapContainerRef.current) {
        countryMapRef.current = new mapboxgl.Map({
          container: countryMapContainerRef.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [0, 20],
          zoom: 1.5
        });

        // Add navigation controls
        countryMapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        // Wait for map to load before adding sources and layers
        countryMapRef.current.on('load', () => {
          addCountryHeatmapLayer();
        });
      }
    } catch (err) {
      console.error("Error initializing maps:", err);
      setError("Failed to initialize maps. Please refresh the page.");
    }
  };

  // Add separate layers for each QuadClass - heatmap only
  const addQuadClassLayers = () => {
    if (!quadClassMapRef.current) return;
    
    const quadClassNames = {
      1: 'Verbal Cooperation',
      2: 'Material Cooperation',
      3: 'Verbal Conflict',
      4: 'Material Conflict'
    };
    
    const quadClassColors = {
      1: 'rgb(44, 186, 0)',   // Green
      2: 'rgb(0, 112, 255)',  // Blue
      3: 'rgb(255, 170, 0)',  // Orange
      4: 'rgb(255, 0, 0)'     // Red
    };

    // For each QuadClass, create a separate source and heatmap layer
    for (let qc = 1; qc <= 4; qc++) {
      const qcEvents = events.filter(e => e.quadclass === qc);
      
      if (qcEvents.length === 0) continue;
      
      // Create GeoJSON for this QuadClass
      const geojson = {
        type: 'FeatureCollection',
        features: qcEvents.map(event => ({
          type: 'Feature',
          properties: {
            quadclass: event.quadclass,
            goldsteinscore: event.goldsteinscore,
            fullname: event.fullname,
            countryCode: event.countryCode,
            source: event.source
          },
          geometry: {
            type: 'Point',
            coordinates: [event.coordinates[1], event.coordinates[0]] // Mapbox uses [lng, lat]
          }
        }))
      };

      // Add source for this QuadClass
      const sourceId = `quadclass-${qc}-source`;
      if (!quadClassMapRef.current.getSource(sourceId)) {
        quadClassMapRef.current.addSource(sourceId, {
          type: 'geojson',
          data: geojson
        });
      }

      // Get RGB values for the current quadclass color
      const colorMatch = quadClassColors[qc as keyof typeof quadClassColors].match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      const r = colorMatch ? colorMatch[1] : '0';
      const g = colorMatch ? colorMatch[2] : '0';
      const b = colorMatch ? colorMatch[3] : '0';

      // Add heatmap layer with increased intensity for better visualization
      const layerId = `quadclass-${qc}-heat`;
      if (!quadClassMapRef.current.getLayer(layerId)) {
        quadClassMapRef.current.addLayer({
          id: layerId,
          type: 'heatmap',
          source: sourceId,
          layout: {
            visibility: quadClassFilters[qc] ? 'visible' : 'none'
          },
          paint: {
            // Increase weight based on Goldstein score for higher importance
            'heatmap-weight': [
              'interpolate',
              ['linear'],
              ['abs', ['get', 'goldsteinscore']],
              0, 0.7,  // Increased minimum weight
              10, 1.5  // Increased maximum weight
            ],
            // Use color based on QuadClass
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0, 0, 0, 0)',
              0.1, `rgba(${r}, ${g}, ${b}, 0.3)`,
              0.3, `rgba(${r}, ${g}, ${b}, 0.5)`,
              0.6, `rgba(${r}, ${g}, ${b}, 0.7)`,
              0.9, quadClassColors[qc as keyof typeof quadClassColors]
            ],
            // Increase radius for better visibility
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 8,
              6, 20,
              10, 35
            ],
            // Keep high opacity at all zoom levels
            'heatmap-opacity': 0.9
          }
        });
      }
    }
  };

  // Add general heatmap layer showing all events - heatmap only
  const addGeneralHeatmapLayer = () => {
    if (!generalMapRef.current) return;

    // Filter events based on current filters
    const filteredEvents = events.filter(event => {
      const passesQuadClass = quadClassFilters[event.quadclass];
      const passesIntensity = event.goldsteinscore >= intensityFilter[0] && 
                            event.goldsteinscore <= intensityFilter[1];
      
      // If a pattern is selected, check if this event is part of it
      const passesPattern = selectedPattern ? 
        patterns.find(p => p.id === selectedPattern)?.relatedEvents.includes(events.indexOf(event)) : 
        true;
        
      return passesQuadClass && passesIntensity && passesPattern;
    });

    // Create GeoJSON for filtered events
    const geojson = {
      type: 'FeatureCollection',
      features: filteredEvents.map((event, index) => ({
        type: 'Feature',
        properties: {
          id: index,
          quadclass: event.quadclass,
          goldsteinscore: event.goldsteinscore,
          fullname: event.fullname,
          countryCode: event.countryCode,
          source: event.source
        },
        geometry: {
          type: 'Point',
          coordinates: [event.coordinates[1], event.coordinates[0]] // Mapbox uses [lng, lat]
        }
      }))
    };

    // Add or update source
    const sourceId = 'all-events-source';
    if (generalMapRef.current.getSource(sourceId)) {
      (generalMapRef.current.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson as any);
    } else {
      generalMapRef.current.addSource(sourceId, {
        type: 'geojson',
        data: geojson
      });

      // Add enhanced heatmap layer
      generalMapRef.current.addLayer({
        id: 'all-events-heat',
        type: 'heatmap',
        source: sourceId,
        paint: {
          // Weight by absolute value of Goldstein score
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['abs', ['get', 'goldsteinscore']],
            0, 0.7,
            10, 1.5
          ],
          // Enhanced color gradient for heatmap
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0, 0, 0, 0)',
            0.1, 'rgba(0, 0, 255, 0.3)',
            0.3, 'rgba(0, 255, 255, 0.5)',
            0.5, 'rgba(0, 255, 0, 0.6)',
            0.7, 'rgba(255, 255, 0, 0.7)',
            0.9, 'rgba(255, 0, 0, 0.8)',
            1, 'rgba(255, 0, 0, 1)'
          ],
          // Increased radius for better coverage
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 8,
            6, 25,
            10, 40
          ],
          // Keep high opacity at all zoom levels
          'heatmap-opacity': 0.9
        }
      });
    }
  };

  // Add country heatmap layer showing events by country
  const addCountryHeatmapLayer = () => {
    if (!countryMapRef.current) return;
    
    // First, we need to create a data structure that counts events per country
    const eventsByCountry = {};
    
    // Filter events based on current filters
    const filteredEvents = events.filter(event => {
      const passesQuadClass = quadClassFilters[event.quadclass];
      const passesIntensity = event.goldsteinscore >= intensityFilter[0] && 
                            event.goldsteinscore <= intensityFilter[1];
      
      // If a pattern is selected, check if this event is part of it
      const passesPattern = selectedPattern ? 
        patterns.find(p => p.id === selectedPattern)?.relatedEvents.includes(events.indexOf(event)) : 
        true;
        
      return passesQuadClass && passesIntensity && passesPattern;
    });
    
    // Count events by country
    filteredEvents.forEach(event => {
      if (event.countryCode) {
        if (!eventsByCountry[event.countryCode]) {
          eventsByCountry[event.countryCode] = 0;
        }
        eventsByCountry[event.countryCode]++;
      }
    });
    
    // Check if we already have the world boundaries source
    const sourceId = 'country-boundaries-source';
    
    if (!countryMapRef.current.getSource(sourceId)) {
      // Fetch the world boundaries GeoJSON - we'll use Natural Earth data via Mapbox vector tiles
      countryMapRef.current.addSource(sourceId, {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1'
      });
      
      // Add country polygon layer
      countryMapRef.current.addLayer({
        id: 'country-fills',
        type: 'fill',
        source: sourceId,
        'source-layer': 'country_boundaries',
        layout: {},
        paint: {
          'fill-color': [
            'case',
            ['has', ['get', 'iso_3166_1_alpha_3'], ['literal', eventsByCountry]],
            [
              'interpolate',
              ['linear'],
              ['get', ['get', 'iso_3166_1_alpha_3'], ['literal', eventsByCountry]],
              0, 'rgba(255, 165, 0, 0)', // No events - transparent
              1, 'rgba(255, 165, 0, 0.2)', // Few events - light orange
              5, 'rgba(255, 165, 0, 0.4)', 
              10, 'rgba(255, 165, 0, 0.6)',
              20, 'rgba(255, 165, 0, 0.8)',
              50, 'rgba(255, 165, 0, 1)' // Many events - solid orange
            ],
            'rgba(0, 0, 0, 0)' // No data - transparent
          ],
          'fill-outline-color': 'rgba(0, 0, 0, 0.2)'
        }
      });
      
      // Add a hover effect
      countryMapRef.current.addLayer({
        id: 'country-borders',
        type: 'line',
        source: sourceId,
        'source-layer': 'country_boundaries',
        layout: {},
        paint: {
          'line-color': 'rgba(0, 0, 0, 0.5)',
          'line-width': 1
        }
      });
      
      // Add country labels
      countryMapRef.current.addLayer({
        id: 'country-labels',
        type: 'symbol',
        source: sourceId,
        'source-layer': 'country_boundaries',
        layout: {
          'text-field': [
            'format',
            ['get', 'name_en'],
            { 'font-scale': 0.9 },
            '\n',
            {},
            ['case',
              ['has', ['get', 'iso_3166_1_alpha_3'], ['literal', eventsByCountry]],
              [
                'concat',
                ['get', ['get', 'iso_3166_1_alpha_3'], ['literal', eventsByCountry]],
                ' events'
              ],
              'No events'
            ],
            { 'font-scale': 0.7 }
          ],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 12,
          'text-max-width': 8,
          'text-variable-anchor': ['center'],
          'text-radial-offset': 0.5,
          'text-justify': 'auto',
          'text-padding': 0
        },
        paint: {
          'text-color': 'rgba(0, 0, 0, 0.8)',
          'text-halo-color': '#fff',
          'text-halo-width': 1
        }
      });
      
      // Add popups on hover
      countryMapRef.current.on('click', 'country-fills', (e) => {
        if (e.features.length > 0) {
          const feature = e.features[0];
          const countryCode = feature.properties.iso_3166_1_alpha_3;
          const countryName = feature.properties.name_en;
          
          if (eventsByCountry[countryCode]) {
            const eventCount = eventsByCountry[countryCode];
            
            new mapboxgl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(`
                <h3>${countryName}</h3>
                <p>${eventCount} events</p>
                <p>Click to filter to just this country</p>
              `)
              .addTo(countryMapRef.current);
              
            // Here we could add functionality to filter to just this country
          } else {
            new mapboxgl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(`
                <h3>${countryName}</h3>
                <p>No events recorded</p>
              `)
              .addTo(countryMapRef.current);
          }
        }
      });
      
      // Change cursor to pointer when over countries with data
      countryMapRef.current.on('mouseenter', 'country-fills', () => {
        countryMapRef.current.getCanvas().style.cursor = 'pointer';
      });
      
      countryMapRef.current.on('mouseleave', 'country-fills', () => {
        countryMapRef.current.getCanvas().style.cursor = '';
      });
    } else {
      // Update data in the existing layers
      countryMapRef.current.setPaintProperty('country-fills', 'fill-color', [
        'case',
        ['has', ['get', 'iso_3166_1_alpha_3'], ['literal', eventsByCountry]],
        [
          'interpolate',
          ['linear'],
          ['get', ['get', 'iso_3166_1_alpha_3'], ['literal', eventsByCountry]],
          0, 'rgba(255, 165, 0, 0)', // No events - transparent
          1, 'rgba(255, 165, 0, 0.2)', // Few events - light orange
          5, 'rgba(255, 165, 0, 0.4)', 
          10, 'rgba(255, 165, 0, 0.6)',
          20, 'rgba(255, 165, 0, 0.8)',
          50, 'rgba(255, 165, 0, 1)' // Many events - solid orange
        ],
        'rgba(0, 0, 0, 0)' // No data - transparent
      ]);
      
      countryMapRef.current.setLayoutProperty('country-labels', 'text-field', [
        'format',
        ['get', 'name_en'],
        { 'font-scale': 0.9 },
        '\n',
        {},
        ['case',
          ['has', ['get', 'iso_3166_1_alpha_3'], ['literal', eventsByCountry]],
          [
            'concat',
            ['get', ['get', 'iso_3166_1_alpha_3'], ['literal', eventsByCountry]],
            ' events'
          ],
          'No events'
        ],
        { 'font-scale': 0.7 }
      ]);
    }
  };

  // Update maps based on current filters
  const updateMaps = () => {
    try {
      // Update QuadClass map layer visibility
      if (quadClassMapRef.current) {
        for (let qc = 1; qc <= 4; qc++) {
          const layerId = `quadclass-${qc}-heat`;
          
          if (quadClassMapRef.current.getLayer(layerId)) {
            quadClassMapRef.current.setLayoutProperty(
              layerId,
              'visibility',
              quadClassFilters[qc] ? 'visible' : 'none'
            );
          }
        }
      }

      // Update general map with filtered events
      if (generalMapRef.current) {
        addGeneralHeatmapLayer();
      }
      
      // Update country map with filtered events
      if (countryMapRef.current) {
        addCountryHeatmapLayer();
      }
    } catch (err) {
      console.error("Error updating maps:", err);
    }
  };

  // AI Pattern Analysis function
  const analyzePatterns = (data: EventData[]) => {
    // This is a simple AI agent that finds patterns in the data
    // In a real application, this could be more sophisticated or call a dedicated AI service
    
    // Detected patterns will be stored here
    const detectedPatterns: Pattern[] = [];
    
    // Pattern 1: Geographic clusters
    const geoClusters = findGeographicClusters(data);
    geoClusters.forEach((cluster, index) => {
      detectedPatterns.push({
        id: `geo-cluster-${index}`,
        name: `Geographic Cluster ${index + 1}`,
        description: `A concentration of ${cluster.count} events in the ${cluster.region} region`,
        confidence: cluster.confidence,
        relatedEvents: cluster.eventIndices
      });
    });
    
    // Pattern 2: Temporal sequences
    const tempSequences = findTemporalSequences(data);
    tempSequences.forEach((sequence, index) => {
      detectedPatterns.push({
        id: `temporal-${index}`,
        name: `Event Sequence ${index + 1}`,
        description: sequence.description,
        confidence: sequence.confidence,
        relatedEvents: sequence.eventIndices
      });
    });
    
    // Pattern 3: Unusual country/quadclass combinations
    const unusualCombos = findUnusualCombinations(data);
    unusualCombos.forEach((combo, index) => {
      detectedPatterns.push({
        id: `unusual-combo-${index}`,
        name: `Unusual Pattern ${index + 1}`,
        description: combo.description,
        confidence: combo.confidence,
        relatedEvents: combo.eventIndices
      });
    });
    
    setPatterns(detectedPatterns);
  };
  
  // Find geographic clusters
  const findGeographicClusters = (data: EventData[]) => {
    // Simple clustering algorithm
    const clusters: {
      center: [number, number];
      count: number;
      region: string;
      confidence: number;
      eventIndices: number[];
    }[] = [];
    
    // Group events by region/country
    const countryGroups = _.groupBy(data, 'countryCode');
    
    // Find significant clusters by country
    Object.entries(countryGroups).forEach(([countryCode, events]) => {
      if (events.length >= 3) { // At least 3 events to be considered a cluster
        const region = events[0].fullname || countryCode;
        const avgLat = _.meanBy(events, e => e.coordinates[0]);
        const avgLon = _.meanBy(events, e => e.coordinates[1]);
        const eventIndices = events.map(event => data.findIndex(e => 
          e.coordinates[0] === event.coordinates[0] && 
          e.coordinates[1] === event.coordinates[1] &&
          e.quadclass === event.quadclass
        ));
        
        clusters.push({
          center: [avgLat, avgLon],
          count: events.length,
          region,
          confidence: Math.min(0.5 + (events.length / 20), 0.95), // Higher count = higher confidence
          eventIndices
        });
      }
    });
    
    return clusters;
  };
  
  // Find temporal sequences (simplified)
  const findTemporalSequences = (data: EventData[]) => {
    // In a real application, this would analyze event timestamps
    // Here we're simulating temporal patterns based on available data
    
    // Group by QuadClass
    const quadClassGroups = _.groupBy(data, 'quadclass');
    
    const sequences: {
      description: string;
      confidence: number;
      eventIndices: number[];
    }[] = [];
    
    // Look for escalation patterns (verbal conflict followed by material conflict)
    if (quadClassGroups[3] && quadClassGroups[4]) {
      const verbalConflicts = quadClassGroups[3];
      const materialConflicts = quadClassGroups[4];
      
      // Group by country
      const verbalByCountry = _.groupBy(verbalConflicts, 'countryCode');
      const materialByCountry = _.groupBy(materialConflicts, 'countryCode');
      
      // Find countries with both verbal and material conflicts
      const commonCountries = _.intersection(
        Object.keys(verbalByCountry), 
        Object.keys(materialByCountry)
      );
      
      if (commonCountries.length > 0) {
        const country = commonCountries[0];
        const verbal = verbalByCountry[country];
        const material = materialByCountry[country];
        
        const eventIndices = [
          ...verbal.map(event => data.findIndex(e => 
            e.coordinates[0] === event.coordinates[0] && 
            e.coordinates[1] === event.coordinates[1] &&
            e.quadclass === event.quadclass
          )),
          ...material.map(event => data.findIndex(e => 
            e.coordinates[0] === event.coordinates[0] && 
            e.coordinates[1] === event.coordinates[1] &&
            e.quadclass === event.quadclass
          ))
        ];
        
        sequences.push({
          description: `Potential conflict escalation in ${verbal[0].fullname || country}`,
          confidence: 0.7,
          eventIndices
        });
      }
    }
    
    return sequences;
  };
  
  // Find unusual combinations
  const findUnusualCombinations = (data: EventData[]) => {
    const combinations: {
      description: string;
      confidence: number;
      eventIndices: number[];
    }[] = [];
    
    // Look for countries with both cooperation and conflict
    const countryGroups = _.groupBy(data, 'countryCode');
    
    Object.entries(countryGroups).forEach(([countryCode, events]) => {
      // Group by quadClass
      const quadClasses = _.groupBy(events, 'quadclass');
      
      // If both cooperation (1,2) and conflict (3,4) are present
      const hasCooperation = quadClasses[1]?.length > 0 || quadClasses[2]?.length > 0;
      const hasConflict = quadClasses[3]?.length > 0 || quadClasses[4]?.length > 0;
      
      if (hasCooperation && hasConflict) {
        const country = events[0].fullname || countryCode;
        const eventIndices = events.map(event => data.findIndex(e => 
          e.coordinates[0] === event.coordinates[0] && 
          e.coordinates[1] === event.coordinates[1] &&
          e.quadclass === event.quadclass
        ));
        
        combinations.push({
          description: `Mixed cooperation and conflict events in ${country}`,
          confidence: 0.75,
          eventIndices
        });
      }
    });
    
    return combinations;
  };

  // Handle QuadClass filter changes
  const handleQuadClassFilterChange = (quadClass: number) => {
    setQuadClassFilters(prev => ({
      ...prev,
      [quadClass]: !prev[quadClass]
    }));
  };

  // Handle intensity filter changes
  const handleIntensityFilterChange = (values: number[]) => {
    setIntensityFilter([values[0], values[1]]);
  };

  // Handle pattern selection
  const handlePatternChange = (patternId: string | null) => {
    setSelectedPattern(patternId);
  };

  // Render component
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Geopolitical Event Analysis</h1>
      
      {error && (
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-lg">Loading event data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Filters Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Filters & Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Event Type</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="filter-verbal-coop" 
                        checked={quadClassFilters[1]}
                        onCheckedChange={() => handleQuadClassFilterChange(1)}
                      />
                      <Label htmlFor="filter-verbal-coop">Verbal Cooperation</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="filter-material-coop" 
                        checked={quadClassFilters[2]}
                        onCheckedChange={() => handleQuadClassFilterChange(2)}
                      />
                      <Label htmlFor="filter-material-coop">Material Cooperation</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="filter-verbal-conflict" 
                        checked={quadClassFilters[3]}
                        onCheckedChange={() => handleQuadClassFilterChange(3)}
                      />
                      <Label htmlFor="filter-verbal-conflict">Verbal Conflict</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="filter-material-conflict" 
                        checked={quadClassFilters[4]}
                        onCheckedChange={() => handleQuadClassFilterChange(4)}
                      />
                      <Label htmlFor="filter-material-conflict">Material Conflict</Label>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Intensity (Goldstein Score)</h3>
                  <div className="px-2">
                    <Slider 
                      defaultValue={[-10, 10]} 
                      min={-10} 
                      max={10} 
                      step={0.5}
                      value={intensityFilter}
                      onValueChange={handleIntensityFilterChange}
                    />
                    <div className="flex justify-between mt-2">
                      <span>{intensityFilter[0]}</span>
                      <span>{intensityFilter[1]}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">AI-Detected Patterns</h3>
                  {patterns.length === 0 ? (
                    <p>No significant patterns detected</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center mb-2">
                        <Button 
                          variant={selectedPattern === null ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePatternChange(null)}
                        >
                          All Events
                        </Button>
                      </div>
                      
                      {patterns.map(pattern => (
                        <div key={pattern.id} className="flex flex-col space-y-1">
                          <Button 
                            variant={selectedPattern === pattern.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePatternChange(pattern.id)}
                          >
                            {pattern.name}
                          </Button>
                          {selectedPattern === pattern.id && (
                            <div className="text-sm bg-muted p-2 rounded-md mt-1">
                              <p>{pattern.description}</p>
                              <div className="flex justify-between mt-1">
                                <Badge variant="outline">{pattern.relatedEvents.length} events</Badge>
                                <Badge variant="outline">Confidence: {Math.round(pattern.confidence * 100)}%</Badge>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Maps Panel */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="quadclass">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="quadclass">QuadClass Heatmap</TabsTrigger>
                <TabsTrigger value="general">General Heatmap</TabsTrigger>
              </TabsList>
              
              <TabsContent value="quadclass">
                <Card>
                  <CardHeader>
                    <CardTitle>Events by QuadClass</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      ref={quadClassMapContainerRef} 
                      className="w-full h-96 rounded-md border"
                    ></div>
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-green-500 mr-2"></div>
                        <span className="text-xs">Verbal Coop</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-blue-500 mr-2"></div>
                        <span className="text-xs">Material Coop</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-orange-500 mr-2"></div>
                        <span className="text-xs">Verbal Conflict</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-red-500 mr-2"></div>
                        <span className="text-xs">Material Conflict</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="general">
                <Card>
                  <CardHeader>
                    <CardTitle>General Event Heatmap</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      ref={generalMapContainerRef} 
                      className="w-full h-96 rounded-md border"
                    ></div>
                    <div className="flex flex-col items-center mt-4">
                      <div className="w-full max-w-md h-6 bg-gradient-to-r from-blue-500 via-green-500 to-red-500 rounded-md"></div>
                      <div className="flex justify-between w-full max-w-md text-xs px-2">
                        <span>Low</span>
                        <span>Medium</span>
                        <span>High</span>
                      </div>
                    </div>
                    
                    {selectedPattern && (
                      <div className="mt-4 p-3 bg-muted rounded-md">
                        <h4 className="font-medium">
                          {patterns.find(p => p.id === selectedPattern)?.name} Pattern
                        </h4>
                        <p className="text-sm">
                          {patterns.find(p => p.id === selectedPattern)?.description}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
            
            {/* Stats Card */}
<Card className="mt-4">
  <CardHeader>
    <CardTitle>Event Statistics</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-muted p-3 rounded-md">
        <h4 className="text-sm font-medium">Total Events</h4>
        <p className="text-2xl font-bold">{events.length}</p>
      </div>
      
      <div className="bg-muted p-3 rounded-md">
        <h4 className="text-sm font-medium">Countries</h4>
        <p className="text-2xl font-bold">
          {new Set(events.map(e => e.countryCode)).size}
        </p>
      </div>
      
      <div className="bg-muted p-3 rounded-md">
        <h4 className="text-sm font-medium">Cooperation</h4>
        <p className="text-2xl font-bold">
          {events.filter(e => e.quadclass === 1 || e.quadclass === 2).length}
        </p>
      </div>
      
      <div className="bg-muted p-3 rounded-md">
        <h4 className="text-sm font-medium">Conflict</h4>
        <p className="text-2xl font-bold">
          {events.filter(e => e.quadclass === 3 || e.quadclass === 4).length}
        </p>
      </div>
    </div>
  </CardContent>
</Card>
          </div>
        </div>
      )}
    </div>
  );
}

// Export a page component that renders your app component
export default function Page() {
    return <GeoEventAnalysis />;
  }