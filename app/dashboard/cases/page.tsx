"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar } from "@/components/ui/calendar"
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Check, PhoneOff, CalendarIcon } from "lucide-react"

const callData = [
  { date: "2023-04-01", calls: 10 },
  { date: "2023-04-02", calls: 15 },
  { date: "2023-04-03", calls: 8 },
  { date: "2023-04-04", calls: 12 },
]

const caseStatusData = [
  { status: "Completed", value: 25 },
  { status: "Follow-up", value: 15 },
]

// const [selectedCase, setSelectedCase] = useState(null)

export default function CaseDashboardPage() {
  const handleNoAnswer = () => {
    // Handle No Answer logic
  }

  const handleSchedule = () => {
    // Handle Schedule logic
  }

  const handleCompleted = () => {
    // Handle Completed logic
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Case Management Dashboard</h1>

      <div className="grid md:grid-cols-3 gap-8 mb-8">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Case Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-6 rounded-lg border border-muted-foreground/20">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Claim Number</Label>
                  <Input value="MED-12345-2023" readOnly className="bg-background" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Date of Service</Label>
                  <Input value="2023-04-15" readOnly className="bg-background" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Patient Name</Label>
                  <Input value="John Doe" readOnly className="bg-background" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Date of Birth</Label>
                  <Input value="1980-01-15" readOnly className="bg-background" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Insurance ID</Label>
                  <Input value="INS-98765-XYZ" readOnly className="bg-background" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Provider Name</Label>
                  <Input value="Dr. Jane Smith" readOnly className="bg-background" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Diagnosis Code</Label>
                  <Input value="ICD-10: J45.909" readOnly className="bg-background" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Procedure Code</Label>
                  <Input value="CPT: 99213" readOnly className="bg-background" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Billed Amount</Label>
                  <Input value="$150.00" readOnly className="bg-background" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Insurance Paid</Label>
                  <Input value="$120.00" readOnly className="bg-background" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Patient Responsibility</Label>
                  <Input value="$30.00" readOnly className="bg-background" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Claim Status</Label>
                  <Input value="Pending" readOnly className="bg-background" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button onClick={handleNoAnswer} className="justify-start text-left font-normal" variant="outline">
                    <div className="bg-muted mr-2 p-1 rounded">
                      <PhoneOff className="h-4 w-4" />
                    </div>
                    No Answer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule Follow-up</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Calendar />
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" />
                  </div>
                  <Button>Save</Button>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button onClick={handleSchedule} className="justify-start text-left font-normal" variant="outline">
                    <div className="bg-muted mr-2 p-1 rounded">
                      <CalendarIcon className="h-4 w-4" />
                    </div>
                    Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule Follow-up</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Calendar />
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" />
                  </div>
                  <Button>Save</Button>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button onClick={handleCompleted} className="justify-start text-left font-normal" variant="outline">
                    <div className="bg-muted mr-2 p-1 rounded">
                      <Check className="h-4 w-4" />
                    </div>
                    Completed
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Completion</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" />
                    <Label htmlFor="check-number">Check Number</Label>
                    <Input id="check-number" />
                  </div>
                  <Button>Save</Button>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Calls Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={callData}>
                <XAxis dataKey="date" />
                <YAxis />
                <Line type="monotone" dataKey="calls" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Case Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={caseStatusData}>
                <XAxis dataKey="status" />
                <YAxis />
                <Line type="monotone" dataKey="value" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Follow-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Case ID</TableHead>
                <TableHead>Patient Name</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>2023-04-15</TableCell>
                <TableCell>12345</TableCell>
                <TableCell>John Doe</TableCell>
                <TableCell>Follow-up call</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>2023-04-16</TableCell>
                <TableCell>12346</TableCell>
                <TableCell>Jane Smith</TableCell>
                <TableCell>Check payment status</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

