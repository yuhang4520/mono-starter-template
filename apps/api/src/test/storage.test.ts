import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createStorage, validFileSignature } from "../lib/storage";

test("file signatures reject mislabeled uploads", () => {
  assert.equal(validFileSignature(Buffer.from("<svg>"), "image/png"), false);
  assert.equal(validFileSignature(Buffer.from("%PDF-1.7"), "application/pdf"), true);
  assert.equal(validFileSignature(Buffer.from([137,80,78,71,13,10,26,10]), "image/png"), true);
  assert.equal(validFileSignature(Buffer.alloc(0), "image/jpeg"), false);
});

test("private S3 upload and signed retrieval", { skip: !process.env.TEST_S3_ENDPOINT }, async () => {
  process.env.S3_ENDPOINT = process.env.TEST_S3_ENDPOINT;
  const storage = createStorage();
  const key = `users/${randomUUID()}/${randomUUID()}.pdf`;
  const client = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || "us-east-1", forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } });
  try {
    const body = Buffer.from("%PDF-1.7\ntemplate-storage-test");
    await storage.put(key, body, "application/pdf");
    const signed = await fetch(await storage.sign(key));
    assert.equal(signed.status, 200);
    assert.deepEqual(Buffer.from(await signed.arrayBuffer()), body);
    const unsigned = await fetch(`${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`);
    assert.equal(unsigned.status, 403);
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    client.destroy();
  }
});
