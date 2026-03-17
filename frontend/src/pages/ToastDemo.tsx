/**
 * Demo page for E2E tests: exercises useToast via UI (add, update, dismiss, dismiss all).
 * App.tsx already renders Toaster at root, so toasts appear when triggered from here.
 */
import React from "react";
import { useToast } from "@/hooks/use-toast";

export default function ToastDemo() {
  const { toasts, toast, dismiss } = useToast();
  const toastRef = React.useRef<ReturnType<typeof toast> | null>(null);

  const handleAdd = () => {
    toastRef.current = toast({
      title: "Initial title",
      description: "Initial description",
    });
  };

  const handleUpdate = () => {
    if (toastRef.current) {
      toastRef.current.update({
        id: toastRef.current.id,
        title: "Updated title",
        description: "Updated description",
      });
    }
  };

  const handleDismiss = () => {
    if (toastRef.current) {
      dismiss(toastRef.current.id);
    }
  };

  const handleDismissAll = () => {
    dismiss();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8">
      <h1 className="text-2xl font-semibold">Toast E2E Demo</h1>
      <div data-testid="toast-controls" className="flex flex-wrap gap-2">
        <button type="button" onClick={handleAdd} data-testid="add-toast" className="rounded bg-primary px-4 py-2 text-primary-foreground">
          Add Toast
        </button>
        <button type="button" onClick={handleUpdate} data-testid="update-toast" className="rounded bg-primary px-4 py-2 text-primary-foreground">
          Update Toast
        </button>
        <button type="button" onClick={handleDismiss} data-testid="dismiss-toast" className="rounded bg-primary px-4 py-2 text-primary-foreground">
          Dismiss Toast
        </button>
        <button type="button" onClick={handleDismissAll} data-testid="dismiss-all" className="rounded bg-primary px-4 py-2 text-primary-foreground">
          Dismiss All
        </button>
      </div>
      <div data-testid="toast-count" className="text-muted-foreground">
        Count: {toasts.length}
      </div>
    </div>
  );
}
