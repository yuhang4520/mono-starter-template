"use client";

import { createContext, PropsWithChildren, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "../ui/dialog";

type AlertContextType = {
  show: (render: (dismiss: () => void) => React.ReactNode) => void;
};

const DialogContext = createContext<AlertContextType>({
  show() {
    throw new Error("useDialogContext must be used within DialogProvider");
  },
});

export function DialogProvider({ children }: PropsWithChildren) {
  const [element, setElement] = useState<React.ReactNode>();

  const dismiss = () => {
    setElement(undefined);
  };

  return (
    <DialogContext.Provider
      value={{
        show: (render) => setElement(render(dismiss)),
      }}
    >
      {children}
      {element &&
        createPortal(
          <Dialog open onOpenChange={() => dismiss()}>
            {element}
          </Dialog>,
          document.body
        )}
    </DialogContext.Provider>
  );
}

export function useDialogContext() {
  return useContext(DialogContext);
}

export type DialogRenderProps<T> = {
  dismiss: () => void;
} & T;
