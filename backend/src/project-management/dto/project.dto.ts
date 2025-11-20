import { IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;
}

export class UpdateProjectDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;
}
