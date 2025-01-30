"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X, UserCircle } from "lucide-react"

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth >= 1024) {
        setIsOpen(false)
      }
    }

    checkScreenSize()
    window.addEventListener("resize", checkScreenSize)
    return () => window.removeEventListener("resize", checkScreenSize)
  }, [])

  return (
    <nav className="bg-secondary">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-foreground font-bold">
            MediTrack Pro
          </Link>
          <div className="hidden lg:flex space-x-4">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/ingestion">Ingestion</NavLink>
            <NavLink href="/filter">Filter</NavLink>
            <NavLink href="/dashboard/filters">Filter Dashboard</NavLink>
            <NavLink href="/dashboard/cases">Case Management</NavLink>
            <NavLink href="/dashboard/saas">SaaS Dashboard</NavLink>
          </div>
          <div className="flex items-center">
            <Link href="/account" className="text-foreground mr-4">
              <UserCircle className="h-6 w-6" />
            </Link>
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={toggleMenu}>
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            )}
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="lg:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <NavLink href="/" mobile>Home</NavLink>
            <NavLink href="/ingestion" mobile>Ingestion</NavLink>
            <NavLink href="/filter" mobile>Filter</NavLink>
            <NavLink href="/dashboard/filters" mobile>Filter Dashboard</NavLink>
            <NavLink href="/dashboard/cases" mobile>Case Management</NavLink>
            <NavLink href="/dashboard/saas" mobile>SaaS Dashboard</NavLink>
          </div>
        </div>
      )}
    </nav>
  )
}

interface NavLinkProps {
  href: string
  children: React.ReactNode
  mobile?: boolean
}

function NavLink({ href, children, mobile = false }: NavLinkProps) {
  const baseClasses = "text-foreground hover:text-primary transition-colors duration-200"
  const mobileClasses = "block px-3 py-2 rounded-md text-base font-medium"
  const desktopClasses = "px-3 py-2 rounded-md text-sm font-medium"

  return (
    <Link href={href} className={`${baseClasses} ${mobile ? mobileClasses : desktopClasses}`}>
      {children}
    </Link>
  )
} 