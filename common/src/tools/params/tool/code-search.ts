import z from 'zod/v4'

import { $getNativeToolCallExampleString, jsonToolResultSchema } from '../utils'

import type { $ToolParams } from '../../constants'

const toolName = 'code_search'
const endsAgentStep = true
const inputSchema = z
  .object({
    pattern: z
      .string()
      .min(1, 'Pattern cannot be empty')
      .describe(`The pattern to search for.`),
    flags: z
      .string()
      .optional()
      .describe(
        `Optional ripgrep flags to customize the search (e.g., "-i" for case-insensitive, "-g *.ts -g *.js" for TypeScript and JavaScript files only, "-g !*.test.ts" to exclude Typescript test files,  "-A 3" for 3 lines after match, "-B 2" for 2 lines before match).`,
      ),
    cwd: z
      .string()
      .optional()
      .describe(
        `Optional working directory to search within, relative to the project root. Defaults to searching the entire project.`,
      ),
    maxResults: z
      .number()
      .int()
      .positive()
      .optional()
      .default(15)
      .describe(
        `Maximum number of results to return per file. Defaults to 15. Related caps: globalMaxResults (total matches across files) and maxOutputStringLength (total output characters).`,
      ),
    globalMaxResults: z
      .number()
      .int()
      .positive()
      .max(5000)
      .optional()
      .default(250)
      .describe(
        `Maximum total matching results across all files before the search stops early. Defaults to 250 (ceiling 5000). Prefer narrowing the pattern first; raise only for broad audit-style sweeps.`,
      ),
    maxOutputStringLength: z
      .number()
      .int()
      .positive()
      .max(200000)
      .optional()
      .default(20000)
      .describe(
        `Maximum total output size in characters before the search stops early. Defaults to 20000 (ceiling 200000). Prefer narrowing the pattern first; raise only for evidence-heavy sweeps.`,
      ),
  })
  .describe(
    `Search for string patterns in the project's files. This tool uses ripgrep (rg), a fast line-oriented search tool. Use this tool only when read_files is not sufficient to find the files you need.`,
  )
const description = `
Purpose: Search through code files to find files with specific text patterns, function names, variable names, and more.

Prefer to use read_files instead of code_search unless you need to search for a specific pattern in multiple files.

Use cases:
1. Finding all references to a function, class, or variable name across the codebase
2. Searching for specific code patterns or implementations
3. Looking up where certain strings or text appear
4. Finding files that contain specific imports or dependencies
5. Locating configuration settings or environment variables

The pattern supports regular expressions and will search recursively through all files in the project by default. Some tips:
- Be as constraining in the pattern as possible to limit the number of files returned, e.g. if searching for the definition of a function, use "(function foo|const foo)" or "def foo" instead of merely "foo".
- Use Rust-style regex, not grep-style, PCRE, RE2 or JavaScript regex - you must always escape special characters like { and }
- Be as constraining as possible to limit results, e.g. use "(function foo|const foo)" or "def foo" instead of merely "foo"
- Add context to your search with surrounding terms (e.g., "function handleAuth" rather than just "handleAuth")
- Use word boundaries (\\b) to match whole words only
- Use the cwd parameter to narrow your search to specific directories
- For case-sensitive searches like constants (e.g., ERROR vs error), omit the "-i" flag
- Searches file content and filenames
- Automatically ignores binary files, hidden files, and files in .gitignore


Advanced ripgrep flags (use the flags parameter):

- Case sensitivity: "-i" for case-insensitive search
- File type filtering: "-t ts -t js" (TypeScript and JavaScript), "-t py" (Python), etc.
- Exclude file types: "--type-not py" to exclude Python files
- Context lines: "-A 3" (3 lines after), "-B 2" (2 lines before), "-C 2" (2 lines before and after)
- Line numbers: "-n" to show line numbers
- Count matches: "-c" to count matches per file
- Only filenames: "-l" to show only filenames with matches
- Invert match: "-v" to show lines that don't match
- Word boundaries: "-w" to match whole words only
- Fixed strings: "-F" to treat pattern as literal string (not regex)

Note: Do not use the end_turn tool after this tool! You will want to see the output of this tool before ending your turn.

RESULT LIMITING:

- The maxResults parameter limits the number of results shown per file (default: 15)
- globalMaxResults caps total matches across all files (default: 250, ceiling: 5000)
- maxOutputStringLength caps the total output size in characters (default: 20000, ceiling: 200000)
- When a limit fires, the truncation marker names the cap that fired and the remedy: re-run with a narrower pattern, cwd, or -g globs, or pass the named parameter to raise that cap
- If a file has more matches than maxResults, you'll see a truncation notice indicating how many results were found

Examples:
${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: { pattern: 'foo' },
  endsAgentStep,
})}
${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: { pattern: 'foo\\.bar = 1\\.0' },
  endsAgentStep,
})}
${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: { pattern: 'import.*foo', cwd: 'src' },
  endsAgentStep,
})}
${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: { pattern: 'function.*authenticate', flags: '-i -t ts -t js' },
  endsAgentStep,
})}
${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: { pattern: 'deprecated', flags: '-n --type-not py' },
  endsAgentStep,
})}${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: { pattern: 'getUserData', maxResults: 10 },
  endsAgentStep,
})}
${$getNativeToolCallExampleString({
  toolName,
  inputSchema,
  input: {
    pattern: 'deprecated|legacy',
    flags: '-g docs/**',
    globalMaxResults: 1000,
    maxOutputStringLength: 50000,
  },
  endsAgentStep,
})}`.trim()

export const codeSearchParams = {
  toolName,
  endsAgentStep,
  description,
  inputSchema,
  outputSchema: jsonToolResultSchema(
    z.union([
      z.object({
        stdout: z.string(),
        stderr: z.string().optional(),
        exitCode: z.number().optional(),
        message: z.string(),
      }),
      z.object({
        errorMessage: z.string(),
      }),
    ]),
  ),
} satisfies $ToolParams
