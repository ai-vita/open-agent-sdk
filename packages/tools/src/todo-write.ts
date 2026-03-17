import { tool, zodSchema } from "ai";
import { z } from "zod";

export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm: string;
}

export interface TodoState {
  todos: TodoItem[];
}

export interface TodoWriteOutput {
  message: string;
  stats: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
}

export interface TodoWriteError {
  error: string;
}

const todoWriteSchema = z.object({
  todos: z
    .array(
      z.object({
        content: z.string().describe("The task description (imperative form)"),
        status: z.enum(["pending", "in_progress", "completed"]).describe("Task status"),
        activeForm: z.string().describe("Present continuous form of the task"),
      }),
    )
    .describe("The updated todo list"),
});

type TodoWriteInput = z.infer<typeof todoWriteSchema>;

const TODO_WRITE_DESCRIPTION = `Manage a structured task list for tracking progress on complex tasks.

Use for tasks with 3+ steps. Keep exactly ONE task in_progress at a time.
Mark tasks complete immediately after finishing.

Task states: pending → in_progress → completed`;

export function createTodoWriteTool(state: TodoState, onUpdate?: (todos: TodoItem[]) => void) {
  return tool({
    description: TODO_WRITE_DESCRIPTION,
    inputSchema: zodSchema(todoWriteSchema),
    execute: async ({ todos }: TodoWriteInput): Promise<TodoWriteOutput | TodoWriteError> => {
      try {
        state.todos = todos;
        onUpdate?.(todos);

        const stats = {
          total: todos.length,
          pending: todos.filter((t) => t.status === "pending").length,
          in_progress: todos.filter((t) => t.status === "in_progress").length,
          completed: todos.filter((t) => t.status === "completed").length,
        };

        return { message: "Todo list updated successfully", stats };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  });
}
