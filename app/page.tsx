"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FileSpreadsheet,
  Filter,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  FileText,
  AppWindowIcon as Window,
} from "lucide-react"
import type { ReactNode } from "react"

export default function HomePage() {
  useEffect(() => {
    console.log("Client-side render")
  }, [])

  if (typeof window === "undefined") {
    console.log("Server-side render")
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative hero-image text-primary-foreground p-responsive">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="text-center md:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-extrabold tracking-tight mb-4 text-responsive">
                Welcome to MediTrack Pro
              </h1>
              <p className="text-sm sm:text-base md:text-lg max-w-3xl mb-6 mx-auto md:mx-0">
                Advanced Medical Product Management System: Streamline your healthcare data processing, enhance
                decision-making, and optimize claim management with our cutting-edge platform.
              </p>
              <Link href="/dashboard/saas" passHref>
                <Button size="lg" variant="secondary" className="hover-effect">
                  Explore Dashboard
                </Button>
              </Link>
            </div>
            <div className="relative h-64 md:h-full min-h-[300px] bg-primary-foreground/10 rounded-lg overflow-hidden hover-effect">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-foreground/20 to-transparent"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-4 p-4">
                  <div className="bg-background/90 p-4 rounded-lg shadow-lg">
                    <Window className="w-8 h-8 mb-2 text-primary" />
                    <p className="text-sm font-semibold">Medical Records</p>
                  </div>
                  <div className="bg-background/90 p-4 rounded-lg shadow-lg">
                    <FileText className="w-8 h-8 mb-2 text-primary" />
                    <p className="text-sm font-semibold">Claim Forms</p>
                  </div>
                  <div className="bg-background/90 p-4 rounded-lg shadow-lg">
                    <BarChart3 className="w-8 h-8 mb-2 text-primary" />
                    <p className="text-sm font-semibold">Analytics</p>
                  </div>
                  <div className="bg-background/90 p-4 rounded-lg shadow-lg">
                    <ClipboardList className="w-8 h-8 mb-2 text-primary" />
                    <p className="text-sm font-semibold">Coding</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Showcase */}
      <section className="py-12 sm:py-16 bg-background p-responsive">
        <div className="container mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12 text-responsive">
            Experience MediTrack Pro
          </h2>
          <div className="bg-card text-card-foreground rounded-lg shadow-lg overflow-hidden hover-effect">
            <div className="p-4 sm:p-6">
              <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                  <TabsTrigger value="claims">Claims</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>
                <TabsContent value="dashboard" className="mt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Total Claims</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl sm:text-3xl font-bold text-responsive">1,234</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Approval Rate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl sm:text-3xl font-bold text-responsive">87%</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Avg. Processing Time</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl sm:text-3xl font-bold text-responsive">3.2 days</p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                <TabsContent value="claims" className="mt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-responsive">Recent Claims</h3>
                      <Button variant="outline">View All</Button>
                    </div>
                    <div className="bg-card-foreground/5 p-4 rounded-md">
                      <p className="font-medium text-responsive">Claim #12345</p>
                      <p className="text-sm text-muted-foreground text-responsive">Submitted on: 2023-07-01</p>
                    </div>
                    <div className="bg-card-foreground/5 p-4 rounded-md">
                      <p className="font-medium text-responsive">Claim #12346</p>
                      <p className="text-sm text-muted-foreground text-responsive">Submitted on: 2023-06-30</p>
                    </div>
                    <div className="bg-card-foreground/5 p-4 rounded-md">
                      <p className="font-medium text-responsive">Claim #12347</p>
                      <p className="text-sm text-muted-foreground text-responsive">Submitted on: 2023-06-29</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="analytics" className="mt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-responsive">Analytics Overview</h3>
                      <Button variant="outline">Generate Report</Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-card-foreground/5 p-4 rounded-md">
                        <p className="font-medium text-responsive">Top Performing Category</p>
                        <p className="text-xl sm:text-2xl font-bold mt-2 text-responsive">Cardiology</p>
                      </div>
                      <div className="bg-card-foreground/5 p-4 rounded-md">
                        <p className="font-medium text-responsive">Most Common Procedure</p>
                        <p className="text-xl sm:text-2xl font-bold mt-2 text-responsive">ECG</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 bg-secondary p-responsive">
        <div className="container mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-8 sm:mb-12 text-responsive">
            Powerful Features for Healthcare Management
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <FeatureCard
              icon={<FileSpreadsheet className="h-8 w-8" />}
              title="Data Ingestion"
              description="Easily import CSV files and LUT tables for seamless data management."
            />
            <FeatureCard
              icon={<Filter className="h-8 w-8" />}
              title="Advanced Filtering"
              description="Create, save, and manage custom filters to quickly access relevant information."
            />
            <FeatureCard
              icon={<BarChart3 className="h-8 w-8" />}
              title="Comprehensive Analytics"
              description="Gain insights with detailed dashboards and performance metrics."
            />
            <FeatureCard
              icon={<ClipboardList className="h-8 w-8" />}
              title="Case Management"
              description="Efficiently handle and track individual cases with our intuitive interface."
            />
            <FeatureCard
              icon={<LayoutDashboard className="h-8 w-8" />}
              title="SaaS Dashboard"
              description="Access key performance indicators and visualizations in one central location."
            />
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-12 sm:py-16 bg-background p-responsive">
        <div className="container mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-8 sm:mb-12 text-responsive">
            What Our Customers Say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <TestimonialCard
              quote="MediTrack Pro has revolutionized our claim management process. We've seen a 30% increase in efficiency since implementing the system."
              author="Dr. Emily Chen"
              role="Chief Medical Officer, HealthFirst Hospital"
            />
            <TestimonialCard
              quote="The analytics provided by MediTrack Pro have given us unprecedented insights into our operations. It's been a game-changer for our decision-making process."
              author="Michael Johnson"
              role="Data Analyst, MedTech Solutions"
            />
            <TestimonialCard
              quote="The ease of use and powerful features of MediTrack Pro have made it an indispensable tool for our medical practice. I highly recommend it to any healthcare provider."
              author="Dr. Sarah Thompson"
              role="Owner, Family Care Clinic"
            />
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-12 sm:py-16 bg-primary text-primary-foreground p-responsive">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-4 sm:mb-6 text-responsive">
            Ready to Optimize Your Healthcare Management?
          </h2>
          <p className="text-responsive mb-6 sm:mb-8 max-w-2xl mx-auto">
            Join thousands of healthcare providers who have transformed their operations with MediTrack Pro.
          </p>
          <Link href="/ingestion" passHref>
            <Button size="lg" variant="secondary" className="hover-effect">
              Get Started
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}

interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="hover-effect">
      <CardHeader>
        <div className="flex items-center justify-center w-12 h-12 rounded-md bg-primary text-primary-foreground mb-4">
          {icon}
        </div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-responsive">{description}</p>
      </CardContent>
    </Card>
  )
}

interface TestimonialCardProps {
  quote: string
  author: string
  role: string
}

function TestimonialCard({ quote, author, role }: TestimonialCardProps) {
  return (
    <Card className="hover-effect">
      <CardContent className="pt-6">
        <blockquote className="text-responsive font-medium mb-4">&ldquo;{quote}&rdquo;</blockquote>
        <cite className="block text-sm text-muted-foreground">
          <span className="font-semibold">{author}</span>
          <br />
          {role}
        </cite>
      </CardContent>
    </Card>
  )
}

