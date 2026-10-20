import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addBusinessPhoto,
  BUSINESS_SECTORS,
  DAYS,
  deleteBusinessPhoto,
  saveBusinessProfile,
  type BusinessPhoto,
  type BusinessProfile,
  type OpeningHours,
} from "@/lib/businesses";
import { uploadImage, validateImageFile } from "@/lib/uploads";
import { Button } from "@/components/ui/button";

export const MIN_PHOTOS = 5;

/**
 * For the business owner and admins: photos, opening hours, services and
 * contact details, shown on the business page.
 */
export function BusinessManager({
  business,
  photos,
  userId,
}: {
  business: BusinessProfile;
  photos: BusinessPhoto[];
  userId: string;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(business.logo_url);
  const [logoUploading, setLogoUploading] = useState(false);
  const [name, setName] = useState(business.name);
  const [category, setCategory] = useState(business.category);
  const [town, setTown] = useState(business.town ?? "");
  const [contactName, setContactName] = useState(business.contact_name ?? "");
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState(business.description ?? "");
  const [address, setAddress] = useState(business.address ?? "");
  const [phone, setPhone] = useState(business.phone ?? "");
  const [website, setWebsite] = useState(business.website ?? "");
  const [email, setEmail] = useState(business.email ?? "");
  const [services, setServices] = useState((business.services ?? []).join(", "));
  const [hours, setHours] = useState<OpeningHours>(business.opening_hours ?? {});
  const ownPhotos = photos.filter((p) => p.source === "business");

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["business", business.id] });
    void queryClient.invalidateQueries({ queryKey: ["businesses"] });
    void queryClient.invalidateQueries({ queryKey: ["my-businesses"] });
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) return void toast.error(problem);
    setLogoUploading(true);
    try {
      setLogo(await uploadImage("user-media", userId, file));
      toast.success("Logo uploaded — save your profile to apply it");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't upload logo"); }
    finally { setLogoUploading(false); if (logoRef.current) logoRef.current.value = ""; }
  }

  async function upload(files: FileList | null) {
    const list = [...(files ?? [])].slice(0, 20);
    if (fileRef.current) fileRef.current.value = "";
    for (const file of list) {
      const problem = validateImageFile(file);
      if (problem) {
        toast.error(problem);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const url = await uploadImage("user-media", userId, file);
        await addBusinessPhoto(business.id, url);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add that photo");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    refresh();
  }

  async function remove(photo: BusinessPhoto) {
    if (!window.confirm("Remove this photo?")) return;
    try {
      await deleteBusinessPhoto(photo.id);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the photo");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const site = website.trim();
    if (site && !/^https:\/\//.test(site)) {
      toast.error("The website needs to start with https://");
      return;
    }
    setSaving(true);
    try {
      const cleanHours = Object.fromEntries(
        DAYS.map(([key]) => [key, hours[key] ?? null]),
      ) as OpeningHours;
      const anyHours = Object.values(cleanHours).some(Boolean);
      await saveBusinessProfile(business.id, {
        name: name.trim(),
        category,
        town: town.trim() || null,
        contact_name: contactName.trim() || null,
        logo_url: logo,
        description: description.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        website: site || null,
        email: email.trim() || null,
        services: services
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 30),
        opening_hours: anyHours ? cleanHours : null,
      });
      toast.success("Profile saved");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the profile");
    } finally {
      setSaving(false);
    }
  }

  const left = Math.max(0, MIN_PHOTOS - ownPhotos.length);
  return (
    <section className="mt-6 border-t border-border pt-5">
      <h2 className="text-lg font-bold">Manage your profile</h2>
      <p className="text-sm text-muted-foreground">Only you and RevMate's team see this box.</p>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">
            Photos <span className="font-normal text-muted-foreground">({ownPhotos.length})</span>
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading > 0}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {uploading > 0 ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
            {uploading > 0 ? `Uploading ${uploading}…` : "Add photos"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => void upload(e.target.files)}
          />
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${left ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, (ownPhotos.length / MIN_PHOTOS) * 100)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {left
            ? `Add ${left} more to reach ${MIN_PHOTOS}. Show the outside, the inside, your team and your work. Profiles with ${MIN_PHOTOS}+ photos show higher in the list.`
            : "Great, your profile has enough photos. Keep adding your latest work."}
        </p>
        {ownPhotos.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {ownPhotos.map((p) => (
              <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg">
                <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => void remove(p)}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/65 text-white"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={save} className="mt-5 space-y-3">
        <div className="flex items-center gap-3">
          {logo && <img src={logo} alt={`${name} logo`} className="size-16 rounded-md border border-border object-contain" />}
          <Button type="button" variant="outline" disabled={logoUploading} onClick={() => logoRef.current?.click()}><Camera />{logoUploading ? "Uploading…" : "Change logo"}</Button>
          {logo && <Button type="button" variant="ghost" onClick={() => setLogo(null)}>Remove logo</Button>}
          <input ref={logoRef} aria-label="Business logo" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => void uploadLogo(e.target.files?.[0])} />
        </div>
        <Field label="Business name"><input required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></Field>
        <Field label="Business category"><select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{BUSINESS_SECTORS.map(s => <optgroup key={s.id} label={s.label}>{s.categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</optgroup>)}</select></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Town"><input maxLength={60} value={town} onChange={e => setTown(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></Field>
          <Field label="Contact name"><input maxLength={100} value={contactName} onChange={e => setContactName(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></Field>
        </div>
        <p className="text-xs text-muted-foreground">Business contact details are public. Don't add your private home address.</p>
        <Field label="About the business">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Address">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
            placeholder="Unit 4, Kirkstall Road, Leeds LS3 1AB"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              inputMode="tel"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Website">
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
              inputMode="url"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              maxLength={120}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <Field label="Services (separate with commas)">
          <input
            value={services}
            onChange={(e) => setServices(e.target.value)}
            placeholder="Servicing, MOT, Diagnostics, Air con re-gas"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium">Opening hours</p>
          <div className="divide-y divide-border rounded-lg border border-border bg-background">
            {DAYS.map(([key, name]) => {
              const day = hours[key];
              return (
                <div key={key} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="w-12 font-medium">{name.slice(0, 3)}</span>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!day}
                      onChange={(e) =>
                        setHours((h) => ({
                          ...h,
                          [key]: e.target.checked ? { open: "09:00", close: "17:30" } : null,
                        }))
                      }
                    />
                    Open
                  </label>
                  {day ? (
                    <span className="ml-auto flex items-center gap-1">
                      <input
                        type="time"
                        value={day.open}
                        aria-label={`${name} opens`}
                        onChange={(e) =>
                          setHours((h) => ({ ...h, [key]: { ...day, open: e.target.value } }))
                        }
                        className="rounded-md border border-input bg-background px-1.5 py-1"
                      />
                      –
                      <input
                        type="time"
                        value={day.close}
                        aria-label={`${name} closes`}
                        onChange={(e) =>
                          setHours((h) => ({ ...h, [key]: { ...day, close: e.target.value } }))
                        }
                        className="rounded-md border border-input bg-background px-1.5 py-1"
                      />
                    </span>
                  ) : (
                    <span className="ml-auto text-muted-foreground">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Button
          disabled={saving || logoUploading}
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
