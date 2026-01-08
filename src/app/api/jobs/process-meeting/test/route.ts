import { NextResponse } from "next/server";

/**
 * Test endpoint to verify the process-meeting handler is accessible
 * This helps debug QStash webhook issues
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Process meeting endpoint is accessible",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    hasQStashToken: !!process.env.QSTASH_TOKEN,
    hasSigningKeys: !!(process.env.QSTASH_CURRENT_SIGNING_KEY || process.env.QSTASH_NEXT_SIGNING_KEY),
    webhookUrl: process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/process-meeting`
      : "NOT SET",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({
      status: "ok",
      message: "Test POST received",
      body,
      timestamp: new Date().toISOString(),
      headers: Object.fromEntries(request.headers.entries()),
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 400 });
  }
}

