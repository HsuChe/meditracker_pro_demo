import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton
} from '@clerk/nextjs'
import { Inter } from "next/font/google"
import "@/app/globals.css"
import { ThemeProvider } from "@/components/layout/theme-provider"
import { Navbar } from "@/components/layout/navbar"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "MediTrack Pro",
  description: "Medical claims tracking and analysis",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider 
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      proxyUrl="https://clerk.clerk.dev"
      appearance={{
        elements: {
          formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
          footerActionLink: "text-primary hover:text-primary/90"
        }
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={cn(inter.className, "min-h-screen bg-background antialiased")} suppressHydrationWarning>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="relative min-h-screen bg-background">
              <SignedIn>
                <Navbar />
              </SignedIn>
              <SignedOut>
                <header className="border-b bg-background">
                  <div className="container flex h-16 items-center px-4">
                    <div className="flex-1">
                      <h1 className="text-xl font-bold">MediTrack Pro</h1>
                    </div>
                    <div className="flex items-center gap-4">
                      <SignInButton mode="modal">
                        <button className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">
                          Sign In
                        </button>
                      </SignInButton>
                    </div>
                  </div>
                </header>
              </SignedOut>
              <main className="container mx-auto px-4 py-8">
                {children}
              </main>
            </div>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}

