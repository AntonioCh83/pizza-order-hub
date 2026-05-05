import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MenuPage() {
  const [cats, setCats] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="p-12 grid place-items-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl">Menu</h1>
        <p className="text-sm text-muted-foreground">Gestisci disponibilità delle voci</p>
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
                  <Switch checked={i.available} onCheckedChange={(v) => toggle(i.id, v)} />
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
