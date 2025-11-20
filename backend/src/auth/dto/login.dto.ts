// src/auth/dto/login.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class LoginDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  password?: string;
}
