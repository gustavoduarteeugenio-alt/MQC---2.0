import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export const AppShell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="app-shell pb-24 shadow-elevated">
      {children}
      <BottomNav />
    </div>
  );
};
