import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export async function GET(
  request: Request,
  { params }: { params: { filterId: string } }
) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/filters/execute/${params.filterId}`)
    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error executing filter:', error)
    return NextResponse.json(
      { error: 'Failed to execute filter' },
      { status: 500 }
    )
  }
} 