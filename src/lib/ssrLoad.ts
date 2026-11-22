// Route loaders run on the server for a visitor's first page load (and on the client for later
// navigations). They fetch the page's main content so Google gets real HTML, not a skeleton.
// A slow or failing database must never break the page, so loaders go through this helper:
// it never throws and gives up after a few seconds, and the page then fetches in the browser
// exactly as it did before.

export type Loaded<T> = { ok: true; data: T } | { ok: false };

export async function loadForSsr<T>(run: () => PromiseLike<T>, ms = 4000): Promise<Loaded<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(run()).then((data): Loaded<T> => ({ ok: true, data })),
      new Promise<Loaded<T>>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false }), ms);
      }),
    ]);
  } catch {
    return { ok: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
