import React from "react";

export default function LoadingScreen({ label = "Loading..." }) {
  return (
    <main className="loading-screen" role="status" aria-live="polite">
      {label}
    </main>
  );
}
