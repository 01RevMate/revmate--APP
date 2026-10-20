import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Camera, Loader2, Plus, Store } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BUSINESS_SECTORS, createMyBusiness, fetchMyBusinesses } from "@/lib/businesses";
import { uploadImage, validateImageFile } from "@/lib/uploads";

export const Route = createFileRoute("/businesses/manage")({
  head: () => ({ meta: [
    { title: "My business — RevMate" },
    { name: "description", content: "Add and manage your car business, contact details, photos and reviews on RevMate." },
    { property: "og:title", content: "My business — RevMate" },
    { property: "og:description", content: "Manage your business profile with your normal RevMate account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: MyBusinessPage,
});

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function MyBusinessPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: mine = [], isPending, error, refetch } = useQuery({
    queryKey: ["my-businesses", user?.id],
    queryFn: () => user ? fetchMyBusinesses(user.id) : Promise.resolve([]),
    enabled: !!user,
  });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fields, setFields] = useState({ name: "", category: "garage", description: "", town: "", contact_name: "", email: "", phone: "" });

  async function upload(file: File | undefined) {
    if (!file || !user) return;
    const problem = validateImageFile(file);
    if (problem) return void toast.error(problem);
    setUploading(true);
    try { setLogo(await uploadImage("user-media", user.id, file)); toast.success("Logo uploaded"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't upload logo"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const id = await createMyBusiness({ name: fields.name.trim(), category: fields.category, description: fields.description.trim(), town: fields.town.trim() || null, contact_name: fields.contact_name.trim() || null, email: fields.email.trim() || null, phone: fields.phone.trim() || null, logo_url: logo });
      toast.success("Business added — you can now manage its profile");
      await navigate({ to: "/businesses/$businessId", params: { businessId: id }, search: { manage: true } });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't add your business"); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="mx-auto max-w-2xl px-4 py-6">Loading…</main>;
  if (!user) return <main className="mx-auto max-w-xl px-4 py-6">
    <h1 className="text-2xl font-bold">Your business on RevMate</h1>
    <p className="mt-3 text-sm text-muted-foreground">Use your normal RevMate account to add your business.</p>
    <div className="mt-4 flex gap-2"><Button asChild><Link to="/login" search={{ redirect: "/businesses/manage" }}>Log in</Link></Button><Button asChild variant="outline"><Link to="/signup" search={{ redirect: "/businesses/manage" }}>Create account</Link></Button></div>
  </main>;

  const showForm = adding || (!isPending && !error && mine.length === 0);
  return <main className="mx-auto max-w-2xl px-4 py-6">
    <Link to="/businesses" className="text-sm text-muted-foreground">← All businesses</Link>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><h1 className="flex items-center gap-2 text-2xl font-bold"><Store className="size-6 text-primary" /> My business</h1>{mine.length > 0 && !showForm && <Button onClick={() => setAdding(true)}><Plus /> Add business</Button>}</div>
    {isPending && <p className="mt-4 text-muted-foreground">Loading your businesses…</p>}
    {error && <div role="alert" className="mt-4"><p>Couldn't load your businesses.</p><Button variant="outline" onClick={() => void refetch()}>Try again</Button></div>}
    <ul className="mt-4 divide-y divide-border">{mine.map(b => <li key={b.id} className="flex items-center gap-3 py-4">
      {b.logo_url ? <img src={b.logo_url} alt={`${b.name} logo`} className="size-12 rounded-md object-contain" /> : <Store className="size-10 text-muted-foreground" />}
      <div className="min-w-0 flex-1"><p className="break-words font-semibold">{b.name}</p><p className="text-xs text-muted-foreground">{b.status === "active" ? "Live" : "Suspended"} · {b.verified ? "Verified" : "Not verified"}</p></div>
      <Button asChild variant="outline"><Link to="/businesses/$businessId" params={{ businessId: b.id }} search={{ manage: true }}>Manage</Link></Button>
    </li>)}</ul>
    {showForm && <form onSubmit={submit} className="mt-5 space-y-4 border-t border-border pt-5">
      <h2 className="text-lg font-semibold">Add your business</h2>
      <div className="flex items-center gap-3">{logo && <img src={logo} alt="Business logo preview" className="size-16 rounded-md border border-border object-contain" />}<Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <Loader2 className="animate-spin" /> : <Camera />}{uploading ? "Uploading…" : "Add logo"}</Button><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Business logo" className="hidden" onChange={e => void upload(e.target.files?.[0])} /></div>
      <label className="block text-sm font-medium">Business name<input className={`${inputClass} mt-1`} required minLength={2} maxLength={100} value={fields.name} onChange={e => setFields(f => ({ ...f, name: e.target.value }))} /></label>
      <label className="block text-sm font-medium">Business category<select className={`${inputClass} mt-1`} value={fields.category} onChange={e => setFields(f => ({ ...f, category: e.target.value }))}>{BUSINESS_SECTORS.map(s => <optgroup key={s.id} label={s.label}>{s.categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</optgroup>)}</select></label>
      <label className="block text-sm font-medium">About the business<textarea className={`${inputClass} mt-1`} rows={3} maxLength={2000} value={fields.description} onChange={e => setFields(f => ({ ...f, description: e.target.value }))} /></label>
      <div className="grid gap-4 sm:grid-cols-2">{([ ["town", "Town", 60], ["contact_name", "Contact name", 100], ["email", "Business email", 120], ["phone", "Business phone", 30] ] as const).map(([key, label, max]) => <label key={key} className="block text-sm font-medium">{label}<input className={`${inputClass} mt-1`} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} maxLength={max} value={fields[key]} onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))} /></label>)}</div>
      <p className="text-xs text-muted-foreground">These business details are public. Only add contact details you want customers to see.</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1" />I own or am authorised to manage this business.</label>
      <div className="flex gap-2"><Button disabled={saving || uploading}>{saving ? <Loader2 className="animate-spin" /> : <Plus />}{saving ? "Adding…" : "Add business"}</Button>{mine.length > 0 && <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>}</div>
    </form>}
  </main>;
}