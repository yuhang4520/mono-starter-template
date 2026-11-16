import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
export interface FileStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  sign(key: string): Promise<string>;
}
export function createStorage(): FileStorage {
  let client: S3Client | undefined;
  function configured() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET is required");
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) throw new Error("Both S3 credential variables are required together");
    client ??= new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
    return { client, bucket };
  }
  return {
    async put(key, body, contentType) {
      const { client, bucket } = configured();
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async sign(key) {
      const { client, bucket } = configured();
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: "attachment" }), { expiresIn: 900 });
    },
  };
}
export const uploadTypes: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf" };
export function validFileSignature(buffer: Buffer, type: string) {
  if (type === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === "image/jpeg") return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (type === "image/webp") return buffer.subarray(0,4).toString() === "RIFF" && buffer.subarray(8,12).toString() === "WEBP";
  if (type === "application/pdf") return buffer.subarray(0,5).toString() === "%PDF-";
  return false;
}
