// src/upload/upload.service.ts
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import path from "path";

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3: S3Client;
  private bucket: string;
  private endpoint?: string;
  private region?: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>("S3_BUCKET_NAME")!;
    this.endpoint = this.config.get<string>("S3_ENDPOINT_URL") || undefined;
    this.region = this.config.get<string>("S3_REGION") || undefined;

    // build S3 client, use endpoint if present (S3-compatible)
    const s3Config: any = {
      region: this.region || "us-east-1",
      credentials: {
        accessKeyId: this.config.get<string>("S3_ACCESS_KEY") || "",
        secretAccessKey: this.config.get<string>("S3_SECRET_KEY") || "",
      },
    };

    if (this.endpoint) {
      s3Config.endpoint = this.endpoint;
      // for many s3-compatible storages you must use path-style URLs
      s3Config.forcePathStyle = true;
    }

    this.s3 = new S3Client(s3Config);
  }

  /**
   * Upload a single file buffer to S3. Returns { key, url }.
   * folder - optional folder/key prefix (e.g. 'projects/p1/tasks/t1')
   */
  async uploadOneFile(
    file: Express.Multer.File,
    folder = ""
  ): Promise<{ key: string; url: string }> {
    try {
      const ext = path.extname(file.originalname || "") || "";
      const filename = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}${ext}`;
      const key = folder
        ? `${folder.replace(/\/+$/, "")}/${filename}`
        : filename;

      const put = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
        ACL: "public-read",
      });

      await this.s3.send(put);

      // Build public URL:
      let url: string;
      if (this.endpoint) {
        // If using S3-compatible with custom endpoint, construct as: {endpoint}/{bucket}/{key}
        // ensure no duplicate slashes
        const ep = this.endpoint.replace(/\/+$/, "");
        url = `${ep}/${this.bucket}/${encodeURI(key)}`;
      } else {
        // Standard AWS S3 public URL pattern:
        // https://{bucket}.s3.{region}.amazonaws.com/{key}
        const region = this.region || "us-east-1";
        if (region === "us-east-1") {
          // us-east-1 has special endpoint form
          url = `https://${this.bucket}.s3.amazonaws.com/${encodeURI(key)}`;
        } else {
          url = `https://${this.bucket}.s3.${region}.amazonaws.com/${encodeURI(
            key
          )}`;
        }
      }

      return { key, url };
    } catch (err: any) {
      this.logger.error("uploadOneFile failed", err);
      throw new InternalServerErrorException(
        `Failed to upload ${file.originalname}`
      );
    }
  }

  /**
   * Upload multiple files concurrently. Returns array of { key, url }.
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder = ""
  ): Promise<{ key: string; url: string }[]> {
    if (!files || files.length === 0) return [];
    const tasks = files.map((f) => this.uploadOneFile(f, folder));
    return await Promise.all(tasks);
  }
}
