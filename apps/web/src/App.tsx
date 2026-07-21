import { LOCATIONS, type LocationKey, type Me, type QuestBoard, type ShopView } from "@hc/shared";
import { ArrowLeft, Coins, LogOut, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatCoins } from "./api.js";
import { AuthScreen } from "./components/AuthScreen.js";
import { Avatar } from "./components/Avatar.js";
import { CityMap } from "./components/CityMap.js";
import { Hangout, WorkHub } from "./components/Locations.js";
import { Merchants } from "./components/Merchants.js";
import { Quests } from "./components/Quests.js";
import { ShopPanel } from "./components/ShopPanel.js";
import { PlaceHeader, Selvedge } from "./components/ui.js";
import { LOCATION_PRINT, printUrl } from "./prints.js";

type View = { kind: "map" } | { kind: "location"; id: LocationKey } | { kind: "browse" };

const PLACE_RULE: Record<LocationKey, string> = {
  market_square: "Customers pay the price you set — too high and they walk",
  work_hub: "Jobs pay only when a business has funded them — nothing here pays yet",
  hangout: "Standings count City Coins, never real money",
};

function Lockup({ onClick }: { onClick?: () => void }) {
  return (
    <button className="lockup" onClick={onClick} style={{ background: "none", border: 0, padding: 0, cursor: onClick ? "pointer" : "default" }}>
      <span className="lockup-swatch" style={{ backgroundImage: printUrl("market"), backgroundSize: "28px 28px" }} aria-hidden="true" />
      <span className="lockup-name">
        Naija <span>Hustle City</span>
      </span>
    </button>
  );
}

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [view, setView] = useState<View>({ kind: "map" });
  const [board, setBoard] = useState<QuestBoard | null>(null);
  const [shop, setShop] = useState<ShopView | null>(null);
  const [marketTab, setMarketTab] = useState<"shop" | "merchants">("shop");
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const refresh = useCallback(async () => {
    const [m, b] = await Promise.all([api<Me>("GET", "/api/me"), api<QuestBoard>("GET", "/api/game/quests")]);
    setMe(m);
    setBoard(b);
  }, []);

  useEffect(() => {
    // Not signed in (401) or API unreachable: show the welcome screen.
    refresh().catch(() => setMe(null));
  }, [refresh]);

  const goMap = () => {
    setView({ kind: "map" });
    window.scrollTo({ top: 0 });
  };

  const openLocation = async (id: LocationKey) => {
    setView({ kind: "location", id });
    setVisited((v) => new Set(v).add(id));
    window.scrollTo({ top: 0 });
    try {
      setBoard(await api<QuestBoard>("POST", "/api/game/visit", { location: id }));
      if (id === "market_square") setShop(await api<ShopView>("GET", "/api/game/shop"));
    } catch (e) {
      notify((e as Error).message);
    }
  };

  const signOut = async () => {
    await api("POST", "/api/auth/logout");
    setMe(null);
    setBoard(null);
    setShop(null);
    setView({ kind: "map" });
  };

  if (me === undefined) return null;

  if (view.kind === "browse") {
    return (
      <>
        <header className="shellbar">
          <div className="shellbar-inner">
            <Lockup onClick={goMap} />
            <button className="shell-btn" onClick={goMap}>
              <ArrowLeft size={16} aria-hidden="true" /> {me ? "Back to the city" : "Sign in"}
            </button>
          </div>
        </header>
        <Selvedge rule="Real businesses, prices in naira" />
        <main className="page stack-lg" style={{ maxWidth: 820 }}>
          <div className="stack" style={{ gap: 4 }}>
            <h1>Find a business</h1>
            <p className="muted">Search shops and artisans that serve your area. No game needed.</p>
          </div>
          <Merchants />
        </main>
      </>
    );
  }

  if (!me) {
    return (
      <AuthScreen
        onSignedIn={(m) => {
          setMe(m);
          void refresh();
        }}
        onBrowse={() => setView({ kind: "browse" })}
      />
    );
  }

  const location = view.kind === "location" ? LOCATIONS.find((l) => l.key === view.id) : undefined;
  const onChanged = () => void refresh();

  return (
    <>
      <header className="shellbar">
        <div className="shellbar-inner">
          <Lockup onClick={goMap} />
          <span className="balance" title="City Coins are game money with no cash value">
            <Coins size={16} aria-hidden="true" />
            <span className="num">{formatCoins(me.coins)}</span>
            <span className="unit hide-sm">City Coins</span>
          </span>
          <span className="xp hide-sm row" style={{ gap: 4 }}>
            <Sparkles size={15} aria-hidden="true" /> {me.xp} XP
          </span>
          <Avatar avatar={me.avatar} size={34} className="shell-avatar hide-sm" />
          <button className="shell-btn" onClick={() => void signOut()} aria-label="Sign out">
            <LogOut size={16} aria-hidden="true" /> <span className="hide-sm">Sign out</span>
          </button>
        </div>
      </header>

      {(view.kind === "map" || !location) && <Selvedge rule="City Coins are game money — no cash value" />}

      <div className="page">
        <div className="layout">
          <main className="stack-lg">
            {view.kind === "map" || !location ? (
              <>
                <div className="spread">
                  <div className="stack" style={{ gap: 4 }}>
                    <h1>Junction 101</h1>
                    <p className="muted">Welcome back, {me.nickname}. Tap a place to go in.</p>
                  </div>
                  <button className="btn" onClick={() => setView({ kind: "browse" })}>
                    <Search size={18} aria-hidden="true" /> Find a business
                  </button>
                </div>
                <CityMap onOpen={(id) => void openLocation(id)} visited={visited} />
              </>
            ) : (
              <>
                <PlaceHeader
                  print={LOCATION_PRINT[location.key]!}
                  title={location.name}
                  blurb={location.blurb}
                  rule={PLACE_RULE[location.key]}
                  onBack={goMap}
                />

                {location.key === "market_square" && (
                  <>
                    <div className="segmented" role="tablist" aria-label="Market Square">
                      <button role="tab" aria-selected={marketTab === "shop"} onClick={() => setMarketTab("shop")}>
                        My shop
                      </button>
                      <button role="tab" aria-selected={marketTab === "merchants"} onClick={() => setMarketTab("merchants")}>
                        Real businesses
                      </button>
                    </div>
                    {marketTab === "shop" ? (
                      shop ? (
                        <ShopPanel shop={shop} onShop={setShop} onChanged={onChanged} notify={notify} />
                      ) : (
                        <p className="muted">Opening your shop…</p>
                      )
                    ) : (
                      <Merchants onViewed={onChanged} />
                    )}
                  </>
                )}
                {location.key === "work_hub" && <WorkHub />}
                {location.key === "hangout" && <Hangout onViewed={onChanged} />}
              </>
            )}
          </main>

          {board && <Quests board={board} onBoard={setBoard} onChanged={onChanged} notify={notify} />}
        </div>
      </div>

      {toast && (
        <div className="toast" role="status">
          <Coins size={18} aria-hidden="true" /> {toast}
        </div>
      )}
    </>
  );
}
