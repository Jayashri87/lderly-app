import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

type Role = "customer" | "caretaker" | "admin" | "superadmin";

const roleLabels: Record<Role, string> = {
  customer: "Customer",
  caretaker: "Caretaker",
  admin: "Admin",
  superadmin: "Super Admin"
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

  return `${cookie.name}=${cookie.value}`;
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
  test("protected APIs reject unauthenticated requests", async ({ request }) => {
    const bookings = await request.get("/api/bookings");
    expect(bookings.status()).toBe(401);

    const statusUpdate = await request.post("/api/bookings/e2e-missing/status", {
      data: { status: "en_route" }
    });
    expect(statusUpdate.status()).toBe(401);

    const profileSave = await request.post("/api/profiles/care", {
      data: { profile: { elderName: "Unauthorized" } }
    });
    expect(profileSave.status()).toBe(401);

    const routeEta = await request.post("/api/locations/route-eta", {
      data: {
        origin: { lat: 12.985, lng: 77.61 },
        destination: { lat: 12.9716, lng: 77.5946 }
      }
    });
    expect(routeEta.status()).toBe(401);

    const routeStream = await request.get("/api/locations/route-stream?bookingId=e2e-missing");
    expect(routeStream.status()).toBe(401);
  });

  test("disabled OTP endpoint does not issue customer sessions", async ({ request }) => {
    const response = await request.post("/api/auth/customer/otp", {
      data: {
        phone: "+919916960524",
        otp: "123456"
      }
    });

    expect(response.status()).toBe(410);
    expect(response.headers()["set-cookie"]).toBeFalsy();
  });

  test("role-specific pages keep their own login surfaces for wrong signed roles", async ({
    request,
    context,
    page,
    baseURL
  }) => {
    const appUrl = baseURL || "http://127.0.0.1:3000";

    await login(request, context, "customer", appUrl);
    await page.goto("/ops");
    await expect(page.getByRole("heading", { name: "Operations control center" })).toBeVisible();

    await context.clearCookies();
    await login(request, context, "admin", appUrl);
    await page.goto("/partner");
    await expect(page.getByRole("heading", { name: "Caregiver operations" })).toBeVisible();
  });

  test("legal and payment policy pages are reachable", async ({ page }) => {
    for (const path of ["/legal/terms", "/legal/refunds", "/legal/privacy", "/legal/emergency"]) {
      await page.goto(path);
      await expect(page.getByText("LDERLY").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("public lead funnel is readable and mobile safe", async ({ page }) => {
    await page.goto("/signin");
    await expect(
      page.getByRole("heading", {
        name: /Is Mom okay right now|trained caregiver|You know what happened|Share your details/i
      })
    ).toBeVisible();
    await expect(page.getByText("Call now")).toBeVisible();
    await expect(page.getByRole("link", { name: "Customer Family care app" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Partner Caregiver app" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin Ops panel" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Super Admin/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("super admin login page is reachable and mobile safe", async ({ page }) => {
    await page.goto("/superadmin");
    await expect(page.getByRole("heading", { name: "Super Admin login" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Open super admin ops/i })).toBeVisible();
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

  test("super admin can enter the ops command center when configured", async ({
    request,
    context,
    page,
    baseURL
  }) => {
    await login(request, context, "superadmin", baseURL || "http://127.0.0.1:3000");
    await primeClientSession(page, "superadmin");
    await page.goto("/ops");
    await expect(page.getByText("LDERLY Ops").first()).toBeVisible();
    await expect(page.getByText("Sign out")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("admin can read go-live readiness and system status", async ({ request, context, baseURL }) => {
    const cookie = await login(request, context, "admin", baseURL || "http://127.0.0.1:3000");

    const status = await request.get("/api/system/status", {
      headers: { cookie }
    });
    expect(status.ok()).toBeTruthy();
    const statusJson = await status.json();
    expect(statusJson.productionReadiness.opsGoLiveReadinessApi).toBe(true);
    expect(statusJson.productionReadiness.googleRoutesEtaApi).toBe(true);

    const routeEta = await request.post("/api/locations/route-eta", {
      headers: {
        cookie,
        origin: baseURL || "http://127.0.0.1:3000"
      },
      data: {
        origin: { lat: 12.985, lng: 77.61 },
        destination: { lat: 12.9716, lng: 77.5946 }
      }
    });
    expect(routeEta.ok()).toBeTruthy();
    const routeEtaJson = await routeEta.json();
    expect(routeEtaJson.route.etaMinutes).toBeGreaterThan(0);

    const readiness = await request.get("/api/ops/readiness", {
      headers: { cookie }
    });
    expect(readiness.ok()).toBeTruthy();
    const readinessJson = await readiness.json();
    expect(Array.isArray(readinessJson.snapshot.checks)).toBe(true);
    expect(readinessJson.snapshot.checks.some((check: { id: string }) => check.id === "firebase-admin")).toBe(true);
  });
});
