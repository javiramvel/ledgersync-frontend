import { KMSClient, EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";

// The client automatically picks up your local AWS CLI credentials
const kmsClient = new KMSClient({ region: "us-west-2" });
const KEY_ID = process.env.AWS_KMS_KEY_ID; // The ID output from Terraform

export async function encryptToken(plainText: string) {
  const command = new EncryptCommand({
    KeyId: KEY_ID,
    Plaintext: Buffer.from(plainText),
  });
  const response = await kmsClient.send(command);
  return Buffer.from(response.CiphertextBlob!).toString("base64");
}

export async function decryptToken(cipherText: string) {
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(cipherText, "base64"),
  });
  const response = await kmsClient.send(command);
  return Buffer.from(response.Plaintext!).toString("utf-8");
}
