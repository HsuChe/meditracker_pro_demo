import { NextResponse } from 'next/server'
import { getApiUrl } from '@/app/config'

// Explicitly mark this route as dynamic
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '10'

    const response = await fetch(`${getApiUrl()}/api/filters/saved?page=${page}&limit=${limit}`, {
      // Add cache: 'no-store' to ensure fresh data
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Transform the response to match the expected format
    return NextResponse.json({
      filters: data.filters || [],
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(limit),
        totalPages: data.pagination?.totalPages || 1,
        total: data.pagination?.totalRecords || 0
      }
    })
  } catch (error) {
    console.error('Error fetching saved filters:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch saved filters',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 