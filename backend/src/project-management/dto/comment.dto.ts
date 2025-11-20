import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateCommentDto {
    @IsString()
    author: string;

    @IsString()
    body: string;

    @IsOptional()
    @IsArray()
    attachments?: any[];
}

export class UpdateCommentDto {
    @IsOptional()
    @IsString()
    body?: string;

    @IsOptional()
    @IsArray()
    attachments?: any[];
}
