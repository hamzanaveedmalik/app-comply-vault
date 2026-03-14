import { metrics } from "~/lib/metrics";
import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { env } from "~/env";

// Add basic authentication for metrics endpoint
const METRICS_AUTH = {
  username: env.METRICS_USERNAME || "admin",
  password: env.METRICS_PASSWORD || "metrics",
};

export async function GET(request: Request) {
  try {
    // Check for basic auth
    const authHeader = request.headers.get("authorization");
    
    // Only require auth in production
    if (env.NODE_ENV === "production") {
      // If no auth header, require session
      if (!authHeader) {
        const session = await auth();
        if (!session?.user) {
          return new Response("Unauthorized", {
            status: 401,
            headers: {
              "WWW-Authenticate": 'Basic realm="Metrics Access"',
            },
          });
        }
      } else {
        // Basic auth validation
        const [, credentials] = authHeader.split(" ");
        const decoded = credentials ? atob(credentials) : "";
        const [username, password] = decoded.split(":");
        
        if (!username || !password || username !== METRICS_AUTH.username || password !== METRICS_AUTH.password) {
          return new Response("Unauthorized", {
            status: 401,
            headers: {
              "WWW-Authenticate": 'Basic realm="Metrics Access"',
            },
          });
        }
      }
    }
    
    // Generate prometheus metrics
    const metricsOutput = metrics.getPrometheusMetrics();
    
    return new NextResponse(metricsOutput, {
      headers: {
        "Content-Type": "text/plain",
      },
    });
  } catch (error) {
    console.error("Error serving metrics:", error);
    return new NextResponse("Error generating metrics", { status: 500 });
  }
}