import { z } from "zod"

export type EmailPayload = z.infer<typeof ValidationService.EmailPayloadSchema>

export class ValidationService {

    static emailWithOptionalNameRegex = /^([^<]+\s*<[^>]+>|[^<>\s]+@[^<>\s]+\.[^<>\s]+)$/

    static sesSenderSchema = z.string()
        .trim()
        .regex(this.emailWithOptionalNameRegex, {
            message: "Must be 'Name <email@domain.com>' or 'email@domain.com'",
        })

    static EmailPayloadSchema = z.object({
        from: this.sesSenderSchema,
        replyTo: z.string().optional(),
        to: z.array(z.string()).min(1),
        subject: z.string(),
        html: z.string()
    })

    static formatError(e: any) {
        if (e instanceof z.ZodError) {
            return e.issues.map(err => `'${err.path.join('.')}': ${err.message}`)
        }
        return ['Unknown validation error']
    }

    static validateEmailPayload(payload: any): { errors: string[]; data?: EmailPayload } {
        try {
            const result = this.EmailPayloadSchema.parse(payload)
            return {
                errors: [],
                data: result,
            }
        } catch (e) {
            return {
                errors: this.formatError(e),
                data: undefined
            }
        }
    }
}