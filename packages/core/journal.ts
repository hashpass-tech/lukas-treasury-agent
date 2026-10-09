import fs from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export class Journal {
  private key?: Buffer;
  constructor() {
    const file = process.env.JOURNAL_KEY_FILE;
    if (file) {
      if ((fs.statSync(file).mode & 0o077) !== 0)
        throw new Error("JOURNAL_KEY_PERMISSIONS");
      this.key = Buffer.from(fs.readFileSync(file, "utf8").trim(), "hex");
      if (this.key.length !== 32) throw new Error("JOURNAL_KEY_INVALID");
    } else if ((process.env.MODE ?? "LOCAL") !== "LOCAL")
      throw new Error("PROTECTED_JOURNAL_REQUIRED");
  }
  protect(raw: string, hash: string) {
    if (!this.key) return raw;
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(hash));
    const encrypted = Buffer.concat([
      cipher.update(raw, "utf8"),
      cipher.final(),
    ]);
    return [
      "enc1",
      iv.toString("hex"),
      cipher.getAuthTag().toString("hex"),
      encrypted.toString("hex"),
    ].join(":");
  }
  recover(raw: string, hash: string) {
    if (!raw.startsWith("enc1:")) {
      if (this.key) throw new Error("UNPROTECTED_JOURNAL_ENTRY");
      return raw;
    }
    if (!this.key) throw new Error("JOURNAL_KEY_REQUIRED");
    const [, iv, tag, data] = raw.split(":");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(iv, "hex"),
    );
    decipher.setAAD(Buffer.from(hash));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "hex")),
      decipher.final(),
    ]).toString("utf8");
  }
}
