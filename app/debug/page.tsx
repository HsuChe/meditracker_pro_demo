import DebugAPI from '../debug-api'

export default function DebugPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">API Connection Debugging</h1>
      <p className="mb-6">
        Use this page to test the connection to your backend API and debug any issues with data retrieval.
      </p>
      <DebugAPI />
    </div>
  )
} 