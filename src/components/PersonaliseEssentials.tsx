import { useState } from "react";
import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DEFAULT_HOME_PREFERENCES, moveHomeItem, type HomePreferences } from "@/lib/essentialsPreferences";

export const HOME_TOOL_LABELS: Record<string, string> = {
  diagnose: "Fix a problem", mechanic: "Find a mechanic", fuel: "Cheapest fuel",
  chargers: "EV chargers", sell: "Sell", ask: "Ask for help",
};
export const HOME_SECTION_LABELS: Record<string, string> = {
  cars: "My cars", community: "Lendawatt", tools: "Quick buttons", buy: "Buy", "your-car": "Your car",
  shops: "Shops", deals: "Deals", listings: "Latest for sale",
};

export function PersonaliseEssentials({ preferences, onSave }: {
  preferences: HomePreferences; onSave: (value: HomePreferences) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(preferences);
  function rows(kind: "tools" | "sections", hiddenKey: "hiddenTools" | "hiddenSections", labels: Record<string, string>) {
    return draft[kind].map((id, index) => (
      <div key={id} className="flex items-center gap-2 border-b border-border py-2 last:border-0">
        <Switch id={`home-${id}`} checked={!draft[hiddenKey].includes(id)}
          onCheckedChange={checked => setDraft(current => ({ ...current,
            [hiddenKey]: checked ? current[hiddenKey].filter(item => item !== id) : [...current[hiddenKey], id],
          }))} />
        <label htmlFor={`home-${id}`} className="min-w-0 flex-1 text-sm font-medium">{labels[id]}</label>
        <Button variant="ghost" size="icon" disabled={index === 0} aria-label={`Move ${labels[id]} up`} title={`Move ${labels[id]} up`}
          onClick={() => setDraft(current => ({ ...current, [kind]: moveHomeItem(current[kind], id, -1) }))}>
          <ArrowUp className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" disabled={index === draft[kind].length - 1} aria-label={`Move ${labels[id]} down`} title={`Move ${labels[id]} down`}
          onClick={() => setDraft(current => ({ ...current, [kind]: moveHomeItem(current[kind], id, 1) }))}>
          <ArrowDown className="size-4" />
        </Button>
      </div>
    ));
  }
  return <>
    <Button variant="outline" size="sm" onClick={() => { setDraft(preferences); setOpen(true); }}>
      <SlidersHorizontal className="size-4" /> Personalise your home
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Personalise your home</DialogTitle>
          <DialogDescription>Your Essentials choices are saved on this device.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto pr-1">
          <h3 className="text-sm font-semibold">Quick buttons</h3>
          {rows("tools", "hiddenTools", HOME_TOOL_LABELS)}
          <h3 className="mt-6 text-sm font-semibold">Home sections</h3>
          {rows("sections", "hiddenSections", HOME_SECTION_LABELS)}
        </div>
        <div className="flex justify-between gap-2 border-t border-border pt-3">
          <Button variant="ghost" onClick={() => setDraft(DEFAULT_HOME_PREFERENCES)}>Reset</Button>
          <Button onClick={() => { onSave(draft); setOpen(false); }}>Save choices</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}