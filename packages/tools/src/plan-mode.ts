import { tool, zodSchema } from "ai";
import { z } from "zod";

export interface PlanModeState {
  isActive: boolean;
  enteredAt?: Date;
  reason?: string;
}

export interface EnterPlanModeOutput {
  message: string;
  mode: "planning";
}

export interface EnterPlanModeError {
  error: string;
}

export interface ExitPlanModeOutput {
  message: string;
  approved?: boolean;
}

export interface ExitPlanModeError {
  error: string;
}

const enterSchema = z.object({
  reason: z.string().describe("Why you're entering planning mode"),
});

const exitSchema = z.object({
  plan: z.string().describe("The plan to present to the user for approval"),
});

const ENTER_DESCRIPTION = `Enter planning mode to explore and design an approach before implementing.

Use proactively for non-trivial tasks, multi-step changes, or when there are multiple valid approaches.
In plan mode: use Read, Grep, Glob to explore, then call ExitPlanMode with your plan.`;

const EXIT_DESCRIPTION = `Exit planning mode and present the plan for user approval.

Only use when in plan mode and ready to implement. Present a clear, unambiguous plan.`;

/**
 * Create the EnterPlanMode tool.
 * @param state - Shared mutable state object tracking plan mode
 * @param onEnter - Optional callback when planning starts
 */
export function createEnterPlanModeTool(
  state: PlanModeState,
  onEnter?: (reason: string) => void | Promise<void>,
) {
  return tool({
    description: ENTER_DESCRIPTION,
    inputSchema: zodSchema(enterSchema),
    execute: async ({
      reason,
    }: {
      reason: string;
    }): Promise<EnterPlanModeOutput | EnterPlanModeError> => {
      if (state.isActive) {
        return { error: "Already in planning mode. Use ExitPlanMode to exit." };
      }

      state.isActive = true;
      state.enteredAt = new Date();
      state.reason = reason;

      await onEnter?.(reason);

      return {
        message: `Entered planning mode: ${reason}. Explore with Read/Grep/Glob, then call ExitPlanMode with your plan.`,
        mode: "planning",
      };
    },
  });
}

/**
 * Create the ExitPlanMode tool.
 * @param onPlanSubmit - Optional callback to get user approval for the plan
 */
export function createExitPlanModeTool(
  onPlanSubmit?: (plan: string) => Promise<boolean> | boolean,
) {
  return tool({
    description: EXIT_DESCRIPTION,
    inputSchema: zodSchema(exitSchema),
    execute: async ({
      plan,
    }: {
      plan: string;
    }): Promise<ExitPlanModeOutput | ExitPlanModeError> => {
      let approved: boolean | undefined;

      if (onPlanSubmit) {
        approved = await onPlanSubmit(plan);
      }

      return {
        message: approved
          ? "Plan approved, proceeding with execution"
          : "Plan submitted for review",
        approved,
      };
    },
  });
}
