"use client"

import { useState } from "react"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import Image from "next/image"
import { useRouter } from "next/navigation"

export default function TwoFactorSetup() {
  const { user } = useUser()
  const router = useRouter()
  const [verificationCode, setVerificationCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [factor, setFactor] = useState<any>(null)

  const initializeTOTP = async () => {
    if (!user) return

    try {
      setLoading(true)
      const factor = await user.createTOTPFactor({
        name: "Authenticator App"
      })
      setFactor(factor)
      setQrCodeUrl(factor.qrCode)
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to initialize 2FA setup",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const verifyTOTP = async () => {
    if (!factor) return

    try {
      setLoading(true)
      await factor.attemptVerification({
        code: verificationCode
      })
      
      toast({
        title: "Success",
        description: "Two-factor authentication has been enabled",
      })
      
      // Redirect to account page after successful setup
      router.push("/account")
    } catch (err) {
      toast({
        title: "Error",
        description: "Invalid verification code. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Set Up Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enhance your account security by setting up two-factor authentication using an authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!qrCodeUrl ? (
            <Button 
              onClick={initializeTOTP} 
              className="w-full"
              disabled={loading}
            >
              {loading ? "Setting up..." : "Begin Setup"}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="relative w-64 h-64">
                  <Image
                    src={qrCodeUrl}
                    alt="QR Code for 2FA setup"
                    fill
                    style={{ objectFit: "contain" }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Scan this QR code with your authenticator app, then enter the verification code below
                </p>
                <Input
                  type="text"
                  placeholder="Enter verification code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  disabled={loading}
                />
                <Button 
                  onClick={verifyTOTP} 
                  className="w-full"
                  disabled={loading || !verificationCode}
                >
                  {loading ? "Verifying..." : "Verify Code"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-center text-muted-foreground w-full">
            You'll need to enter a code from your authenticator app each time you sign in
          </p>
        </CardFooter>
      </Card>
    </div>
  )
} 