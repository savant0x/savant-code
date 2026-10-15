import type { Sandbox, CommandOptions, CommandResult } from '../sandbox'

export interface DockerSandboxOptions {
  /** Name of the Docker image to use. */
  image: string
  /** Optional container name override. */
  name?: string
}

/**
 * Placeholder Docker sandbox implementation.
 *
 * The MVP uses the temp-dir sandbox everywhere. This class preserves the
 * expected interface and can be fleshed out once the harness needs real Linux
 * container isolation on CI runners.
 */
export class DockerSandbox implements Sandbox {
  public readonly id: string
  private readonly image: string
  private readonly name: string
  private workingDir: string = ''

  constructor(options: DockerSandboxOptions) {
    this.id = `docker-${crypto.randomUUID()}`
    this.image = options.image
    this.name = options.name ?? `savant-bench-${crypto.randomUUID()}`
  }

  async prepare(): Promise<void> {
    this.workingDir = process.cwd()
  }

  getWorkingDir(): string {
    return this.workingDir
  }

  async runCommand(
    _command: string,
    _options: Partial<CommandOptions> = {},
  ): Promise<CommandResult> {
    throw new Error(
      'DockerSandbox is a stub. Use TempDirSandbox or implement Docker execution before running tasks.',
    )
  }

  async teardown(): Promise<void> {
    // No-op in stub.
  }
}
