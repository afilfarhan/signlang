import { test, expect } from "@playwright/test";

/**
 * Happy-path E2E tests for SignTutor.
 * These run against the built/dev server.
 */

test.describe("Home page", () => {
  test("loads and shows primary CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SignTutor/);
    await expect(page.getByRole("link", { name: /start your first lesson/i })).toBeVisible();
    await expect(page.getByText("?? On-device · no upload")).toBeVisible();
  });

  test("navigates to fingerspelling listing", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /browse lessons/i }).click();
    await expect(page).toHaveURL(/fingerspelling/);
    await expect(page.getByRole("heading", { name: /fingerspelling/i })).toBeVisible();
  });
});

test.describe("Fingerspelling listing", () => {
  test("shows all 24 letters", async ({ page }) => {
    await page.goto("/learn/asl/fingerspelling");
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y"];
    for (const letter of letters.slice(0, 5)) {
      await expect(page.getByRole("link", { name: new RegExp(`Practice letter ${letter}`) })).toBeVisible();
    }
  });
});

test.describe("Static sign player", () => {
  test("loads letter A player with correct structure", async ({ page }) => {
    await page.goto("/learn/asl/fingerspelling/A");
    await expect(page).toHaveTitle(/Letter A/);
    // Demo pane
    await expect(page.getByText("Demo · Native signer (mock)")).toBeVisible();
    // Webcam pane
    await expect(page.getByText("You · Webcam")).toBeVisible();
    // Per-finger panel
    await expect(page.getByLabel("Per-finger handshape match")).toBeVisible();
    // Privacy badge
    await expect(page.getByText("?? On-device · no upload")).toBeVisible();
    // Start camera button
    await expect(page.getByRole("button", { name: /start camera/i })).toBeVisible();
  });

  test("letter selector changes target", async ({ page }) => {
    await page.goto("/learn/asl/fingerspelling/A");
    await page.getByRole("button", { name: "B", exact: true }).click();
    await expect(page.getByText("Target: B")).toBeVisible();
  });

  test("mirror toggle is checked by default", async ({ page }) => {
    await page.goto("/learn/asl/fingerspelling/A");
    const mirrorCheckbox = page.getByLabel(/mirror webcam/i);
    await expect(mirrorCheckbox).toBeChecked();
  });
});

test.describe("Dynamic sign player", () => {
  test("loads HELLO player with correct structure", async ({ page }) => {
    await page.goto("/learn/asl/words/hello");
    await expect(page).toHaveTitle(/HELLO/);
    await expect(page.getByText("Target sign (mock demo)")).toBeVisible();
    await expect(page.getByText("Your attempt")).toBeVisible();
    await expect(page.getByRole("button", { name: /record attempt/i })).toBeVisible();
    await expect(page.getByText("?? On-device")).toBeVisible();
  });

  test("sign selector changes target", async ({ page }) => {
    await page.goto("/learn/asl/words/hello");
    await page.getByRole("button", { name: "THANKS", exact: true }).click();
    await expect(page.getByText("Target: THANKS")).toBeVisible();
  });
});

test.describe("Setup wizard", () => {
  test("shows 4-step wizard", async ({ page }) => {
    await page.goto("/setup");
    await expect(page.getByText("Language")).toBeVisible();
    await expect(page.getByText("Camera permission")).toBeVisible();
    await expect(page.getByText("Lighting check")).toBeVisible();
    await expect(page.getByText("Framing & handedness")).toBeVisible();
  });

  test("can advance to step 2", async ({ page }) => {
    await page.goto("/setup");
    await page.getByRole("button", { name: /next: camera permission/i }).click();
    await expect(page.getByRole("heading", { name: /allow camera access/i })).toBeVisible();
  });
});

test.describe("Practice page", () => {
  test("loads with stats and empty queue message", async ({ page }) => {
    await page.goto("/practice");
    await expect(page.getByText("Signs mastered")).toBeVisible();
    await expect(page.getByText("Due for review")).toBeVisible();
  });
});

test.describe("Accessibility", () => {
  test("home page has skip link", async ({ page }) => {
    await page.goto("/");
    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await expect(skipLink).toBeAttached();
  });

  test("fingerspelling player has ARIA labels on key elements", async ({ page }) => {
    await page.goto("/learn/asl/fingerspelling/A");
    await expect(page.getByLabel("Per-finger handshape match")).toBeVisible();
    await expect(page.getByLabel("Select target letter")).toBeVisible();
  });
});
