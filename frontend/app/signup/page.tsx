"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { isStrongPassword, isValidEmail, normalizeEmail } from "@/services/authStorage";

export default function SignupPage() {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");

  // Password strength indicator
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    const levels = [
      { label: "", color: "" },
      { label: "Very weak", color: "bg-rose-500" },
      { label: "Weak", color: "bg-orange-500" },
      { label: "Fair", color: "bg-amber-500" },
      { label: "Good", color: "bg-lime-500" },
      { label: "Strong", color: "bg-emerald-500" },
    ];
    return { score, ...levels[score] };
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const trimmedName = name.trim();
      const normalizedEmail = normalizeEmail(email).toLowerCase();

      if (!trimmedName) {
        throw new Error("Name is required.");
      }
      if (!isValidEmail(normalizedEmail)) {
        throw new Error("Please enter a valid email address.");
      }
      if (!isStrongPassword(password)) {
        throw new Error("Password must be at least 8 characters and include upper, lower, number, and symbol.");
      }

      await signup(normalizedEmail, password, trimmedName);
    } catch (err) {
      // Check if this is the verification required response
      if (err && typeof err === "object" && "requiresVerification" in err && (err as { requiresVerification: boolean }).requiresVerification) {
        setShowVerificationMessage(true);
        setVerificationEmail("email" in err ? String((err as { email: unknown }).email) : email);
        setError("");
      } else {
        setError(err instanceof Error ? err.message : "Signup failed");
      }
    } finally {
      setLoading(false);
    }
  };

  // Show verification message after successful signup
  if (showVerificationMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-stone-900 dark:text-zinc-100">
              <span className="text-teal-600 dark:text-teal-400">FAQ</span> Manager
            </h1>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
                <svg className="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-stone-900 dark:text-zinc-100 mb-2">Check Your Email</h2>
              <p className="text-stone-600 dark:text-zinc-400 mb-2">
                Your account has been created successfully!
              </p>
              <p className="text-stone-500 dark:text-zinc-500 text-sm mb-6">
                We've sent a verification link to <span className="font-medium text-stone-700 dark:text-zinc-300">{verificationEmail}</span>. 
                Please check your inbox and click the link to verify your email address.
              </p>
              
              <div className="bg-stone-50 dark:bg-zinc-800 rounded-xl p-4 mb-6 text-left">
                <h3 className="text-sm font-medium text-stone-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  What's next?
                </h3>
                <ul className="text-sm text-stone-600 dark:text-zinc-400 space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-teal-500 mt-0.5">1.</span>
                    Check your email inbox (and spam folder)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-500 mt-0.5">2.</span>
                    Click the verification link in the email
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-500 mt-0.5">3.</span>
                    Return here and sign in to your account
                  </li>
                </ul>
              </div>
              
              <Link
                href="/login"
                className="inline-flex justify-center py-2.5 px-6 border border-transparent text-sm font-medium rounded-xl text-white bg-teal-600 hover:bg-teal-700 transition-colors"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-stone-900 dark:text-zinc-100">
            <span className="text-teal-600 dark:text-teal-400">FAQ</span> Manager
          </h1>
          <p className="text-stone-500 dark:text-zinc-400 mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-8 space-y-5">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="signup-name" className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1.5">
              Full name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-stone-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl pl-10 pr-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="signup-email" className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1.5">
              Email address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-stone-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl pl-10 pr-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="signup-password" className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-stone-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl pl-10 pr-12 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-shadow"
                placeholder="Min 8 characters"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 dark:text-zinc-500 hover:text-stone-600 dark:hover:text-zinc-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Password strength indicator */}
            {password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        level <= passwordStrength.score ? passwordStrength.color : "bg-stone-200 dark:bg-zinc-700"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  {passwordStrength.label} • Use 8+ chars with upper, lower, number & symbol
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 text-white py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm hover:shadow flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Creating account...</span>
              </>
            ) : (
              "Create Account"
            )}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-zinc-900 text-stone-500 dark:text-zinc-400">Already have an account?</span>
            </div>
          </div>

          <Link
            href="/login"
            className="block w-full text-center py-2.5 rounded-xl border border-stone-300 dark:border-zinc-600 text-stone-700 dark:text-zinc-300 hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors font-medium"
          >
            Sign in instead
          </Link>
        </form>

        <p className="text-center text-xs text-stone-400 dark:text-zinc-500 mt-6">
          By signing up, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
