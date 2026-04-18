import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";

export type SendMailOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Mail.Attachment[];
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Mail;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled =
      this.config.get<string>("EMAIL_ENABLED", "true").toLowerCase() === "true";

    if (!this.enabled) {
      this.logger.warn("Email sending is DISABLED (EMAIL_ENABLED=false)");
      // Create a dummy transporter so the property is always initialised
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      return;
    }

    const host = this.config.get<string>("SMTP_HOST", "127.0.0.1");
    const port = Number(this.config.get<string>("SMTP_PORT", "587"));
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASS");
    const secure = this.config.get<string>("SMTP_SECURE", "false") === "true";

    const auth = user && pass ? { user, pass } : undefined;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth,
      tls: {
        // Accept self-signed certs if you run local test servers (set false in prod).
        rejectUnauthorized:
          this.config.get<string>("SMTP_REJECT_UNAUTHORIZED", "true") ===
          "true",
      },
      // Connection timeout defaults can be set here if needed:
      // connectionTimeout: 30_000,
    });

    // verify transporter early so any config error surfaces
    this.transporter
      .verify()
      .then(() => {
        this.logger.log(
          `SMTP transporter connected: ${host}:${port} (secure=${secure})`
        );
      })
      .catch((err) => {
        this.logger.warn(
          "SMTP transporter verification failed: " + err?.message
        );
      });
  }

  private defaultFrom(): string {
    const name = this.config.get<string>("FROM_NAME") || "";
    const addr =
      this.config.get<string>("FROM_ADDRESS") ||
      this.config.get<string>("SMTP_USER") ||
      "no-reply@example.com";
    return name ? `"${name}" <${addr}>` : addr;
  }

  async sendMail(opts: SendMailOptions) {
    if (!this.enabled) {
      this.logger.debug(
        `Email skipped (EMAIL_ENABLED=false): "${opts.subject}" → ${
          Array.isArray(opts.to) ? opts.to.join(",") : opts.to
        }`
      );
      return { ok: true, skipped: true };
    }

    const from = opts.from ?? this.defaultFrom();

    const mail: Mail.Options = {
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      cc: opts.cc,
      bcc: opts.bcc,
      attachments: opts.attachments,
    };

    try {
      const info = await this.transporter.sendMail(mail);
      this.logger.log(
        `Email sent: ${info.messageId} to ${
          Array.isArray(opts.to) ? opts.to.join(",") : opts.to
        }`
      );
      return { ok: true, info };
    } catch (error) {
      this.logger.error("Failed to send email: " + (error?.message ?? error));
      return { ok: false, error };
    }
  }
}
