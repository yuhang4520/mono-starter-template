"use client";

import { createContext, PropsWithChildren, useContext, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { LucideLoader } from "lucide-react";

type AlertSchema = {
  title?: string;
  description?: string;
  onConfirm: (dismiss: () => void) => Promise<void>;
};

type AlertContextType = {
  confirm: (
    title: string | undefined,
    description: string | undefined,
    onConfirm: (dismiss: () => void) => Promise<void>
  ) => Promise<void>;
};

const AlertContext = createContext<AlertContextType>({
  async confirm() {
    throw new Error("useAlertContext must be used within AlertProvider");
  },
});

export function AlertProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(false);
  const [presentation, setPresentation] = useState<AlertSchema | undefined>();

  const dismiss = () => {
    setLoading(false);
    setPresentation(undefined);
  };

  return (
    <AlertContext.Provider
      value={{
        async confirm(title, description, onConfirm) {
          setPresentation({ title, description, onConfirm });
        },
      }}
    >
      {children}
      {presentation &&
        createPortal(
          <AlertDialog open={!!presentation} onOpenChange={() => dismiss()}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {presentation.title || "Confirmation"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {presentation.description ||
                    "Review your action, cancel or continue?"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    setLoading(true);
                    await presentation.onConfirm(dismiss);
                  }}
                >
                  {loading && <LucideLoader className="animate-spin" />}
                  Continue
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>,
          document.body
        )}
    </AlertContext.Provider>
  );
}

export function useAlertContext() {
  return useContext(AlertContext);
}
