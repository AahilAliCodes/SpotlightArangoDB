'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { UserButton, SignOutButton } from "@clerk/nextjs";
import Link from 'next/link';
import axios from 'axios';

// Interface for the event data
interface EventData {
  source: string;
  goldsteinscore: number;
  quadclass: number;
  fullname: string;
  countryCode: string;
  actorCountryCode?: string | null;
  actorFilter?: string | null;
  coordinates: [number, number] | null;
  time_ago: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const WorkflowsPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const source = searchParams.get('source');

  const [apiKey, setApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState('');
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [insights, setInsights] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceContent, setSourceContent] = useState<string>('');
  
  // Chat related states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Force minimum content height
  useEffect(() => {
    // Ensure body and html have proper height settings
    document.body.style.minHeight = '1400px';
    document.documentElement.style.minHeight = '1400px';
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    return () => {
      document.body.style.minHeight = '';
      document.documentElement.style.minHeight = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);
  
  // Scroll to bottom of chat when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  // Load saved API key from localStorage on component mount
  useEffect(() => {
    const storedApiKey = localStorage.getItem('openai_api_key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setSavedApiKey(storedApiKey);
    }
  }, []);

  // Fetch event data when the component mounts
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setIsLoading(true);
        
        // First, try to get the selected event from localStorage
        const storedEvent = localStorage.getItem('selectedEvent');
        
        if (storedEvent) {
          const parsedEvent = JSON.parse(storedEvent);
          setEventData(parsedEvent);
          
          // Try to fetch content from source URL if available
          if (parsedEvent && parsedEvent.source) {
            try {
              // Fetch the website content through a proxy API route
              const contentResponse = await axios.post('/api/scrape-content', {
                url: parsedEvent.source
              });
              setSourceContent(contentResponse.data.content);
            } catch (error) {
              console.error('Error fetching source content:', error);
              setSourceContent('Unable to fetch content from source. Website may have restrictions or require authentication.');
            }
          }
          
          setIsLoading(false);
          return; // Exit early since we already have the data
        }
        
        // If no stored event, try to fetch from API using source parameter
        if (source) {
          const response = await axios.get('/api/events');
          const events = response.data;
          
          // Find the event with matching source
          const matchedEvent = events.find((e: EventData) => e.source === source);
          
          if (matchedEvent) {
            setEventData(matchedEvent);
            
            // Try to fetch content from source URL
            try {
              const contentResponse = await axios.post('/api/scrape-content', {
                url: source
              });
              setSourceContent(contentResponse.data.content);
            } catch (error) {
              console.error('Error fetching source content:', error);
              setSourceContent('Unable to fetch content from source. Website may have restrictions or require authentication.');
            }
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching event data:', error);
        setError('Failed to load event data. Please try again.');
        setIsLoading(false);
      }
    };

    fetchEventData();
    
    // Clean up function to remove the stored event when leaving the page
    return () => {
      localStorage.removeItem('selectedEvent');
    };
  }, [source]);

  // Save API key to localStorage
  const saveApiKey = () => {
    localStorage.setItem('openai_api_key', apiKey);
    setSavedApiKey(apiKey);
  };

  // Generate insights using OpenAI API
  const generateInsights = async () => {
    if (!savedApiKey) {
      setError('Please save your OpenAI API key first.');
      return;
    }

    if (!eventData) {
      setError('No event data available.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // We'll use a server endpoint to make the OpenAI API call securely
      const response = await axios.post('/api/generate-insights', {
        apiKey: savedApiKey,
        eventData,
        sourceContent
      });

      const insightText = response.data.insights;
      setInsights(insightText);
      
      // Add the insights to the chat as the first assistant message
      setChatMessages([{
        role: 'assistant',
        content: insightText
      }]);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error generating insights:', error);
      setError('Failed to generate insights. Please check your API key and try again.');
      setIsLoading(false);
    }
  };
  
  // Send a chat message to the AI
  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentMessage.trim() || !savedApiKey || isChatLoading) return;
    
    // Add user message to chat
    const userMessage = { role: 'user' as const, content: currentMessage };
    setChatMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsChatLoading(true);
    
    try {
      // Prepare context for the AI
      const context = eventData ? 
        `Event: ${getEventTypeName(eventData.quadclass)} in ${eventData.fullname}, ${eventData.countryCode}. 
         Source: ${eventData.source}` : 
        'No specific event context available.';
      
      // Get previous messages to maintain conversation history
      const previousMessages = chatMessages.slice(-10); // Limit to last 10 messages
      
      // Call the chat API
      const response = await axios.post('/api/chat', {
        apiKey: savedApiKey,
        message: currentMessage,
        context,
        previousMessages,
        sourceContent
      });
      
      // Add AI response to chat
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.data.reply 
      }]);
      
    } catch (error) {
      console.error('Error in chat:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I encountered an error processing your request. Please try again or check your API key.' 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Helper function to get event type name based on quadclass
  const getEventTypeName = (quadClass: number) => {
    switch (quadClass) {
      case 1: return 'Verbal Cooperation';
      case 2: return 'Material Cooperation';
      case 3: return 'Verbal Conflict';
      case 4: return 'Material Conflict';
      default: return 'Unknown Event Type';
    }
  };

  return (
    <div className="min-h-[1400px] bg-gray-900 text-white overflow-y-auto">
      <header className="p-6 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900 z-10">
        <div className="flex items-center">
          <Link href="/" className="text-3xl font-bold mr-8">
            <span>Sp</span>
            <span className="relative">
              <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">o</span>
            </span>
            <span>tlight</span>
          </Link>
          
          {/* Navigation Buttons */}
          <div className="hidden md:flex space-x-4">
            <Link href="/workflows">
              <button className="px-4 py-2 text-white bg-emerald-600 rounded-lg transition-colors">
                Workflows
              </button>
            </Link>
            <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors">
              Funding
            </button>
            <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors">
              Documents
            </button>
            <button className="px-4 py-2 text-gray-300 hover:text-white hover:bg-emerald-600 rounded-lg transition-colors">
              Tasks
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Back button */}
          <button 
            onClick={() => router.push('/home')}
            className="flex items-center gap-1 px-4 py-2 text-gray-300 hover:text-white rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
          
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
      
      {/* Main content - Two column layout */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-76px)]">
        {/* Left column - Controls and Event Info */}
        <div className="w-full lg:w-1/2 p-6 overflow-y-auto">
          <h1 className="text-3xl font-bold mb-6">AI Insights Generator</h1>
          
          {/* API Key Section */}
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">OpenAI API Key</h2>
            <div className="flex gap-4 mb-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your OpenAI API key"
                className="flex-1 px-4 py-2 bg-gray-700 rounded-lg text-white border border-gray-600 focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={saveApiKey}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                Save Key
              </button>
            </div>
            <p className="text-sm text-gray-400">
              {savedApiKey ? 'API key saved. Ready to generate insights.' : 'Your API key will be stored securely in your browser.'}
            </p>
          </div>
          
          {/* Event Information */}
          {eventData ? (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Event Information</h2>
              <div>
                <h3 className="font-bold text-lg mb-2">
                  {getEventTypeName(eventData.quadclass)} in {eventData.fullname}
                </h3>
                <p className="mb-2">Goldstein Score: {eventData.goldsteinscore.toFixed(1)}</p>
                <p className="mb-2">Country: {eventData.countryCode}</p>
                {eventData.actorCountryCode && (
                  <p className="mb-2">Actor Country: {eventData.actorCountryCode}</p>
                )}
                {eventData.actorFilter && (
                  <p className="mb-2">Actor Type: {eventData.actorFilter}</p>
                )}
                {eventData.coordinates && (
                  <p className="mb-2">
                    Coordinates: {eventData.coordinates[0].toFixed(4)}, {eventData.coordinates[1].toFixed(4)}
                  </p>
                )}
                <p className="mb-2">Reported: {eventData.time_ago}</p>
                {eventData.source && (
                  <a 
                    href={eventData.source} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    View Original Source
                  </a>
                )}
              </div>
              
              <div className="mt-4">
                <h3 className="font-bold text-lg mb-2">Source Content Preview</h3>
                <div className="bg-gray-700 p-4 rounded-lg h-48 overflow-y-auto">
                  {sourceContent ? (
                    <div className="text-sm whitespace-pre-line">{sourceContent.substring(0, 500)}...</div>
                  ) : (
                    <div className="text-gray-400 italic">Loading source content...</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Event Information</h2>
              {isLoading ? (
                <div className="flex justify-center items-center p-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                </div>
              ) : (
                <p>No event selected. Please return to the dashboard and select an event.</p>
              )}
            </div>
          )}
          
          {/* Generate Insights Button */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Generate AI Insights</h2>
            
            <button
              onClick={generateInsights}
              disabled={!savedApiKey || !eventData || isLoading}
              className={`w-full py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                !savedApiKey || !eventData || isLoading 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Generate Insights</span>
                </>
              )}
            </button>
            
            {error && (
              <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                {error}
              </div>
            )}
          </div>
        </div>
        
        {/* Right column: Chat interface - Full height */}
        <div className="w-full lg:w-1/2 bg-gray-800 border-l border-gray-700 flex flex-col h-full">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold">Interactive Chat</h2>
            <p className="text-sm text-gray-400">Ask follow-up questions or request more detailed analysis about this event</p>
          </div>
          
          {/* Chat messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 && !isLoading && (
              <div className="text-center text-gray-400 py-10">
                <p>Click "Generate Insights" to analyze this event</p>
                <p className="text-sm mt-2">Then you can ask follow-up questions here</p>
              </div>
            )}
            
            {chatMessages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-3/4 rounded-lg p-3 ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-700 text-white'
                }`}>
                  <div className="whitespace-pre-line">{msg.content}</div>
                </div>
              </div>
            ))}
            
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-100"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Invisible element to scroll to */}
            <div ref={chatEndRef} />
          </div>
          
          {/* Chat input area */}
          <form onSubmit={sendChatMessage} className="p-4 border-t border-gray-700 flex gap-2">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              placeholder="Ask a follow-up question..."
              disabled={chatMessages.length === 0 || isChatLoading}
              className="flex-1 px-4 py-2 bg-gray-700 rounded-lg text-white border border-gray-600 focus:border-emerald-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!currentMessage.trim() || chatMessages.length === 0 || isChatLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WorkflowsPage;