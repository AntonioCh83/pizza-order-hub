import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2 } from "lucide-react";

type T = { id: string; number: number; seats: number };
type Order = { id: string; table_id: string; opened_at: string; total: number; count: number };

export default function Tables() {
  const [tables, setTables] = useState<T[]>([]);
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: ts }, { data: os }] = await Promise.all([
      supabase.from("restaurant_tables").select("*").order("number"),
      supabase.from("orders").select("id, table_id, opened_at, order_items(quantity, price)").eq("status", "open"),
    ]);
    setTables(ts ?? []);
    const map: Record<string, Order> = {};
    (os ?? []).forEach((o: any) => {
      const items = o.order_items ?? [];
      map[o.table_id] = {
        id: o.id, table_id: o.table_id, opened_at: o.opened_at,
        total: items.reduce((s: number, i: any) => s + Number(i.price) * i.quantity, 0),
        count: items.reduce((s: number, i: any) => s + i.quantity, 0),
      };
    });
    setOrders(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("tables-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (loading) return <div className="p-12 grid place-items-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl">Tavoli</h1>
        <p className="text-muted-foreground text-sm">Tocca un tavolo per aprire o gestire la comanda</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        {tables.map(t => {
          const o = orders[t.id];
          const occupied = !!o;
          return (
            <Link key={t.id} to={`/table/${t.id}`}>
              <Card className={`p-4 sm:p-5 transition-all hover:scale-[1.02] hover:shadow-elegant cursor-pointer relative overflow-hidden ${occupied ? "border-gold border-2 bg-gradient-to-br from-card to-accent-soft/30" : ""}`}>
                {occupied && <div className="absolute top-0 right-0 h-16 w-16 bg-gold/10 rounded-bl-full" />}
                <div className="flex items-start justify-between mb-2">
                  <div className="text-3xl font-bold text-primary" style={{fontFamily:"'Playfair Display', serif"}}>{t.number}</div>
                  <Badge variant={occupied ? "default" : "secondary"} className={occupied ? "bg-gold text-gold-foreground" : ""}>
                    {occupied ? "Occupato" : "Libero"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                  <Users className="h-3 w-3" /> {t.seats} posti
                </div>
                {occupied ? (
                  <div className="border-t pt-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Articoli</span><span className="font-medium">{o.count}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Totale</span><span className="font-bold text-primary">€ {o.total.toFixed(2)}</span></div>
                  </div>
                ) : (
                  <div className="border-t pt-2 text-xs text-muted-foreground">Tocca per aprire</div>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
