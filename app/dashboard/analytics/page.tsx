'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Send, Loader2, BarChart2, PieChart, LineChart, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import axios from 'axios';

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

// Define chat message interface
interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

// Define the component
function GeoEventAnalysis() {
  const router = useRouter();
  // State for events data
  const [events, setEvents] = useState<EventData[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<string | null>(null);
  
  // State for chat
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'ai',
      content: "Welcome! Ask me anything about the geopolitical event data. For example, try 'Show me all events in the US' or 'What countries had the most conflict events?'",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [queryInProgress, setQueryInProgress] = useState<boolean>(false);
  const [usingFallback, setUsingFallback] = useState<boolean>(false);
  
  // Refs
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Force minimum content height
  useEffect(() => {
    document.body.style.minHeight = '1300px';
    document.documentElement.style.minHeight = '1300px';
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    return () => {
      document.body.style.minHeight = '';
      document.documentElement.style.minHeight = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

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
        setFilteredEvents(data); // Initially show all events
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Failed to fetch events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Initialize the map once we have data
  useEffect(() => {
    if (events.length > 0 && !loading) {
      initializeMap();
    }

    // Cleanup map on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [events, loading]);

  // Update map when filtered events change
  useEffect(() => {
    if (mapRef.current && filteredEvents.length > 0) {
      updateMap();
    }
    
    // Generate charts based on the filtered data
    generateCharts();
  }, [filteredEvents]);

  // Scroll to the bottom of chat when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Initialize Mapbox map
  const initializeMap = () => {
    try {
      if (mapContainerRef.current) {
        mapRef.current = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [0, 20],
          zoom: 1.5
        });

        // Add navigation controls
        mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        // Wait for map to load before adding sources and layers
        mapRef.current.on('load', () => {
          addHeatmapLayer();
        });
      }
    } catch (err) {
      console.error("Error initializing map:", err);
      setError("Failed to initialize map. Please refresh the page.");
    }
  };

  // Add heatmap layer
  const addHeatmapLayer = () => {
    if (!mapRef.current) return;

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
    const sourceId = 'events-source';
    if (mapRef.current.getSource(sourceId)) {
      (mapRef.current.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson as any);
    } else {
      mapRef.current.addSource(sourceId, {
        type: 'geojson',
        data: geojson
      });

      // Add heatmap layer
      mapRef.current.addLayer({
        id: 'events-heat',
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
          // Color gradient based on event type
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0, 0, 0, 0)',
            0.2, 'rgba(65, 105, 225, 0.5)', // Blue (cooperation)
            0.4, 'rgba(0, 255, 255, 0.6)',
            0.6, 'rgba(255, 165, 0, 0.7)', // Orange 
            0.8, 'rgba(255, 0, 0, 0.8)',    // Red (conflict)
            1, 'rgba(255, 0, 0, 1)'
          ],
          // Increased radius for better coverage
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 10,
            6, 30,
            10, 50
          ],
          // Keep high opacity
          'heatmap-opacity': 0.9
        }
      });

      // Add point layer for interaction
      mapRef.current.addLayer({
        id: 'events-points',
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 4,
          'circle-color': [
            'match',
            ['get', 'quadclass'],
            1, '#4169E1', // Verbal Cooperation - Blue
            2, '#00BFFF', // Material Cooperation - Light Blue
            3, '#FFA500', // Verbal Conflict - Orange
            4, '#FF0000', // Material Conflict - Red
            '#888888'     // Default - Gray
          ],
          'circle-opacity': 0.7,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#FFFFFF'
        },
        'maxzoom': 14 // Only show points at high zoom levels
      });

      // Add popup on click
      mapRef.current.on('click', 'events-points', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const props = feature.properties;
          
          if (props) {
            const quadClassNames = {
              1: 'Verbal Cooperation',
              2: 'Material Cooperation',
              3: 'Verbal Conflict',
              4: 'Material Conflict'
            };
            
            const coordinates = feature.geometry.coordinates.slice();
            
            new mapboxgl.Popup()
              .setLngLat(coordinates as [number, number])
              .setHTML(`
                <strong>${props.fullname || 'Unknown Location'}</strong><br>
                <span>${quadClassNames[props.quadclass as keyof typeof quadClassNames] || 'Unknown Type'}</span><br>
                <span>Goldstein Score: ${props.goldsteinscore}</span><br>
                ${props.source ? `<a href="${props.source}" target="_blank" rel="noopener noreferrer">Source</a>` : ''}
              `)
              .addTo(mapRef.current);
          }
        }
      });
      
      // Change cursor on hover
      mapRef.current.on('mouseenter', 'events-points', () => {
        if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'pointer';
      });
      
      mapRef.current.on('mouseleave', 'events-points', () => {
        if (mapRef.current) mapRef.current.getCanvas().style.cursor = '';
      });
    }
  };

  // Update map when filtered events change
  const updateMap = () => {
    if (!mapRef.current) return;
    
    // Create updated GeoJSON
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

    // Update source data
    const sourceId = 'events-source';
    if (mapRef.current.getSource(sourceId)) {
      (mapRef.current.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson as any);
    }
    
    // Fit map to the filtered data points
    if (filteredEvents.length > 0 && filteredEvents.length < events.length) {
      // Only adjust bounds if we're filtering to a subset
      const bounds = new mapboxgl.LngLatBounds();
      
      filteredEvents.forEach(event => {
        bounds.extend([event.coordinates[1], event.coordinates[0]]);
      });
      
      mapRef.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 6
      });
    } else if (filteredEvents.length === events.length) {
      // Reset to world view if showing all events
      mapRef.current.flyTo({
        center: [0, 20],
        zoom: 1.5
      });
    }
  };

  // Generate dynamic charts based on filtered data
  const generateCharts = () => {
    if (filteredEvents.length === 0) {
      setActiveChart(null);
      return;
    }
    
    // Set a default chart if none is active
    if (!activeChart) {
      setActiveChart('quadclass');
    }
  };

  // Generate Chart HTML based on chart type
  const getChartHTML = () => {
    if (!activeChart || filteredEvents.length === 0) {
      return '<div class="flex items-center justify-center h-full"><p class="text-gray-400">Select a chart type or filter the data to view charts</p></div>';
    }
    
    if (activeChart === 'quadclass') {
      // Count events by quadclass
      const quadClassCounts = {
        1: 0, // Verbal Cooperation
        2: 0, // Material Cooperation
        3: 0, // Verbal Conflict
        4: 0  // Material Conflict
      };
      
      filteredEvents.forEach(event => {
        if (event.quadclass in quadClassCounts) {
          quadClassCounts[event.quadclass]++;
        }
      });
      
      // Create pie chart HTML
      return `
        <div class="flex flex-col items-center">
          <h3 class="text-lg font-medium mb-2 text-gray-400">Event Types Distribution</h3>
          <div class="relative w-64 h-64">
            <svg viewBox="0 0 100 100" class="w-full h-full">
              <!-- Pie chart segments -->
              <circle r="25" cx="50" cy="50" fill="transparent" stroke="#4169E1" stroke-width="50" stroke-dasharray="${calculatePieSegment(quadClassCounts[1], filteredEvents.length)}" stroke-dashoffset="0" transform="rotate(-90 50 50)" />
              <circle r="25" cx="50" cy="50" fill="transparent" stroke="#00BFFF" stroke-width="50" stroke-dasharray="${calculatePieSegment(quadClassCounts[2], filteredEvents.length)}" stroke-dashoffset="${calculatePieOffset(quadClassCounts[1], filteredEvents.length)}" transform="rotate(-90 50 50)" />
              <circle r="25" cx="50" cy="50" fill="transparent" stroke="#FFA500" stroke-width="50" stroke-dasharray="${calculatePieSegment(quadClassCounts[3], filteredEvents.length)}" stroke-dashoffset="${calculatePieOffset(quadClassCounts[1] + quadClassCounts[2], filteredEvents.length)}" transform="rotate(-90 50 50)" />
              <circle r="25" cx="50" cy="50" fill="transparent" stroke="#FF0000" stroke-width="50" stroke-dasharray="${calculatePieSegment(quadClassCounts[4], filteredEvents.length)}" stroke-dashoffset="${calculatePieOffset(quadClassCounts[1] + quadClassCounts[2] + quadClassCounts[3], filteredEvents.length)}" transform="rotate(-90 50 50)" />
              <circle r="12.5" cx="50" cy="50" fill="#2d3748" />
            </svg>
          </div>
          <div class="grid grid-cols-2 gap-2 mt-4 text-gray-400">
            <div class="flex items-center">
              <div class="w-4 h-4 bg-blue-600 mr-2"></div>
              <span>Verbal Cooperation (${quadClassCounts[1]})</span>
            </div>
            <div class="flex items-center">
              <div class="w-4 h-4 bg-blue-400 mr-2"></div>
              <span>Material Cooperation (${quadClassCounts[2]})</span>
            </div>
            <div class="flex items-center">
              <div class="w-4 h-4 bg-orange-500 mr-2"></div>
              <span>Verbal Conflict (${quadClassCounts[3]})</span>
            </div>
            <div class="flex items-center">
              <div class="w-4 h-4 bg-red-500 mr-2"></div>
              <span>Material Conflict (${quadClassCounts[4]})</span>
            </div>
          </div>
        </div>
      `;
    } else if (activeChart === 'country') {
      // Count events by country
      const countryCounts = {};
      filteredEvents.forEach(event => {
        if (event.countryCode) {
          if (!countryCounts[event.countryCode]) {
            countryCounts[event.countryCode] = 0;
          }
          countryCounts[event.countryCode]++;
        }
      });
      
      // Sort countries by count
      const sortedCountries = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10 countries
      
      // Find max value for scaling
      const maxCount = sortedCountries.length > 0 ? sortedCountries[0][1] : 0;
      
      // Create bar chart HTML
      let bars = '';
      sortedCountries.forEach(([country, count], index) => {
        const barWidth = (count / maxCount * 100);
        bars += `
          <div class="flex items-center mb-2">
            <div class="w-10 text-right mr-2 text-gray-400">${country}</div>
            <div class="flex-1 bg-gray-700 rounded-full h-4">
              <div class="bg-indigo-500 h-4 rounded-full" style="width: ${barWidth}%"></div>
            </div>
            <div class="ml-2 text-gray-400">${count}</div>
          </div>
        `;
      });
      
      return `
        <div class="w-full">
          <h3 class="text-lg font-medium mb-4 text-gray-400">Top Countries</h3>
          ${bars || '<p class="text-gray-500">No country data available</p>'}
        </div>
      `;
    } else if (activeChart === 'goldstein') {
      // Group events by Goldstein score ranges
      const scoreRanges = {
        'Very Negative (-10 to -7)': 0,
        'Negative (-7 to -3)': 0,
        'Slightly Negative (-3 to 0)': 0,
        'Slightly Positive (0 to 3)': 0,
        'Positive (3 to 7)': 0,
        'Very Positive (7 to 10)': 0
      };
      
      filteredEvents.forEach(event => {
        const score = event.goldsteinscore;
        if (score <= -7) scoreRanges['Very Negative (-10 to -7)']++;
        else if (score <= -3) scoreRanges['Negative (-7 to -3)']++;
        else if (score < 0) scoreRanges['Slightly Negative (-3 to 0)']++;
        else if (score < 3) scoreRanges['Slightly Positive (0 to 3)']++;
        else if (score < 7) scoreRanges['Positive (3 to 7)']++;
        else scoreRanges['Very Positive (7 to 10)']++;
      });
      
      // Find max value for scaling
      const maxCount = Math.max(...Object.values(scoreRanges));
      
      // Create bar chart HTML
      let bars = '';
      Object.entries(scoreRanges).forEach(([range, count], index) => {
        const barWidth = (count / maxCount * 100);
        const colors = ['bg-red-600', 'bg-red-400', 'bg-orange-400', 'bg-green-300', 'bg-green-500', 'bg-green-700'];
        bars += `
          <div class="flex items-center mb-2">
            <div class="w-40 text-right mr-2 text-xs text-gray-400">${range}</div>
            <div class="flex-1 bg-gray-700 rounded-full h-4">
              <div class="${colors[index]} h-4 rounded-full" style="width: ${barWidth}%"></div>
            </div>
            <div class="ml-2 text-gray-400">${count}</div>
          </div>
        `;
      });
      
      return `
        <div class="w-full">
          <h3 class="text-lg font-medium mb-4 text-gray-400">Goldstein Score Distribution</h3>
          ${bars || '<p class="text-gray-500">No score data available</p>'}
        </div>
      `;
    }
    
    return '<div class="flex items-center justify-center h-full"><p class="text-gray-400">Select a chart type</p></div>';
  };

  // Helper function to calculate pie chart segment dasharray
  const calculatePieSegment = (count, total) => {
    const percentage = count / total;
    return `${percentage * 157.08} ${157.08 - (percentage * 157.08)}`;
  };

  // Helper function to calculate pie chart segment dashoffset
  const calculatePieOffset = (previousCount, total) => {
    const percentage = previousCount / total;
    return `${-percentage * 157.08}`;
  };

  // Client-side fallback for natural language processing
  const clientSideQueryProcessing = (query: string) => {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Extract country code
    let countryFilter = null;
    if (normalizedQuery.includes(' in us') || normalizedQuery.includes(' in the us') || 
        normalizedQuery.includes(' in united states') || normalizedQuery.includes(' in the united states')) {
      countryFilter = 'US';
    } else if (normalizedQuery.includes(' in uk') || normalizedQuery.includes(' in the uk') || 
               normalizedQuery.includes(' in united kingdom') || normalizedQuery.includes(' in the united kingdom')) {
      countryFilter = 'GB';
    } else if (normalizedQuery.includes(' in canada') || normalizedQuery.includes(' in the canada')) {
      countryFilter = 'CA';
    }
    // Add more country checks as needed
    
    // Extract event types
    const eventTypeFilters = {
      cooperation: normalizedQuery.includes('cooperation'),
      conflict: normalizedQuery.includes('conflict'),
      verbal: normalizedQuery.includes('verbal'),
      material: normalizedQuery.includes('material')
    };
    
    // Extract Goldstein score filtering
    let goldsteinMin = -10;
    let goldsteinMax = 10;
    
    if (normalizedQuery.includes('above') || normalizedQuery.includes('greater than')) {
      const scoreMatch = normalizedQuery.match(/(above|greater than|>)\s+(\d+)/);
      if (scoreMatch && scoreMatch[2]) {
        goldsteinMin = parseInt(scoreMatch[2]);
      }
    }
    
    if (normalizedQuery.includes('below') || normalizedQuery.includes('less than')) {
      const scoreMatch = normalizedQuery.match(/(below|less than|<)\s+(\d+)/);
      if (scoreMatch && scoreMatch[2]) {
        goldsteinMax = parseInt(scoreMatch[2]);
      }
    }
    
    // Apply filters
    let filtered = [...events];
    
    // Apply country filter
    if (countryFilter) {
      filtered = filtered.filter(event => event.countryCode === countryFilter);
    }
    
    // Apply event type filters
    if (eventTypeFilters.cooperation && !eventTypeFilters.conflict) {
      filtered = filtered.filter(event => event.quadclass === 1 || event.quadclass === 2);
      
      if (eventTypeFilters.verbal) {
        filtered = filtered.filter(event => event.quadclass === 1);
      } else if (eventTypeFilters.material) {
        filtered = filtered.filter(event => event.quadclass === 2);
      }
    } else if (eventTypeFilters.conflict && !eventTypeFilters.cooperation) {
      filtered = filtered.filter(event => event.quadclass === 3 || event.quadclass === 4);
      
      if (eventTypeFilters.verbal) {
        filtered = filtered.filter(event => event.quadclass === 3);
      } else if (eventTypeFilters.material) {
        filtered = filtered.filter(event => event.quadclass === 4);
      }
    } else if (eventTypeFilters.verbal) {
      filtered = filtered.filter(event => event.quadclass === 1 || event.quadclass === 3);
    } else if (eventTypeFilters.material) {
      filtered = filtered.filter(event => event.quadclass === 2 || event.quadclass === 4);
    }
    
    // Apply Goldstein score filters
    filtered = filtered.filter(event => 
      event.goldsteinscore >= goldsteinMin && 
      event.goldsteinscore <= goldsteinMax
    );
    
    // Generate response message
    let responseMessage = "";
    
    if (filtered.length === 0) {
      responseMessage = "I couldn't find any events matching your criteria.";
    } else if (filtered.length === events.length) {
      responseMessage = "Showing all events. You can be more specific with your query to filter the results.";
    } else {
      // Country-specific response
      if (countryFilter) {
        responseMessage = `Found ${filtered.length} events in ${countryFilter === 'US' ? 'the United States' : countryFilter === 'GB' ? 'the United Kingdom' : countryFilter}.`;
      } else {
        responseMessage = `Found ${filtered.length} events matching your criteria.`;
      }
      
      // Add event type info
      if (eventTypeFilters.cooperation && !eventTypeFilters.conflict) {
        responseMessage += ` These are cooperation events`;
        if (eventTypeFilters.verbal) responseMessage += ` of the verbal type.`;
        else if (eventTypeFilters.material) responseMessage += ` of the material type.`;
        else responseMessage += `.`;
      } else if (eventTypeFilters.conflict && !eventTypeFilters.cooperation) {
        responseMessage += ` These are conflict events`;
        if (eventTypeFilters.verbal) responseMessage += ` of the verbal type.`;
        else if (eventTypeFilters.material) responseMessage += ` of the material type.`;
        else responseMessage += `.`;
      }
      
      // Add Goldstein info
      if (goldsteinMin > -10 || goldsteinMax < 10) {
        responseMessage += ` Goldstein scores are between ${goldsteinMin} and ${goldsteinMax}.`;
      }
    }
    
    return {
      message: responseMessage,
      filteredEvents: filtered
    };
  };

  // Process query with ArangoDB Langchain or fallback to client-side processing
  const processNaturalLanguageQuery = async () => {
    if (!input.trim()) return;
    
    try {
      // Add user message
      setMessages(prev => [
        ...prev, 
        { role: 'user', content: input, timestamp: new Date() }
      ]);
      
      // Add loading message
      setMessages(prev => [
        ...prev, 
        { role: 'ai', content: '...', timestamp: new Date(), isLoading: true }
      ]);
      
      setQueryInProgress(true);
      const userQuery = input;
      setInput(''); // Clear input field
      
      // Try server API first
      try {
        const response = await axios.post('/api/natural-language-query', {
          query: userQuery
        });
        
        // Remove loading message
        setMessages(prev => prev.filter(msg => !msg.isLoading));
        
        // Add AI response
        setMessages(prev => [
          ...prev, 
          { role: 'ai', content: response.data.answer, timestamp: new Date() }
        ]);
        
        // Filter events if results were returned
        if (response.data.aqlResult && Array.isArray(response.data.aqlResult)) {
          setFilteredEvents(response.data.aqlResult);
        }
        
        setUsingFallback(false);
        
        // Set appropriate chart based on query
        if (userQuery.toLowerCase().includes('countr')) {
          setActiveChart('country');
        } else if (userQuery.toLowerCase().includes('goldstein') || 
                  userQuery.toLowerCase().includes('score')) {
          setActiveChart('goldstein');
        } else if (userQuery.toLowerCase().includes('type') || 
                  userQuery.toLowerCase().includes('cooperation') || 
                  userQuery.toLowerCase().includes('conflict')) {
          setActiveChart('quadclass');
        }
        
      } catch (apiError) {
        console.warn('API request failed, falling back to client-side processing:', apiError);
        
        // Fall back to client-side processing
        const result = clientSideQueryProcessing(userQuery);
        
        // Remove loading message
        setMessages(prev => prev.filter(msg => !msg.isLoading));
        
        // Add AI response from client-side processing
        setMessages(prev => [
          ...prev, 
          { 
            role: 'ai', 
            content: result.message + "\n\n(Note: I'm currently using basic text matching since the database query service is unavailable.)",
            timestamp: new Date() 
          }
        ]);
        
        // Update filtered events
        setFilteredEvents(result.filteredEvents);
        
        setUsingFallback(true);
        
        // Set appropriate chart based on query
        if (userQuery.toLowerCase().includes('countr')) {
          setActiveChart('country');
        } else if (userQuery.toLowerCase().includes('goldstein') || 
                  userQuery.toLowerCase().includes('score')) {
          setActiveChart('goldstein');
        } else if (userQuery.toLowerCase().includes('type') || 
                  userQuery.toLowerCase().includes('cooperation') || 
                  userQuery.toLowerCase().includes('conflict')) {
          setActiveChart('quadclass');
        }
      }
      
    } catch (error) {
      console.error('Error processing query:', error);
      
      // Remove loading message
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      
      // Add error message
      setMessages(prev => [
        ...prev, 
        { 
          role: 'ai', 
          content: 'Sorry, I encountered an error processing your query. Please try again.',
          timestamp: new Date() 
        }
      ]);
    } finally {
        setQueryInProgress(false);
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processNaturalLanguageQuery();
  };

  // Handle keypress
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      processNaturalLanguageQuery();
    }
  };

  // Reset to show all events
  const resetView = () => {
    setFilteredEvents(events);
    
    // Add system message
    setMessages(prev => [
      ...prev, 
      { 
        role: 'ai', 
        content: 'View reset to show all events.',
        timestamp: new Date() 
      }
    ]);
  };

  return (
    <div className="w-full min-h-screen bg-gray-800 text-gray-400">
      <header className="w-full bg-gray-900 shadow-sm py-4 px-6 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-white">Geopolitical Event Analysis</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Back button */}
          <Button 
            variant="outline"
            onClick={() => router.push('/home')}
            className="flex items-center gap-2"
          >
            <Home className="h-5 w-5" />
            Back to Dashboard
          </Button>
          
          {/* Chart type selector */}
          <div className="hidden md:flex space-x-2">
            <Button 
              variant={activeChart === 'quadclass' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveChart('quadclass')}
              className="flex items-center gap-1"
            >
              <PieChart className="h-4 w-4" />
              Event Types
            </Button>
            <Button 
              variant={activeChart === 'country' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setActiveChart('country')}
              className="flex items-center gap-1"
            >
              <BarChart2 className="h-4 w-4" />
              Countries
            </Button>
            <Button 
              variant={activeChart === 'goldstein' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setActiveChart('goldstein')}
              className="flex items-center gap-1"
            >
              <LineChart className="h-4 w-4" />
              Goldstein
            </Button>
          </div>
        </div>
      </header>
      
      {error && (
        <Alert className="m-6">
          <Info className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {usingFallback && (
        <Alert className="mx-6 mt-2">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Using simplified text matching for queries. For full AI-powered search, ensure the ArangoDB and Langchain packages are installed.
          </AlertDescription>
        </Alert>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center h-64 m-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Map Area - Spans 2 columns */}
          <div className="md:col-span-2 space-y-6">
            {/* Map Card with dark background */}
            <Card className="bg-gray-700 border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white">Global Events Heatmap</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={resetView}
                >
                  Reset View
                </Button>
              </CardHeader>
              <CardContent>
                <div 
                  ref={mapContainerRef} 
                  className="w-full h-[400px] rounded-md border"
                ></div>
                
                <div className="flex flex-col items-center mt-4">
                  <div className="w-full max-w-md h-6 bg-gradient-to-r from-blue-500 via-cyan-400 to-red-500 rounded-md"></div>
                  <div className="flex justify-between w-full max-w-md mt-1">
                    <span className="text-xs">Cooperation</span>
                    <span className="text-xs">Conflict</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Dynamic Chart Card */}
            <Card className="bg-gray-700 border-0 shadow-md pb-10">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white">
                  {activeChart === 'quadclass' && 'Event Types Distribution'}
                  {activeChart === 'country' && 'Events by Country'}
                  {activeChart === 'goldstein' && 'Goldstein Score Distribution'}
                  {!activeChart && 'Data Visualization'}
                </CardTitle>
                <div className="flex md:hidden space-x-2">
                  <Button 
                    variant={activeChart === 'quadclass' ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setActiveChart('quadclass')}
                  >
                    <PieChart className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={activeChart === 'country' ? 'default' : 'outline'} 
                    size="icon"
                    onClick={() => setActiveChart('country')}
                  >
                    <BarChart2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={activeChart === 'goldstein' ? 'default' : 'outline'} 
                    size="icon"
                    onClick={() => setActiveChart('goldstein')}
                  >
                    <LineChart className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div 
                  ref={chartContainerRef}
                  className="w-full h-[300px] flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: getChartHTML() }}
                ></div>
              </CardContent>
            </Card>
            
            {/* Stats Card */}
            <Card className="bg-gray-700 border-0 shadow-md">
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-400">Total Events</h4>
                    <p className="text-2xl font-bold text-white">{events.length}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-400">Filtered Events</h4>
                    <p className="text-2xl font-bold text-white">{filteredEvents.length}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-400">Countries</h4>
                    <p className="text-2xl font-bold text-white">
                      {new Set(filteredEvents.map(e => e.countryCode)).size}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Chat Interface - Takes up 1 column */}
          <div className="md:col-span-1">
            <Card className="h-full bg-gray-700 border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-white">Ask About Events</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col h-[calc(100vh-12rem)]">
                <div 
                  ref={chatContainerRef}
                  className="flex-grow overflow-y-auto mb-4 space-y-4 max-h-[calc(100vh-16rem)]"
                >
                  {messages.map((message, index) => (
                    <div 
                      key={index} 
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`rounded-lg px-4 py-2 max-w-[85%] ${
                          message.role === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-600 text-gray-100'
                        }`}
                      >
                        {message.isLoading ? (
                          <div className="flex items-center space-x-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Thinking...</span>
                          </div>
                        ) : (
                          <div>{message.content}</div>
                        )}
                        <div className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about the events data..."
                    className="flex-grow rounded-lg border border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-800 text-gray-200"
                    disabled={queryInProgress}
                  />
                  <Button 
                    type="submit" 
                    size="icon"
                    disabled={queryInProgress}
                  >
                    {queryInProgress ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
                
                <div className="mt-4 text-xs text-gray-400">
                  <p>Try asking:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Show events in the United States</li>
                    <li>Show conflict events</li>
                    <li>Show cooperation events</li>
                    <li>Show events with Goldstein scores above 5</li>
                  </ul>
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