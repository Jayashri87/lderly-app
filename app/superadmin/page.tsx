"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { PortalLoginSwitch } from "../../components/system/PortalLoginSwitch";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { AuthService } from "../../services/authService";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Enter the super admin username and password.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/auth/superadmin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      });

      if (!response.ok) {
        setError("Check the super admin username and password.");
        return;
      }

      const payload = (await response.json()) as {
        uid?: string;
        name?: string;
      };

      AuthService.storeSignedSession({
        uid: payload.uid || "demo-superadmin",
        name: payload.name || "Super Admin",
        role: "superadmin",
        authMode: "demo"
      });
      router.replace("/ops");
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#06130f] px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,.20),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(79,70,229,.18),transparent_28%),linear-gradient(180deg,#06130f,#08110f_46%,#050706)]" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-md flex-col gap-5">
        <header>
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200">LDERLY</p>
          <h1 className="mt-1 text-3xl font-semibold">Super Admin login</h1>
          <p className="mt-2 text-sm text-white/55">
            Owner-level access for production controls, security checks, and ops governance.
          </p>
        </header>

        <PortalLoginSwitch />

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="relative overflow-hidden p-5 shadow-2xl shadow-black/25 sm:rounded-[2rem]">
            <motion.div
              aria-hidden
              animate={{ x: ["-12%", "22%", "-12%"], opacity: [0.16, 0.32, 0.16] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-16 left-8 h-40 w-40 rounded-full bg-indigo-300/40 blur-3xl"
            />
            <div className="relative">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-indigo-300/15 text-indigo-100">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight">
                Govern the care operating system.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/68">
                Use this only for high-trust operational, security, and production administration work.
              </p>
            </div>
          </Card>
        </motion.div>

        <Card className="rounded-[2rem] border-0 bg-white p-5 text-[#06130f] shadow-2xl shadow-black/20">
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2 text-slate-600">
                <UserRound className="h-4 w-4" />
                Super admin username
              </Label>
              <Input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Super admin username"
                className="mt-2 border-slate-200 bg-slate-50 text-[#06130f] placeholder:text-slate-400 focus-visible:border-emerald-400 focus-visible:ring-emerald-200"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 text-slate-600">
                <LockKeyhole className="h-4 w-4" />
                Password
              </Label>
              <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 pr-3 focus-within:border-emerald-400">
                <input
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-4 text-base outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="grid h-10 w-10 place-items-center rounded-full text-slate-500"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="warning" className="mt-4 bg-amber-50 text-amber-700">
              {error}
            </Alert>
          )}

          <Button
            onClick={login}
            disabled={busy}
            className="mt-6 w-full bg-[#06130f] px-5 py-4 text-white hover:bg-[#10241d]"
          >
            {busy ? "Signing in..." : "Open super admin ops"}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Card>
      </div>
    </main>
  );
}
