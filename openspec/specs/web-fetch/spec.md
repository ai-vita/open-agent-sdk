# web-fetch Specification

## Purpose

Extract focused web content by passing the user prompt as the objective parameter to parallel-web, eliminating a redundant second-pass AI generation call.

## Requirements
### Requirement: Prompt forwarded as extraction objective
The tool SHALL pass the user-supplied `prompt` as the `objective` parameter in the `parallel-web` extract call, so that extracted content is focused on the user's intent without a secondary AI generation step.

#### Scenario: Prompt used as objective
- **WHEN** `execute` is called with a `url` and `prompt`
- **THEN** the `parallel-web` extract request includes `objective: prompt`

#### Scenario: No secondary generateText call
- **WHEN** `execute` completes successfully
- **THEN** no call to `generateText` is made and the response is returned directly from the extraction result

### Requirement: Extracted content returned as response
The tool SHALL return the focused extracted content directly in `WebFetchOutput.response`, using `full_content` if available, falling back to joined `excerpts`.

#### Scenario: Full content available
- **WHEN** the extract result contains `full_content`
- **THEN** `response` is set to `full_content`

#### Scenario: Only excerpts available
- **WHEN** the extract result contains no `full_content` but has `excerpts`
- **THEN** `response` is set to `excerpts` joined by double newline

#### Scenario: No content available
- **WHEN** the extract result contains neither `full_content` nor `excerpts`
- **THEN** the tool returns `{ error: "No content available from URL" }`

### Requirement: WebFetchConfig does not require a language model
`WebFetchConfig` SHALL NOT include a `model` field. The tool operates solely via `parallel-web` and does not invoke any external language model.

#### Scenario: Config accepted without model
- **WHEN** `createWebFetchTool` is called with only `{ apiKey }`
- **THEN** the tool is created successfully without TypeScript errors

