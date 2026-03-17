import { tool, zodSchema } from "ai";
import { z } from "zod";

export interface QuestionOption {
  label: string;
  description: string | null;
}

export interface AskUserOutput {
  question: string;
  awaiting_response: true;
}

export interface AskUserAnswerOutput {
  answer: string;
}

export interface AskUserError {
  error: string;
}

export type AskUserResponseHandler = (question: string) => Promise<string> | string;

const askUserInputSchema = z.object({
  question: z.string().describe("The question to ask the user"),
  options: z
    .array(
      z.object({
        label: z.string(),
        description: z.string().nullable().default(null),
      }),
    )
    .nullable()
    .default(null)
    .describe("Optional preset options for the user to choose from"),
});

type AskUserInput = z.infer<typeof askUserInputSchema>;

const ASK_USER_DESCRIPTION = `Ask the user a clarifying question during execution.

Use when:
- Requirements are ambiguous
- Multiple valid approaches exist and user preference matters
- Required information is missing from context

Do NOT use when you can make a reasonable assumption.`;

export function createAskUserTool(onQuestion?: AskUserResponseHandler) {
  return tool({
    description: ASK_USER_DESCRIPTION,
    inputSchema: zodSchema(askUserInputSchema),
    execute: async ({
      question,
    }: AskUserInput): Promise<AskUserOutput | AskUserAnswerOutput | AskUserError> => {
      if (!question) return { error: "question is required" };

      if (onQuestion) {
        const answer = await onQuestion(question);
        return { answer };
      }

      return { question, awaiting_response: true };
    },
  });
}
