import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Dept = "cucina" | "pizzeria" | "bar";

export default function MenuPage() {
  const [cats, setCats] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    price: "",
    description: "",
    category_id: "",
    department: "cucina" as Dept,
    newCategory: "",
  });

  const load = async () => {
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("menu_items").select("*").order("name"),
    ]);
    setCats(c ?? []); setItems(m ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (id: string, available: boolean) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, available } : i));
    const { error } = await supabase.from("menu_items").update({ available }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(available ? "Disponibile" : "Esaurito");
  };

  const removeItem = async (id: string) => {
    if (!confirm("Eliminare questa voce dal menu?")) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Voce eliminata");
  };

  const resetForm = () => setForm({ name: "", price: "", description: "", category_id: "", department: "cucina", newCategory: "" });

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Nome obbligatorio");
    const price = parseFloat(form.price.replace(",", "."));
    if (isNaN(price) || price < 0) return toast.error("Prezzo non valido");

    setSaving(true);
    try {
      let categoryId = form.category_id;
      let department = form.department;

      if (categoryId === "__new__") {
        if (!form.newCategory.trim()) { toast.error("Nome categoria obbligatorio"); setSaving(false); return; }
        const { data: newCat, error: catErr } = await supabase
          .from("categories")
          .insert({ name: form.newCategory.trim(), department, sort_order: cats.length })
          .select().single();
        if (catErr) throw catErr;
        categoryId = newCat.id;
      } else if (!categoryId) {
        toast.error("Seleziona una categoria"); setSaving(false); return;
      } else {
        const cat = cats.find(c => c.id === categoryId);
        if (cat) department = cat.department;
      }

      const { error } = await supabase.from("menu_items").insert({
        name: form.name.trim(),
        price,
        description: form.description.trim() || null,
        category_id: categoryId,
        department,
        available: true,
      });
      if (error) throw error;

      toast.success("Voce aggiunta al menu");
      setOpen(false);
      resetForm();
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Errore");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 grid place-items-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl">Menu</h1>
          <p className="text-sm text-muted-foreground">Gestisci disponibilità e aggiungi nuove voci</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Aggiungi voce</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuova portata o pizza</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Es. Margherita" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Prezzo (€)</Label>
                  <Input type="number" step="0.50" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="8.00" />
                </div>
                <div className="space-y-2">
                  <Label>Reparto</Label>
                  <Select value={form.department} onValueChange={(v: Dept) => setForm({ ...form, department: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cucina">Cucina</SelectItem>
                      <SelectItem value="pizzeria">Pizzeria</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
                  <SelectContent>
                    {cats.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.department})</SelectItem>
                    ))}
                    <SelectItem value="__new__">+ Nuova categoria…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.category_id === "__new__" && (
                <div className="space-y-2">
                  <Label>Nome nuova categoria</Label>
                  <Input value={form.newCategory} onChange={e => setForm({ ...form, newCategory: e.target.value })} placeholder="Es. Pizze speciali" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Descrizione (opzionale)</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Pomodoro, mozzarella, basilico" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annulla</Button>
              <Button onClick={submit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salva
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {cats.map(c => (
          <div key={c.id}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-xl">{c.name}</h2>
              <Badge variant="outline" className="capitalize">{c.department}</Badge>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {items.filter(i => i.category_id === c.id).map(i => (
                <Card key={i.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`font-medium ${!i.available ? "line-through text-muted-foreground" : ""}`}>{i.name}</div>
                    <div className="text-xs text-muted-foreground">€ {Number(i.price).toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={i.available} onCheckedChange={(v) => toggle(i.id, v)} />
                    <Button size="icon" variant="ghost" onClick={() => removeItem(i.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
