import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { useSignIn } from '@clerk/nextjs'
import { toast } from '@/components/ui/use-toast'
import LoginPage from '@/app/login/page'
import { ButtonProps } from '@/components/ui/button'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}))

// Mock Clerk's useSignIn hook
jest.mock('@clerk/nextjs', () => ({
  useSignIn: jest.fn(() => ({
    isLoaded: true,
    signIn: {
      create: jest.fn().mockResolvedValue({}),
      authenticateWithRedirect: jest.fn().mockResolvedValue({}),
    },
  })),
}))

// Mock toast component
jest.mock('@/components/ui/use-toast', () => ({
  toast: jest.fn(),
}))

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: ButtonProps) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      data-testid="button" 
      {...props}
    >
      {children}
    </button>
  ),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('renders login form correctly', () => {
    render(<LoginPage />)
    
    // Check for main elements
    expect(screen.getByText('Login to MediTrack Pro')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send Magic Link/i })).toBeInTheDocument()
    
    // Check for OAuth buttons
    expect(screen.getByRole('button', { name: /Microsoft/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Apple/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Google/i })).toBeInTheDocument()
  })

  it('handles magic link email submission', async () => {
    const mockSignIn = {
      isLoaded: true,
      signIn: {
        create: jest.fn().mockResolvedValue({}),
        authenticateWithRedirect: jest.fn().mockResolvedValue({}),
      },
    }
    ;(useSignIn as jest.Mock).mockReturnValue(mockSignIn)

    render(<LoginPage />)
    
    const emailInput = screen.getByPlaceholderText('Enter your email')
    const form = screen.getByRole('form')
    
    // Type email and submit
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.submit(form)
    
    await waitFor(() => {
      expect(mockSignIn.signIn.create).toHaveBeenCalledWith({
        strategy: 'email_link',
        identifier: 'test@example.com',
        redirectUrl: '/account'
      })
    })
    
    expect(toast).toHaveBeenCalledWith({
      title: 'Check your email',
      description: 'We sent you a magic link to sign in'
    })
  })

  it('handles magic link email submission error', async () => {
    const mockSignIn = {
      isLoaded: true,
      signIn: {
        create: jest.fn().mockRejectedValue(new Error('Failed to send email')),
        authenticateWithRedirect: jest.fn().mockResolvedValue({}),
      },
    }
    ;(useSignIn as jest.Mock).mockReturnValue(mockSignIn)

    render(<LoginPage />)
    
    const emailInput = screen.getByPlaceholderText('Enter your email')
    const form = screen.getByRole('form')
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.submit(form)
    
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Failed to send magic link',
        variant: 'destructive'
      })
    })
  })

  it('handles OAuth login with Microsoft', async () => {
    const mockSignIn = {
      isLoaded: true,
      signIn: {
        create: jest.fn().mockResolvedValue({}),
        authenticateWithRedirect: jest.fn().mockResolvedValue({}),
      },
    }
    ;(useSignIn as jest.Mock).mockReturnValue(mockSignIn)

    render(<LoginPage />)
    
    const microsoftButton = screen.getByRole('button', { name: /Microsoft/i })
    fireEvent.click(microsoftButton)
    
    await waitFor(() => {
      expect(mockSignIn.signIn.authenticateWithRedirect).toHaveBeenCalledWith({
        strategy: 'oauth_microsoft',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/account'
      })
    })
  })

  it('handles OAuth login with Apple', async () => {
    const mockSignIn = {
      isLoaded: true,
      signIn: {
        create: jest.fn().mockResolvedValue({}),
        authenticateWithRedirect: jest.fn().mockResolvedValue({}),
      },
    }
    ;(useSignIn as jest.Mock).mockReturnValue(mockSignIn)

    render(<LoginPage />)
    
    const appleButton = screen.getByRole('button', { name: /Apple/i })
    fireEvent.click(appleButton)
    
    await waitFor(() => {
      expect(mockSignIn.signIn.authenticateWithRedirect).toHaveBeenCalledWith({
        strategy: 'oauth_apple',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/account'
      })
    })
  })

  it('handles OAuth login with Google', async () => {
    const mockSignIn = {
      isLoaded: true,
      signIn: {
        create: jest.fn().mockResolvedValue({}),
        authenticateWithRedirect: jest.fn().mockResolvedValue({}),
      },
    }
    ;(useSignIn as jest.Mock).mockReturnValue(mockSignIn)

    render(<LoginPage />)
    
    const googleButton = screen.getByRole('button', { name: /Google/i })
    fireEvent.click(googleButton)
    
    await waitFor(() => {
      expect(mockSignIn.signIn.authenticateWithRedirect).toHaveBeenCalledWith({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/account'
      })
    })
  })

  it('handles OAuth login error', async () => {
    const mockSignIn = {
      isLoaded: true,
      signIn: {
        create: jest.fn().mockResolvedValue({}),
        authenticateWithRedirect: jest.fn().mockRejectedValue(new Error('Auth failed')),
      },
    }
    ;(useSignIn as jest.Mock).mockReturnValue(mockSignIn)

    render(<LoginPage />)
    
    const googleButton = screen.getByRole('button', { name: /Google/i })
    fireEvent.click(googleButton)
    
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Authentication Error',
        description: 'Failed to authenticate with provider',
        variant: 'destructive'
      })
    })
  })

  it('disables form elements while loading', async () => {
    const mockSignIn = {
      isLoaded: true,
      signIn: {
        create: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))),
        authenticateWithRedirect: jest.fn().mockResolvedValue({}),
      },
    }
    ;(useSignIn as jest.Mock).mockReturnValue(mockSignIn)
    
    render(<LoginPage />)
    
    const emailInput = screen.getByPlaceholderText('Enter your email')
    const form = screen.getByRole('form')
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.submit(form)
    
    // Check disabled states during loading
    await waitFor(() => {
      expect(emailInput).toBeDisabled()
      expect(screen.getByRole('button', { name: /Sending\.\.\./i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Microsoft/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Apple/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Google/i })).toBeDisabled()
    })
  })
}) 