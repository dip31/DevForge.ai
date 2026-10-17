import { describe, it, expect, beforeEach, vi } from "vitest";
import { createOpenHandsAdapter, createPythonBridgeRuntime, runBridgeProcess } from "./adapter";
import { OpenHandsConfigError } from "./config";
import { OpenHandsRuntimeError } from "./types";
import { MemoryWorkspaceStore } from "../workspaceService";
import type { OpenHandsConfig } from "./config";
import type { ChildProcessLike, SpawnLike } from "./adapter";

describe("OpenHands Adapter", () => {
  const mockConfig: OpenHandsConfig = {
    enabled: true,
    serverUrl: "http://127.0.0.1:8999",
    sessionApiKey: "test-session-key",
    secretKey: "test-secret-key",
    model: "test-model",
    timeoutMs: 5000,
    pythonPath: "/usr/bin/python",
    bridgeScript: "/path/to/bridge.py",
    llmApiKey: null,
    llmBaseUrl: null,
  };

  describe("Configuration", () => {
    it("should throw OpenHandsConfigError when adapter is disabled", () => {
      const adapter = createOpenHandsAdapter({
        config: { ...mockConfig, enabled: false },
      });

      expect(
        adapter.runTask({
          store: new MemoryWorkspaceStore(),
          prompt: "test",
          taskContext: { instructions: null, requirements: [], aiPolicy: null },
        }),
      ).rejects.toThrow(OpenHandsRuntimeError);
    });
  });

  describe("Python Bridge Process", () => {
    it("should handle successful bridge execution", async () => {
      const mockChild: ChildProcessLike = {
        stdin: {
          end: vi.fn(),
        } as any,
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === "data") {
              cb(JSON.stringify({ ok: true, status: "finished", model: "test-model" }));
            }
          }),
        } as any,
        stderr: {
          on: vi.fn(),
        } as any,
        on: vi.fn(((event: string, cb: any) => {
          if (event === "close") {
            setTimeout(() => cb(0), 10);
          }
        }) as any),
        kill: vi.fn(() => true),
      };

      const mockSpawn: SpawnLike = vi.fn(() => mockChild);

      const result = await runBridgeProcess(
        mockSpawn,
        mockConfig,
        { prompt: "test", working_dir: "/tmp/test" },
        5000,
      );

      expect(result.code).toBe(0);
      expect(mockSpawn).toHaveBeenCalledWith(
        mockConfig.pythonPath,
        [mockConfig.bridgeScript],
        expect.objectContaining({ windowsHide: true }),
      );
    });

    it("should handle bridge timeout", { timeout: 500 }, async () => {
      let closeCallback: ((code: number | null) => void) | null = null;
      const mockChild: ChildProcessLike = {
        stdin: { end: vi.fn() } as any,
        stdout: { on: vi.fn() } as any,
        stderr: { on: vi.fn() } as any,
        on: vi.fn(((event: string, cb: any) => {
          if (event === "close") {
            closeCallback = cb;
            // After kill is called, trigger close
            setTimeout(() => {
              if (closeCallback) closeCallback(null);
            }, 150);
          }
        }) as any),
        kill: vi.fn(() => true),
      };

      const mockSpawn: SpawnLike = vi.fn(() => mockChild);

      const result = await runBridgeProcess(mockSpawn, mockConfig, { prompt: "test" }, 100);

      expect(result.spawnError).toBeDefined();
      expect(result.spawnError?.message).toBe("__timeout__");
      expect(mockChild.kill).toHaveBeenCalledWith("SIGKILL");
    });

    it("should handle spawn errors", async () => {
      const spawnError = new Error("ENOENT");
      const mockChild: ChildProcessLike = {
        stdin: null,
        stdout: null,
        stderr: null,
        on: vi.fn(((event: string, cb: any) => {
          if (event === "error") {
            setTimeout(() => cb(spawnError), 10);
          }
        }) as any),
        kill: vi.fn(() => true),
      };

      const mockSpawn: SpawnLike = vi.fn(() => mockChild);

      const result = await runBridgeProcess(mockSpawn, mockConfig, { prompt: "test" }, 5000);

      expect(result.spawnError).toBe(spawnError);
      expect(result.code).toBeNull();
    });
  });

  describe("Python Bridge Runtime", () => {
    it("should map successful bridge response", async () => {
      const mockChild: ChildProcessLike = {
        stdin: { end: vi.fn() } as any,
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === "data") {
              cb(JSON.stringify({ ok: true, status: "finished", model: "gpt-4" }));
            }
          }),
        } as any,
        stderr: { on: vi.fn() } as any,
        on: vi.fn(((event: string, cb: any) => {
          if (event === "close") setTimeout(() => cb(0), 10);
        }) as any),
        kill: vi.fn(() => true),
      };

      const mockSpawn: SpawnLike = vi.fn(() => mockChild);
      const runtime = createPythonBridgeRuntime(mockConfig, mockSpawn);

      const outcome = await runtime({
        workingDir: "/tmp/test",
        prompt: "test prompt",
        taskContext: { instructions: "test", requirements: [], aiPolicy: null },
        model: "gpt-4",
        timeoutMs: 5000,
        config: mockConfig,
      });

      expect(outcome.status).toBe("finished");
      expect(outcome.model).toBe("gpt-4");
    });

    it("should throw OpenHandsRuntimeError on bridge failure", async () => {
      const mockChild: ChildProcessLike = {
        stdin: { end: vi.fn() } as any,
        stdout: {
          on: vi.fn((event, cb) => {
            if (event === "data") {
              cb(
                JSON.stringify({
                  ok: false,
                  error: { code: "runtime_auth", message: "Authentication failed" },
                }),
              );
            }
          }),
        } as any,
        stderr: { on: vi.fn() } as any,
        on: vi.fn(((event: string, cb: any) => {
          if (event === "close") setTimeout(() => cb(0), 10);
        }) as any),
        kill: vi.fn(() => true),
      };

      const mockSpawn: SpawnLike = vi.fn(() => mockChild);
      const runtime = createPythonBridgeRuntime(mockConfig, mockSpawn);

      await expect(
        runtime({
          workingDir: "/tmp/test",
          prompt: "test",
          taskContext: { instructions: null, requirements: [], aiPolicy: null },
          model: "gpt-4",
          timeoutMs: 5000,
          config: mockConfig,
        }),
      ).rejects.toThrow(OpenHandsRuntimeError);
    });

    it("should handle timeout errors", async () => {
      const mockChild: ChildProcessLike = {
        stdin: { end: vi.fn() } as any,
        stdout: { on: vi.fn() } as any,
        stderr: { on: vi.fn() } as any,
        on: vi.fn(((event: string, cb: any) => {
          if (event === "close") {
            // Simulate timeout
            setTimeout(() => cb(null), 200);
          }
        }) as any),
        kill: vi.fn(() => true),
      };

      const mockSpawn: SpawnLike = vi.fn(() => mockChild);
      const runtime = createPythonBridgeRuntime(mockConfig, mockSpawn);

      await expect(
        runtime({
          workingDir: "/tmp/test",
          prompt: "test",
          taskContext: { instructions: null, requirements: [], aiPolicy: null },
          model: "gpt-4",
          timeoutMs: 100,
          config: mockConfig,
        }),
      ).rejects.toThrow("timed out");
    });

    it("should handle missing interpreter", async () => {
      const enoentError = Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" });
      const mockChild: ChildProcessLike = {
        stdin: null,
        stdout: null,
        stderr: null,
        on: vi.fn(((event: string, cb: any) => {
          if (event === "error") setTimeout(() => cb(enoentError), 10);
        }) as any),
        kill: vi.fn(() => true),
      };

      const mockSpawn: SpawnLike = vi.fn(() => mockChild);
      const runtime = createPythonBridgeRuntime(mockConfig, mockSpawn);

      await expect(
        runtime({
          workingDir: "/tmp/test",
          prompt: "test",
          taskContext: { instructions: null, requirements: [], aiPolicy: null },
          model: "gpt-4",
          timeoutMs: 5000,
          config: mockConfig,
        }),
      ).rejects.toThrow("not available");
    });
  });

  describe("Feature Flag", () => {
    it("should reject runs when feature is disabled", async () => {
      const adapter = createOpenHandsAdapter({
        config: { ...mockConfig, enabled: false },
      });

      await expect(
        adapter.runTask({
          store: new MemoryWorkspaceStore(),
          prompt: "test",
          taskContext: { instructions: null, requirements: [], aiPolicy: null },
        }),
      ).rejects.toThrow("not enabled");
    });
  });
});
