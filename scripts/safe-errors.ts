// CLI errors must never dump viem signing arguments or serialized transactions.
export function installSafeErrors() {
  process.on("uncaughtException", (error) => {
    console.error(
      JSON.stringify({
        event: "fatal",
        errorClass: error.name,
        code:
          error.message.match(/^([A-Z][A-Z0-9_]+)(?::|$)/)?.[1] ??
          "INTERNAL_ERROR",
      }),
    );
    process.exit(1);
  });
  process.on("unhandledRejection", (error) => {
    console.error(
      JSON.stringify({
        event: "fatal",
        errorClass: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    process.exit(1);
  });
}
