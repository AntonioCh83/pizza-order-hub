# Order Hub

Order Hub è un’app per la gestione di tavoli e comande in un ristorante.

## Cosa fa

- visualizza l’elenco dei tavoli e lo stato di occupazione
- apre e gestisce le comande per ogni tavolo
- aggiunge e rimuove tavoli
- invia portate alle diverse aree di preparazione (`cucina`, `pizzeria`, `bar`)
- mostra uno schermo KDS per vedere le comande attive per reparto
- aggiorna lo stato delle portate da `inviata` a `in preparazione` a `pronta`
- stampa scontrini non fiscali e comande per reparto
- impedisce di liberare un tavolo quando non ci sono le condizioni corrette

## Tecnologie

- React + TypeScript
- Vite
- Tailwind CSS
- Supabase (database e autenticazione)
- React Router
- React Query
- Radix UI
- Sonner per le notifiche

## Avvio locale

1. Copia il file `.env` in radice e imposta le variabili Supabase:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PROJECT_ID`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

2. Installa le dipendenze:
   - `npm install`

3. Avvia l’app in sviluppo:
   - `npm run dev`

4. Apri il browser su:
   - `http://localhost:8080`

## Note

- È necessario avere un progetto Supabase configurato con le tabelle `restaurant_tables`, `orders` e `order_items`.
- Le modifiche vengono aggiornate in tempo reale usando i canali realtime di Supabase.
