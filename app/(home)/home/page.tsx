'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserButton, SignOutButton } from "@clerk/nextjs";
import Earth3D from '@/components/Earth3D';
import axios from 'axios';

export default function HomePage() {
  const router = useRouter();
  const [mapHeight, setMapHeight] = useState(1200);
  const [eventData, setEventData] = useState([]);
  const [filteredEventData, setFilteredEventData] = useState([]);
  const [visibleEventCount, setVisibleEventCount] = useState(10);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isNaturalLanguageQuery, setIsNaturalLanguageQuery] = useState(false);
  const [queryInProgress, setQueryInProgress] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  
  // Filter states
  const [eventTypeFilters, setEventTypeFilters] = useState({
    'Verbal Cooperation': true,
    'Material Cooperation': true,
    'Verbal Conflict': true,
    'Material Conflict': true
  });
  const [selectedCountry, setSelectedCountry] = useState('');
  const [goldsteinMin, setGoldsteinMin] = useState(-10);
  const [goldsteinMax, setGoldsteinMax] = useState(10);
  const [selectedActorFilter, setSelectedActorFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [countries, setCountries] = useState([]);
  const [actorFilters, setActorFilters] = useState([]);
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  
  const updatesContainerRef = useRef(null);

  // Process natural language query
  const processNaturalLanguageQuery = async () => {
    if (!textFilter.trim()) return;
    
    try {
      setQueryInProgress(true);
      setIsNaturalLanguageQuery(true);
      
      const response = await axios.post('/api/natural-language-query', {
        query: textFilter
      });
      
      setQueryResult(response.data);
      
      // Check if we're using the fallback system
      if (response.data.usingFallback) {
        setUsingFallback(true);
      } else {
        setUsingFallback(false);
      }
      
      // If there are results, apply them to the filtered events
      if (response.data.aqlResult && Array.isArray(response.data.aqlResult)) {
        setFilteredEventData(response.data.aqlResult);
        setIsFilterApplied(true);
      } else if (response.data.answer) {
        // Handle case where there's an answer but no direct results to display
        console.log("Natural language query answer:", response.data.answer);
      }
      
    } catch (error) {
      console.error('Error processing natural language query:', error);
      // Handle error by doing client-side processing
      handleClientSideProcessing();
    } finally {
      setQueryInProgress(false);
    }
  };
  
  // Client-side fallback for processing queries
  const handleClientSideProcessing = () => {
    // Local implementation of the query processing
    const normalizedQuery = textFilter.toLowerCase().trim();
    
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
    let filtered = [...eventData];
    
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
    } else if (filtered.length === eventData.length) {
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
    
    // Update state
    setFilteredEventData(filtered);
    setIsFilterApplied(true);
    setUsingFallback(true);
    setQueryResult({
      answer: responseMessage,
      aqlResult: filtered
    });
  };
  
  // Detect if input is likely a natural language query
  const isLikelyNaturalLanguageQuery = (text) => {
    if (!text) return false;
    
    // Always treat text with a question mark as a natural language query
    if (text.includes('?')) {
      return true;
    }
    
    // Check if text contains question words or phrases
    const questionPatterns = [
      /^(what|where|when|which|who|whose|whom|why|how)/i,
      /^(show|find|get|give|list|display|tell)/i,
      /^(is|are|can|could|do|does|did|has|have|should|would|will)/i,
      /(show me|tell me|can you|could you|would you|find|list|get|give)/i
    ];
    
    return questionPatterns.some(pattern => pattern.test(text.trim()));
  };

  // Handle text filter change
  const handleTextFilterChange = (e) => {
    const newValue = e.target.value;
    setTextFilter(newValue);
    
    // Check if the input looks like a natural language query
    setIsNaturalLanguageQuery(isLikelyNaturalLanguageQuery(newValue));
  };

  // Handle key press in text filter input
  const handleTextFilterKeyPress = (e) => {
    if (e.key === 'Enter' && isNaturalLanguageQuery) {
      processNaturalLanguageQuery();
    }
  };
  
  // Fetch event data from webhook
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/events');
        setEventData(response.data);
        
        // Extract unique countries and actor types for the dropdowns
        const uniqueCountries = [...new Set(
          response.data
            .map(event => event.countryCode)
            .filter(Boolean)
        )].sort();
        
        const uniqueActorTypes = [...new Set(
          response.data
            .map(event => event.actorFilter)
            .filter(Boolean)
        )].sort();
        
        setCountries(uniqueCountries);
        setActorFilters(uniqueActorTypes);
        
        // Set filtered data initially (before any filters applied)
        if (!isFilterApplied) {
          setFilteredEventData(response.data);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching event data:', error);
        setLoading(false);
      }
    };
    
    fetchEvents();
    
    // Auto-refresh data every 5 minutes
    const intervalId = setInterval(fetchEvents, 300000);
    
    return () => clearInterval(intervalId);
  }, [isFilterApplied]);
  
  // Map quadclass to readable event type names
  const quadClassToEventType = {
    1: 'Verbal Cooperation',
    2: 'Material Cooperation',
    3: 'Verbal Conflict',
    4: 'Material Conflict'
  };
  
  // Map event type names back to quadclass values
  const eventTypeToQuadClass = {
    'Verbal Cooperation': 1,
    'Material Cooperation': 2,
    'Verbal Conflict': 3,
    'Material Conflict': 4
  };
  
  // Function to send filters to backend
  const sendFiltersToBackend = async (filters) => {
    try {
      const response = await axios.post('/api/filter-events', filters);
      return response.data;
    } catch (error) {
      console.error('Error sending filters to backend:', error);
      return [];
    }
  };
  
  // Apply filters when user clicks the Apply button
  const applyFilters = async () => {
    if (!eventData.length) return;
    
    // If it's a natural language query, process it differently
    if (isNaturalLanguageQuery) {
      processNaturalLanguageQuery();
      return;
    }
    
    setLoading(true);
    
    // Convert event type filters from names to quadclass values for the backend
    const activeQuadClasses = Object.entries(eventTypeFilters)
      .filter(([type, isActive]) => isActive)
      .map(([type]) => eventTypeToQuadClass[type]);
    
    // Create filter payload for backend
    const filterPayload = {
      eventTypes: activeQuadClasses,
      country: selectedCountry,
      goldsteinMin: parseFloat(goldsteinMin),
      goldsteinMax: parseFloat(goldsteinMax),
      searchText: textFilter,
      actorFilter: selectedActorFilter
    };
    
    console.log('Sending filters to backend:', filterPayload);
    
    try {
      // Option 1: Use backend filtering
      const filteredResults = await sendFiltersToBackend(filterPayload);
      setFilteredEventData(filteredResults);
      
      // Option 2: Client-side filtering (fallback)
      if (!filteredResults || filteredResults.length === 0) {
        // Perform client-side filtering
        const filtered = eventData.filter(event => {
          // Filter by event type
          if (!activeQuadClasses.includes(event.quadclass)) return false;
          
          // Filter by country
          if (selectedCountry && event.countryCode !== selectedCountry) return false;
          
          // Filter by actor type
          if (selectedActorFilter && event.actorFilter !== selectedActorFilter) return false;
          
          // Filter by Goldstein scale range
          const score = event.goldsteinscore || 0;
          if (score < parseFloat(goldsteinMin) || score > parseFloat(goldsteinMax)) return false;
          
          // Filter by text input (search in location name, source URL, or actor type)
          if (textFilter) {
            const searchText = textFilter.toLowerCase();
            const fullnameMatch = event.fullname?.toLowerCase()?.includes(searchText) || false;
            const sourceMatch = event.source?.toLowerCase()?.includes(searchText) || false;
            const countryMatch = event.countryCode?.toLowerCase()?.includes(searchText) || false;
            const actorCountryMatch = event.actorCountryCode?.toLowerCase()?.includes(searchText) || false;
            const actorFilterMatch = event.actorFilter?.toLowerCase()?.includes(searchText) || false;
            
            if (!(fullnameMatch || sourceMatch || countryMatch || actorCountryMatch || actorFilterMatch)) return false;
          }
          
          return true;
        });
        
        setFilteredEventData(filtered);
      }
      
      // Set filter as applied
      setIsFilterApplied(true);
      
    } catch (error) {
      console.error('Error applying filters:', error);
    } finally {
      setLoading(false);
      // Reset visible count when filters change
      setVisibleEventCount(10);
    }
  };
  
  // Initialize filtered data with all events
  useEffect(() => {
    if (eventData.length > 0 && !isFilterApplied) {
      setFilteredEventData(eventData);
    }
  }, [eventData, isFilterApplied]);
  
  // Force minimum content height
  useEffect(() => {
    document.body.style.minHeight = '1500px';
    document.documentElement.style.minHeight = '1500px';
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    return () => {
      document.body.style.minHeight = '';
      document.documentElement.style.minHeight = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  // Implement infinite scroll
  const handleScroll = useCallback(() => {
    if (!updatesContainerRef.current) return;
    
    const container = updatesContainerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    
    // Load more items when user scrolls to bottom (with a 200px threshold)
    if (scrollHeight - scrollTop - clientHeight < 200 && !loadingMore && visibleEventCount < filteredEventData.length) {
      setLoadingMore(true);
      
      // Simulate loading delay
      setTimeout(() => {
        setVisibleEventCount(prev => Math.min(prev + 10, filteredEventData.length));
        setLoadingMore(false);
      }, 500);
    }
  }, [visibleEventCount, filteredEventData.length, loadingMore]);

  // Add scroll event listener
  useEffect(() => {
    const container = updatesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Helper function to get event name based on quadclass
  const getEventTypeName = (quadClass) => {
    switch (quadClass) {
      case 1: return 'Verbal Cooperation';
      case 2: return 'Material Cooperation';
      case 3: return 'Verbal Conflict';
      case 4: return 'Material Conflict';
      default: return 'Unknown Event Type';
    }
  };
  
  // Helper function to format source URL
  const formatSourceUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return url;
    }
  };
  
  // Handle event type toggle
  const toggleEventType = (eventType) => {
    setEventTypeFilters(prev => ({
      ...prev,
      [eventType]: !prev[eventType]
    }));
  };
  
  // Clear all filters
  const clearFilters = () => {
    setEventTypeFilters({
      'Verbal Cooperation': true,
      'Material Cooperation': true,
      'Verbal Conflict': true,
      'Material Conflict': true
    });
    setSelectedCountry('');
    setGoldsteinMin(-10);
    setGoldsteinMax(10);
    setSelectedActorFilter('');
    setTextFilter('');
    setIsNaturalLanguageQuery(false);
    setQueryResult(null);
    setUsingFallback(false);
    
    if (isFilterApplied) {
      setFilteredEventData(eventData);
      setIsFilterApplied(false);
    }
  };

  return (
    <div className="min-h-[1500px] bg-gray-900 text-white overflow-y-auto">
      <header className="p-6 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900 z-10">
        <div className="flex items-center">
          <div className="text-3xl font-bold mr-8">
            <span>Sp</span>
            <span className="relative">
              <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">o</span>
            </span>
            <span>tlight</span>
          </div>
          
          {/* Navigation Buttons */}
          <div className="hidden md:flex space-x-4">
          <Link href="/dashboard/agents">
            <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors">
              Workflows
            </button>
          </Link>
            <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors">
              Funding
            </button>
            <Link href="/dashboard/analytics">
            <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors">
              Analytics
            </button>
          </Link>
            <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors">
              Documents
            </button>
            <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors">
              Tasks
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Sign Out Button */}
          <SignOutButton>
            <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
              Sign Out
            </button>
          </SignOutButton>
          
          {/* User Profile Button */}
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>
      
      <main className="p-6">
        <h1 className="text-4xl font-bold mb-6">Dashboard Home</h1>
        <p className="text-xl text-gray-300 mb-8">
          Welcome to your Spotlight dashboard. You've successfully authenticated!
        </p>
        
        {/* 3D Earth Map with adjustable height */}
        <div className="bg-gray-800 p-6 rounded-lg mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Global Visualization</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">Size:</span>
              <div className="flex items-center">
                <span className="mr-2 text-sm text-gray-400">Small</span>
                <input 
                  type="range" 
                  min="300" 
                  max="1200" 
                  step="50" 
                  value={mapHeight} 
                  onChange={(e) => setMapHeight(parseInt(e.target.value))}
                  className="w-28 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="ml-2 text-sm text-gray-400">Large</span>
              </div>
              <span className="text-xs text-gray-500 min-w-[60px] text-right">{mapHeight}px</span>
            </div>
          </div>
          <p className="mb-4">Explore our interactive 3D map with global data points. Use the slider above to adjust the map size.</p>
          <div className="w-full rounded-lg overflow-hidden">
            <Earth3D 
              height={mapHeight} 
              initialZoom={0} 
              events={filteredEventData} 
            />
          </div>
        </div>
        
        {/* Additional Content */}
        <div className="mt-8">
          <h2 className="text-3xl font-bold mb-6">Event Filters</h2>
          
          {/* Filter Card */}
          <div className="bg-gray-800 p-6 rounded-lg mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Filter Events</h3>
              <button 
                onClick={clearFilters}
                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
              >
                Clear All Filters
              </button>
            </div>
            
            {/* Event Type Toggle Buttons */}
            <div className="mb-6">
              <h4 className="font-semibold mb-2">Event Type</h4>
              <div className="flex flex-wrap gap-3">
                {Object.keys(eventTypeFilters).map((eventType) => (
                  <button
                    key={eventType}
                    onClick={() => toggleEventType(eventType)}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      eventTypeFilters[eventType] 
                        ? 'bg-emerald-600 hover:bg-emerald-700' 
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
                    }`}
                  >
                    {eventType}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* Country Dropdown */}
              <div>
                <label htmlFor="country-filter" className="block font-semibold mb-2">
                  Country
                </label>
                <select
                  id="country-filter"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white border border-gray-600 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">All Countries</option>
                  {countries.map(country => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Actor Filter Dropdown */}
              <div>
                <label htmlFor="actor-filter" className="block font-semibold mb-2">
                  Actor Type
                </label>
                <select
                  id="actor-filter"
                  value={selectedActorFilter}
                  onChange={(e) => setSelectedActorFilter(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white border border-gray-600 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">All Actor Types</option>
                  {actorFilters.map(actorType => (
                    <option key={actorType} value={actorType}>
                      {actorType}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Goldstein Scale Range Inputs */}
              <div className="col-span-2">
                <label className="block font-semibold mb-2">
                  Goldstein Scale Range (-10 to 10)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="-10"
                    max="10"
                    step="0.1"
                    value={goldsteinMin}
                    onChange={(e) => setGoldsteinMin(Math.min(parseFloat(e.target.value), goldsteinMax))}
                    className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white border border-gray-600 focus:border-emerald-500 focus:outline-none"
                    placeholder="Min (-10)"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="number"
                    min="-10"
                    max="10"
                    step="0.1"
                    value={goldsteinMax}
                    onChange={(e) => setGoldsteinMax(Math.max(parseFloat(e.target.value), goldsteinMin))}
                    className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white border border-gray-600 focus:border-emerald-500 focus:outline-none"
                    placeholder="Max (10)"
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>Low Destabilizing Risk (-10)</span>
                  <span>Neutral (0)</span>
                  <span>High Destabilizing Risk (10)</span>
                </div>
              </div>
              
              {/* Text Search Input with Natural Language Query Support */}
              <div className="col-span-4">
                <label htmlFor="text-filter" className="flex items-center font-semibold mb-2">
                  {isNaturalLanguageQuery ? 'Natural Language Query' : 'Search or Ask a Question'}
                  <span className="ml-2 text-xs bg-indigo-600 px-2 py-0.5 rounded-full">
                    AI Powered
                  </span>
                  {usingFallback && (
                    <span className="ml-2 text-xs bg-orange-600 px-2 py-0.5 rounded-full">
                      Langchain
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    id="text-filter"
                    type="text"
                    value={textFilter}
                    onChange={handleTextFilterChange}
                    onKeyPress={handleTextFilterKeyPress}
                    placeholder="Ask questions like 'Which countries had verbal conflicts?' or 'Show events with scores > 5'"
                    className={`w-full px-4 py-2 rounded-lg text-white border focus:outline-none ${
                      isNaturalLanguageQuery 
                        ? 'bg-indigo-900 border-indigo-600 focus:border-indigo-400' 
                        : 'bg-gray-700 border-gray-600 focus:border-emerald-500'
                    }`}
                  />
                  {isNaturalLanguageQuery && (
                    <div className="absolute right-3 top-2">
                      <span className="bg-indigo-700 text-xs px-2 py-1 rounded-full">
                        Question Mode
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-1 text-sm flex justify-between">
                  <p className={isNaturalLanguageQuery ? "text-indigo-400" : "text-gray-400"}>
                    {isNaturalLanguageQuery 
                      ? "I'll analyze your question. Press Enter or click Search."
                      : "Try asking a question like 'What conflicts occurred in the US?' or 'Show cooperation events'"}
                  </p>
                  {textFilter && !isNaturalLanguageQuery && (
                    <button
                      onClick={() => setIsNaturalLanguageQuery(true)}
                      className="text-indigo-400 hover:text-indigo-300 ml-2"
                    >
                      Treat as question?
                    </button>
                  )}
                </div>
                
                {/* Show query result if available */}
                {queryResult && queryResult.answer && (
                  <div className="mt-3 p-3 bg-indigo-800 bg-opacity-50 rounded-lg">
                    <h4 className="font-semibold text-indigo-300">AI Response:</h4>
                    <p className="text-white">{queryResult.answer}</p>
                    {queryResult.aqlQuery && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-indigo-300">Show Query Details</summary>
                        <pre className="mt-1 p-2 bg-gray-900 rounded overflow-x-auto">
                          {queryResult.aqlQuery}
                        </pre>
                      </details>
                    )}
                    {usingFallback && (
                      <p className="mt-2 text-xs text-orange-300">
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Apply Filters Button */}
            <div className="flex justify-center mt-6 mb-4">
              <button
                onClick={applyFilters}
                disabled={queryInProgress}
                className={`px-6 py-3 rounded-lg transition-colors font-semibold ${
                  queryInProgress 
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : isNaturalLanguageQuery 
                      ? 'bg-indigo-600 hover:bg-indigo-700' 
                      : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {queryInProgress ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing Your Question...
                  </span>
                ) : isNaturalLanguageQuery ? 'Search' : 'Apply Filters'}
              </button>
            </div>
            
            {/* Filter Stats */}
            <div className="text-sm text-gray-400 mt-4">
              Showing {filteredEventData.length} of {eventData.length} events
              {isFilterApplied && <span className="ml-2">(filters applied)</span>}
              {usingFallback && isFilterApplied}
            </div>
          </div>
          
          {/* Infinite Scrollable Recent Updates Container */}
          <div className="bg-gray-800 p-6 rounded-lg mb-8">
            <h2 className="text-2xl font-bold mb-4 sticky top-20 bg-gray-800 py-2 z-10">Recent Updates</h2>
            
            {loading ? (
              <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
              </div>
            ) : (
              <div 
                ref={updatesContainerRef}
                className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2 pb-4 custom-scrollbar"
                style={{ 
                  scrollBehavior: 'smooth',
                  minHeight: '500px'
                }}
              >
                <ul className="space-y-4">
                  {filteredEventData.length > 0 ? (
                    filteredEventData.slice(0, visibleEventCount).map((event, index) => (
                      <li key={index} className="p-4 bg-gray-700 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">
                              {quadClassToEventType[event.quadclass] || getEventTypeName(event.quadclass)} in {event.fullname || 'Unknown Location'}
                            </h3>
                            <p className="text-gray-300">
                              Goldstein Scale: {event.goldsteinscore?.toFixed(1) || 'N/A'} | 
                              Country: {event.countryCode || 'Unknown'}
                              {event.actorCountryCode && ` | Actor Country: ${event.actorCountryCode}`}
                            {event.actorFilter && (
                              <span className="inline-block px-2 py-0.5 bg-gray-600 text-xs rounded ml-2">
                                {event.actorFilter}
                              </span>
                            )}
                            </p>
                            {event.coordinates && (
                              <p className="text-gray-400 text-xs">
                                Coordinates: {event.coordinates[0]?.toFixed(4)}, {event.coordinates[1]?.toFixed(4)}
                              </p>
                            )}
                            {event.source && (
                              <a 
                                href={event.source} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-emerald-400 hover:text-emerald-300"
                              >
                                Source: {formatSourceUrl(event.source)}
                              </a>
                            )}
                            <div className="mt-3">
                            <button 
                              onClick={() => {
                                // Store the current event in localStorage
                                localStorage.setItem('selectedEvent', JSON.stringify(event));
                                // Navigate to workflows page
                                router.push(`/workflows?source=${encodeURIComponent(event.source || '')}`);
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Generate AI Insights
                            </button>
                            </div>
                          </div>
                          <span className="text-sm text-gray-400">{event.time_ago}</span>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="p-4 bg-gray-700 rounded-lg">
                      <p>No events match your filter criteria. Try adjusting the filters.</p>
                    </li>
                  )}
                  
                  {loadingMore && (
                    <li className="flex justify-center items-center p-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                    </li>
                  )}
                  
                  {eventData.length === 0 && (
                    <li className="p-4 bg-gray-700 rounded-lg">
                      <p>No events found. Please check your connection to the database.</p>
                    </li>
                  )}
                  
                  {visibleEventCount >= filteredEventData.length && filteredEventData.length > 0 && (
                    <li className="p-4 text-center text-gray-400">
                      <p>All events loaded</p>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
          
          <footer className="text-center text-gray-400 py-8">
            <p>© 2025 Spotlight. All rights reserved.</p>
          </footer>
        </div>
      </main>
    </div>
  );
}