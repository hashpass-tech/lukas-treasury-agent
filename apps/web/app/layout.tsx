import "./style.css";
export const metadata = {
  title: "LUKAS Treasury · Simulation",
  description: "Policy-controlled treasury obligations. Local simulation.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
