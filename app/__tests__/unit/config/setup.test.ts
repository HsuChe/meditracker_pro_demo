describe('Jest Configuration', () => {
  describe('Environment Variables', () => {
    it('should have claims table environment variable set', () => {
      expect(process.env.CLAIMS_TABLE).toBe('claims_dummy');
    });
  });

  describe('Console Mocks', () => {
    it('should mock console methods', () => {
      console.log('test log');
      console.error('test error');
      console.warn('test warn');
      
      expect(console.log).toHaveBeenCalledWith('test log');
      expect(console.error).toHaveBeenCalledWith('test error');
      expect(console.warn).toHaveBeenCalledWith('test warn');
    });
  });

  describe('Window APIs', () => {
    it('should mock matchMedia', () => {
      const mediaQuery = window.matchMedia('(min-width: 768px)');
      expect(mediaQuery.matches).toBe(false);
      expect(mediaQuery.addEventListener).toBeDefined();
      expect(mediaQuery.removeEventListener).toBeDefined();
    });

    it('should mock IntersectionObserver', () => {
      const observer = new IntersectionObserver(() => {});
      expect(observer.observe).toBeDefined();
      expect(observer.unobserve).toBeDefined();
      expect(observer.disconnect).toBeDefined();
    });
  });

  describe('Next.js Router', () => {
    it('should mock next/router', async () => {
      const { useRouter } = require('next/router');
      const router = useRouter();
      
      router.push('/test');
      expect(router.push).toHaveBeenCalledWith('/test');
      
      router.replace('/other');
      expect(router.replace).toHaveBeenCalledWith('/other');
    });

    it('should mock next/navigation', async () => {
      const { useRouter, usePathname, useSearchParams } = require('next/navigation');
      const router = useRouter();
      const pathname = usePathname();
      const searchParams = useSearchParams();
      
      router.push('/test');
      expect(router.push).toHaveBeenCalledWith('/test');
      expect(pathname).toBe('/');
      expect(searchParams).toBeInstanceOf(URLSearchParams);
    });
  });

  describe('TextEncoder/TextDecoder', () => {
    it('should have TextEncoder and TextDecoder available globally', () => {
      expect(global.TextEncoder).toBeDefined();
      expect(global.TextDecoder).toBeDefined();
      
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      const text = 'Hello, World!';
      const encoded = encoder.encode(text);
      const decoded = decoder.decode(encoded);
      
      expect(decoded).toBe(text);
    });
  });

  describe('Mock Clearing', () => {
    it('should clear mocks between tests', () => {
      const mockFn = jest.fn();
      mockFn();
      expect(mockFn).toHaveBeenCalled();
      
      jest.clearAllMocks();
      expect(mockFn).not.toHaveBeenCalled();
    });
  });
}); 