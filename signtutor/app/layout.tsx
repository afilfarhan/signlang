import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SignTutor — Learn Sign Language",
    template: "%s | SignTutor",
  },
  description:
    "Browser-based, vision-driven sign language learning with on-device AI. No account required. Your webcam never leaves your device.",
  keywords: ["sign language", "ASL", "learn", "fingerspelling", "on-device AI", "accessibility"],
  openGraph: {
    title: "SignTutor — Learn Sign Language",
    description: "On-device AI sign language tutor. No uploads, no account required.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* MediaPipe Hands CDN — same versions as prototype */}
        <script
          src="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js"
          crossOrigin="anonymous"
          defer
        />
        <script
          src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js"
          crossOrigin="anonymous"
          defer
        />
        <script
          src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js"
          crossOrigin="anonymous"
          defer
        />
      </head>
      <body>
        {/* Skip link for keyboard navigation (WCAG 2.2 AA, PDR FR-5.3) */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
