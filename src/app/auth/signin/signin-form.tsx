"use client";

import { signIn } from "next-auth/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface SignInFormProps {
  callbackUrl?: string;
}

export function SignInForm({ callbackUrl }: SignInFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleGoogleAuth = async (mode: "signin" | "signup") => {
    setIsLoading(`google-${mode}`);
    setError(null);
    try {
      const result = await signIn("google", {
        callbackUrl: callbackUrl || "/dashboard",
        redirect: true,
      });
      if (result?.error) {
        setIsLoading(null);
        setError("Failed to sign in with Google");
      }
    } catch (error) {
      console.error("Auth error:", error);
      setIsLoading(null);
      setError("An error occurred during authentication");
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading("email-signin");
    setError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      console.log("Sign in result:", result);

      if (result?.error) {
        setError("Invalid email or password");
        setIsLoading(null);
      } else if (result?.ok) {
        // Successful sign in - force full page reload to refresh session
        // This ensures the session includes workspaceId if user has a workspace
        const redirectUrl = callbackUrl || "/dashboard";
        window.location.href = redirectUrl;
      } else {
        // Check if result is undefined or null
        console.error("Unexpected sign in result:", result);
        setError("Failed to sign in. Please try again.");
        setIsLoading(null);
      }
    } catch (error) {
      console.error("Sign in error:", error);
      setError("An error occurred during sign in");
      setIsLoading(null);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading("email-signup");
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(null);
      return;
    }

    try {
      // Create account
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create account");
        setIsLoading(null);
        return;
      }

      // Auto sign in after successful signup
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but failed to sign in. Please try signing in.");
        setIsLoading(null);
      } else {
        router.push(callbackUrl || "/dashboard");
        router.refresh();
      }
    } catch (error) {
      console.error("Sign up error:", error);
      setError("An error occurred during sign up");
      setIsLoading(null);
    }
  };

  const GoogleIcon = () => (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-lg border border-white/10">
        <button
          onClick={() => {
            setActiveTab("signin");
            setError(null);
            setEmail("");
            setPassword("");
            setName("");
            setConfirmPassword("");
          }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === "signin"
              ? "bg-[#117A4B] text-white shadow-sm"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => {
            setActiveTab("signup");
            setError(null);
            setEmail("");
            setPassword("");
            setName("");
            setConfirmPassword("");
          }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === "signup"
              ? "bg-[#117A4B] text-white shadow-sm"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Sign In Form */}
      {activeTab === "signin" ? (
        <div className="space-y-4">
          <p className="text-center text-sm text-gray-400 mb-4">
            Welcome back! Sign in to continue to your account.
          </p>

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email" className="text-white">
                Email
              </Label>
              <Input
                id="signin-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading !== null}
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signin-password" className="text-white">
                Password
              </Label>
              <Input
                id="signin-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading !== null}
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading !== null}
              className="w-full h-12 bg-[#117A4B] text-white hover:bg-[#0E6B3F] font-medium text-base"
              size="lg"
            >
              {isLoading === "email-signin" ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-2 text-gray-400">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            onClick={() => handleGoogleAuth("signin")}
            disabled={isLoading !== null}
            className="w-full h-12 bg-white text-gray-900 hover:bg-gray-100 font-medium text-base shadow-lg transition-all"
            size="lg"
          >
            {isLoading === "google-signin" ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 mr-2"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Signing in...
              </>
            ) : (
              <>
                <GoogleIcon />
                Sign in with Google
              </>
            )}
          </Button>
        </div>
      ) : (
        /* Sign Up Form */
        <div className="space-y-4">
          <p className="text-center text-sm text-gray-400 mb-4">
            Create a new account to get started with Comply Vault.
          </p>

          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name" className="text-white">
                Full Name
              </Label>
              <Input
                id="signup-name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading !== null}
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-email" className="text-white">
                Email
              </Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading !== null}
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-password" className="text-white">
                Password
              </Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading !== null}
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-confirm-password" className="text-white">
                Confirm Password
              </Label>
              <Input
                id="signup-confirm-password"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading !== null}
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading !== null}
              className="w-full h-12 bg-[#117A4B] text-white hover:bg-[#0E6B3F] font-medium text-base"
              size="lg"
            >
              {isLoading === "email-signup" ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-2 text-gray-400">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            onClick={() => handleGoogleAuth("signup")}
            disabled={isLoading !== null}
            className="w-full h-12 bg-white text-gray-900 hover:bg-gray-100 font-medium text-base shadow-lg transition-all"
            size="lg"
          >
            {isLoading === "google-signup" ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 mr-2"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Creating account...
              </>
            ) : (
              <>
                <GoogleIcon />
                Sign up with Google
              </>
            )}
          </Button>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-4">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
