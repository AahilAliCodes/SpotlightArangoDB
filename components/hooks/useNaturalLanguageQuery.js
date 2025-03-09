// hooks/useNaturalLanguageQuery.js
import { useState, useCallback } from 'react';
import axios from 'axios';

export function useNaturalLanguageQuery() {
  const [isNaturalLanguageQuery, setIsNaturalLanguageQuery] = useState(false);
  const [queryInProgress, setQueryInProgress] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [error, setError] = useState(null);

  // Detect if input is likely a natural language query
  const detectNaturalLanguageQuery = useCallback((text) => {
    if (!text) return false;
    
    // Always consider it a natural language query if it contains a question mark
    if (text.includes('?')) {
      setIsNaturalLanguageQuery(true);
      return true;
    }
    
    // Check if text contains question words or phrases
    const questionPatterns = [
      /^(what|where|when|which|who|whose|whom|why|how)/i,
      /^(show|find|get|give|list|display|tell)/i,
      /^(is|are|can|could|do|does|did|has|have|should|would|will)/i,
      /(show me|tell me|can you|could you|would you|find|list|get|give)/i
    ];
    
    const isNLQuery = questionPatterns.some(pattern => pattern.test(text.trim()));
    setIsNaturalLanguageQuery(isNLQuery);
    return isNLQuery;
  }, []);

  // Process natural language query
  const processQuery = useCallback(async (query) => {
    if (!query.trim()) return null;
    
    try {
      setQueryInProgress(true);
      setError(null);
      
      const response = await axios.post('/api/natural-language-query', {
        query
      });
      
      setQueryResult(response.data);
      return response.data;
      
    } catch (err) {
      console.error('Error processing natural language query:', err);
      setError(err.message || 'Failed to process your query');
      return null;
    } finally {
      setQueryInProgress(false);
    }
  }, []);

  // Clear query state
  const clearQuery = useCallback(() => {
    setIsNaturalLanguageQuery(false);
    setQueryResult(null);
    setError(null);
  }, []);

  return {
    isNaturalLanguageQuery,
    queryInProgress,
    queryResult,
    error,
    detectNaturalLanguageQuery,
    processQuery,
    clearQuery
  };
}