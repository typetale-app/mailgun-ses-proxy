import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST as v3MessagesPost } from "@/app/v3/[siteId]/messages/route"
import { POST as v1SendPost } from "@/app/v1/send/route"
import { POST as statsPost } from "@/app/stats/[action]/route"
import { addNewsletterToQueue } from "@/service/newsletter-service"
import { sendSystemMail } from "@/service/transaction-email-service"
import { getNewsletterUsage } from "@/service/stats-service"
import { ApiResponse } from "@/lib/api-response"
import { NextRequest } from "next/server"
import { formDataToObject } from "@/lib/core/common"
import { ValidationService } from "@/service/validation-service/validation"
import { ErrorHandler } from "@/service/error-handler/error-handler"

describe("Comprehensive API Test Suite", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe("Newsletter API (v3/messages)", () => {
        it("should successfully queue newsletter messages", async () => {
            // Arrange
            const mockFormData = new FormData()
            mockFormData.append("from", "newsletter@example.com")
            mockFormData.append("to", "subscriber@example.com")
            mockFormData.append("subject", "Weekly Newsletter")
            mockFormData.append("html", "<h1>Newsletter Content</h1>")
            mockFormData.append("v:email-id", "batch-123")

            const request = {
                formData: vi.fn().mockResolvedValue(mockFormData),
            } as unknown as Request

            const params = Promise.resolve({ siteId: "site-123" })

            vi.mocked(addNewsletterToQueue).mockResolvedValue({
                messageId: "msg-123",
                batchId: "batch-123",
            })

            // Act
            const response = await v3MessagesPost(request, { params })
            const result = await response.json()

            // Assert
            expect(response.status).toBe(200)
            expect(result.id).toEqual("batch-123")
            expect(addNewsletterToQueue).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: "newsletter@example.com",
                    to: "subscriber@example.com",
                    subject: "Weekly Newsletter",
                    html: "<h1>Newsletter Content</h1>",
                    "v:email-id": "batch-123",
                }),
                "site-123"
            )
        })

        it("should handle missing siteId", async () => {
            const request = {} as Request
            const params = Promise.resolve({ siteId: "" })

            const response = await v3MessagesPost(request, { params })
            const result = await response.json()

            expect(response.status).toBe(400)
            expect(result.message).toBe("siteId is required")
        })

        it("should handle service errors", async () => {
            const mockFormData = new FormData()
            mockFormData.append("from", "sender@example.com")

            const request = {
                formData: vi.fn().mockResolvedValue(mockFormData),
            } as unknown as Request

            const params = Promise.resolve({ siteId: "site-123" })

            vi.mocked(addNewsletterToQueue).mockRejectedValue(new Error("Service error"))

            const response = await v3MessagesPost(request, { params })
            const result = await response.json()

            expect(response.status).toBe(400)
            expect(result.message).toBe("Service error")
        })
    })

    describe("System Email API (v1/send)", () => {
        it("should send system emails successfully", async () => {
            const emailPayload = {
                to: ["recipient@example.com"],
                subject: "Test Subject",
                html: "<p>Test content</p>",
            }

            const request = {
                json: vi.fn().mockResolvedValue(emailPayload),
            } as unknown as NextRequest

            vi.mocked(sendSystemMail).mockResolvedValue({
                messageId: "msg-123",
                dbId: "db-123",
            })

            const response = await v1SendPost(request as any)
            const result = await response.json()

            expect(response.status).toBe(200)
            expect(result.success).toBe(true)
            expect(result.data.messageId).toBe("msg-123")
        })

        it("should validate email payloads", async () => {
            const invalidPayload = {
                subject: "Test Subject",
                // Missing required fields
            }

            const request = {
                json: vi.fn().mockResolvedValue(invalidPayload),
            } as unknown as NextRequest

            const response = await v1SendPost(request)
            const result = await response.json()

            expect(response.status).toBe(400)
            expect(result.success).toBe(false)
            expect(result.error).toBe("Validation Error")
        })
    })

    describe("Stats API (stats/action)", () => {
        it("should get newsletter usage statistics", async () => {
            const statsPayload = {
                from: Date.now() - 86400000,
                to: Date.now(),
                siteId: "site-123",
            }

            const request = {
                json: vi.fn().mockResolvedValue(statsPayload),
            } as unknown as Request

            const params = Promise.resolve({ action: "getNewsletterUsage" })

            vi.mocked(getNewsletterUsage).mockResolvedValue({
                status: "ok",
                data: {
                    forRange: {
                        gte: new Date(statsPayload.from),
                        lte: new Date(statsPayload.to),
                    },
                    message: "newsletter usage",
                    count: 42,
                    timestamp: new Date().toISOString(),
                },
            })

            const response = await statsPost(request, { params })
            const result = await response.json()

            expect(response.status).toBe(200)
            expect(result.status).toBe("ok")
            expect(result.data.count).toBe(42)
        })

        it("should handle invalid actions", async () => {
            const request = {
                json: vi.fn().mockResolvedValue({}),
            } as unknown as Request

            const params = Promise.resolve({ action: "invalidAction" })

            const response = await statsPost(request, { params })
            const result = await response.json()

            expect(response.status).toBe(400)
            expect(result.message).toBe("Invalid action")
        })
    })

    describe("Utility Functions", () => {
        it("should convert form data to objects correctly", () => {
            const formData = new FormData()
            formData.append("from", "sender@example.com")
            formData.append("to", "recipient1@example.com")
            formData.append("to", "recipient2@example.com")
            formData.append("subject", "Test Subject")

            const result = formDataToObject(formData)

            expect(result).toEqual({
                from: "sender@example.com",
                to: ["recipient1@example.com", "recipient2@example.com"],
                subject: "Test Subject",
            })
        })

        it("should validate email payloads", () => {
            const validPayload = {
                from: "sender@example.com",
                to: ["recipient@example.com"],
                subject: "Test Subject",
                html: "<p>Test</p>",
            }

            const result = ValidationService.validateEmailPayload(validPayload)
            expect(result.errors).toEqual([])
            expect(result.data).toEqual(validPayload)
        })

        it("should handle validation errors", () => {
            const invalidPayload = {}

            const result = ValidationService.validateEmailPayload(invalidPayload)
            expect(result.errors[0]).toContain("'from'")
            expect(result.errors[1]).toContain("'to'")
            expect(result.errors[2]).toContain("'subject'")
            expect(result.errors[3]).toContain("'html'")
        })

        it("should create proper API responses", async () => {
            const successResponse = ApiResponse.success({ id: 123 }, "Custom message")
            const successResult = await successResponse.json()

            expect(successResponse.status).toBe(200)
            expect(successResult).toEqual({
                success: true,
                data: { id: 123 },
                message: "Custom message",
                timestamp: successResult.timestamp
            })

            const errorResponse = ApiResponse.validationError("Validation failed")
            const errorResult = await errorResponse.json()

            expect(errorResponse.status).toBe(400)
            expect(errorResult).toEqual({
                success: false,
                error: "Validation Error",
                message: "Validation failed",
                timestamp: expect.any(String),
            })
        })

        it("should handle errors properly", () => {
            const error = new Error("Test error")
            error.name = "TestError"

            const result = ErrorHandler.handleApiError(error, "test-context")

            expect(result).toEqual({
                error: "TestError",
                message: "Test error",
                status: 500,
                context: "test-context",
            })

            const unknownError = "string error"
            const unknownResult = ErrorHandler.handleApiError(unknownError, "test-context")

            expect(unknownResult).toEqual({
                error: "Unknown Error",
                message: "An unexpected error occurred",
                status: 500,
                context: "test-context",
            })
        })
    })

    describe("Error Handling", () => {
        it("should handle service errors consistently", async () => {
            // Test newsletter service error
            const mockFormData = new FormData()
            mockFormData.append("from", "sender@example.com")

            const newsletterRequest = {
                formData: vi.fn().mockResolvedValue(mockFormData),
            } as unknown as Request

            const newsletterParams = Promise.resolve({ siteId: "site-123" })

            vi.mocked(addNewsletterToQueue).mockRejectedValue(new Error("Queue unavailable"))

            const newsletterResponse = await v3MessagesPost(newsletterRequest, { params: newsletterParams })
            const newsletterResult = await newsletterResponse.json()

            expect(newsletterResponse.status).toBe(400)
            expect(newsletterResult.message).toBe("Queue unavailable")

            // Test system email service error
            const systemEmailRequest = {
                json: vi.fn().mockResolvedValue({
                    to: ["test@example.com"],
                    subject: "Test",
                    html: "<p>Test</p>",
                }),
            } as unknown as NextRequest

            vi.mocked(sendSystemMail).mockRejectedValue(new Error("SES unavailable"))

            const systemResponse = await v1SendPost(systemEmailRequest as any)
            const systemResult = await systemResponse.json()

            expect(systemResponse.status).toBe(500)
            expect(systemResult.success).toBe(false)

            // Test stats service error
            const statsRequest = {
                json: vi.fn().mockResolvedValue({
                    from: Date.now() - 86400000,
                    to: Date.now(),
                    siteId: "site-123",
                }),
            } as unknown as Request

            const statsParams = Promise.resolve({ action: "getNewsletterUsage" })

            vi.mocked(getNewsletterUsage).mockRejectedValue(new Error("Database error"))

            const statsResponse = await statsPost(statsRequest, { params: statsParams })
            const statsResult = await statsResponse.json()

            expect(statsResponse.status).toBe(500)
            expect(statsResult.message).toBe("Internal server error")
        })
    })

    describe("Integration Scenarios", () => {
        it("should handle complete workflow", async () => {
            // Step 1: Queue newsletter
            const mockFormData = new FormData()
            mockFormData.append("from", "newsletter@example.com")
            mockFormData.append("to", "subscriber@example.com")
            mockFormData.append("subject", "Newsletter")
            mockFormData.append("html", "<h1>Content</h1>")
            mockFormData.append("v:email-id", "batch-456")

            const newsletterRequest = {
                formData: vi.fn().mockResolvedValue(mockFormData),
            } as unknown as Request

            vi.mocked(addNewsletterToQueue).mockResolvedValue({
                messageId: "msg-456",
                batchId: "batch-456",
            })

            const newsletterResponse = await v3MessagesPost(newsletterRequest, {
                params: Promise.resolve({ siteId: "site-456" }),
            })

            expect(newsletterResponse.status).toBe(200)

            // Step 2: Send notification email
            const notificationRequest = {
                json: vi.fn().mockResolvedValue({
                    to: ["admin@example.com"],
                    subject: "Newsletter Queued",
                    html: "<p>Newsletter batch-456 queued</p>",
                }),
            } as unknown as NextRequest

            vi.mocked(sendSystemMail).mockResolvedValue({
                messageId: "notification-msg",
                dbId: "notification-db",
            })

            const notificationResponse = await v1SendPost(notificationRequest as any)

            expect(notificationResponse.status).toBe(200)

            // Step 3: Check stats
            const statsRequest = {
                json: vi.fn().mockResolvedValue({
                    from: Date.now() - 86400000,
                    to: Date.now(),
                    siteId: "site-456",
                }),
            } as unknown as Request

            vi.mocked(getNewsletterUsage).mockResolvedValue({
                status: "ok",
                data: {
                    forRange: { gte: new Date(), lte: new Date() },
                    message: "newsletter usage",
                    count: 1,
                    timestamp: new Date().toISOString(),
                },
            })

            const statsResponse = await statsPost(statsRequest, {
                params: Promise.resolve({ action: "getNewsletterUsage" }),
            })

            expect(statsResponse.status).toBe(200)

            // Verify all services were called
            expect(addNewsletterToQueue).toHaveBeenCalled()
            expect(sendSystemMail).toHaveBeenCalled()
            expect(getNewsletterUsage).toHaveBeenCalled()
        })
    })
})
