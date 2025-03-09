// app/api/events/route.js
import { NextResponse } from 'next/server';
import axios from 'axios';

// Environment variable for Flask webhook URL - add this to your .env.local file
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:8000/api/events';

export async function GET() {
  try {
    // Fetch events from the Flask webhook
    const response = await axios.get(WEBHOOK_URL);
    
    // Return the data
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error fetching events from webhook:', error);
    
    // Return error with appropriate status code
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: error.response?.status || 500 }
    );
  }
}