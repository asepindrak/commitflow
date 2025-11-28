// src/upload/upload.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { UploadService } from "./upload.service";
import multer from "multer";
import { Public } from "src/auth/public.decorator";

@Controller("upload")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /upload
   * multipart form:
   *  - file: single or multiple files (use input name "file")
   *  - folder: optional form field for prefix
   *
   * Response:
   * { success: true, uploaded: [ { key, url }, ... ] }
   */
  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FilesInterceptor("file", 20, {
      storage: multer.memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // max 50MB per file (tweak as needed)
    })
  )
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body("folder") folder?: string
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'No file provided. Use field name "file" in multipart form.'
      );
    }

    // sanitize folder - disallow leading ../ for safety
    const safeFolder = folder
      ? folder.replace(/\.\.+/g, "").replace(/^\/+/, "")
      : "";

    const uploaded = await this.uploadService.uploadMultipleFiles(
      files,
      safeFolder
    );

    return {
      success: true,
      count: uploaded.length,
      uploaded,
    };
  }
}
