import { metrics } from "~/lib/metrics";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { env } from "~/env";

// Add basic authentication for metrics endpoint
const METRICS_AUTH = {
  username: env.METRICS_USERNAME || "admin",
  password: env.METRICS_PASSWORD || "metrics",
};

export async function GET(request: Request) {
  try {
    // Check for basic auth
    const auth = request.headers.get("authorization");
    
    // Only require auth in production
    if (env.NODE_ENV === "production") {
      // If no auth header, require session
      if (!auth) {
        const session = await getServerSession(authOptions);
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
        const [, credentials] = auth.split(" ");
        const [username, password] = atob(credentials).split(":");
        
        if (username !== METRICS_AUTH.username || password !== METRICS_AUTH.password) {
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