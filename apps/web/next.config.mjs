const isGitHubPages = process.env.GITHUB_PAGES === "true";

export default {
  experimental: { cpus: 2 },
  ...(isGitHubPages
    ? {
        output: "export",
        basePath: "/lukas-treasury-agent",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
  ...(isGitHubPages
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://127.0.0.1:3001/:path*",
            },
          ];
        },
      }),
};
