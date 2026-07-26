/*
  SBTS Approve Page
  Shown to users who have completed registration and are awaiting admin approval.
  Also shown to rejected users with appropriate messaging.
*/
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle, RefreshCw, LogOut, Shield, Mail } from "lucide-react";

export default function Approve() {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();

  // Re-fetch auth state to check if approval happened
  const meQuery = trpc.auth.me.useQuery(undefined, {
    refetchInterval: 30_000, // poll every 30s
  });

  const currentUser = meQuery.data ?? user;
  const userStatus = (currentUser as any)?.userStatus;

  useEffect(() => {
    if (!loading && !currentUser) {
      setLocation("/login");
      return;
    }
    if (!loading && currentUser) {
      if (userStatus === "active") {
        // Check if registration is complete
        const hasRegistration = (currentUser as any).employeeNumber;
        if (!hasRegistration) {
          setLocation("/register");
        } else {
          setLocation("/dashboard");
        }
      } else if (!userStatus) {
        // No status = old user, redirect to register
        setLocation("/register");
      }
    }
  }, [currentUser, loading, userStatus, setLocation]);

  const handleRefresh = () => {
    meQuery.refetch();
  };

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
          <p className="text-slate-400 text-sm tracking-widest uppercase">جاري التحقق...</p>
        </div>
      </div>
    );
  }

  const isRejected = userStatus === "rejected";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6" dir="rtl">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Shield className="h-6 w-6 text-cyan-400" />
            </div>
          </div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400 mb-1">SBTS Professional</div>
          <div className="text-xs text-slate-600">Smart Blind Tracking System</div>
        </div>

        {/* Status Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {isRejected ? (
            /* Rejected State */
            <>
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
                <h2 className="text-xl font-black text-white mb-2">تم رفض الطلب</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  للأسف، تم رفض طلب تسجيلك في النظام. يرجى التواصل مع مسؤول النظام للاستفسار عن السبب.
                </p>
              </div>

              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-1">للتواصل مع الإدارة</div>
                    <div className="text-xs text-slate-500">
                      يرجى التواصل مع مسؤول النظام لمعرفة أسباب الرفض وإمكانية إعادة التقديم.
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Pending State */
            <>
              <div className="flex flex-col items-center text-center mb-6">
                <div className="relative w-16 h-16 mb-4">
                  <div className="absolute inset-0 rounded-full bg-amber-500/10 border border-amber-500/30 animate-pulse" />
                  <div className="relative w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                    <Clock className="h-8 w-8 text-amber-400" />
                  </div>
                </div>
                <h2 className="text-xl font-black text-white mb-2">طلبك قيد المراجعة</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  تم استلام طلب تسجيلك بنجاح وهو الآن في انتظار مراجعة وموافقة مسؤول النظام.
                </p>
              </div>

              {/* User info */}
              {currentUser && (
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-3">
                    {(currentUser as any).avatarUrl ? (
                      <img
                        src={(currentUser as any).avatarUrl}
                        alt="Avatar"
                        className="w-10 h-10 rounded-full border border-slate-600"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300 font-bold text-sm">
                        {(currentUser as any).name?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-white">{(currentUser as any).name ?? "مستخدم جديد"}</div>
                      <div className="text-xs text-slate-500">{(currentUser as any).email ?? ""}</div>
                    </div>
                    <div className="mr-auto">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-400">
                        <Clock className="h-3 w-3" />
                        قيد المراجعة
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Steps */}
              <div className="space-y-3 mb-6">
                {[
                  { done: true, label: "إنشاء الحساب وإرسال الطلب", desc: "تم بنجاح" },
                  { done: true, label: "إكمال بيانات التسجيل", desc: "تم بنجاح" },
                  { done: false, label: "مراجعة الطلب من قِبل المسؤول", desc: "قيد الانتظار" },
                  { done: false, label: "الوصول الكامل للنظام", desc: "بعد الموافقة" },
                ].map(({ done, label, desc }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      done
                        ? "bg-emerald-500/20 border border-emerald-500/40"
                        : "bg-slate-800 border border-slate-700"
                    }`}>
                      {done ? (
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-slate-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`text-xs font-medium ${done ? "text-slate-300" : "text-slate-500"}`}>{label}</div>
                    </div>
                    <div className={`text-xs ${done ? "text-emerald-400" : "text-slate-600"}`}>{desc}</div>
                  </div>
                ))}
              </div>

              {/* Info notice */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 mb-6">
                <p className="text-xs text-slate-500 text-center leading-relaxed">
                  سيتم إشعارك عند الموافقة على طلبك. يمكنك الضغط على "تحديث الحالة" للتحقق من أي تغييرات.
                </p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {!isRejected && (
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="flex-1 h-11 border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white rounded-xl"
                disabled={meQuery.isFetching}
              >
                <RefreshCw className={`h-4 w-4 ml-2 ${meQuery.isFetching ? "animate-spin" : ""}`} />
                تحديث الحالة
              </Button>
            )}
            <Button
              onClick={handleLogout}
              variant="outline"
              className={`${isRejected ? "flex-1" : ""} h-11 border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40 rounded-xl`}
            >
              <LogOut className="h-4 w-4 ml-2" />
              تسجيل الخروج
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-700">
            SBTS Professional &copy; {new Date().getFullYear()} — جميع الحقوق محفوظة
          </p>
        </div>
      </div>
    </div>
  );
}
