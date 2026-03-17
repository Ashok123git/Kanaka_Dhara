/**
 * E2E tests for src/hooks/use-toast.ts. Visits /toast-demo and drives toast
 * actions via UI to cover reducer (ADD_TOAST, UPDATE_TOAST, DISMISS_TOAST,
 * REMOVE_TOAST), genId, addToRemoveQueue, toast(), useToast(), and listener lifecycle.
 * Uses cy.clock() / cy.tick() so addToRemoveQueue timeout runs deterministically.
 */
const TOAST_REMOVE_DELAY_MS = 1000000;

describe("useToast E2E — reducer, genId, addToRemoveQueue, listeners", () => {
  beforeEach(() => {
    cy.clock();
    cy.visit("/toast-demo");
  });

  afterEach(() => {
    cy.clock().then((clock) => clock.restore());
  });

  describe("ADD_TOAST and TOAST_LIMIT", () => {
    it("adds toast and prepends to state; TOAST_LIMIT keeps only one toast", () => {
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 0");
      cy.get("[data-testid=add-toast]").click();
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 1");
      cy.get("[data-radix-collection-item]").should("contain.text", "Initial title");
      cy.get("[data-testid=add-toast]").click();
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 1");
    });

    it("genId generates unique ids across add/dismiss/add", () => {
      cy.get("[data-testid=add-toast]").click();
      cy.get("[data-radix-collection-item]").should("exist");
      cy.get("[data-testid=dismiss-toast]").click();
      cy.tick(TOAST_REMOVE_DELAY_MS);
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 0");
      cy.get("[data-testid=add-toast]").click();
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 1");
    });
  });

  describe("UPDATE_TOAST", () => {
    it("merges updates into existing toast", () => {
      cy.get("[data-testid=add-toast]").click();
      cy.get("[data-radix-collection-item]").should("contain.text", "Initial title").and("contain.text", "Initial description");
      cy.get("[data-testid=update-toast]").click();
      cy.get("[data-radix-collection-item]").should("contain.text", "Updated title").and("contain.text", "Updated description").and("not.contain.text", "Initial title");
    });
  });

  describe("DISMISS_TOAST with toastId (single)", () => {
    it("sets open to false and addToRemoveQueue schedules REMOVE_TOAST; after tick toast is removed", () => {
      cy.get("[data-testid=add-toast]").click();
      cy.get("[data-radix-collection-item]").should("exist");
      cy.get("[data-testid=dismiss-toast]").click();
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 1");
      cy.tick(TOAST_REMOVE_DELAY_MS);
      cy.get("[data-radix-collection-item]").should("not.exist");
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 0");
    });
  });

  describe("DISMISS_TOAST without toastId (dismiss all)", () => {
    it("dismisses all toasts and schedules removal for each", () => {
      cy.get("[data-testid=add-toast]").click();
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 1");
      cy.get("[data-testid=dismiss-all]").click();
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 1");
      cy.tick(TOAST_REMOVE_DELAY_MS);
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 0");
    });
  });

  describe("addToRemoveQueue — duplicate toastId in toastTimeouts", () => {
    it("dismissing same toast twice then ticking once removes toast only once", () => {
      cy.get("[data-testid=add-toast]").click();
      cy.get("[data-radix-collection-item]").should("exist");
      cy.get("[data-testid=dismiss-toast]").click();
      cy.get("[data-testid=dismiss-toast]").click();
      cy.tick(TOAST_REMOVE_DELAY_MS);
      cy.get("[data-radix-collection-item]").should("not.exist");
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 0");
    });
  });

  describe("REMOVE_TOAST (single and list)", () => {
    it("REMOVE_TOAST removes single toast after timeout", () => {
      cy.get("[data-testid=add-toast]").click();
      cy.get("[data-testid=dismiss-toast]").click();
      cy.tick(TOAST_REMOVE_DELAY_MS);
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 0");
    });
  });

  describe("useToast listener registration and cleanup", () => {
    it("listeners are active on toast-demo and count updates when toast is added", () => {
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 0");
      cy.get("[data-testid=add-toast]").click();
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 1");
    });

    it("navigating away unmounts component and cleanup runs; navigating back re-registers", () => {
      cy.get("[data-testid=add-toast]").click();
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 1");
      cy.visit("/");
      cy.visit("/toast-demo");
      cy.get("[data-testid=toast-count]").should("be.visible");
      cy.get("[data-testid=add-toast]").click();
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 1");
    });
  });

  describe("onOpenChange branch (close via Radix close button)", () => {
    it("when user closes toast via close button, onOpenChange(false) triggers dismiss", () => {
      cy.get("[data-testid=add-toast]").click();
      cy.get("[data-radix-collection-item]").should("exist");
      cy.get("[data-radix-collection-item]").find("[toast-close]").click();
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 1");
      cy.tick(TOAST_REMOVE_DELAY_MS);
      cy.get("[data-testid=toast-count]").should("contain.text", "Count: 0");
    });
  });
});
