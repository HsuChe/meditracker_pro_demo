import { NextResponse } from 'next/server'
import { getApiUrl } from '@/app/config'

export async function GET(
  request: Request,
  { params }: { params: { filterId: string } }
) {
  try {
    const response = await fetch(`${getApiUrl()}/api/filters/execute/${params.filterId}`)
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