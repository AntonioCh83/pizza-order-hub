import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Pizza, Loader2 } from "lucide-react";

export default function Auth() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin" /></div>;
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account creato! Controlla l'email per confermare.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Errore");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-hero">
      <Card className="w-full max-w-md p-8 shadow-elegant">
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-gradient-gold grid place-items-center shadow-gold mb-3">
            <Pizza className="h-7 w-7 text-gold-foreground" />
          </div>
          <h1 className="text-2xl">Comande Pro</h1>
          <p className="text-sm text-muted-foreground">Accesso staff pizzeria · ristorante</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Accedi" : "Registrati"}
          </Button>
        </form>
        <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground">
          {mode === "login" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
        </button>
      </Card>
    </div>
  );
}
