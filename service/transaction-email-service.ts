import { MessageTag, SendEmailCommand, SendEmailCommandOutput } from "@aws-sdk/client-sesv2"
import logger from "../lib/core/logger"
import { prisma } from "./db-service"
import { EmailPayload } from "./validation-service"
import { awsService } from "./aws-service"

class TransactionalEmailService {

    private log = logger.child({ module: "service:transactional-email-service" })

    constructor() {
        if (!process.env.TRANSACTIONAL_CONFIGURATION_SET_NAME) {
            throw new Error("env variable TRANSACTIONAL_CONFIGURATION_SET_NAME is not defined")
        }
    }

    formatEmail(email: EmailPayload, tags: MessageTag[]) {
        return {
            ConfigurationSetName: process.env.TRANSACTIONAL_CONFIGURATION_SET_NAME,
            FromEmailAddress: email.from,
            Destination: {
                ToAddresses: email.to,
            },
            ReplyToAddresses: email.replyTo ? [email.replyTo] : [],
            FeedbackForwardingEmailAddress: email.replyTo || email.from,
            Content: {
                Simple: {
                    Subject: {
                        Data: email.subject,
                    },
                    Body: {
                        Html: {
                            Data: email.html,
                        },
                    },
                },
            },
            EmailTags: tags
        }
    }

    async sendMail(email: EmailPayload): Promise<SendEmailCommandOutput> {
        const mail = this.formatEmail(email, [{ Name: 'transactional-email', Value: 'true' }])
        const cmd = new SendEmailCommand(mail)
        this.log.debug({ mail }, "sending email")
        return awsService.sesSystemClient().send(cmd)
    }

    async saveSystemEmail(resp: SendEmailCommandOutput, email: EmailPayload) {
        if (resp.MessageId) {
            const { id } = await prisma.systemMails.create({
                select: { id: true },
                data: {
                    messageId: resp.MessageId!,
                    toEmail: email.to.join(","),
                    fromEmail: email.from,
                    subject: email.subject,
                    contents: email.html,
                }
            })
            this.log.debug({ email }, "email saved")
            return { id }
        }
        this.log.error({ resp, email }, "email not saved")
        throw new Error("Email not saved")
    }

    async sendSystemMail(email: EmailPayload) {
        if (!email.to) throw new Error("Email to address is required")
        const resp = await this.sendMail(email)
        const { id } = await this.saveSystemEmail(resp, email)
        this.log.info({ resp, to: email.to }, "system mail sent")
        return { messageId: resp.MessageId, dbId: id }
    }
}

export const transactionalEmailService = new TransactionalEmailService()







