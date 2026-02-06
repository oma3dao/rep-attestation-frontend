import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import logger from '@/lib/logger'

describe('logger', () => {
  let consoleLogSpy: any
  let consoleWarnSpy: any
  let consoleErrorSpy: any
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('log', () => {
    it('logs in development mode', () => {
      process.env.NODE_ENV = 'development'
      process.env.NEXT_PUBLIC_DEBUG_ADAPTER = 'false'
      
      logger.log('test message', { data: 123 })
      
      expect(consoleLogSpy).toHaveBeenCalledWith('test message', { data: 123 })
    })

    it('logs when NEXT_PUBLIC_DEBUG_ADAPTER is true', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_DEBUG_ADAPTER = 'true'
      
      logger.log('debug message')
      
      expect(consoleLogSpy).toHaveBeenCalledWith('debug message')
    })

    it('does not log in production without debug flag', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_DEBUG_ADAPTER = 'false'
      
      logger.log('should not appear')
      
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    it('handles multiple arguments', () => {
      process.env.NODE_ENV = 'development'
      
      logger.log('message', 1, 2, 3, { key: 'value' })
      
      expect(consoleLogSpy).toHaveBeenCalledWith('message', 1, 2, 3, { key: 'value' })
    })
  })

  describe('warn', () => {
    it('warns in development mode', () => {
      process.env.NODE_ENV = 'development'
      process.env.NEXT_PUBLIC_DEBUG_ADAPTER = 'false'
      
      logger.warn('warning message')
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('warning message')
    })

    it('warns when NEXT_PUBLIC_DEBUG_ADAPTER is true', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_DEBUG_ADAPTER = 'true'
      
      logger.warn('debug warning')
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('debug warning')
    })

    it('does not warn in production without debug flag', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_DEBUG_ADAPTER = 'false'
      
      logger.warn('should not appear')
      
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('handles multiple arguments', () => {
      process.env.NODE_ENV = 'development'
      
      logger.warn('warning', { details: 'info' })
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('warning', { details: 'info' })
    })
  })

  describe('error', () => {
    it('always logs errors regardless of environment', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_DEBUG_ADAPTER = 'false'
      
      logger.error('error message')
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('error message')
    })

    it('logs errors in development', () => {
      process.env.NODE_ENV = 'development'
      
      logger.error('dev error')
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('dev error')
    })

    it('handles Error objects', () => {
      const error = new Error('test error')
      
      logger.error('An error occurred:', error)
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('An error occurred:', error)
    })

    it('handles multiple arguments', () => {
      logger.error('error', 'context', { stack: 'trace' })
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('error', 'context', { stack: 'trace' })
    })
  })
})
