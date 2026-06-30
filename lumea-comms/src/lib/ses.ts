import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { logger } from "./logger";

// SESClient.send() is inherited from @smithy/smithy-client Client<>.
// moduleResolution:"bundler" doesn't always follow that chain — cast to
// the minimal interface we use.
type Sendable = { send(cmd: unknown): Promise<unknown> };

let _ses: SESClient | null = null;

function getSES(): Sendable {
  if (!_ses) {
    _ses = new SESClient({ region: process.env.AWS_REGION ?? "ap-south-1" });
  }
  return _ses as unknown as Sendable;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    logger.debug({ to, subject }, "📧 [DEV] email skipped — not production");
    return;
  }

  await getSES().send(
    new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL ?? "noreply@lumea.ink",
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: html } },
      },
    })
  );
}
