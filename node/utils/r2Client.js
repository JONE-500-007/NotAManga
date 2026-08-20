const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const BUCKET = process.env.R2_BUCKET_NAME;

// R2 speaks the S3 API, so the regular AWS SDK works against it unmodified —
// "auto" region and the account's R2 endpoint (not a real AWS region) are
// the only R2-specific bits.
const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Every stored image_path/URL in the DB is shaped "/uploads/<key>" (a
// leftover from when it was a literal static-file path). R2 keys are that
// same string with the prefix stripped, so this is the one place the two
// address spaces get translated between each other.
function toR2Key(publicPath) {
  return publicPath.replace(/^\/uploads\//, "");
}

async function putObject(key, body, contentType) {
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

async function deleteObject(key) {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// R2 has no move/rename or recursive delete — a "folder" is just every key
// sharing a prefix, so removing one means listing every key under it and
// batch-deleting them. Paginated since ListObjectsV2 caps at 1000 keys/page.
async function deleteObjectsByPrefix(prefix) {
  let ContinuationToken;
  do {
    const listed = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken })
    );
    const keys = (listed.Contents || []).map((o) => ({ Key: o.Key }));
    if (keys.length > 0) {
      await client.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keys } }));
    }
    ContinuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (ContinuationToken);
}

// Short-lived signed URL so a privacy-gated object (a private manga's pages)
// can be handed to a browser without making the bucket itself public — the
// caller does its own visibility check first, this just mints the URL.
async function getPresignedGetUrl(key, expiresInSeconds = 300) {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

module.exports = {
  client,
  BUCKET,
  toR2Key,
  putObject,
  deleteObject,
  deleteObjectsByPrefix,
  getPresignedGetUrl,
};
