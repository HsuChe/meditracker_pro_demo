import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '10'

    const response = await fetch(`${BACKEND_URL}/api/filters/saved?page=${page}&limit=${limit}`)
    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching saved filters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch saved filters' },
      { status: 500 }
    )
  }
} 