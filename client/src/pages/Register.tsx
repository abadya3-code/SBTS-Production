/*
  SBTS Registration Page — Standalone Email/Password Self-Registration
  New users can request an account. Admin must approve before access is granted.
*/
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  User,
  Briefcase,
  Hash,
  FileText,
  Loader2,
  CheckCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

const DEPARTMENTS = [
  "Maintenance & Operations",
  "Mechanical Engineering",
  "Chemical Engineering",
  "Electrical Engineering",
  "Quality Assurance & Inspection",
  "Occupational Health & Safety",
  "Planning & Scheduling",
  "Procurement & Contracts",
  "Information Technology",
  "Administration & Human Resources",
  "Other",
];

const SPECIALTIES = [
  "Turnaround & Inspection Engineer",
  "Metal Foreman",
  "Installation Technician",
  "QC Inspector",
  "Safety Officer",
  "Project Coordinator",
  "Senior Engineer",
  "Operations Supervisor",
  "Project Manager",
  "Other",
];

export default function Register() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    department: "",
    specialty: "",
    employeeNumber: "",
    registrationNote: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: err => {
      setErrorMsg(err.message);
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      newErrors.name = "Name must contain at least two characters";
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Enter a valid email address";
    }
    if (!form.password || form.password.length < 8) {
      newErrors.password = "Password must contain at least eight characters";
    }
    if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    if (!form.department) newErrors.department = "Select a department";
    if (!form.specialty) newErrors.specialty = "Select a specialty";
    if (!form.employeeNumber.trim() || form.employeeNumber.trim().length < 3) {
      newErrors.employeeNumber =
        "Employee number must contain at least three characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!validate()) return;
    registerMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      department: form.department,
      specialty: form.specialty,
      employeeNumber: form.employeeNumber.trim(),
      registrationNote: form.registrationNote.trim() || undefined,
    });
  };

  if (submitted) {
    return (
      <div
        className="min-h-screen bg-slate-950 flex items-center justify-center p-6"
        dir="ltr"
      >
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">
            Registration request submitted
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Your request has been received and is awaiting System Administrator
            review. You can sign in after your account is approved.
          </p>
          <Button
            onClick={() => setLocation("/login")}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-8"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex overflow-hidden" dir="ltr">
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

      {/* Left info panel */}
      <div className="hidden lg:flex lg:w-2/5 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex-col justify-between p-12">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-60" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Shield className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">
                SBTS
              </div>
              <div className="text-xs text-slate-500">
                Smart Blind Tracking System
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-black text-white leading-tight mb-4">
            Request
            <br />
            <span className="text-cyan-400">an account</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Create an account request for System Administrator review and role
            assignment.
          </p>
        </div>

        {/* Steps */}
        <div className="relative z-10 space-y-4">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">
            Registration process
          </div>
          {[
            { num: "01", label: "Create and submit the request", active: true },
            { num: "02", label: "Administrator review", done: false },
            { num: "03", label: "Sign in with approved access", done: false },
          ].map(({ num, label, active, done }) => (
            <div key={num} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
                  done
                    ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                    : active
                      ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-400"
                      : "bg-slate-800 border border-slate-700 text-slate-600"
                }`}
              >
                {done ? <CheckCircle className="h-4 w-4" /> : num}
              </div>
              <span
                className={`text-sm font-medium ${
                  done
                    ? "text-emerald-400"
                    : active
                      ? "text-white"
                      : "text-slate-600"
                }`}
              >
                {label}
              </span>
              {active && (
                <div className="ml-auto">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="relative z-10">
          <div className="text-xs text-slate-600">SBTS Professional v1.0</div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 relative z-10 overflow-y-auto">
        <div className="w-full max-w-lg py-8">
          {/* Mobile header */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center mx-auto mb-3">
              <Shield className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">
              SBTS Professional
            </div>
          </div>

          {/* Form card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-5 bg-cyan-400 rounded-full" />
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">
                  Registration details
                </span>
              </div>
              <h2 className="text-xl font-black text-white">
                Create an account request
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Fields marked with * are required
              </p>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-300">{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-cyan-400" />
                  Full name *
                </Label>
                <Input
                  value={form.name}
                  onChange={e => {
                    setForm(f => ({ ...f, name: e.target.value }));
                    if (errors.name) setErrors(er => ({ ...er, name: "" }));
                  }}
                  placeholder="Full name"
                  className={`bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-11 rounded-xl ${errors.name ? "border-red-500" : ""}`}
                />
                {errors.name && (
                  <p className="text-xs text-red-400">{errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-cyan-400" />
                  Email address *
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => {
                    setForm(f => ({ ...f, email: e.target.value }));
                    if (errors.email) setErrors(er => ({ ...er, email: "" }));
                  }}
                  placeholder="example@company.com"
                  dir="ltr"
                  className={`bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-11 rounded-xl ${errors.email ? "border-red-500" : ""}`}
                />
                {errors.email && (
                  <p className="text-xs text-red-400">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-cyan-400" />
                    Password *
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={e => {
                        setForm(f => ({ ...f, password: e.target.value }));
                        if (errors.password)
                          setErrors(er => ({ ...er, password: "" }));
                      }}
                      placeholder="At least 8 characters"
                      dir="ltr"
                      className={`bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-11 rounded-xl pr-10 ${errors.password ? "border-red-500" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-400">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">
                    Confirm password *
                  </Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={e => {
                        setForm(f => ({
                          ...f,
                          confirmPassword: e.target.value,
                        }));
                        if (errors.confirmPassword)
                          setErrors(er => ({ ...er, confirmPassword: "" }));
                      }}
                      placeholder="Re-enter your password"
                      dir="ltr"
                      className={`bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-11 rounded-xl pr-10 ${errors.confirmPassword ? "border-red-500" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-400">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-cyan-400" />
                  Department *
                </Label>
                <Select
                  value={form.department}
                  onValueChange={v => {
                    setForm(f => ({ ...f, department: v }));
                    if (errors.department)
                      setErrors(e => ({ ...e, department: "" }));
                  }}
                >
                  <SelectTrigger
                    className={`bg-slate-800 border-slate-700 text-white h-11 rounded-xl ${errors.department ? "border-red-500" : ""}`}
                  >
                    <SelectValue placeholder="Select a department..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {DEPARTMENTS.map(d => (
                      <SelectItem
                        key={d}
                        value={d}
                        className="text-slate-200 focus:bg-slate-700 focus:text-white"
                      >
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.department && (
                  <p className="text-xs text-red-400">{errors.department}</p>
                )}
              </div>

              {/* Specialty */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-cyan-400" />
                  Specialty / Job role *
                </Label>
                <Select
                  value={form.specialty}
                  onValueChange={v => {
                    setForm(f => ({ ...f, specialty: v }));
                    if (errors.specialty)
                      setErrors(e => ({ ...e, specialty: "" }));
                  }}
                >
                  <SelectTrigger
                    className={`bg-slate-800 border-slate-700 text-white h-11 rounded-xl ${errors.specialty ? "border-red-500" : ""}`}
                  >
                    <SelectValue placeholder="Select a specialty..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {SPECIALTIES.map(s => (
                      <SelectItem
                        key={s}
                        value={s}
                        className="text-slate-200 focus:bg-slate-700 focus:text-white"
                      >
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.specialty && (
                  <p className="text-xs text-red-400">{errors.specialty}</p>
                )}
              </div>

              {/* Employee Number */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-cyan-400" />
                  Employee / Badge number *
                </Label>
                <Input
                  value={form.employeeNumber}
                  onChange={e => {
                    setForm(f => ({ ...f, employeeNumber: e.target.value }));
                    if (errors.employeeNumber)
                      setErrors(er => ({ ...er, employeeNumber: "" }));
                  }}
                  placeholder="Example: EMP-12345"
                  className={`bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-11 rounded-xl ${errors.employeeNumber ? "border-red-500" : ""}`}
                  dir="ltr"
                />
                {errors.employeeNumber && (
                  <p className="text-xs text-red-400">
                    {errors.employeeNumber}
                  </p>
                )}
              </div>

              {/* Registration Note */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  Additional notes (optional)
                </Label>
                <Textarea
                  value={form.registrationNote}
                  onChange={e =>
                    setForm(f => ({ ...f, registrationNote: e.target.value }))
                  }
                  placeholder="Add any information the System Administrator should review..."
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 rounded-xl resize-none"
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                disabled={registerMutation.isPending}
                className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm tracking-wide rounded-xl transition-all duration-200 shadow-lg shadow-cyan-500/20 hover:-translate-y-0.5 disabled:opacity-50"
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting request...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Submit registration request
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Back to login */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setLocation("/login")}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
