import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received LUT submission:', body);

    if (!body.name || !body.data) {
      console.error('Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields', details: 'Both name and data are required' },
        { status: 400 }
      );
    }

    console.log('Sending request to backend...');
    const response = await fetch('http://localhost:5000/api/luts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: body.name,
        type: 'lut',
        // Send raw data as the backend will process it
        data: body.data,
        metadata: {
          rowCount: body.data.split('\n').filter(Boolean).length,
          columnCount: 1
        }
      }),
    });

    console.log('Backend response status:', response.status);
    const responseData = await response.json();
    console.log('Backend response data:', responseData);

    if (!response.ok) {
      return NextResponse.json(
        responseData,
        { status: response.status }
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Detailed error in /api/luts POST:', error);
    
    // Check if it's a connection error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          error: 'Backend connection error', 
          details: 'Could not connect to the backend server. Please ensure it is running.',
          code: 'ECONNREFUSED'
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof Error ? error.name : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const pageSize = searchParams.get('pageSize') || '50';
    const name = searchParams.get('name');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const queryParams = new URLSearchParams({
      page,
      pageSize,
      ...(name && { name }),
      ...(fromDate && { fromDate }),
      ...(toDate && { toDate })
    });

    const response = await fetch(`http://localhost:5000/api/luts?${queryParams}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        errorData,
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in /api/luts GET:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 