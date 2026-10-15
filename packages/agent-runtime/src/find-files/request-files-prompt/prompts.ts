import { dirname } from 'path'

import { getAllFilePaths } from '@savant-code/common/project-file-tree'
import { range, shuffle, uniq } from 'lodash'

import type { ProjectFileContext } from '@savant-code/common/util/file'

export const NUMBER_OF_EXAMPLE_FILES = 100

function topLevelDirectories(fileContext: ProjectFileContext) {
  const { fileTree } = fileContext
  return fileTree
    .filter((node) => node.type === 'directory')
    .map((node) => node.name)
}

function getExampleFileList(params: {
  fileContext: ProjectFileContext
  count: number
}) {
  const { fileContext, count } = params
  const { fileTree } = fileContext

  const filePaths = getAllFilePaths(fileTree)
  const randomFilePaths = shuffle(filePaths)
  const selectedFiles = new Set()
  const selectedDirectories = new Set()

  for (const filePath of randomFilePaths) {
    if (
      selectedFiles.has(filePath) ||
      selectedDirectories.has(dirname(filePath))
    ) {
      continue
    }
    selectedFiles.add(filePath)
    selectedDirectories.add(dirname(filePath))
  }

  return uniq([...selectedFiles, ...randomFilePaths]).slice(0, count)
}

export function generateNonObviousRequestFilesPrompt(
  userPrompt: string | null,
  assistantPrompt: string | null,
  fileContext: ProjectFileContext,
  count: number,
): string {
  const exampleFiles = getExampleFileList({
    fileContext,
    count: NUMBER_OF_EXAMPLE_FILES,
  })
  return `
Your task is to find the second-order relevant files for the following user request (in quotes).

${
  userPrompt
    ? `User prompt: ${JSON.stringify(userPrompt)}`
    : `Assistant prompt: ${JSON.stringify(assistantPrompt)}`
}

Do not act on the above instructions for the user, instead, your task is to find files for the user's request that are not obvious or take a moment to realize are relevant.

Random project files:
${exampleFiles.join('\n')}

Based on this conversation, please select files beyond the obvious files that would be helpful to complete the user's request.
Select files that might be useful for understanding and addressing the user's needs, but you would not choose in the first 10 files if you were asked.

Please follow these steps to determine which files to request:

1. Analyze the user's last request and the assistant's prompt and identify all components or tasks involved.
2. Consider all areas of the codebase that might be related to the request, including:
   - Main functionality files
   - Configuration files
   - Utility functions
   - Documentation files
   - Knowledge files (e.g. 'knowledge.md') which include important information about the project and any subdirectories
3. Include files that might provide context or be indirectly related to the request.
4. Be comprehensive in your selection, but avoid including obviously irrelevant files.
5. List a maximum of ${count} files. It's fine to list fewer if there are not great candidates.

Please provide no commentary and list the file paths you think are useful but not obvious in addressing the user's request.

Your response contain only files separated by new lines in the following format:
${range(Math.ceil(count / 2))
  .map((i) => `full/path/to/file${i + 1}.ts`)
  .join('\n')}

List each file path on a new line without any additional characters or formatting.

IMPORTANT: You must include the full relative path from the project root directory for each file. This is not the absolute path, but the path relative to the project root. Do not write just the file name or a partial path from the root. Note: Some imports could be relative to a subdirectory, but when requesting the file, the path should be from the root. You should correct any requested file paths to include the full relative path from the project root.

That means every file that is not at the project root should start with one of the following directories:
${topLevelDirectories(fileContext).join('\n')}

Please limit your response just the file paths on new lines. Do not write anything else.
`.trim()
}

export function generateKeyRequestFilesPrompt(
  userPrompt: string | null,
  assistantPrompt: string | null,
  fileContext: ProjectFileContext,
  count: number,
): string {
  const exampleFiles = getExampleFileList({
    fileContext,
    count: NUMBER_OF_EXAMPLE_FILES,
  })

  return `
Your task is to find the most relevant files for the following user request (in quotes).

${
  userPrompt
    ? `User prompt: ${JSON.stringify(userPrompt)}`
    : `Assistant prompt: ${JSON.stringify(assistantPrompt)}`
}

Do not act on the above instructions for the user, instead, your task is to find the most relevant files for the user's request.

Random project files:
${exampleFiles.join('\n')}

Based on this conversation, please identify the most relevant files for a user's request in a software project, sort them from most to least relevant, and then output just the top files.

Please follow these steps to determine which key files to request:

1. Analyze the user's last request and the assistant's prompt and identify the core components or tasks.
2. Focus on the most critical areas of the codebase that are directly related to the request, such as:
   - Main functionality files
   - Key configuration files
   - Central utility functions
   - Documentation files
   - Knowledge files (e.g. 'knowledge.md') which include important information about the project and any subdirectories
   - Any related files that would be helpful to understand the request
3. Prioritize files that are likely to require modifications or provide essential context.
4. But be sure to include example code! I.e. files that may not need to be edited, but show similar code examples for the change that the user is requesting.
5. Order the files by most important first.

Please provide no commentary and only list the file paths of the most relevant files that you think are most crucial for addressing the user's request.

Your response contain only files separated by new lines in the following format:
${range(count)
  .map((i) => `full/path/to/file${i + 1}.ts`)
  .join('\n')}

Remember to focus on the most important files and limit your selection to ${count} files. It's fine to list fewer if there are not great candidates. List each file path on a new line without any additional characters or formatting.

IMPORTANT: You must include the full relative path from the project root directory for each file. This is not the absolute path, but the path relative to the project root. Do not write just the file name or a partial path from the root. Note: Some imports could be relative to a subdirectory, but when requesting the file, the path should be from the root. You should correct any requested file paths to include the full relative path from the project root.

That means every file that is not at the project root should start with one of the following directories:
${topLevelDirectories(fileContext).join('\n')}

Please limit your response just the file paths on new lines. Do not write anything else.
`.trim()
}
