// app/api/natural-language-query/route.js

/**
 * Process a natural language query using client-side logic
 * @param {string} query - The natural language query
 * @param {Array} events - Array of event objects
 * @returns {Object} Result with message and filtered events
 */
const clientSideQueryProcessing = (query, events) => {
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
    } else if (normalizedQuery.includes(' in europe')) {
      // European country codes (simplified)
      const europeanCountries = ['DE', 'FR', 'GB', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'DK', 'NO', 'FI', 'PT', 'IE', 'GR', 'PL'];
      countryFilter = europeanCountries;
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
    let filtered = [...events];
    
    // Apply country filter
    if (countryFilter) {
      if (Array.isArray(countryFilter)) {
        // If it's an array of country codes (e.g., Europe)
        filtered = filtered.filter(event => 
          countryFilter.includes(event.countryCode)
        );
      } else {
        // Single country code
        filtered = filtered.filter(event => event.countryCode === countryFilter);
      }
    }
    
    // Apply event type filters based on quadclass
    // quadclass: 1 = Verbal Cooperation, 2 = Material Cooperation, 
    // 3 = Verbal Conflict, 4 = Material Conflict
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
        if (Array.isArray(countryFilter)) {
          responseMessage = `Found ${filtered.length} events in Europe.`;
        } else {
          responseMessage = `Found ${filtered.length} events in ${
            countryFilter === 'US' ? 'the United States' : 
            countryFilter === 'GB' ? 'the United Kingdom' : 
            countryFilter
          }.`;
        }
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
  
  export async function POST(request) {
    try {
      const { query } = await request.json();
      
      if (!query) {
        return new Response(JSON.stringify({ error: 'Query is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`Received query: ${query}`);
      
      // Fetch all events data directly from your API
      try {
        const eventsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/events`);
        if (!eventsResponse.ok) {
          throw new Error(`Error fetching events: ${eventsResponse.status}`);
        }
        
        const events = await eventsResponse.json();
        
        // Process the query using client-side logic
        const result = clientSideQueryProcessing(query, events);
        
        return new Response(JSON.stringify({
          answer: result.message,
          aqlResult: result.filteredEvents,
          usingFallback: true
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (fetchError) {
        console.error('Error fetching events data:', fetchError);
        
        // Return a helpful error message
        return new Response(JSON.stringify({
          error: 'Unable to process query. Event data could not be retrieved.',
          usingFallback: true
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
    } catch (error) {
      console.error('Error processing natural language query:', error);
      return new Response(JSON.stringify({ 
        error: error.message || 'An error occurred',
        usingFallback: true 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }