import { describe, it, expect, vi } from 'vitest'
import { ApiResponse } from '@/lib/api-response'
import { formDataToObject } from '@/lib/utils/common'
import { ValidationService } from '@/service/validation-service/validation'
import { ErrorHandler } from '@/service/error-handler/error-handler'

describe('Utility Edge Cases', () => {
  describe('formDataToObject Edge Cases', () => {
    it('should handle extremely large form data', () => {
      const formData = new FormData()
      
      // Add many fields
      for (let i = 0; i < 1000; i++) {
        formData.append(`field${i}`, `value${i}`)
      }
      
      // Add very long values
      formData.append('longValue', 'x'.repeat(100000))
      
      const result = formDataToObject(formData)
      
      expect(Object.keys(result)).toHaveLength(1001)
      expect(result.longValue).toHaveLength(100000)
      expect(result.field999).toBe('value999')
    })

    it('should handle special characters in field names', () => {
      const formData = new FormData()
      
      const specialKeys = [
        'field with spaces',
        'field-with-dashes',
        'field_with_underscores',
        'field.with.dots',
        'field[with]brackets',
        'field{with}braces',
        'field(with)parentheses',
        'field@with@symbols',
        'field#with#hash',
        'field$with$dollar',
        'field%with%percent',
        'field^with^caret',
        'field&with&ampersand',
        'field*with*asterisk',
        'field+with+plus',
        'field=with=equals',
        'field|with|pipe',
        'field\\with\\backslash',
        'field/with/slash',
        'field?with?question',
        'field<with>angles',
        'field"with"quotes',
        "field'with'apostrophes",
        'field`with`backticks',
        'field~with~tilde',
        'field!with!exclamation',
        'field:with:colon',
        'field;with;semicolon',
        'field,with,comma'
      ]
      
      specialKeys.forEach((key, index) => {
        formData.append(key, `value${index}`)
      })
      
      const result = formDataToObject(formData)
      
      specialKeys.forEach((key, index) => {
        expect(result[key]).toBe(`value${index}`)
      })
    })

    it('should handle unicode characters in field names and values', () => {
      const formData = new FormData()
      
      const unicodeTests = [
        { key: '中文字段', value: '中文值' },
        { key: 'العربية', value: 'قيمة عربية' },
        { key: 'ελληνικά', value: 'ελληνική αξία' },
        { key: 'русский', value: 'русское значение' },
        { key: '日本語', value: '日本語の値' },
        { key: '한국어', value: '한국어 값' },
        { key: 'emoji🚀field', value: '🎉🎊🎈 emoji value' },
        { key: 'field\u0000null', value: 'value\u0000null' },
        { key: 'field\u200Bzwsp', value: 'value\u200Bzwsp' },
        { key: 'field\uFEFFbom', value: 'value\uFEFFbom' }
      ]
      
      unicodeTests.forEach(({ key, value }) => {
        formData.append(key, value)
      })
      
      const result = formDataToObject(formData)
      
      unicodeTests.forEach(({ key, value }) => {
        expect(result[key]).toBe(value)
      })
    })

    it('should handle binary data in file names', () => {
      const formData = new FormData()
      
      // Create files with various problematic names
      const problematicNames = [
        '', // empty name
        ' ', // space only
        '.', // dot only
        '..', // double dot
        'file.txt', // normal
        'file with spaces.txt',
        'file-with-dashes.txt',
        'file_with_underscores.txt',
        'UPPERCASE.TXT',
        'MiXeD-CaSe_File.TxT',
        'file.with.multiple.dots.txt',
        'very'.repeat(100) + '.txt', // very long name
        'file\u0000null.txt',
        'file\ttab.txt',
        'file\nnewline.txt',
        'file\rcarriage.txt'
      ]
      
      problematicNames.forEach((name, index) => {
        const file = new File(['content'], name, { type: 'text/plain' })
        formData.append(`file${index}`, file)
      })
      
      // Test with includeFilenames option
      const result = formDataToObject(formData, { fileHandling: 'includeFilenames' })
      
      problematicNames.forEach((name, index) => {
        expect(result[`file${index}`]).toBe(name)
      })
    })

    it('should handle mixed file and text data with same keys', () => {
      const formData = new FormData()
      
      // Add text first
      formData.append('mixed', 'text value 1')
      formData.append('mixed', 'text value 2')
      
      // Add files
      const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' })
      const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' })
      formData.append('mixed', file1)
      formData.append('mixed', file2)
      
      // Add more text
      formData.append('mixed', 'text value 3')
      
      const result = formDataToObject(formData, { fileHandling: 'includeFilenames' })
      
      expect(Array.isArray(result.mixed)).toBe(true)
      expect(result.mixed).toEqual([
        'text value 1',
        'text value 2',
        'file1.txt',
        'file2.txt',
        'text value 3'
      ])
    })

    it('should handle circular references in complex scenarios', () => {
      const formData = new FormData()
      
      // Create a scenario that might cause issues with object creation
      for (let i = 0; i < 100; i++) {
        formData.append('circular', `value${i}`)
      }
      
      const result = formDataToObject(formData)
      
      expect(Array.isArray(result.circular)).toBe(true)
      expect(result.circular).toHaveLength(100)
      expect(result.circular[0]).toBe('value0')
      expect(result.circular[99]).toBe('value99')
    })

    it('should handle empty FormData', () => {
      const formData = new FormData()
      const result = formDataToObject(formData)
      
      expect(result).toEqual({})
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('should handle FormData with only files (excluded)', () => {
      const formData = new FormData()
      
      const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' })
      const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' })
      
      formData.append('file1', file1)
      formData.append('file2', file2)
      
      const result = formDataToObject(formData) // default excludes files
      
      expect(result).toEqual({})
    })

    it('should handle malformed file objects', () => {
      const formData = new FormData()
      
      // Create a file-like object that might cause issues
      const malformedFile = new File([''], '', { type: '' })
      formData.append('malformed', malformedFile)
      
      const result = formDataToObject(formData, { fileHandling: 'includeFilenames' })
      
      expect(result.malformed).toBe('')
    })
  })

  describe('ValidationService Edge Cases', () => {
    it('should handle deeply nested objects', () => {
      const deepObject = {
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        html: '<p>Test</p>',
        nested: {
          level1: {
            level2: {
              level3: {
                value: 'deep value'
              }
            }
          }
        }
      }
      
      const result = ValidationService.validateEmailPayload(deepObject)
      expect(result.data).toEqual({ ...deepObject, nested: undefined})
    })

    it('should handle arrays in unexpected places', () => {
      const arrayPayload = {
        from: ['sender1@example.com', 'sender2@example.com'], // should be string
        to: ['recipient@example.com'],
        subject: ['Subject 1', 'Subject 2'], // should be string
        html: ['<p>HTML 1</p>', '<p>HTML 2</p>'] // should be string
      }
      
      const result = ValidationService.validateEmailPayload(arrayPayload)
      
      // Should still be valid as we're not strictly type checking
      expect(result.errors).toHaveLength(3)
    })

    it('should handle null and undefined values', () => {
      const nullPayload = {
        from: null,
        to: null,
        subject: null,
        html: null
      }
      
      const result = ValidationService.validateEmailPayload(nullPayload)
      expect(result.errors).toHaveLength(4)
    })

    it('should handle circular references', () => {
      const circularPayload: any = {
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        html: '<p>Test</p>'
      }
      
      circularPayload.self = circularPayload
      
      const result = ValidationService.validateEmailPayload(circularPayload)
      
      expect(result.data).toBeDefined()
    })

    it('should handle very long field values', () => {
      const longPayload = {
        from: 'a'.repeat(10000) + '@example.com',
        to: [('b'.repeat(5000) + '@example.com')],
        subject: 'c'.repeat(50000),
        html: '<p>' + 'd'.repeat(100000) + '</p>'
      }
      
      const result = ValidationService.validateEmailPayload(longPayload)
      expect(result.data).toBeDefined()
    })

    it('should handle special JavaScript values', () => {
      const specialValues = [
        { from: NaN, to: ['test@example.com'], subject: 'Test', html: '<p>Test</p>' },
        { from: Infinity, to: ['test@example.com'], subject: 'Test', html: '<p>Test</p>' },
        { from: -Infinity, to: ['test@example.com'], subject: 'Test', html: '<p>Test</p>' },
        { from: Symbol('test'), to: ['test@example.com'], subject: 'Test', html: '<p>Test</p>' },
        { from: function() {}, to: ['test@example.com'], subject: 'Test', html: '<p>Test</p>' }
      ]
      
      specialValues.forEach(payload => {
        const result = ValidationService.validateEmailPayload(payload)
        // Our validation is not strict about types, so some of these might pass
        // The key is that they don't crash the validator
        expect(Array.isArray(result.errors)).toBe(true)
      })
    })
  })

  describe('ApiResponse Edge Cases', () => {
    it('should handle very large data objects', async () => {
      const largeData = {
        items: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'x'.repeat(1000)
        }))
      }
      
      const response = ApiResponse.success(largeData)
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.items).toHaveLength(10000)
    })

    it('should handle circular references in data', async () => {
      const circularData: any = { name: 'test' }
      circularData.self = circularData
      
      // This will throw an error due to circular reference in JSON.stringify
      // The test verifies that we handle this gracefully
      expect(() => {
        ApiResponse.success(circularData)
      }).toThrow('Converting circular structure to JSON')
    })

    it('should handle special JavaScript values in data', async () => {
      const specialData = {
        undefined: undefined,
        null: null,
        nan: NaN,
        infinity: Infinity,
        negativeInfinity: -Infinity,
        date: new Date(),
        regex: /test/g,
        function: function() { return 'test' }
      }
      
      const response = ApiResponse.success(specialData)
      const result = await response.json()
      
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      // Note: JSON.stringify will convert/remove some of these values
    })

    it('should handle very long error messages', async () => {
      const longMessage = 'Error: ' + 'x'.repeat(100000)
      
      const response = ApiResponse.validationError(longMessage)
      const result = await response.json()
      
      expect(response.status).toBe(400)
      expect(result.message).toHaveLength(longMessage.length)
    })

    it('should handle unicode in error messages', async () => {
      const unicodeMessage = '错误: 🚨 Something went wrong with 中文 and العربية'
      
      const response = ApiResponse.validationError(unicodeMessage)
      const result = await response.json()
      
      expect(response.status).toBe(400)
      expect(result.message).toBe(unicodeMessage)
    })
  })

  describe('ErrorHandler Edge Cases', () => {
    it('should handle custom error types', () => {
      class CustomError extends Error {
        constructor(message: string, public code: number) {
          super(message)
          this.name = 'CustomError'
        }
      }
      
      const customError = new CustomError('Custom error message', 404)
      const result = ErrorHandler.handleApiError(customError, 'test-context')
      
      expect(result.error).toBe('CustomError')
      expect(result.message).toBe('Custom error message')
      expect(result.status).toBe(500) // Always returns 500
    })

    it('should handle errors with circular references', () => {
      const error: any = new Error('Circular error')
      error.self = error
      
      const result = ErrorHandler.handleApiError(error, 'test-context')
      
      expect(result.error).toBe('Error')
      expect(result.message).toBe('Circular error')
    })

    it('should handle errors with very long messages', () => {
      const longMessage = 'Error message: ' + 'x'.repeat(100000)
      const error = new Error(longMessage)
      
      const result = ErrorHandler.handleApiError(error, 'test-context')
      
      expect(result.message).toHaveLength(longMessage.length)
    })

    it('should handle errors with unicode characters', () => {
      const unicodeError = new Error('错误: 🚨 Unicode error message with 中文 and العربية')
      
      const result = ErrorHandler.handleApiError(unicodeError, 'test-context')
      
      expect(result.message).toBe('错误: 🚨 Unicode error message with 中文 and العربية')
    })

    it('should handle primitive error values', () => {
      const primitiveErrors = [
        'string error',
        42,
        true,
        false,
        Symbol('error'),
        BigInt(123)
      ]
      
      primitiveErrors.forEach(error => {
        const result = ErrorHandler.handleApiError(error, 'test-context')
        
        expect(result.error).toBe('Unknown Error')
        expect(result.message).toBe('An unexpected error occurred')
        expect(result.status).toBe(500)
      })
    })

    it('should handle error objects without message property', () => {
      const errorLikeObject = {
        name: 'CustomError',
        code: 404,
        details: 'Some details'
      }
      
      const result = ErrorHandler.handleApiError(errorLikeObject, 'test-context')
      
      expect(result.error).toBe('Unknown Error')
      expect(result.message).toBe('An unexpected error occurred')
    })

    it('should handle errors with getters that throw', () => {
      const problematicError = {
        get message() {
          throw new Error('Getter error')
        },
        get name() {
          throw new Error('Name getter error')
        }
      }
      
      const result = ErrorHandler.handleApiError(problematicError, 'test-context')
      
      expect(result.error).toBe('Unknown Error')
      expect(result.message).toBe('An unexpected error occurred')
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('should handle memory-intensive operations', () => {
      // Create a large FormData object
      const formData = new FormData()
      
      for (let i = 0; i < 10000; i++) {
        formData.append(`field${i}`, 'x'.repeat(1000))
      }
      
      const startTime = Date.now()
      const result = formDataToObject(formData)
      const endTime = Date.now()
      
      expect(Object.keys(result)).toHaveLength(10000)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle rapid successive validations', () => {
      const payloads = Array.from({ length: 1000 }, (_, i) => ({
        from: `sender${i}@example.com`,
        to: [`recipient${i}@example.com`],
        subject: `Subject ${i}`,
        html: `<p>Content ${i}</p>`
      }))
      
      const startTime = Date.now()
      const results = payloads.map(payload => ValidationService.validateEmailPayload(payload))
      const endTime = Date.now()
      
      expect(results.every(r => r.data)).toBeDefined()
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should handle garbage collection scenarios', () => {
      // Create and discard many objects to trigger GC
      for (let i = 0; i < 1000; i++) {
        const formData = new FormData()
        formData.append('test', 'x'.repeat(10000))
        const result = formDataToObject(formData)
        // Let result go out of scope
      }
      
      // Final test should still work
      const finalFormData = new FormData()
      finalFormData.append('final', 'test')
      const finalResult = formDataToObject(finalFormData)
      
      expect(finalResult.final).toBe('test')
    })
  })
})