"use client"

import { useSignIn } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Apple } from "lucide-react"
import { FcGoogle } from "react-icons/fc"
import { FaMicrosoft } from "react-icons/fa"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"

export default function LoginPage() {
  const { signIn, isLoaded } = useSignIn()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  // Handle OAuth login
  const handleOAuthLogin = async (provider: "oauth_google" | "oauth_microsoft" | "oauth_apple") => {
    if (!isLoaded) return
    try {
      const result = await signIn.authenticateWithRedirect({
        strategy: provider,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/account"
      })
    } catch (err) {
      toast({
        title: "Authentication Error",
        description: "Failed to authenticate with provider",
        variant: "destructive"
      })
    }
  }

  // Handle magic link email
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) return

    try {
      setLoading(true)
      await signIn.create({
        strategy: "email_link",
        identifier: email,
        redirectUrl: "/account"
      })
      
      toast({
        title: "Check your email",
        description: "We sent you a magic link to sign in",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to send magic link",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full max-w-md mx-auto bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center mb-2">Login to MediTrack Pro</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Enter your email for a magic link or use a provider
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleEmailLogin} className="space-y-4" role="form">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Magic Link"}
              </Button>
            </div>
          </form>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => handleOAuthLogin("oauth_microsoft")}
              disabled={loading}
            >
              <FaMicrosoft className="mr-2 h-4 w-4" />
              Microsoft
            </Button>
            <Button
              variant="outline"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => handleOAuthLogin("oauth_apple")}
              disabled={loading}
            >
              <Apple className="mr-2 h-4 w-4" />
              Apple
            </Button>
            <Button
              variant="outline"
              className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => handleOAuthLogin("oauth_google")}
              disabled={loading}
            >
              <FcGoogle className="mr-2 h-4 w-4" />
              Google
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

