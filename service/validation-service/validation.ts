import { z } from "zod"

// This regex matches:
// 1. Optional Name followed by <email> 
//    OR 
// 2. Just a plain email address
const emailWithOptionalNameRegex = /^([^<]+\s*<[^>]+>|[^<>\s]+@[^<>\s]+\.[^<>\s]+)$/

const sesSenderSchema = z.string()
    .trim()
    .regex(emailWithOptionalNameRegex, {
        message: "Must be 'Name <email@domain.com>' or 'email@domain.com'",
    })

const EmailPayloadSchema = z.object({
    from: sesSenderSchema,
    replyTo: z.string().optional(),
    to: z.array(z.string()).min(1),
    subject: z.string(),
    html: z.string()
})

export type EmailPayload = z.infer<typeof EmailPayloadSchema>

export class ValidationService {

    static validateEmailPayload(payload: any): { errors: string[]; data?: EmailPayload } {
        try {
            const result = EmailPayloadSchema.parse(payload)
            return {
                errors: [],
                data: result,
            }
        } catch (e) {
            if (e instanceof z.ZodError) {
                return {
                    errors: e.issues.map(err => `'${err.path.join('.')}': ${err.message}`),
                }
            }
            return {
                errors: ['Unknown validation error'],
            }
        }
    }
}