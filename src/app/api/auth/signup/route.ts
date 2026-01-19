import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "~/server/db";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = signupSchema.parse(body);

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Create user and account in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          name: validatedData.name || validatedData.email.split("@")[0],
          emailVerified: new Date(), // Auto-verify for now
        },
      });

      // Create account with password hash stored in access_token field
      // (We'll use access_token as a temporary storage for password hash)
      await tx.account.create({
        data: {
          userId: user.id,
          type: "credentials",
          provider: "credentials",
          providerAccountId: user.id,
          access_token: hashedPassword, // Store password hash here
        },
      });

      return user;
    });

    return NextResponse.json(
      {
        message: "Account created successfully",
        user: {
          id: result.id,
          email: result.email,
          name: result.name,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Validation error" },
        { status: 400 },
      );
    }

    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }
}
