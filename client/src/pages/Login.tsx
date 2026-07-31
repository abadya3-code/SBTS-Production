/*
  SBTS Login Page — Standalone Email/Password Authentication
  Industrial Command Center Minimalism - Professional Login Interface
  Features: Email + Password login, link to register, RTL support, professional branding
*/
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Shield, Activity, Eye, Lock, EyeOff, Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { releaseVersion, shortReleaseCommit } from "@/lib/release";

export default function Login() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // If already authenticated, redirect appropriately
  useEffect(() => {
    if (!loading && user) {
      const userStatus = (user as any).userStatus;
      if (userStatus === "pending" || userStatus === "rejected") {
        setLocation("/approve");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [user, loading, setLocation]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async ({ user: loggedUser }) => {
      // The login page queried auth.me before the session cookie existed. Update
      // that cache immediately so the dashboard does not reuse a stale null user.
      utils.auth.me.setData(undefined, loggedUser as any);
      await utils.auth.me.invalidate();
      const status = (loggedUser as any).userStatus;
      if (status === "pending" || status === "rejected") {
        setLocation("/approve");
      } else {
        setLocation("/dashboard");
      }
    },
    onError: (err) => {
      const msg = err.message;
      if (msg.includes("pending")) {
        toast.error("الحساب قيد المراجعة", {
          description: "طلبك معلق وينتظر موافقة مسؤول النظام.",
        });
        setLocation("/approve");
      } else if (msg.includes("rejected")) {
        toast.error("تم رفض الحساب", {
          description: "تم رفض طلب تسجيلك. تواصل مع مسؤول النظام.",
        });
      } else {
        toast.error("خطأ في تسجيل الدخول", {
          description: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    loginMutation.mutate({ email: email.trim(), password });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
          <p className="text-slate-400 text-sm tracking-widest uppercase">جاري التحقق من الجلسة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex overflow-hidden" dir="rtl">
      {/* Left Panel - Branding & Info */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex-col justify-between p-12">
        {/* Grid background pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-60" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-40" />

        {/* Top section */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Shield className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">SBTS</div>
              <div className="text-xs text-slate-500 tracking-widest">Smart Blind Tracking System</div>
            </div>
          </div>

          <h1 className="text-4xl font-black text-white leading-tight mb-4">
            نظام تتبع
            <br />
            <span className="text-cyan-400">الستائر الصناعية</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
            منصة احترافية لإدارة وتتبع الستائر الصناعية في المشاريع الهندسية مع نظام متكامل للصلاحيات والتقارير.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="relative z-10 space-y-4">
          {[
            { icon: Activity, label: "تتبع مراحل العمل في الوقت الفعلي", desc: "مراقبة كاملة لجميع مراحل تركيب الستائر" },
            { icon: Shield, label: "نظام صلاحيات متكامل", desc: "تحكم دقيق في صلاحيات كل مستخدم ودور" },
            { icon: Eye, label: "تقارير احترافية", desc: "تقارير شاملة مع دعم التصدير والطباعة" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-200">{label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom version info */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="text-xs text-slate-500 tracking-widest uppercase">
            Professional Edition · v{releaseVersion} · {shortReleaseCommit}
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 1 ? "bg-cyan-400" : "bg-slate-700"}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Shield className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-[0.3em] text-cyan-400">SBTS</div>
              <div className="text-xs text-slate-500">Smart Blind Tracking System</div>
            </div>
          </div>

          {/* Login card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            {/* Header */}
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-5 bg-cyan-400 rounded-full" />
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">تسجيل الدخول</span>
              </div>
              <h2 className="text-2xl font-black text-white">مرحباً بك في SBTS</h2>
              <p className="text-slate-400 text-sm mt-1">أدخل بياناتك للوصول إلى لوحة التحكم</p>
            </div>

            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm font-medium">البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@company.com"
                    dir="ltr"
                    className="pr-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20 h-11 rounded-xl"
                    required
                    autoComplete="email"
                    disabled={loginMutation.isPending}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm font-medium">كلمة المرور</Label>
                <div className="relative">
                  <KeyRound className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="pr-10 pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-cyan-500 focus:ring-cyan-500/20 h-11 rounded-xl"
                    required
                    autoComplete="current-password"
                    disabled={loginMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={loginMutation.isPending || !email.trim() || !password}
                className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm tracking-wide rounded-xl transition-all duration-200 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 mt-2"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جاري تسجيل الدخول...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 ml-2" />
                    تسجيل الدخول
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-xs text-slate-600">أو</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* Register link */}
            <div className="text-center">
              <p className="text-sm text-slate-500">
                ليس لديك حساب؟{" "}
                <Link
                  href="/register"
                  className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
                >
                  طلب تسجيل جديد
                </Link>
              </p>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                طلبات التسجيل تتطلب موافقة مسؤول النظام قبل تفعيل الحساب.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-600">
              نظام SBTS Professional &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
