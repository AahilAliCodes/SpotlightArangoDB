import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Fetch the website content
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000 // 10 second timeout
    });

    // Use cheerio to parse the HTML and extract the main content
    const $ = cheerio.load(response.data);
    
    // Remove scripts, styles, and other non-content elements
    $('script, style, meta, link, noscript, iframe, svg').remove();

    // Try to extract the main content from common content containers
    const selectors = [
      'article', 'main', '.content', '.article', '.post', 
      '#content', '#main', '.main-content', '.article-content', '.post-content'
    ];

    let mainContent = '';
    
    // Try to find content using selectors
    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        mainContent = element.text().trim();
        break;
      }
    }

    // If no content was found using selectors, use the body content
    if (!mainContent) {
      mainContent = $('body').text().trim();
    }

    // Clean up the text
    mainContent = mainContent
      .replace(/\s+/g, ' ')         // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n\n')  // Replace multiple newlines with double newline
      .trim();                     

    return NextResponse.json({ content: mainContent });
  } catch (error) {
    console.error('Error scraping content:', error);
    return NextResponse.json(
      { error: 'Failed to scrape content from the URL' },
      { status: 500 }
    );
  }
}