"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Apple, Github, Mail, AlertCircle } from "lucide-react"
import { FcGoogle } from "react-icons/fc"
import { FaMicrosoft } from "react-icons/fa"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()

  const handleOAuthLogin = (provider: string) => {
    console.log(`Initiating ${provider} OAuth login`)
    localStorage.setItem("isAuthenticated", "true")
    localStorage.setItem("userEmail", `${provider.toLowerCase()}@example.com`)
    localStorage.setItem("userWorkspace", provider === "Microsoft" ? "Administration" : "Default")
    router.push("/account")
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full max-w-md mx-auto bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center mb-2">Login to MediTrack Pro</CardTitle>
          <CardDescription className="text-center text-muted-foreground">Choose your login method</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => handleOAuthLogin("Microsoft")}
            >
              <FaMicrosoft className="mr-2 h-4 w-4" />
              Microsoft
            </Button>
            <Button
              variant="outline"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => handleOAuthLogin("Apple")}
            >
              <Apple className="mr-2 h-4 w-4" />
              Apple
            </Button>
            <Button
              variant="outline"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => handleOAuthLogin("Google")}
            >
              <FcGoogle className="mr-2 h-4 w-4" />
              Google
            </Button>
            <Button
              variant="outline"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => handleOAuthLogin("GitHub")}
            >
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-center text-muted-foreground w-full">
            By clicking continue, you agree to our{" "}
            <a href="#" className="underline hover:text-primary">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline hover:text-primary">
              Privacy Policy
            </a>
            .
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

