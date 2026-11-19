import { describe, expect, it, beforeAll } from "vitest";
import { addDays, buildPlanTasks, planProgress } from "@/lib/kt/template";
import { createPlan, signOff, updateTask, visiblePlans, canReadViaKtPlan, planBundle } from "@/lib/kt/service";
import { findEmployeeByUserName } from "@/lib/servicenow/employees";
import { projects } from "@/lib/servicenow/projects";
import { ktTasks } from "@/lib/servicenow/kt";
import type { SessionUser } from "@/types";

beforeAll(() => {
  delete process.env.SERVICENOW_INSTANCE_URL;
  process.env.DEMO_MODE = "true";
});

describe("KT template", () => {
  it("spreads tasks over the notice period and repeats per-module tasks", () => {
    const tasks = buildPlanTasks("2026-01-01", "2026-01-31", ["HRSD", "Payroll"]);
    expect(tasks.filter((t) => t.title.startsWith("Write and submit the KT document")).length).toBe(2);
    expect(tasks.filter((t) => t.title.startsWith("Walkthrough session")).length).toBe(2);
    expect(tasks.every((t) => t.dueDate > "2026-01-01" && t.dueDate <= "2026-01-31")).toBe(true);
    expect(tasks.at(-1)!.dueDate).toBe("2026-01-31");
    expect(new Set(tasks.map((t) => t.week))).toEqual(new Set([1, 2, 3, 4]));
  });
  it("computes countdown, progress and risk", () => {
    const tasks = [{ status: "done", dueDate: "2026-01-05" }, { status: "todo", dueDate: "2026-01-10" }, { status: "todo", dueDate: "2026-01-30" }];
    expect(planProgress({ lastWorkingDay: "2026-01-31", status: "active" }, tasks, "2026-01-08")).toMatchObject({ daysLeft: 23, percent: 33, overdue: 0, risk: "low" });
    expect(planProgress({ lastWorkingDay: "2026-01-31", status: "active" }, tasks, "2026-01-12").risk).toBe("medium");
    expect(planProgress({ lastWorkingDay: "2026-01-31", status: "active" }, tasks, "2026-01-26").risk).toBe("high");
    expect(planProgress({ lastWorkingDay: "2026-01-31", status: "completed" }, tasks, "2026-02-05").risk).toBe("low");
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });
});

describe("KT plan lifecycle (demo store)", () => {
  it("creates a plan with requests, enforces roles and sign-off order", async () => {
    const as = async (u: string): Promise<SessionUser> => {
      const p = (await findEmployeeByUserName(u))!;
      return { id: p.id, userName: p.userName, fullName: p.fullName, role: p.role };
    };
    const admin = await as("meera.nair");
    const leaver = await as("karan.mehta");
    const successor = await as("rahul.verma");
    const outsider = await as("priya.sharma");
    const project = (await projects.list({ limit: 1 })).items[0];

    const plan = await createPlan(admin, {
      employeeId: leaver.id, successorId: successor.id, managerId: admin.id,
      noticeStart: "2026-11-01", lastWorkingDay: "2026-12-01", modules: [{ moduleName: "Procurement Approvals", projectId: project.id }],
    });
    await expect(createPlan(admin, { employeeId: leaver.id, noticeStart: "2026-11-01", lastWorkingDay: "2026-12-01", modules: [{ moduleName: "X1", projectId: project.id }] })).rejects.toThrow(/already has an active/);

    const bundle = await planBundle(leaver, plan.id);
    expect(bundle.role).toBe("leaver");
    const docTask = bundle.tasks.find((t) => t.requestId)!;
    expect(docTask.title).toContain("Procurement Approvals");
    expect(await canReadViaKtPlan(successor.id, docTask.requestId)).toBe(true);
    expect(await canReadViaKtPlan(outsider.id, docTask.requestId)).toBe(false);

    await expect(planBundle(outsider, plan.id)).rejects.toThrow(/not found/);
    expect((await visiblePlans(successor)).some((p) => p.id === plan.id)).toBe(true);
    expect((await visiblePlans(outsider)).some((p) => p.id === plan.id)).toBe(false);

    await updateTask(leaver, docTask.id, { status: "done" });
    expect((await ktTasks.get(docTask.id))!.status).toBe("done");
    await expect(updateTask(leaver, docTask.id, { title: "Renamed" })).rejects.toThrow(/Only HR or the manager/);

    await expect(signOff(admin, plan.id, "manager")).rejects.toThrow(/successor must confirm/);
    await expect(signOff(leaver, plan.id, "successor")).rejects.toThrow(/Only the successor/);
    await signOff(successor, plan.id, "successor");
    const done = await signOff(admin, plan.id, "manager");
    expect(done.status).toBe("completed");
    await expect(updateTask(leaver, docTask.id, { status: "todo" })).rejects.toThrow(/closed/);
  });
});
