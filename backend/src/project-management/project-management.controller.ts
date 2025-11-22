import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Res,
  HttpStatus,
  BadRequestException,
  StreamableFile,
  UseGuards,
  Req,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { ProjectManagementService } from "./project-management.service";
import { CreateProjectDto, UpdateProjectDto } from "./dto/project.dto";
import { CreateTaskDto, UpdateTaskDto, PatchTaskDto } from "./dto/task.dto";
import { CreateCommentDto, UpdateCommentDto } from "./dto/comment.dto";
import { CreateTeamMemberDto, UpdateTeamMemberDto } from "./dto/team.dto";
import { Request } from "express";
import * as fs from "fs";
import { join } from "path";
import { JwtGuard } from "src/common/guards/jwt.guard";
import { CreateWorkspaceDto } from "./dto/workspace.dto";

@Controller("api")
@UseGuards(JwtGuard)
export class ProjectManagementController {
  constructor(private svc: ProjectManagementService) {}

  @Get("project-management/workspaces")
  getWorkspaces(@Req() req: any) {
    const userId = req.user.userId; // <-- ambil userId dari JWT
    return this.svc.getWorkspaces(userId);
  }

  // State / bootstrap
  @Get("project-management/state/:id")
  getState(@Param("id") id: string) {
    return this.svc.getState(id);
  }

  // Export XLSX
  @Get("project-management/export")
  async exportXlsx(@Res() res: Response) {
    const buffer = await this.svc.exportXlsx();
    res.set({
      "Content-Disposition":
        'attachment; filename="project-management-export.xlsx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    res.status(HttpStatus.OK).send(buffer);
  }

  // Import XLSX (multipart/form-data)
  @Post("project-management/import")
  @UseInterceptors(FileInterceptor("file"))
  async importXlsx(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("File required");
    const result = await this.svc.importXlsx(file.path);
    // optionally delete uploaded file
    try {
      fs.unlinkSync(file.path);
    } catch {
      console.log("failed unlink file");
    }
    return result;
  }

  // Workspaces
  @Post("workspaces")
  createWorkspaces(@Body() dto: CreateWorkspaceDto, @Req() req: any) {
    const userId = req.user.userId; // <-- ambil userId dari JWT
    return this.svc.createWorkspaces(dto, userId);
  }

  // Projects
  @Get("projects/:id")
  getProjects(@Param("id") id: string) {
    return this.svc.getProjects(id);
  }

  @Post("projects")
  createProject(@Body() dto: CreateProjectDto) {
    return this.svc.createProject(dto);
  }

  @Put("projects/:id")
  updateProject(@Param("id") id: string, @Body() dto: UpdateProjectDto) {
    return this.svc.updateProject(id, dto);
  }

  @Delete("projects/:id")
  deleteProject(@Param("id") id: string) {
    return this.svc.deleteProject(id);
  }

  // Tasks
  @Get("tasks")
  getTasks(@Query("projectId") projectId?: string) {
    return this.svc.getTasks(projectId);
  }

  @Post("tasks")
  createTask(@Body() dto: CreateTaskDto) {
    return this.svc.createTask(dto);
  }

  @Put("tasks/:id")
  updateTask(@Param("id") id: string, @Body() dto: UpdateTaskDto) {
    return this.svc.updateTask(id, dto);
  }

  @Patch("tasks/:id")
  patchTask(@Param("id") id: string, @Body() patch: PatchTaskDto) {
    return this.svc.patchTask(id, patch);
  }

  @Delete("tasks/:id")
  deleteTask(@Param("id") id: string) {
    return this.svc.deleteTask(id);
  }

  // Comments
  @Get("tasks/:taskId/comments")
  getComments(@Param("taskId") taskId: string) {
    return this.svc.getComments(taskId);
  }

  @Post("tasks/:taskId/comments")
  createComment(
    @Param("taskId") taskId: string,
    @Body() dto: CreateCommentDto
  ) {
    return this.svc.createComment(taskId, dto);
  }

  @Patch("tasks/:taskId/comments/:commentId")
  updateComment(
    @Param("taskId") taskId: string,
    @Param("commentId") commentId: string,
    @Body() dto: UpdateCommentDto
  ) {
    return this.svc.updateComment(taskId, commentId, dto);
  }

  @Delete("tasks/:taskId/comments/:commentId")
  deleteComment(
    @Param("taskId") taskId: string,
    @Param("commentId") commentId: string
  ) {
    return this.svc.deleteComment(taskId, commentId);
  }

  // Team members
  @Get("team/:id")
  getTeam(@Param("id") id: string) {
    return this.svc.getTeam(id);
  }

  @Post("team")
  createTeamMember(@Body() dto: CreateTeamMemberDto) {
    return this.svc.createTeamMember(dto);
  }

  @Put("team/:id")
  updateTeamMember(@Param("id") id: string, @Body() dto: UpdateTeamMemberDto) {
    return this.svc.updateTeamMember(id, dto);
  }

  @Delete("team/:id")
  deleteTeamMember(@Param("id") id: string) {
    return this.svc.deleteTeamMember(id);
  }

  // Simple uploads route (used by frontend if needed)
  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("file required");
    // Return some metadata: url/path
    const url = `/uploads/${file.filename}`;
    return { filename: file.filename, originalname: file.originalname, url };
  }
}
