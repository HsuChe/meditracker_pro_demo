import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/filters/claims`)
    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching total claims:', error)
    return NextResponse.json(
      { error: 'Failed to fetch total claims' },
      { status: 500 }
    )
  }
} 