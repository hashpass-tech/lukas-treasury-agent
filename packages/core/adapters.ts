import { type Intent, type Snapshot } from "./domain.js";
import { type Decision, type Policy } from "./policy.js";
export type JackTreasuryTask = {
  id: string;
  intent: Intent;
  signature: `0x${string}`;
  authority: "EXECUTE_AUTHORIZED";
};
export type JackTreasuryEvent = {
  taskId: string;
  eventType: string;
  reasonCode?: string;
  at: number;
};
export interface LukasMarketAdapter {
  snapshot(): Promise<Snapshot>;
}
export interface TreasurySubmitter {
  submit(
    task: JackTreasuryTask,
  ): Promise<{ attemptId: string; transactionHash: `0x${string}` }>;
  reconcile(
    task: JackTreasuryTask,
  ): Promise<{ status: "pending" | "reconciled" | "failed" }>;
}
export interface JackTreasuryExecutor {
  evaluate(task: JackTreasuryTask, policy: Policy): Promise<Decision>;
  prepare(task: JackTreasuryTask): Promise<{ quoteId: string; intent: Intent }>;
  submit(task: JackTreasuryTask): ReturnType<TreasurySubmitter["submit"]>;
  reconcile(task: JackTreasuryTask): ReturnType<TreasurySubmitter["reconcile"]>;
}
export class JackRuntimeAdapter {
  constructor(
    private executor: JackTreasuryExecutor,
    private emit: (event: JackTreasuryEvent) => void,
  ) {}
  async run(task: JackTreasuryTask, policy: Policy) {
    const decision = await this.executor.evaluate(task, policy);
    this.emit({
      taskId: task.id,
      eventType: "EVALUATED",
      reasonCode: decision.reasons[0],
      at: Date.now(),
    });
    if (decision.decision !== "ALLOW") return decision;
    await this.executor.prepare(task);
    return this.executor.submit(task);
  }
}
