import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChefHat, Pizza, Wine, Check, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

const meta: Record<string, { title: string; icon: any }> = {
  cucina: { title: "Cucina", icon: ChefHat },
  pizzeria: { title: "Pizzeria", icon: Pizza },
  bar: { title: "Bar", icon: Wine },
};

type Item = {
  id: string; name: string; quantity: number; notes: string | null; status: string; sent_at: string | null;
  order: { id: string; table: { number: number } } | null;
};

export default function KDS() {
  const { dept } = useParams<{ dept: "cucina" | "pizzeria" | "bar" }>();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const M = meta[dept ?? "cucina"];

  const load = async () => {
    const { data } = await supabase
      .from("order_items")
      .select("id, name, quantity, notes, status, sent_at, orders!inner(id, status, restaurant_tables(number))")
      .eq("department", dept!)
      .in("status", ["sent", "preparing", "ready"])
      .order("sent_at", { ascending: true });
    setItems((data ?? []).map((d: any) => ({
      ...d,
      order: { id: d.orders.id, table: d.orders.restaurant_tables },
    })).filter((d: any) => d.order));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`kds-${dept}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dept]);

  const advance = async (it: Item) => {
    const next = it.status === "sent" ? "preparing" : it.status === "preparing" ? "ready" : "served";
    await supabase.from("order_items").update({ status: next }).eq("id", it.id);
  };

  if (loading) return <div className="p-12 grid place-items-center"><Loader2 className="animate-spin" /></div>;

  // group by table
  const groups = items.reduce<Record<string, Item[]>>((acc, it) => {
    const k = String(it.order?.table.number ?? "?");
    (acc[k] ||= []).push(it);
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-xl bg-gradient-primary grid place-items-center shadow-elegant">
          <M.icon className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl">{M.title}</h1>
          <p className="text-sm text-muted-foreground">{items.length} voci attive</p>
        </div>
      </div>

      <Card className="p-3 sm:p-4 mb-4 bg-muted/30 border-dashed">
        <div className="text-sm font-semibold mb-2">Come gestire le comande</div>
        <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5">
          <li className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded border-2 border-border bg-muted/40 shrink-0" />
            <span><b>Inviata</b> — tocca <Check className="inline h-3.5 w-3.5 mx-0.5" /> per metterla <b>In preparazione</b>.</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded border-2 border-warning bg-warning/10 shrink-0" />
            <span><b>In preparazione</b> — tocca <Check className="inline h-3.5 w-3.5 mx-0.5" /> per segnarla <b>Pronta</b>.</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded border-2 border-success bg-success/10 shrink-0" />
            <span><b>Pronta</b> — tocca <Check className="inline h-3.5 w-3.5 mx-0.5" /> (verde) per <b>Servita</b>: scompare dalla schermata.</span>
          </li>
        </ul>
      </Card>

      {Object.keys(groups).length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">Nessuna comanda in arrivo</Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(groups).map(([tn, its]) => (
          <Card key={tn} className="overflow-hidden border-2">
            <div className="bg-gradient-primary text-primary-foreground px-4 py-2 flex justify-between items-center">
              <span className="font-bold text-lg" style={{fontFamily:"'Playfair Display', serif"}}>Tavolo {tn}</span>
              {its[0].sent_at && <span className="text-xs opacity-80">{formatDistanceToNow(new Date(its[0].sent_at), { locale: it, addSuffix: true })}</span>}
            </div>
            <div className="p-3 space-y-2">
              {its.map(i => (
                <div key={i.id} className={`p-3 rounded-lg border-2 ${i.status === "ready" ? "border-success bg-success/5" : i.status === "preparing" ? "border-warning bg-warning/5" : "border-border bg-muted/20"}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2">
                        <span className="text-2xl text-gold">{i.quantity}×</span> {i.name}
                      </div>
                      {i.notes && <div className="text-xs italic text-warning mt-1">📝 {i.notes}</div>}
                      <Badge variant="outline" className="mt-1 text-[10px]">{i.status}</Badge>
                    </div>
                    <Button size="sm" onClick={() => advance(i)} className={i.status === "ready" ? "bg-success hover:bg-success/90 text-white" : "bg-gradient-gold text-gold-foreground"}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
