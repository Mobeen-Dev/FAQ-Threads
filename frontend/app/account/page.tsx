"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { shopifyApi, type EmailStatus, type EmailLog } from "@/services/shopifyApi";
import MaterialIcon from "@/components/MaterialIcon";
import { toast } from "sonner";

type TabId = "profile" | "email" | "security";

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: "profile", label: "Profile", icon: "person" },
  { id: "email", label: "Email & Notifications", icon: "mail" },
  { id: "security", label: "Password & Security", icon: "lock" },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-stone-200 dark:border-zinc-800 p-6 mb-6">
      <h2 className="text-lg font-semibold mb-1 text-stone-900 dark:text-zinc-100">{title}</h2>
      {description && <p className="text-sm text-stone-500 dark:text-zinc-400 mb-5">{description}</p>}
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function StatusBadge({ status, children }: { status: "success" | "warning" | "error" | "info"; children: React.ReactNode }) {
  const colors = {
    success: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    warning: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    error: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    info: "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status]}`}>
      {children}
    </span>
  );
}

// Profile Tab
function ProfileTab() {
  const { user, refreshUser } = useAuth();
  const [resendingVerification, setResendingVerification] = useState(false);

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      const result = await shopifyApi.resendVerificationEmail();
      toast.success(result.message || "Verification email sent!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send verification email");
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <div>
      <Section title="Account Information" description="Your basic account details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">Email Address</label>
            <div className="flex items-center gap-3">
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="flex-1 border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-stone-50 dark:bg-zinc-800/50 text-stone-900 dark:text-zinc-100 cursor-not-allowed"
              />
              {user?.emailVerified ? (
                <StatusBadge status="success">
                  <MaterialIcon name="check_circle" className="text-xs mr-1" />
                  Verified
                </StatusBadge>
              ) : (
                <StatusBadge status="warning">
                  <MaterialIcon name="warning" className="text-xs mr-1" />
                  Unverified
                </StatusBadge>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">Display Name</label>
            <input
              type="text"
              value={user?.name || "—"}
              disabled
              className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-stone-50 dark:bg-zinc-800/50 text-stone-900 dark:text-zinc-100 cursor-not-allowed"
            />
          </div>
        </div>
      </Section>

      {!user?.emailVerified && (
        <Section title="Email Verification" description="Verify your email address to unlock all features">
          <div className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800">
            <MaterialIcon name="mark_email_unread" className="text-2xl text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-800 dark:text-amber-200">Your email is not verified</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                We&apos;ve sent a verification email to <strong>{user?.email}</strong>. 
                Click the link in the email to verify your account.
              </p>
              <button
                onClick={handleResendVerification}
                disabled={resendingVerification}
                className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendingVerification ? "Sending..." : "Resend verification email"}
              </button>
            </div>
          </div>
        </Section>
      )}

      <Section title="Connected Shops" description="Shopify stores linked to your account">
        {user?.shops && user.shops.length > 0 ? (
          <div className="space-y-3">
            {user.shops.map((shop) => (
              <div
                key={shop.id}
                className="flex items-center gap-3 p-3 bg-stone-50 dark:bg-zinc-800/50 rounded-xl border border-stone-200 dark:border-zinc-700"
              >
                <MaterialIcon name="storefront" className="text-xl text-teal-600 dark:text-teal-400" />
                <div>
                  <p className="font-medium text-stone-900 dark:text-zinc-100">{shop.name || shop.domain}</p>
                  <p className="text-xs text-stone-500 dark:text-zinc-400">{shop.domain}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-stone-500 dark:text-zinc-400 text-sm">No shops connected yet. Go to Shopify Store settings to connect.</p>
        )}
      </Section>
    </div>
  );
}

// Email Tab
function EmailTab() {
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState<string | null>(null);

  // Only show test emails in development mode
  const isDevelopment = process.env.NODE_ENV === "development";

  const loadEmailData = useCallback(async () => {
    try {
      const [status, logsData] = await Promise.all([
        shopifyApi.getEmailStatus(),
        shopifyApi.getEmailLogs({ limit: "10" }),
      ]);
      setEmailStatus(status);
      setEmailLogs(logsData.logs);
    } catch (error) {
      console.error("Failed to load email data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmailData();
  }, [loadEmailData]);

  const handleSendTestEmail = async (templateName: string) => {
    setSendingTest(templateName);
    try {
      const result = await shopifyApi.sendTestEmail(templateName);
      if (result.skipped) {
        toast.info(result.reason || "Email was skipped");
      } else {
        toast.success(result.message || "Test email sent!");
        loadEmailData(); // Refresh logs
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send test email");
    } finally {
      setSendingTest(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div>
      <Section title="Email Service Status" description="Current status of the email delivery system">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-stone-50 dark:bg-zinc-800/50 rounded-xl border border-stone-200 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-stone-600 dark:text-zinc-400">Provider</span>
              {emailStatus?.service.ready ? (
                <StatusBadge status="success">Active</StatusBadge>
              ) : (
                <StatusBadge status="error">Inactive</StatusBadge>
              )}
            </div>
            <p className="text-lg font-semibold text-stone-900 dark:text-zinc-100 capitalize">
              {emailStatus?.service.provider || "None"}
            </p>
            {emailStatus?.service.previewMode && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Preview mode (emails logged only)</p>
            )}
          </div>

          <div className="p-4 bg-stone-50 dark:bg-zinc-800/50 rounded-xl border border-stone-200 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-stone-600 dark:text-zinc-400">Queue</span>
              {emailStatus?.queue.processing ? (
                <StatusBadge status="info">Processing</StatusBadge>
              ) : (
                <StatusBadge status="success">Idle</StatusBadge>
              )}
            </div>
            <p className="text-lg font-semibold text-stone-900 dark:text-zinc-100">
              {emailStatus?.queue.pending || 0} pending
            </p>
            {(emailStatus?.queue.failed || 0) > 0 && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{emailStatus?.queue.failed} failed</p>
            )}
          </div>

          <div className="p-4 bg-stone-50 dark:bg-zinc-800/50 rounded-xl border border-stone-200 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-stone-600 dark:text-zinc-400">Scheduler</span>
              {emailStatus?.scheduler.running ? (
                <StatusBadge status="success">Running</StatusBadge>
              ) : (
                <StatusBadge status="warning">Stopped</StatusBadge>
              )}
            </div>
            <p className="text-sm text-stone-700 dark:text-zinc-300">
              {emailStatus?.scheduler.nextRun
                ? `Next: ${new Date(emailStatus.scheduler.nextRun).toLocaleString()}`
                : "No scheduled jobs"}
            </p>
          </div>
        </div>
      </Section>

      {isDevelopment && (
        <Section title="Test Emails" description="Send test emails to verify your email configuration (development only)">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: "welcome", label: "Welcome Email", icon: "waving_hand", description: "Test the welcome email template" },
              { id: "verify-email", label: "Verification Email", icon: "mark_email_read", description: "Test email verification" },
              { id: "password-reset", label: "Password Reset", icon: "lock_reset", description: "Test password reset email" },
            ].map((template) => (
              <div
                key={template.id}
                className="p-4 bg-stone-50 dark:bg-zinc-800/50 rounded-xl border border-stone-200 dark:border-zinc-700"
              >
                <div className="flex items-center gap-3 mb-3">
                  <MaterialIcon name={template.icon} className="text-xl text-teal-600 dark:text-teal-400" />
                  <div>
                    <h4 className="font-medium text-stone-900 dark:text-zinc-100">{template.label}</h4>
                    <p className="text-xs text-stone-500 dark:text-zinc-400">{template.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleSendTestEmail(template.id)}
                  disabled={sendingTest !== null}
                  className="w-full px-4 py-2 text-sm font-medium rounded-xl border border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendingTest === template.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-teal-600 border-t-transparent rounded-full" />
                      Sending...
                    </span>
                  ) : (
                    "Send Test"
                  )}
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Recent Email Activity" description="Your last 10 emails">
        {emailLogs.length > 0 ? (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 dark:border-zinc-700">
                  <th className="text-left py-2 px-3 font-medium text-stone-600 dark:text-zinc-400">Type</th>
                  <th className="text-left py-2 px-3 font-medium text-stone-600 dark:text-zinc-400">Recipient</th>
                  <th className="text-left py-2 px-3 font-medium text-stone-600 dark:text-zinc-400">Subject</th>
                  <th className="text-left py-2 px-3 font-medium text-stone-600 dark:text-zinc-400">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-stone-600 dark:text-zinc-400">Sent</th>
                </tr>
              </thead>
              <tbody>
                {emailLogs.map((log) => (
                  <tr key={log.id} className="border-b border-stone-100 dark:border-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-800/50">
                    <td className="py-2 px-3 text-stone-700 dark:text-zinc-300">{log.emailType}</td>
                    <td className="py-2 px-3 text-stone-700 dark:text-zinc-300 truncate max-w-[150px]">{log.recipient}</td>
                    <td className="py-2 px-3 text-stone-700 dark:text-zinc-300 truncate max-w-[200px]">{log.subject}</td>
                    <td className="py-2 px-3">
                      <StatusBadge status={log.status === "sent" ? "success" : log.status === "failed" ? "error" : "info"}>
                        {log.status}
                      </StatusBadge>
                    </td>
                    <td className="py-2 px-3 text-stone-500 dark:text-zinc-400">
                      {log.sentAt ? new Date(log.sentAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-stone-500 dark:text-zinc-400 text-sm py-4 text-center">No email activity yet.</p>
        )}
      </Section>
    </div>
  );
}

// Security Tab
function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pwd)) return "Must contain an uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Must contain a lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Must contain a number";
    return null;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validatePassword(newPassword);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setChanging(true);
    try {
      const result = await shopifyApi.changePassword(currentPassword, newPassword);
      toast.success(result.message || "Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setChanging(false);
    }
  };

  const passwordStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: "Weak", color: "bg-rose-500" };
    if (score <= 4) return { score, label: "Fair", color: "bg-amber-500" };
    return { score, label: "Strong", color: "bg-emerald-500" };
  };

  const strength = passwordStrength(newPassword);

  return (
    <div>
      <Section title="Change Password" description="Update your account password">
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 pr-10 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-zinc-200"
              >
                <MaterialIcon name={showPasswords ? "visibility_off" : "visibility"} className="text-lg" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">
              New Password
            </label>
            <input
              type={showPasswords ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              placeholder="Enter new password"
            />
            {newPassword && (
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-1.5 bg-stone-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strength.color} transition-all duration-300`}
                      style={{ width: `${(strength.score / 6) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-stone-600 dark:text-zinc-400">{strength.label}</span>
                </div>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  Use 8+ characters with uppercase, lowercase, and numbers
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-zinc-300 mb-1">
              Confirm New Password
            </label>
            <input
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full border border-stone-300 dark:border-zinc-600 rounded-xl px-3 py-2.5 bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              placeholder="Confirm new password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={changing || !currentPassword || !newPassword || !confirmPassword}
            className="bg-teal-600 text-white px-5 py-2.5 rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {changing ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Changing...
              </span>
            ) : (
              "Change Password"
            )}
          </button>
        </form>
      </Section>

      <Section title="Password Recovery" description="Options for recovering your account">
        <div className="flex items-start gap-4 p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-200 dark:border-sky-800">
          <MaterialIcon name="info" className="text-2xl text-sky-600 dark:text-sky-400 mt-0.5" />
          <div>
            <h3 className="font-medium text-sky-800 dark:text-sky-200">Forgot your password?</h3>
            <p className="text-sm text-sky-700 dark:text-sky-300 mt-1">
              If you&apos;re logged out and can&apos;t remember your password, you can request a password reset link from the login page.
            </p>
            <a
              href="/forgot-password"
              className="mt-2 inline-block text-sm font-medium text-sky-700 dark:text-sky-300 hover:text-sky-800 dark:hover:text-sky-200 underline"
            >
              Go to password reset page →
            </a>
          </div>
        </div>
      </Section>

      <Section title="Security Tips" description="Keep your account secure">
        <ul className="space-y-3 text-sm text-stone-700 dark:text-zinc-300">
          <li className="flex items-start gap-3">
            <MaterialIcon name="check_circle" className="text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <span>Use a unique password that you don&apos;t use for other accounts</span>
          </li>
          <li className="flex items-start gap-3">
            <MaterialIcon name="check_circle" className="text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <span>Include a mix of letters, numbers, and special characters</span>
          </li>
          <li className="flex items-start gap-3">
            <MaterialIcon name="check_circle" className="text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <span>Change your password regularly and never share it with others</span>
          </li>
          <li className="flex items-start gap-3">
            <MaterialIcon name="check_circle" className="text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <span>Be cautious of phishing emails pretending to be from our service</span>
          </li>
        </ul>
      </Section>
    </div>
  );
}

export default function AccountPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  if (!user) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-zinc-100">Account Settings</h1>
        <p className="text-stone-500 dark:text-zinc-400 mt-1">Manage your profile, email preferences, and security</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                : "bg-white dark:bg-zinc-900 text-stone-600 dark:text-zinc-400 border border-stone-200 dark:border-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-800"
            }`}
          >
            <MaterialIcon name={tab.icon} className="text-lg" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "profile" && <ProfileTab />}
      {activeTab === "email" && <EmailTab />}
      {activeTab === "security" && <SecurityTab />}
    </div>
  );
}
