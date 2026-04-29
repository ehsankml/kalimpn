export const config = { runtime: "edge" };

const UPSTREAM_HOST = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const BANNED_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function apiRoute(req) {
  if (!UPSTREAM_HOST) {
    return new Response("Error: Missing UPSTREAM configuration", { status: 500 });
  }

  try {
    const parsedUrl = new URL(req.url);
    const finalDest = `${UPSTREAM_HOST}${parsedUrl.pathname}${parsedUrl.search}`;

    const proxyReqHeaders = new Headers();
    let clientAddress = null;

    req.headers.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (BANNED_HEADERS.has(lowerKey) || lowerKey.startsWith("x-vercel-")) return;

      if (lowerKey === "x-real-ip") {
        clientAddress = val;
        return;
      }
      if (lowerKey === "x-forwarded-for") {
        clientAddress = clientAddress || val;
        return;
      }
      proxyReqHeaders.set(lowerKey, val);
    });

    if (clientAddress) {
      proxyReqHeaders.set("x-forwarded-for", clientAddress);
    }

    const isReadMethod = ["GET", "HEAD"].includes(req.method);

    return await fetch(finalDest, {
      method: req.method,
      headers: proxyReqHeaders,
      body: isReadMethod ? undefined : req.body,
      duplex: "half",
      redirect: "manual",
    });
  } catch (err) {
    // ارور لاگ رو هم یه مقدار رسمی‌تر کردم که جلب توجه نکنه
    console.error("Tunnel link dropped:", err);
    return new Response("Gateway Timeout or Tunnel Error", { status: 502 });
  }
}
