// src/ask.service.ts
import { Injectable } from "@nestjs/common";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { Socket } from "socket.io";
import logger from "vico-logger";
import { PrismaClient } from "@prisma/client";
import { SYSTEM_MESSAGE } from "../common/ai.constants";
import { tools } from "./tools.constants";
import { getContributors, getRepos } from "./github.service";
import {
  getAllTasks,
  getDoneTasks,
  getInProgressTasks,
  getLowTasks,
  getMediumTasks,
  getMembers,
  getProjects,
  getTodoTasks,
  getUnassignedTasks,
  getUrgentTasks,
} from "./project.service";

const prisma = new PrismaClient();
dotenv.config();

@Injectable()
export class AskService {
  private emitThinking(socket: Socket | undefined, message: string) {
    if (socket) {
      socket.emit("ai_thinking", { type: "thinking", message });
    }
  }

  private emitToolCall(socket: Socket | undefined, tool: string, args: any) {
    if (socket) {
      socket.emit("ai_thinking", {
        type: "tool_call",
        message: `🤖 CommitFlow is processing the tool request: ${tool}`,
        tool,
        args,
      });
    }
  }

  private emitToolResult(
    socket: Socket | undefined,
    tool: string,
    result: any
  ) {
    if (socket) {
      socket.emit("ai_thinking", {
        type: "tool_result",
        message: `📊 Tool result for ${tool} is ready.`,
        tool,
        result,
      });
    }
  }

  private emitDone(socket: Socket | undefined) {
    if (socket) {
      socket.emit("ai_thinking", {
        type: "done",
        message: `✅ All processes completed.`,
      });
    }
  }

  /**
   * Helper: execute a tool by name (serial)
   * Returns the raw tool result (JS object/array) or { error: ... }
   */
  private async execToolByName(fn: string, args: any, userId: string) {
    try {
      if (fn === "getRepos") {
        return await getRepos();
      } else if (fn === "getContributors") {
        return await getContributors(args.repo);
      } else if (fn === "getProjects") {
        return await getProjects(userId);
      } else if (fn === "getMembers") {
        return await getMembers(userId);
      } else if (fn === "getAllTasks") {
        return await getAllTasks(args?.projectId || "", userId);
      } else if (fn === "getTodoTasks") {
        return await getTodoTasks(args?.projectId || "", userId);
      } else if (fn === "getInProgressTasks") {
        return await getInProgressTasks(args?.projectId || "", userId);
      } else if (fn === "getDoneTasks") {
        return await getDoneTasks(args?.projectId || "", userId);
      } else if (fn === "getUnassignedTasks") {
        return await getUnassignedTasks(args?.projectId || "", userId);
      } else if (fn === "getUrgentTasks") {
        return await getUrgentTasks(args?.projectId || "", userId);
      } else if (fn === "getLowTasks") {
        return await getLowTasks(args?.projectId || "", userId);
      } else if (fn === "getMediumTasks") {
        return await getMediumTasks(args?.projectId || "", userId);
      } else {
        return { error: `Unknown tool: ${fn}` };
      }
    } catch (err: any) {
      logger.error(`Tool ${fn} error`, err);
      return { error: err?.message ?? String(err) };
    }
  }

  async chat(data: any, res: any, socket?: any, userId?: string) {
    // Save user message
    await prisma.chatMessage.create({
      data: {
        userId: userId || "",
        role: "user",
        content: data.messages[data.messages.length - 1].content,
      },
    });

    // Load recent conversation
    const getMessages = await prisma.chatMessage.findMany({
      where: { userId: userId || "" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const userMessages = getMessages.reverse();

    // Build initial messages array
    const messages: any[] = [
      {
        role: "system",
        content: SYSTEM_MESSAGE,
      },
      ...userMessages.map((msg) => ({ role: msg.role, content: msg.content })),
      ...data.messages,
    ];

    this.emitThinking(socket, "🧠 Thinking...");

    try {
      // === Step 1: initial non-stream call to check for tool calls ===
      const firstRes = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            tools,
            tool_choice: "auto",
          }),
        }
      );

      if (!firstRes.ok) {
        logger.error(`OpenAI error (first): ${firstRes.status}`);
        throw new Error(
          `OpenAI error (first) ${firstRes.status} ${await firstRes.text()}`
        );
      }

      const firstJson: any = await firstRes.json();
      let modelMessage: any = firstJson?.choices?.[0]?.message;
      if (!modelMessage) {
        throw new Error("No model message in first response");
      }

      // Push the assistant message returned (this may contain tool_calls)
      messages.push(modelMessage);

      // === TOOL LOOP: execute until model no longer requests tools ===
      while (modelMessage?.tool_calls && modelMessage.tool_calls.length > 0) {
        console.log("Model requested tool calls:", modelMessage.tool_calls);

        for (const call of modelMessage.tool_calls) {
          const fn = call.function?.name;
          const rawArgs = call.function?.arguments || "{}";
          let args: any;
          try {
            args = rawArgs ? JSON.parse(rawArgs) : {};
          } catch (err) {
            args = {};
          }

          if (!fn) continue;

          // inject cacheDate for certain read-only tools to improve cache key uniqueness
          if (fn === "getRepos" || fn === "getContributors") {
            args.cacheDate = new Date().toISOString().split("T")[0];
          }

          // Try cache lookup (aiToolCache stores raw result in 'result' column)
          let cached: any = null;
          try {
            cached = await prisma.aiToolCache.findFirst({
              where: {
                toolName: fn,
                parameters: { equals: args },
              },
            });
          } catch (err) {
            // ignore cache read errors
            logger.warn("Cache lookup failed", err);
          }

          let toolResult: any = null;

          if (cached && cached.result !== null && cached.result !== undefined) {
            toolResult = cached.result;
            this.emitToolCall(socket, fn, args);
            this.emitToolResult(socket, fn, toolResult);

            // push tool result into conversation in OpenAI expected tool format
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ data: toolResult }),
            });
          } else {
            // Execute actual tool
            this.emitToolCall(socket, fn, args);
            toolResult = await this.execToolByName(fn, args, userId ?? "");
            this.emitToolResult(socket, fn, toolResult);

            // push tool result into conversation
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ data: toolResult }),
            });

            // Optionally cache results for specific tools
            if ((fn === "getRepos" || fn === "getContributors") && toolResult) {
              try {
                await prisma.aiToolCache.create({
                  data: {
                    toolName: fn,
                    parameters: args,
                    result: toolResult,
                  },
                });
              } catch (err) {
                logger.warn("Failed to write cache", err);
              }
            }
          } // end if cached
        } // end for each call

        // After pushing all tool results for this round, call model again (non-stream)
        const followRes = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages,
              tools,
              tool_choice: "auto",
            }),
          }
        );

        if (!followRes.ok) {
          logger.error(`OpenAI follow-up error: ${followRes.status}`);
          throw new Error(
            `OpenAI follow-up error ${
              followRes.status
            } ${await followRes.text()}`
          );
        }

        const followJson: any = await followRes.json();
        modelMessage = followJson?.choices?.[0]?.message;
        if (!modelMessage) {
          // If no message returned, break to avoid infinite loop
          break;
        }
        // push the new assistant message (may include new tool_calls)
        messages.push(modelMessage);
      } // end while tool_calls loop

      messages.push({
        role: "system",
        content: "generate a summary of the tool call results if available",
      });
      // === At this point, modelMessage does NOT request tools anymore ===
      // Start SSE streaming final answer. Ensure we include tools & tool_choice
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const finalStream = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            stream: true,
          }),
        }
      );

      if (!finalStream.ok) {
        const txt = await finalStream.text();
        logger.error("OpenAI final stream error", finalStream.status, txt);
        throw new Error(
          `OpenAI final stream error ${finalStream.status} ${txt}`
        );
      }

      if (!finalStream.body) {
        throw new Error("No stream body from OpenAI final call");
      }

      const decoder = new TextDecoder("utf-8");
      let fullText = "";

      // Notify done start (optional)
      this.emitDone(socket);

      // Stream chunks to client
      for await (const chunk of finalStream.body as any) {
        const text = decoder.decode(chunk);
        // Forward raw chunk to SSE client
        res.write(text);

        // Try to extract content tokens for DB saving
        const lines = text
          .split("\n")
          .filter((line: string) => line.startsWith("data:"));
        for (const line of lines) {
          const data = line.replace(/^data:\s*/, "");
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const token = json.choices?.[0]?.delta?.content || "";
            fullText += token;
          } catch (err) {
            // ignore parsing error
          }
        }
      }

      // Save assistant final text to DB
      try {
        await prisma.chatMessage.create({
          data: {
            userId: userId || "anonymous",
            role: "assistant",
            content: fullText,
          },
        });
      } catch (err) {
        logger.warn("Failed to save assistant message", err);
      }

      // end stream
      res.write(" [DONE]\n\n");
    } catch (error: any) {
      logger.error("AI Chat Error:", error);
      // stream error to client
      try {
        res.write(
          `data: ${JSON.stringify({
            choices: [
              {
                delta: {
                  content: `An error occurred: ${
                    error?.message || String(error)
                  }`,
                },
              },
            ],
          })}\n\n`
        );
        res.write(" [DONE]\n\n");
      } catch (e) {
        // ignore
      }
    } finally {
      try {
        res.end();
      } catch (e) {
        // ignore
      }
    }
  }
}
