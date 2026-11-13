// Claude through Amazon Bedrock (the Bedrock Mantle Messages endpoint).
//
// Turned on when AWS_REGION is set along with AWS credentials: access keys or
// an assumed role (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN,
// which the GitHub OIDC step exports), a Bedrock API key
// (AWS_BEARER_TOKEN_BEDROCK), or a named AWS_PROFILE for local runs.
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";

export const MODEL = process.env.BEDROCK_MODEL || "anthropic.claude-opus-5-5";

export function claudeEnabled(env = process.env) {
  const region = env.AWS_REGION || env.AWS_DEFAULT_REGION;
  const creds = env.AWS_ACCESS_KEY_ID || env.AWS_BEARER_TOKEN_BEDROCK || env.AWS_PROFILE;
  return Boolean(region && creds);
}

let client;
export function claude() {
  client ||= new AnthropicBedrockMantle({ awsRegion: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION });
  return client;
}

// Sends one structured-output request and returns the parsed JSON, or null
// with a log line explaining why (so callers fall back to outlet text).
export async function askJson({ system, user, schema, maxTokens = 4000, log = console.log, what = "request" }) {
  try {
    const res = await claude().messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: user }],
    });
    if (res.stop_reason !== "end_turn") {
      log(`    ${what}: stopped (${res.stop_reason}), using fallback`);
      return null;
    }
    return JSON.parse(res.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) log(`    ${what}: Bedrock rate limit, using fallback`);
    else if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
      log(`    ${what}: Bedrock refused the AWS credentials (${err.status}); check the role/keys and model access, using fallback`);
    else if (err instanceof Anthropic.APIError) log(`    ${what}: Bedrock error ${err.status ?? ""} ${err.message}, using fallback`);
    else if (err instanceof SyntaxError) log(`    ${what}: reply was not valid JSON, using fallback`);
    else if (err?.name === "CredentialsProviderError") log(`    ${what}: no usable AWS credentials, using fallback`);
    else throw err;
    return null;
  }
}
