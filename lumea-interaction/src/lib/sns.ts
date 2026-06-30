import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { logger } from "./logger";

let _sns: SNSClient | null = null;

function getSNS(): SNSClient {
  if (!_sns) {
    _sns = new SNSClient({ region: process.env.AWS_REGION ?? "ap-south-1" });
  }
  return _sns;
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
