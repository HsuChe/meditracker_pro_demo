import { NextResponse } from 'next/server'
import { getApiUrl } from '@/app/config'

export async function GET() {
  try {
    const response = await fetch(`${getApiUrl()}/api/filters/claims`)
    
    if (!response.ok) {
      console.error('Backend response not ok:', {
        status: response.status,
        statusText: response.statusText
      })
      return NextResponse.json(
        { error: 'Backend service error' },
        { status: response.status }
      )
    }

    const text = await response.text()
    console.log('Raw response:', text)
    
    try {
      const data = JSON.parse(text)
      return NextResponse.json(data)
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Raw text:', text)
      return NextResponse.json(
        { error: 'Invalid JSON response from backend' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error fetching total claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch total claims' },
      { status: 500 }
    )
  }
} 