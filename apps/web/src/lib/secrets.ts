import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const client = new SecretManagerServiceClient();

const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? "setu-realestate";

/**
 * Stores a value as a new version of an existing Secret Manager secret.
 * The secret container itself must already exist — this only adds a
 * version to it, matching the least-privilege `secretVersionAdder` role
 * granted to the runtime service account.
 */
export async function addSecretVersion(
  secretName: string,
  value: string,
): Promise<void> {
  await client.addSecretVersion({
    parent: `projects/${projectId}/secrets/${secretName}`,
    payload: {
      data: Buffer.from(value, "utf8"),
    },
  });
}
