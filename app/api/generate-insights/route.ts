import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const { apiKey, eventData, sourceContent } = await request.json();
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!eventData) {
      return NextResponse.json(
        { error: 'Event data is required' },
        { status: 400 }
      );
    }

    // Initialize OpenAI client with the user's API key
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Helper function to get event type name
    const getEventTypeName = (quadClass: number) => {
      switch (quadClass) {
        case 1: return 'Verbal Cooperation';
        case 2: return 'Material Cooperation';
        case 3: return 'Verbal Conflict';
        case 4: return 'Material Conflict';
        default: return 'Unknown Event Type';
      }
    };

    // Construct prompt for the AI - format optimized for chat interface
    const prompt = `
Analyze the following global event as an expert geopolitical analyst:

EVENT TYPE: ${getEventTypeName(eventData.quadclass)}
LOCATION: ${eventData.fullname}
COUNTRY: ${eventData.countryCode}
${eventData.actorCountryCode ? `ACTOR COUNTRY: ${eventData.actorCountryCode}` : ''}
${eventData.actorFilter ? `ACTOR TYPE: ${eventData.actorFilter}` : ''}
GOLDSTEIN SCORE: ${eventData.goldsteinscore.toFixed(1)}
REPORTED: ${eventData.time_ago}
SOURCE URL: ${eventData.source}

SOURCE CONTENT:
${sourceContent ? sourceContent.substring(0, 3000) : "No content available from source"}

Provide a concise yet comprehensive analysis of this event. Your response should be formatted for readability in a chat interface with clear sections using markdown. Include:

1. A brief executive summary (2-3 sentences)
2. Key geopolitical context and significance
3. Likely implications for regional stability
4. Main stakeholders and their interests
5. Historical precedents or relevant background
6. Potential future developments
7. Recommendations for monitoring

Format your analysis with clear headings, bullet points where appropriate, and concise paragraphs. Make your insights accessible while demonstrating expert analysis.

Remember: This initial analysis will start a conversation where the user can ask follow-up questions about specific aspects.
`;

    // System message that emphasizes conversational yet expert analysis
    const systemMessage = `You are an expert geopolitical analyst providing insights on global events through a conversational interface. 
Your analysis should be:
- Factually grounded and balanced
- Structured with clear sections using markdown formatting
- Accessible yet sophisticated
- Concise but comprehensive
- Free from political bias or advocacy positions

Present your analysis in a way that invites further questions and exploration.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Using the latest GPT-4 model
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.5, // More focused and deterministic output
      max_tokens: 1500 // Slightly shorter to focus on key insights and encourage follow-up questions
    });

    // Extract the generated insights
    const insights = completion.choices[0].message.content;

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('Error generating insights:', error);
    
    // Handle errors with proper TypeScript typing
    if (error instanceof Error) {
      // Check if it's an API error with response property
      const apiError = error as any; // Type assertion to access potential response
      
      if (apiError.response?.status === 401) {
        return NextResponse.json(
          { error: 'Invalid OpenAI API key. Please check your API key and try again.' },
          { status: 401 }
        );
      }
      
      // Log the detailed error for debugging
      console.error('OpenAI API error details:', JSON.stringify(apiError, null, 2));
      
      return NextResponse.json(
        { error: `Error: ${error.message}` },
        { status: 500 }
      );
    }
    
    // Fallback for unknown error types
    return NextResponse.json(
      { error: 'An unexpected error occurred while generating insights.' },
      { status: 500 }
    );
  }
}