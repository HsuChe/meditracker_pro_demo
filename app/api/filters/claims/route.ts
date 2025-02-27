import { NextResponse } from 'next/server'
import { getApiUrl } from '@/app/config'

export async function GET() {
  // Check if we're in a build environment
  const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_BUILD_MODE === 'true';
  
  if (isBuildTime) {
    console.log('Build-time detected, returning mock data');
    // Return mock data during build to prevent failures
    return NextResponse.json({
      totalClaims: 0,
      recentClaims: [],
      message: 'Mock data for build time'
    });
  }
  
  try {
    const response = await fetch(`${getApiUrl()}/api/filters/claims`, {
      // Add a timeout to prevent hanging during build
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      console.error('Backend response not ok:', {
        status: response.status,
        statusText: response.statusText
      });
      return NextResponse.json(
        { error: 'Backend service error' },
        { status: response.status }
      );
    }

    const text = await response.text();
    console.log('Raw response:', text);
    
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Raw text:', text);
      return NextResponse.json(
        { error: 'Invalid JSON response from backend' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error fetching total claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch total claims' },
      { status: 500 }
    );
  }
} 