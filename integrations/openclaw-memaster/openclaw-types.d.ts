// Minimal ambient declarations for OpenClaw plugin SDK.
// Real types live in `openclaw/plugin-sdk` at install time;
// we shim them here so this package builds without a hard dependency on OpenClaw.
declare module "openclaw/plugin-sdk" {
  export interface OpenClawLogger {
    info(message: string, ...rest: unknown[]): void;
    warn(message: string, ...rest: unknown[]): void;
    error(message: string, ...rest: unknown[]): void;
    debug?(message: string, ...rest: unknown[]): void;
  }

  export interface ToolContent {
    type: "text";
    text: string;
  }

  export interface ToolResult {
    content: ToolContent[];
    details?: Record<string, unknown>;
  }

  export interface ToolDefinition<TParams = unknown> {
    name: string;
    label?: string;
    description: string;
    parameters: unknown;
    execute(toolCallId: string, params: TParams): Promise<ToolResult>;
  }

  export interface PluginEventContext {
    sessionKey?: string;
  }

  export interface BeforeAgentStartEvent {
    prompt?: string;
    [key: string]: unknown;
  }

  export interface AgentEndEvent {
    success?: boolean;
    messages?: unknown[];
    [key: string]: unknown;
  }

  export type PluginEventName = "before_agent_start" | "agent_end";

  export interface CliRegisterContext {
    program: {
      command(name: string): CliCommand;
    };
  }

  export interface CliCommand {
    description(text: string): CliCommand;
    command(name: string): CliCommand;
    argument(name: string, description?: string): CliCommand;
    option(flags: string, description?: string, defaultValue?: unknown): CliCommand;
    action(handler: (...args: unknown[]) => unknown | Promise<unknown>): CliCommand;
  }

  export interface ServiceDefinition {
    id: string;
    start?: () => void | Promise<void>;
    stop?: () => void | Promise<void>;
  }

  export interface OpenClawPluginApi {
    pluginConfig: unknown;
    logger: OpenClawLogger;
    registerTool<TParams = unknown>(
      tool: ToolDefinition<TParams>,
      meta?: { name?: string },
    ): void;
    registerCli(
      register: (ctx: CliRegisterContext) => void,
      meta?: { commands?: string[] },
    ): void;
    registerService(service: ServiceDefinition): void;
    on(
      event: "before_agent_start",
      handler: (
        event: BeforeAgentStartEvent,
        ctx?: PluginEventContext,
      ) => Promise<{ prependContext?: string } | void> | { prependContext?: string } | void,
    ): void;
    on(
      event: "agent_end",
      handler: (
        event: AgentEndEvent,
        ctx?: PluginEventContext,
      ) => Promise<void> | void,
    ): void;
    resolvePath(path: string): string;
  }
}

