import "@fontsource-variable/space-grotesk";
import "@fontsource/dm-mono/400.css";
import "./style.css";
export const metadata = {
  title: "LUKAS Treasury · Policy-controlled settlement",
  description:
    "A clear operating surface for bounded LUKAS obligations and local settlement.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
