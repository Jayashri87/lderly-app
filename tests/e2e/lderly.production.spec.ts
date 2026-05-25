import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

type Role = "customer" | "caretaker" | "admin";

const roleLabels: Record<Role, string> = {
  customer: "Customer",
  caretaker: "Caretaker",
  admin: "Admin"
};

const envFor = (role: Role) => {
  const prefix = `LDERLY_${role.toUpperCase()}`;

  return {
    username: process.env[`${prefix}_USERNAME`] || "",
    password: process.env[`${prefix}_PASSWORD`] || ""
  };
};

const cookieFrom = (setCookie = "") => {
  const [pair] = setCookie.split(";");
  const [name, ...valueParts] = pair.split("=");

  return {
    name,
    value: valueParts.join("=")
  };
};

const login = async (
  request: APIRequestContext,
  context: BrowserContext,
  role: Role,
  baseURL: string
) => {
  const credentials = envFor(role);

  test.skip(!credentials.username || !credentials.password, `${role} credentials are not configured`);

  const response = await request.post(`/api/auth/${role}`, {
    data: credentials
  });
  expect(response.ok()).toBeTruthy();

  const cookie = cookieFrom(response.headers()["set-cookie"] || "");
  expect(cookie.name).toBeTruthy();
  await context.addCookies([
    {
      ...cookie,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
};

const primeClientSession = async (page: Page, role: Role) => {
  await page.addInitScript(
    ({ roleName, roleLabel }) => {
      window.localStorage.setItem("lderly-role", roleName);
      window.localStorage.setItem(
        "lderly-demo-session",
        JSON.stringify({
          uid: `demo-${roleName}`,
          name: roleLabel,
          role: roleName,
          authMode: "demo"
        })
      );
    },
    { roleName: role, roleLabel: roleLabels[role] }
  );
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );

  expect(overflow).toBeLessThanOrEqual(4);
};

test.describe("LDERLY production E2E route checks", () => {
  test("public lead funnel is readable and mobile safe", async ({ page }) => {
    await page.goto("/signin");
    await expect(
      page.getByRole("heading", {
        name: /Is Mom okay right now|trained caregiver|You know what happened|Share your details/i
      })
    ).toBeVisible();
    await expect(page.getByText("Call now")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("customer app shell loads with signed session", async ({ request, context, page, baseURL }) => {
    await login(request, context, "customer", baseURL || "http://127.0.0.1:3000");
    await primeClientSession(page, "customer");
    await page.goto("/");
    await expect(page.getByText("LDERLY").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("caretaker portal loads as an authenticated partner", async ({
    request,
    context,
    page,
    baseURL
  }) => {
    await login(request, context, "caretaker", baseURL || "http://127.0.0.1:3000");
    await primeClientSession(page, "caretaker");
    await page.goto("/partner");
    await expect(page.getByText("LDERLY Partner").first()).toBeVisible();
    await expect(page.getByText("Sign out")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("ops portal loads and exposes command surface", async ({
    request,
    context,
    page,
    baseURL
  }) => {
    await login(request, context, "admin", baseURL || "http://127.0.0.1:3000");
    await primeClientSession(page, "admin");
    await page.goto("/ops");
    await expect(page.getByText("LDERLY Ops").first()).toBeVisible();
    await expect(page.getByText("Sign out")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("admin can read go-live readiness and system status", async ({ request, context, baseURL }) => {
    await login(request, context, "admin", baseURL || "http://127.0.0.1:3000");

    const status = await request.get("/api/system/status");
    expect(status.ok()).toBeTruthy();
    const statusJson = await status.json();
    expect(statusJson.productionReadiness.opsGoLiveReadinessApi).toBe(true);

    const readiness = await request.get("/api/ops/readiness");
    expect(readiness.ok()).toBeTruthy();
    const readinessJson = await readiness.json();
    expect(Array.isArray(readinessJson.snapshot.checks)).toBe(true);
    expect(readinessJson.snapshot.checks.some((check: { id: string }) => check.id === "firebase-admin")).toBe(true);
  });
});
