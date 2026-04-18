import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { SprintService } from "./sprint.service";
import { JwtGuard } from "src/common/guards/jwt.guard";

@Controller("api/sprints")
@UseGuards(JwtGuard)
export class SprintController {
  constructor(private svc: SprintService) {}

  @Post()
  create(
    @Body()
    body: {
      workspaceId: string;
      name: string;
      description?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.svc.create(body);
  }

  @Get()
  findAll(@Query("workspaceId") workspaceId: string) {
    return this.svc.findAll(workspaceId);
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.svc.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }

  @Get(":id/tasks")
  getSprintTasks(@Param("id") id: string) {
    return this.svc.getSprintTasks(id);
  }

  @Put(":id/assign-task")
  assignTask(@Param("id") id: string, @Body("taskId") taskId: string) {
    return this.svc.assignTask(taskId, id);
  }

  @Put("unassign-task/:taskId")
  unassignTask(@Param("taskId") taskId: string) {
    return this.svc.assignTask(taskId, null);
  }
}
