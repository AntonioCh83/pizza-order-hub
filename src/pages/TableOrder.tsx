import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Minus, Send, Receipt, Trash2, Loader2, ChefHat, Pizza, Wine, Printer } from "lucide-react";
import { toast } from "sonner";

type MenuItem = { id: string; name: string; description: string | null; price: number; department: "cucina" | "pizzeria" | "bar"; available: boolean; category_id: string };
type Category = { id: string; name: string; sort_order: number; department: string };
type OrderItem = { id: string; menu_item_id: string; name: string; price: number; quantity: number; notes: string | null; department: string; status: string };

const deptIcon = (d: string) => d === "pizzeria" ? Pizza : d === "bar" ? Wine : ChefHat;

export default function TableOrder() {
  const { tableId } = useParams();
  const nav = useNavigate();
  const [table, setTable] = useState<any>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [covers, setCovers] = useState<number>(0);
  const [showCovers, setShowCovers] = useState(false);
  const [coversDraft, setCoversDraft] = useState<string>("");
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [noteFor, setNoteFor] = useState<OrderItem | null>(null);
  const [noteText, setNoteText] = useState("");
  const [showBill, setShowBill] = useState(false);

  const loadOrder = async (oid: string) => {
    const { data } = await supabase.from("order_items").select("*").eq("order_id", oid).order("created_at");
    setOrderItems((data ?? []) as OrderItem[]);
  };

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: c }, { data: m }] = await Promise.all([
        supabase.from("restaurant_tables").select("*").eq("id", tableId!).maybeSingle(),
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("menu_items").select("*").eq("available", true).order("name"),
      ]);
      setTable(t);
      setCats(c ?? []);
      setItems((m ?? []) as MenuItem[]);
      if (c?.[0]) setActiveCat(c[0].id);

      let { data: existing } = await supabase.from("orders").select("id, covers").eq("table_id", tableId!).eq("status", "open").maybeSingle();
      if (!existing) {
        const { data: u } = await supabase.auth.getUser();
        const { data: created } = await supabase.from("orders").insert({ table_id: tableId!, opened_by: u.user?.id }).select("id, covers").single();
        existing = created;
      }
      if (existing) {
        setOrderId(existing.id);
        setCovers(existing.covers ?? 0);
        if (!existing.covers) {
          setCoversDraft(String(t?.seats ?? ""));
          setShowCovers(true);
        }
        await loadOrder(existing.id);
      }
      setLoading(false);
    })();
  }, [tableId]);

  const saveCovers = async () => {
    const n = parseInt(coversDraft);
    if (!n || n < 1) { toast.error("Inserisci un numero valido"); return; }
    if (!orderId) return;
    const { error } = await supabase.from("orders").update({ covers: n }).eq("id", orderId);
    if (error) return toast.error(error.message);
    setCovers(n);
    setShowCovers(false);
  };

  useEffect(() => {
    if (!orderId) return;
    const ch = supabase.channel(`order-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `order_id=eq.${orderId}` }, () => loadOrder(orderId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  const addItem = async (mi: MenuItem) => {
    if (!orderId) return;
    const existing = orderItems.find(oi => oi.menu_item_id === mi.id && oi.status === "pending");
    if (existing) {
      await supabase.from("order_items").update({ quantity: existing.quantity + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("order_items").insert({
        order_id: orderId, menu_item_id: mi.id, name: mi.name, price: mi.price, quantity: 1, department: mi.department,
      });
    }
  };

  const changeQty = async (oi: OrderItem, delta: number) => {
    const q = oi.quantity + delta;
    if (q <= 0) {
      setOrderItems(prev => prev.filter(p => p.id !== oi.id));
      const { error } = await supabase.from("order_items").delete().eq("id", oi.id);
      if (error) { toast.error(error.message); if (orderId) await loadOrder(orderId); }
    } else {
      setOrderItems(prev => prev.map(p => p.id === oi.id ? { ...p, quantity: q } : p));
      const { error } = await supabase.from("order_items").update({ quantity: q }).eq("id", oi.id);
      if (error) { toast.error(error.message); if (orderId) await loadOrder(orderId); }
    }
  };

  const sendToKitchen = async () => {
    const pending = orderItems.filter(oi => oi.status === "pending");
    if (!pending.length) { toast.info("Nessuna nuova voce da inviare"); return; }
    const { error } = await supabase.from("order_items").update({ status: "sent", sent_at: new Date().toISOString() }).in("id", pending.map(p => p.id));
    if (error) toast.error(error.message); else {
      const counts = pending.reduce((acc: any, p) => { acc[p.department] = (acc[p.department] ?? 0) + p.quantity; return acc; }, {});
      toast.success(`Inviato: ${Object.entries(counts).map(([d, n]) => `${n}× ${d}`).join(" · ")}`);
    }
  };

  const closeTable = async () => {
    if (!orderId) return;
    await supabase.from("orders").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", orderId);
    toast.success("Tavolo chiuso");
    nav("/");
  };

  const saveNote = async () => {
    if (!noteFor) return;
    await supabase.from("order_items").update({ notes: noteText }).eq("id", noteFor.id);
    setNoteFor(null); setNoteText("");
  };

  const total = useMemo(() => orderItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0), [orderItems]);

  const printReceipt = () => {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) { toast.error("Abilita i popup per stampare"); return; }
    const now = new Date().toLocaleString("it-IT");
    const rows = orderItems.map(oi => `
      <tr>
        <td style="padding:2px 4px">${oi.quantity}×</td>
        <td style="padding:2px 4px;width:100%">${oi.name}${oi.notes ? `<div style="font-style:italic;font-size:10px;color:#555">${oi.notes}</div>` : ""}</td>
        <td style="padding:2px 4px;text-align:right;white-space:nowrap">€ ${(Number(oi.price) * oi.quantity).toFixed(2)}</td>
      </tr>`).join("");
    const perCover = covers > 0 ? (total / covers) : 0;
    w.document.write(`<!doctype html><html><head><title>Scontrino T${table?.number}</title>
      <style>
        @page{size:80mm auto;margin:4mm}
        body{font-family:'Courier New',monospace;font-size:12px;color:#000;margin:0;padding:8px}
        h1{font-size:16px;margin:0 0 4px;text-align:center}
        .meta{text-align:center;font-size:11px;margin-bottom:8px}
        .div{border-top:1px dashed #000;margin:6px 0}
        table{width:100%;border-collapse:collapse}
        .tot{display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-top:6px}
        .sub{display:flex;justify-content:space-between;font-size:11px;color:#333}
        .foot{text-align:center;font-size:10px;margin-top:10px;font-style:italic}
      </style></head><body>
      <h1>SCONTRINO NON FISCALE</h1>
      <div class="meta">
        Tavolo <strong>${table?.number}</strong>${table?.name ? ` · ${table.name}` : ""}<br/>
        Coperti: <strong>${covers || "—"}</strong><br/>
        ${now}
      </div>
      <div class="div"></div>
      <table>${rows}</table>
      <div class="div"></div>
      ${covers > 0 ? `<div class="sub"><span>Per coperto (${covers})</span><span>€ ${perCover.toFixed(2)}</span></div>` : ""}
      <div class="tot"><span>TOTALE</span><span>€ ${total.toFixed(2)}</span></div>
      <div class="foot">Documento non valido ai fini fiscali</div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
      </body></html>`);
    w.document.close();
  };

  const pendingCount = orderItems.filter(i => i.status === "pending").reduce((s, i) => s + i.quantity, 0);
  const filtered = items.filter(i => i.category_id === activeCat);

  if (loading) return <div className="p-12 grid place-items-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-3.5rem)]">
      <div className="flex-1 min-w-0 p-3 sm:p-5">
        <div className="flex items-center gap-3 mb-4">
          <Button asChild variant="ghost" size="icon"><Link to="/"><ArrowLeft /></Link></Button>
          <div className="flex-1">
            <h1 className="text-2xl">Tavolo {table?.number}</h1>
            <p className="text-xs text-muted-foreground">{table?.seats} posti · Coperti: <button onClick={() => { setCoversDraft(String(covers || table?.seats || "")); setShowCovers(true); }} className="underline font-semibold text-foreground">{covers || "—"}</button></p>
          </div>
        </div>

        <Tabs value={activeCat} onValueChange={setActiveCat}>
          <TabsList className="flex flex-wrap h-auto justify-start bg-muted/50 p-1">
            {cats.map(c => (
              <TabsTrigger key={c.id} value={c.id} className="data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground">
                {c.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {cats.map(c => (
            <TabsContent key={c.id} value={c.id} className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map(mi => {
                  const Icon = deptIcon(mi.department);
                  return (
                    <Card key={mi.id} className="p-3 hover:shadow-elegant cursor-pointer transition-all hover:border-gold/50" onClick={() => addItem(mi)}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{mi.name}</div>
                          {mi.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mi.description}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-primary">€ {Number(mi.price).toFixed(2)}</div>
                          <Plus className="h-4 w-4 text-gold ml-auto mt-1" />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <aside className="lg:w-96 border-t lg:border-t-0 lg:border-l bg-card flex flex-col max-h-[60vh] lg:max-h-none lg:sticky lg:top-14 lg:self-start lg:h-[calc(100vh-3.5rem)]">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg" style={{fontFamily:"'Playfair Display', serif"}}>Comanda</h2>
            {pendingCount > 0 && <Badge className="bg-warning text-white">{pendingCount} nuovi</Badge>}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {orderItems.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nessuna voce. Tocca un piatto per aggiungere.</p>}
          {orderItems.map(oi => {
            const Icon = deptIcon(oi.department);
            const isPending = oi.status === "pending";
            return (
              <div key={oi.id} className={`p-2.5 rounded-lg border ${isPending ? "border-warning/40 bg-warning/5" : "bg-muted/30"}`}>
                <div className="flex justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm truncate">{oi.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">€ {Number(oi.price).toFixed(2)} · <button onClick={() => { setNoteFor(oi); setNoteText(oi.notes ?? ""); }} className="underline hover:text-foreground">{oi.notes ? oi.notes : "+ nota"}</button></div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isPending ? (
                      <>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(oi, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-6 text-center font-semibold">{oi.quantity}</span>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(oi, 1)}><Plus className="h-3 w-3" /></Button>
                      </>
                    ) : (
                      <span className="text-sm"><Badge variant="outline" className="text-xs">×{oi.quantity}</Badge></span>
                    )}
                  </div>
                </div>
                {!isPending && (
                  <Badge className={`mt-1 text-[10px] h-4 border ${oi.status === "ready" ? "bg-success/15 text-success border-success/40" : oi.status === "preparing" ? "bg-warning/15 text-warning border-warning/40" : oi.status === "served" ? "bg-muted text-muted-foreground border-border" : "bg-primary/10 text-primary border-primary/30"}`}>
                    {oi.status === "ready" ? "Pronta" : oi.status === "preparing" ? "In preparazione" : oi.status === "served" ? "Servita" : "Inviata"}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
        <div className="border-t p-3 space-y-2 bg-gradient-to-b from-card to-muted/20">
          <div className="flex justify-between text-lg">
            <span>Totale</span>
            <span className="font-bold text-primary" style={{fontFamily:"'Playfair Display', serif"}}>€ {total.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={sendToKitchen} disabled={pendingCount === 0} className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-elegant">
              <Send className="h-4 w-4 mr-1" /> Invia
            </Button>
            <Button variant="outline" onClick={() => setShowBill(true)} disabled={orderItems.length === 0}>
              <Receipt className="h-4 w-4 mr-1" /> Conto
            </Button>
          </div>
        </div>
      </aside>

      <Dialog open={!!noteFor} onOpenChange={(o) => !o && setNoteFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nota per {noteFor?.name}</DialogTitle></DialogHeader>
          <Input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="es. senza glutine, ben cotta..." maxLength={200} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteFor(null)}>Annulla</Button>
            <Button onClick={saveNote} className="bg-gradient-primary text-primary-foreground">Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBill} onOpenChange={setShowBill}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle style={{fontFamily:"'Playfair Display', serif"}}>Conto · Tavolo {table?.number}</DialogTitle></DialogHeader>
          <div className="space-y-1 max-h-[50vh] overflow-auto">
            {orderItems.map(oi => (
              <div key={oi.id} className="flex justify-between text-sm py-1 border-b border-dashed">
                <span>{oi.quantity}× {oi.name}</span>
                <span className="font-medium">€ {(Number(oi.price) * oi.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xl pt-2 border-t-2 border-primary">
            <span className="font-semibold">Totale</span>
            <span className="font-bold text-primary">€ {total.toFixed(2)}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBill(false)}>Chiudi</Button>
            <Button onClick={() => { closeTable(); setShowBill(false); }} variant="destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Chiudi tavolo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCovers} onOpenChange={(o) => { if (!o && !covers) return; setShowCovers(o); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Coperti · Tavolo {table?.number}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Indica il numero di commensali per questo tavolo.</p>
          <Input type="number" min={1} value={coversDraft} onChange={e => setCoversDraft(e.target.value)} autoFocus />
          <DialogFooter>
            {covers > 0 && <Button variant="outline" onClick={() => setShowCovers(false)}>Annulla</Button>}
            <Button onClick={saveCovers} className="bg-gradient-primary text-primary-foreground">Conferma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
