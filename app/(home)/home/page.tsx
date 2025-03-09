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
  
  // Sample event structure:
  // {
  //   "source": "https://thehill.com/homenews/state-watch/5184314-bipartisan-california-lawmakers-congress-los-angeles-wildfire-aid/",
  //   "goldsteinscore": 7,
  //   "quadclass": 2,
  //   "fullname": "Los Angeles County, California, United States",
  //   "countryCode": "US",
  //   "actorCountryCode": null,
  //   "actorFilter": null,
  //   "coordinates": [34.3667, -118.201]
  // }
  //
  // Note: Data comes from different sources but is normalized to this format:
  // - fullname = location.fullname
  // - countryCode = location.countryCode 
  // - actorCountryCode = actor.countryCode
  // - actorFilter = actor.type3Code
  
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
          
          {/* Single Filter Card replacing the three previous cards */}
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
              
              {/* Text Search Input */}
              <div className="col-span-4">
                <label htmlFor="text-filter" className="block font-semibold mb-2">
                  Search Text
                </label>
                <input
                  id="text-filter"
                  type="text"
                  value={textFilter}
                  onChange={(e) => setTextFilter(e.target.value)}
                  placeholder="Search locations, sources, actor types..."
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white border border-gray-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
            
            {/* Apply Filters Button */}
            <div className="flex justify-center mt-6 mb-4">
              <button
                onClick={applyFilters}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors font-semibold"
              >
                Apply Filters
              </button>
            </div>
            
          {/* Filter Stats */}
            <div className="text-sm text-gray-400 mt-4">
              Showing {filteredEventData.length} of {eventData.length} events
              {isFilterApplied && <span className="ml-2">(filters applied)</span>}
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
// {/* Dashboard content */}
// <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
// <div className="bg-gray-800 p-6 rounded-lg">
//   <h2 className="text-2xl font-bold mb-4">Projects</h2>
//   <p>Manage your ongoing projects and initiatives.</p>
// </div>

// <div className="bg-gray-800 p-6 rounded-lg">
//   <h2 className="text-2xl font-bold mb-4">Analytics</h2>
//   <p>Access detailed metrics and performance data.</p>
// </div>

// <div className="bg-gray-800 p-6 rounded-lg">
//   <h2 className="text-2xl font-bold mb-4">Settings</h2>
//   <p>Customize your account and application preferences.</p>
// </div>
// </div>