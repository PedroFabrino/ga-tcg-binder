import type { ReactNode } from "react";

export default function OverlayLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Paint transparent before React hydrates, so OBS never sees the app's
          normal page background for a frame after a browser-source reload. */}
      <style>{`html, body { background: transparent !important; }`}</style>
      {children}
    </>
  );
}
