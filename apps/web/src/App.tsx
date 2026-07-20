import { LOCATIONS, type LocationKey, type Me, type QuestBoard, type ShopView } from "@hc/shared";
import { useCallback, useEffect, useState } from "react";
import { api, formatCoins } from "./api.js";
import { AuthScreen } from "./components/AuthScreen.js";
import { Avatar } from "./components/Avatar.js";
import { CityMap } from "./components/CityMap.js";
import { Hangout, WorkHub } from "./components/Locations.js";
import { Merchants } from "./components/Merchants.js";
import { Quests } from "./components/Quests.js";
import { ShopPanel } from "./components/ShopPanel.js";

type View = { kind: "map" } | { kind: "location"; id: LocationKey } | { kind: "browse" };

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
    setTimeout(() => setToast(null), 2500);
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

  const openLocation = async (id: LocationKey) => {
    setView({ kind: "location", id });
    setVisited((v) => new Set(v).add(id));
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

  if (me === undefined) return <div className="app" />;

  if (view.kind === "browse") {
    return (
      <div className="app">
        <header className="topbar">
          <div className="who">
            <strong>Hustle City Marketplace</strong>
          </div>
          <button className="btn sm" onClick={() => setView({ kind: "map" })}>
            {me ? "Back to the city" : "Sign in / join"}
          </button>
        </header>
        <Merchants />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="app">
        <AuthScreen
          onSignedIn={(m) => {
            setMe(m);
            void refresh();
          }}
          onBrowse={() => setView({ kind: "browse" })}
        />
      </div>
    );
  }

  const location = view.kind === "location" ? LOCATIONS.find((l) => l.key === view.id) : undefined;
  const onChanged = () => void refresh();

  return (
    <div className="app">
      <header className="topbar">
        <div className="who">
          <Avatar avatar={me.avatar} size={38} />
          <strong>{me.nickname}</strong>
        </div>
        <span className="pill coins" title="City Coins — game currency, no cash value">
          <span className="coin-dot" /> {formatCoins(me.coins)}
          <span className="hide-sm small muted">City Coins</span>
        </span>
        <span className="pill hide-sm">{me.xp} XP</span>
        <button className="btn sm ghost" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <div className="grid-2">
        <main className="stack">
          {view.kind === "map" || !location ? (
            <>
              <div className="spread">
                <div>
                  <h2>Junction 101</h2>
                  <p className="small muted">Tap a place to go in.</p>
                </div>
                <button className="btn sm" onClick={() => setView({ kind: "browse" })}>
                  Quick search
                </button>
              </div>
              <CityMap onOpen={(id) => void openLocation(id)} visited={visited} />
            </>
          ) : (
            <section className="stack">
              <div className="panel-head">
                <button className="btn sm" onClick={() => setView({ kind: "map" })} aria-label="Back to map">
                  ← Map
                </button>
                <div>
                  <h2>{location.name}</h2>
                  <p className="small muted">{location.blurb}</p>
                </div>
              </div>

              {location.key === "market_square" && (
                <>
                  <div className="tabs" role="tablist">
                    <button role="tab" className="btn sm" aria-selected={marketTab === "shop"} onClick={() => setMarketTab("shop")}>
                      My shop
                    </button>
                    <button role="tab" className="btn sm" aria-selected={marketTab === "merchants"} onClick={() => setMarketTab("merchants")}>
                      Real merchants
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
            </section>
          )}
        </main>

        <aside>{board && <Quests board={board} onBoard={setBoard} onChanged={onChanged} notify={notify} />}</aside>
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
