import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { logger } from "./logger";

// SNSClient.send() is inherited from @smithy/smithy-client Client<>.
// moduleResolution:"bundler" doesn't always follow that chain, so we
// cast to the minimal interface we actually use.
type Sendable = { send(cmd: unknown): Promise<unknown> };

let _sns: SNSClient | null = null;

function getSNS(): Sendable {
  if (!_sns) {
    _sns = new SNSClient({ region: process.env.AWS_REGION ?? "ap-south-1" });
  }
  return _sns as unknown as Sendable;
}

export async function publishEvent(
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  const topicArn = process.env.SNS_TOPIC_ARN;
  if (!topicArn) return; // SNS not configured — skip silently

  try {
    await getSNS().send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify({ eventType, data, timestamp: new Date().toISOString() }),
        MessageAttributes: {
          eventType: { DataType: "String", StringValue: eventType },
        },
      })
    );
  } catch (err) {
    logger.warn({ err, eventType }, "SNS publish failed — continuing without event");
  }
}
