import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Define the type for chat messages
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Make sure to export this function as a named export
export async function POST(request: Request) {
  try {
    const { apiKey, message, context, previousMessages, sourceContent } = await request.json();
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Initialize OpenAI client with the user's API key
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Format previous messages for OpenAI format
    const formattedPreviousMessages = (previousMessages || []).map((msg: ChatMessage) => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Construct system message with context
    const systemMessage = `You are an expert geopolitical analyst specializing in providing insights and analysis on global events. 
You analyze news and events to extract meaningful patterns, connections, and implications.

Context about the current event being discussed:
${context || 'No specific context provided.'}

${sourceContent ? `Content from the source article (use this to inform your answers):
${sourceContent.substring(0, 2000)}` : 'No source content available.'}

Provide thoughtful, balanced, and informative responses to questions about this event. If asked about something outside your knowledge or not related to the event, politely redirect the conversation back to the event analysis. Use bullet points and structured formatting when appropriate.`;

    // Combine all messages for the API call
    const apiMessages = [
      { role: 'system', content: systemMessage },
      ...formattedPreviousMessages,
      { role: 'user', content: message }
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Using the latest GPT-4 model
      messages: apiMessages,
      temperature: 0.7, // Slightly more creative than the initial analysis
      max_tokens: 1000 // Shorter responses for the chat
    });

    // Extract the generated response
    const reply = completion.choices[0].message.content;

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Error in chat API:', error);
    
    // Safely extract the error message regardless of error type
    let errorMessage = 'An unexpected error occurred';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Try to extract more details if available
      const apiError = error as any;
      if (apiError.response?.data?.error) {
        errorMessage = apiError.response.data.error.message || errorMessage;
      }
    }
    
    return NextResponse.json(
      { reply: `I encountered an error: ${errorMessage}. Please check your API key or try again later.` },
      { status: 200 } // Return 200 so the client can display the error message in the chat
    );
  }
}