import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseSkillMetadata } from "./parser.js";
import { discoverSkills } from "./discovery.js";
import { skillsToXml } from "./xml.js";
import { setupAgentEnvironment } from "./setup.js";
import { createSkillTool } from "./skill-tool.js";
import type { Sandbox } from "@open-agent-sdk/core";

const VALID_SKILL_MD = `---
name: test-skill
description: A test skill for testing purposes
license: MIT
---

# Test Skill

Instructions go here.
`;

describe("parseSkillMetadata", () => {
  it("parses valid SKILL.md frontmatter", () => {
    const metadata = parseSkillMetadata(VALID_SKILL_MD, "/path/to/SKILL.md");
    expect(metadata.name).toBe("test-skill");
    expect(metadata.description).toBe("A test skill for testing purposes");
    expect(metadata.license).toBe("MIT");
    expect(metadata.path).toBe("/path/to/SKILL.md");
  });

  it("throws when name is missing", () => {
    const content = `---\ndescription: A skill\n---\n`;
    expect(() => parseSkillMetadata(content, "/path/SKILL.md")).toThrow("name");
  });

  it("throws when description is missing", () => {
    const content = `---\nname: my-skill\n---\n`;
    expect(() => parseSkillMetadata(content, "/path/SKILL.md")).toThrow("description");
  });

  it("throws when no frontmatter", () => {
    expect(() => parseSkillMetadata("# Just markdown", "/path/SKILL.md")).toThrow(
      "frontmatter",
    );
  });

  it("parses optional fields", () => {
    const content = `---
name: my-skill
description: A skill
compatibility: requires node 18+
allowed-tools: Read Grep Glob
---
`;
    const metadata = parseSkillMetadata(content, "/p/SKILL.md");
    expect(metadata.compatibility).toBe("requires node 18+");
    expect(metadata.allowedTools).toEqual(["Read", "Grep", "Glob"]);
  });
});

describe("discoverSkills", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "skills-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when no skills directory", async () => {
    const skills = await discoverSkills({ cwd: tmpDir, paths: [".skills"] });
    expect(skills).toHaveLength(0);
  });

  it("discovers skills from .skills directory", async () => {
    const skillDir = join(tmpDir, ".skills", "my-skill");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      `---\nname: my-skill\ndescription: My skill\n---\n`,
    );

    const skills = await discoverSkills({ cwd: tmpDir, paths: [".skills"] });
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("my-skill");
  });

  it("deduplicates by name, first path wins", async () => {
    // Create skill in two directories
    const dir1 = join(tmpDir, "skills1");
    const dir2 = join(tmpDir, "skills2");
    await mkdir(join(dir1, "my-skill"), { recursive: true });
    await mkdir(join(dir2, "my-skill"), { recursive: true });
    await writeFile(
      join(dir1, "my-skill", "SKILL.md"),
      `---\nname: my-skill\ndescription: From dir1\n---\n`,
    );
    await writeFile(
      join(dir2, "my-skill", "SKILL.md"),
      `---\nname: my-skill\ndescription: From dir2\n---\n`,
    );

    const skills = await discoverSkills({
      cwd: tmpDir,
      paths: ["skills1", "skills2"],
    });
    expect(skills).toHaveLength(1);
    expect(skills[0].description).toBe("From dir1");
  });
});

describe("skillsToXml", () => {
  it("returns empty element for no skills", () => {
    const xml = skillsToXml([]);
    expect(xml).toContain("<available_skills>");
    expect(xml).toContain("</available_skills>");
  });

  it("formats skills as XML", () => {
    const skills = [
      { name: "pdf", description: "Extract text from PDFs", path: "/path/to/SKILL.md" },
    ];
    const xml = skillsToXml(skills);
    expect(xml).toContain("<name>pdf</name>");
    expect(xml).toContain("<description>Extract text from PDFs</description>");
    expect(xml).toContain("<location>/path/to/SKILL.md</location>");
  });

  it("escapes XML special chars", () => {
    const skills = [
      { name: "my-skill", description: "Use <tags> & 'quotes'", path: "/p/SKILL.md" },
    ];
    const xml = skillsToXml(skills);
    expect(xml).toContain("&lt;tags&gt;");
    expect(xml).toContain("&amp;");
  });
});

describe("setupAgentEnvironment", () => {
  it("writes skill files and returns metadata", async () => {
    const writtenFiles: Record<string, string> = {};
    const sandbox: Sandbox = {
      exec: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(async (path: string, content: string) => {
        writtenFiles[path] = content;
      }),
      readDir: vi.fn(),
      fileExists: vi.fn(),
      isDirectory: vi.fn(),
      destroy: vi.fn(),
    };

    const { skills } = await setupAgentEnvironment(sandbox, {
      skills: {
        "test-skill": {
          name: "test-skill",
          files: { "SKILL.md": VALID_SKILL_MD },
        },
      },
    });

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("test-skill");
    expect(writtenFiles[".skills/test-skill/SKILL.md"]).toBe(VALID_SKILL_MD);
  });
});

describe("createSkillTool", () => {
  it("returns skill path on activation", async () => {
    const skills = {
      "my-skill": {
        name: "my-skill",
        description: "A skill",
        path: "/path/to/my-skill/SKILL.md",
      },
    };
    const tool = createSkillTool(skills);
    const result = await tool.execute!({ skill_name: "my-skill" }, undefined as never);
    expect((result as { path: string }).path).toBe("/path/to/my-skill/SKILL.md");
  });

  it("returns error for unknown skill", async () => {
    const tool = createSkillTool({});
    const result = await tool.execute!({ skill_name: "nope" }, undefined as never);
    expect((result as { error: string }).error).toContain("not found");
  });

  it("invokes onActivate callback", async () => {
    const onActivate = vi.fn();
    const skill = { name: "my-skill", description: "A skill", path: "/p/SKILL.md" };
    const tool = createSkillTool({ "my-skill": skill }, onActivate);
    await tool.execute!({ skill_name: "my-skill" }, undefined as never);
    expect(onActivate).toHaveBeenCalledWith(skill);
  });
});
