// src/auth/dto/register.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class RegisterDto {
  @IsOptional()
  @IsString()
  clientTempId?: string; // optional, FE optimistic id

  @IsString()
  workspace: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  password?: string;
}
