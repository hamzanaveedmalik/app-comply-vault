/**
 * CV-VL-02 — send the hypothesis-check email.
 *
 * Modes:
 *   mailto (default) — opens the OS mail client with a prefilled draft
 *   resend           — sends via Resend (requires VL02_CONFIRM=yes)
 *
 * Usage:
 *   node scripts/send-vl02-email.mjs
 *   node scripts/send-vl02-email.mjs --mode=mailto
 *   VL02_FROM_NAME="André" VL02_CONFIRM=yes node scripts/send-vl02-email.mjs --mode=resend
 *
 * Env:
 *   VL02_TO          default nico@advizorstack.com (public LinkedIn contact)
 *   VL02_FROM_NAME   required for resend mode (signature)
 *   VL02_REPLY_TO    optional
 *   EMAIL_FROM       Resend from address (must be @complyvault.co)
 *   RESEND_API_KEY   required for resend mode
 */
import { execFileSync } from "node:child_process";
import { Resend } from "resend";

const args = new Set(process.argv.slice(2));
const modeArg = [...args].find((a) => a.startsWith("--mode="));
const mode = modeArg?.slice("--mode=".length) ?? "mailto";

const TO = process.env.VL02_TO?.trim() || "nico@advizorstack.com";
const FROM_NAME = process.env.VL02_FROM_NAME?.trim() || "";
const REPLY_TO = process.env.VL02_REPLY_TO?.trim() || undefined;
const SUBJECT = "Quick preference before our 10 Aug session";

const BODY_TEXT = `Hi Nico —

Looking forward to the 10 August session. To use the time well: would it be most useful to see exam-response assembly, the cross-firm portfolio view, or evidence retrieval (source-linked answers from email and meetings)?

Happy to lead with whichever you pick and keep the rest short.

Thanks,
${FROM_NAME || "[Name]"}
`;

const BODY_HTML = `
<p>Hi Nico —</p>
<p>Looking forward to the 10 August session. To use the time well: would it be most useful to see <strong>exam-response assembly</strong>, the <strong>cross-firm portfolio view</strong>, or <strong>evidence retrieval</strong> (source-linked answers from email and meetings)?</p>
<p>Happy to lead with whichever you pick and keep the rest short.</p>
<p>Thanks,<br/>${escapeHtml(FROM_NAME || "[Name]")}</p>
`;

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function openMailto() {
  const url =
    `mailto:${encodeURIComponent(TO)}` +
    `?subject=${encodeURIComponent(SUBJECT)}` +
    `&body=${encodeURIComponent(BODY_TEXT)}`;
  if (process.platform === "darwin") {
    execFileSync("open", [url], { stdio: "inherit" });
  } else if (process.platform === "win32") {
    execFileSync("cmd", ["/c", "start", "", url], { stdio: "inherit" });
  } else {
    execFileSync("xdg-open", [url], { stdio: "inherit" });
  }
  console.log(`Opened mail draft → ${TO}`);
  console.log("Review the signature, then hit Send in your mail client.");
}

async function sendResend() {
  if (process.env.VL02_CONFIRM !== "yes") {
    console.error(
      "Refusing to send via Resend without VL02_CONFIRM=yes.\n" +
        "Set VL02_FROM_NAME and VL02_CONFIRM=yes, or use --mode=mailto."
    );
    process.exit(1);
  }
  if (!FROM_NAME) {
    console.error("VL02_FROM_NAME is required for resend mode.");
    process.exit(1);
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set.");
    process.exit(1);
  }
  const from =
    process.env.EMAIL_FROM?.includes("noreply-local")
      ? "ComplyVault <hello@complyvault.co>"
      : process.env.EMAIL_FROM || "ComplyVault <hello@complyvault.co>";

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: TO,
    subject: SUBJECT,
    text: BODY_TEXT,
    html: BODY_HTML,
    ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
  });
  if (result.error) {
    console.error("Resend error:", result.error);
    process.exit(1);
  }
  console.log("Sent via Resend.", { id: result.data?.id, to: TO, from });
}

if (mode === "resend") {
  await sendResend();
} else if (mode === "mailto") {
  openMailto();
} else {
  console.error(`Unknown mode: ${mode}`);
  process.exit(1);
}
