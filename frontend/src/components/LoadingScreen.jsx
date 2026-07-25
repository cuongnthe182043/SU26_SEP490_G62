import React from "react";
import Logo from "../theme/Logo";
import LoadingState from "./LoadingState";

export default function LoadingScreen({ label = "Đang tải..." }) {
  return (
    <main className="loading-screen" role="status" aria-live="polite">
      <div className="loading-screen-card">
        <Logo className="loading-screen-logo" />
        <LoadingState label={label} className="py-0" />
      </div>
    </main>
  );
}
