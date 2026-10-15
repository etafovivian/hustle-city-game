// Phone → Wardrobe: change your look any time (outfit, colours, hair). Saved to your profile; the 3D preview shows it.
import type { AvatarConfig } from "@hc/shared";
import { Shirt } from "lucide-react";
import { Suspense, lazy, useState } from "react";
import { api } from "../api.js";
import { AvatarPicker } from "./Avatar.js";

const Avatar3D = lazy(() => import("./Avatar3D.js"));

export function Wardrobe({ avatar, notify, onChanged }: { avatar: AvatarConfig; notify: (m: string) => void; onChanged: () => void }) {
  const [look, setLook] = useState<AvatarConfig>(avatar);
  const [busy, setBusy] = useState(false);
  const changed = JSON.stringify(look) !== JSON.stringify(avatar);
  const save = async () => {
    setBusy(true);
    try {
      await api("PATCH", "/api/me/profile", { avatar: look });
      notify("New look saved");
      onChanged();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack account-form">
      <div className="stack" style={{ gap: 2 }}>
        <h2 style={{ fontSize: 20 }}>
          <Shirt size={20} aria-hidden="true" /> Wardrobe
        </h2>
        <p className="small muted">Change your clothes, colours and hair. Everyone sees your new look.</p>
      </div>
      <div className="wardrobe-preview">
        <Suspense fallback={<p className="small muted">Loading…</p>}>
          <Avatar3D avatar={look} height={300} />
        </Suspense>
      </div>
      <AvatarPicker value={look} onChange={setLook} preview={false} />
      <button type="button" className="btn primary block" disabled={!changed || busy} onClick={() => void save()}>
        {busy ? "Saving…" : changed ? "Wear this" : "This is your look"}
      </button>
    </div>
  );
}
