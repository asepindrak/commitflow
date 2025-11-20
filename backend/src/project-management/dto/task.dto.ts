import { IsOptional, IsString, IsDateString } from "class-validator";

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  projectId?: string; // nullable FK to Project (UUID)

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  assigneeId?: string | null; // nullable FK to TeamMember (UUID)

  @IsOptional()
  @IsString()
  priority?: string | null;

  // store date fields as strings (ISO or YYYY-MM-DD)
  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  clientId?: string | null;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  projectId?: string | null;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  assigneeId?: string | null;

  @IsOptional()
  @IsString()
  priority?: string | null;

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;
}

export class PatchTaskDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  projectId?: string | null;

  @IsOptional()
  assigneeId?: string | null;

  @IsOptional()
  @IsString()
  priority?: string | null;

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;
}
