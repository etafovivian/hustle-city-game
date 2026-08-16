import { LOCATIONS, type LocationKey, type Me, type NeedsView, type QuestBoard, type ShopView } from "@hc/shared";
import { ArrowLeft, Coins, ListChecks, LogOut, Map as MapIcon, Search, ShoppingBag, Smartphone, Sparkles, Store } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatCoins } from "./api.js";
import { AuthScreen } from "./components/AuthScreen.js";
import { Avatar } from "./components/Avatar.js";
import { CityMap } from "./components/CityMap.js";
import { Decorate } from "./components/Decorate.js";
import { Hangout, WorkHub } from "./components/Locations.js";
import { Merchants } from "./components/Merchants.js";
import { MoodChip, NeedsPanel } from "./components/Needs.js";
import { Phone, type PhoneApp } from "./components/Phone.js";
import { Quests } from "./components/Quests.js";
import { ResetPassword } from "./components/Password.js";
import { VerifyPage } from "./components/Academy.js";
import { ShopPanel } from "./components/ShopPanel.js";
import { PlaceHeader, Selvedge } from "./components/ui.js";
import { LOCATION_PRINT } from "./prints.js";

type View = { kind: "map" } | { kind: "location"; id: LocationKey } | { kind: "browse" } | { kind: "market" };
type Tab = "map" | "shop" | "market";

const PLACE_RULE: Record<LocationKey, string> = {
  market_square: "Customers pay the price you set — too high and they walk",
  work_hub: "Jobs pay only when a business has funded them — nothing here pays yet",
  hangout: "Standings count City Coins, never real money",
};

const PLACE_ART: Record<LocationKey, string> = {
  market_square: "/art/market-square.webp",
  work_hub: "/art/work-hub.webp",
  hangout: "/art/hangout.webp",
};

function Lockup({ onClick }: { onClick?: () => void }) {
  return (
    <button className="lockup" aria-label="Naija Hustle City, back to the map" onClick={onClick} style={{ background: "none", border: 0, padding: 0, cursor: onClick ? "pointer" : "default" }}>
      <img className="lockup-logo" src="/art/logo.webp" alt="" width={42} height={42} />
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
  const [marketTab, setMarketTab] = useState<"shop" | "decorate" | "merchants">("shop");
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [phone, setPhone] = useState<PhoneApp | null>(null);
  // A one-time reset link opens straight into "choose a new password".
  const [resetToken, setResetToken] = useState<string | null>(() => new URLSearchParams(window.location.search).get("reset"));
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  // A shared certificate link opens the public check page.
  const [verify, setVerify] = useState<string | null>(() => new URLSearchParams(window.location.search).get("verify"));

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const [needs, setNeeds] = useState<NeedsView | null>(null);
  const [needsOpen, setNeedsOpen] = useState(false);
  const refresh = useCallback(async () => {
    const [m, b] = await Promise.all([api<Me>("GET", "/api/me"), api<QuestBoard>("GET", "/api/game/quests")]);
    setMe(m);
    setBoard(b);
    api<NeedsView>("GET", "/api/game/needs")
      .then(setNeeds)
      .catch(() => undefined);
  }, []);
  // Needs run down in real time: look again every few minutes.
  useEffect(() => {
    if (!me) return;
    const id = window.setInterval(() => {
      api<NeedsView>("GET", "/api/game/needs")
        .then(setNeeds)
        .catch(() => undefined);
    }, 180_000);
    return () => window.clearInterval(id);
  }, [!!me]);

  useEffect(() => {
    // Not signed in (401) or API unreachable: show the welcome screen.
    refresh().catch(() => setMe(null));
  }, [refresh]);

  // The city map is full screen (like a game); everything else floats over it.
  const mapFull = !!me && !resetToken && !verify && view.kind === "map";
  useEffect(() => {
    document.body.classList.toggle("map-full", mapFull);
    return () => document.body.classList.remove("map-full");
  }, [mapFull]);

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

  const onQuoteRequested = () => {
    notify("Request sent. Replies land in Phone → Messages.");
    setPhone("messages");
  };

  if (verify) {
    return (
      <VerifyPage
        number={verify}
        onDone={() => {
          window.history.replaceState(null, "", window.location.pathname);
          setVerify(null);
        }}
      />
    );
  }

  if (resetToken) {
    return (
      <ResetPassword
        token={resetToken}
        onDone={(msg) => {
          window.history.replaceState(null, "", window.location.pathname);
          setResetToken(null);
          setMe(null);
          setAuthNotice(msg);
        }}
      />
    );
  }

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
          <Merchants signedIn={!!me} onRequested={() => notify("Request sent. Replies land in Phone → Messages.")} />
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
        notice={authNotice}
      />
    );
  }

  const location = view.kind === "location" ? LOCATIONS.find((l) => l.key === view.id) : undefined;
  const onChanged = () => void refresh();
  const tab: Tab = view.kind === "market" ? "market" : view.kind === "location" && view.id === "market_square" && marketTab !== "merchants" ? "shop" : "map";
  const readyQuests = board ? board.daily.filter((q) => q.progress >= q.target && !q.claimed).length : 0;
  const openShop = () => {
    setMarketTab("shop");
    void openLocation("market_square");
  };
  const openMarket = () => {
    setPhone(null);
    setView({ kind: "market" });
    window.scrollTo({ top: 0 });
  };

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
          {needs && <MoodChip view={needs} onOpen={() => setNeedsOpen(true)} />}
          <span className="xp hide-sm row" style={{ gap: 4 }}>
            <Sparkles size={15} aria-hidden="true" /> {me.xp} XP
          </span>
          <Avatar avatar={me.avatar} size={34} className="shell-avatar hide-sm" />
          <button className="shell-btn" onClick={() => void signOut()} aria-label="Sign out">
            <LogOut size={16} aria-hidden="true" /> <span className="hide-sm">Sign out</span>
          </button>
        </div>
      </header>
      {needsOpen && needs && (
        <NeedsPanel
          view={needs}
          onClose={() => setNeedsOpen(false)}
          onGo={(key) => {
            setNeedsOpen(false);
            goMap();
            // The map opens the place's card (it may need a moment to mount after switching views).
            window.setTimeout(() => window.dispatchEvent(new CustomEvent("hc:open-venue", { detail: key })), 50);
          }}
        />
      )}

      {(view.kind === "map" || !location) && <Selvedge rule="City Coins are game money — no cash value" />}

      <div className="page">
        <div className="layout">
          <main className="stack-lg">
            {view.kind === "market" ? (
              <>
                <div className="stack" style={{ gap: 4 }}>
                  <h1>Real businesses</h1>
                  <p className="muted">Shops and artisans that serve your area. Prices are in naira and set by each business.</p>
                </div>
                <Merchants onViewed={onChanged} signedIn onRequested={onQuoteRequested} />
              </>
            ) : view.kind === "map" || !location ? (
              <>
                {/* Floats over the full-screen map */}
                <div className="map-title">
                  <div className="stack" style={{ gap: 2 }}>
                    <h1>Junction 101</h1>
                    <p className="muted small">Oya, {me.nickname}! Tap the road to walk, or a place to go in.</p>
                  </div>
                  <div className="row map-title-actions">
                    <button className="btn sm" onClick={() => setView({ kind: "browse" })}>
                      <Search size={16} aria-hidden="true" /> Find a business
                    </button>
                    {board && (
                      <button type="button" className="btn sm" onClick={() => setPhone("quests")}>
                        <ListChecks size={16} aria-hidden="true" /> Quests
                        {readyQuests > 0 && <span className="quest-pill-badge">{readyQuests}</span>}
                      </button>
                    )}
                  </div>
                </div>
                <CityMap onOpen={(id) => void openLocation(id)} visited={visited} onVisited={onChanged} notify={notify} onDistrict={openMarket} avatar={me.avatar} nickname={me.nickname} onApp={setPhone} />
              </>
            ) : (
              <>
                <PlaceHeader
                  print={LOCATION_PRINT[location.key]!}
                  title={location.name}
                  blurb={location.blurb}
                  rule={PLACE_RULE[location.key]}
                  art={PLACE_ART[location.key]}
                  onBack={goMap}
                />

                {location.key === "market_square" && (
                  <>
                    <div className="segmented" role="tablist" aria-label="Market Square">
                      <button role="tab" aria-selected={marketTab === "shop"} onClick={() => setMarketTab("shop")}>
                        Stock
                      </button>
                      <button role="tab" aria-selected={marketTab === "decorate"} onClick={() => setMarketTab("decorate")}>
                        Decorate
                      </button>
                      <button role="tab" aria-selected={marketTab === "merchants"} onClick={() => setMarketTab("merchants")}>
                        Real businesses
                      </button>
                    </div>
                    {marketTab === "decorate" ? (
                      <Decorate coins={me.coins} onChanged={onChanged} notify={notify} />
                    ) : marketTab === "shop" ? (
                      shop ? (
                        <ShopPanel shop={shop} onShop={setShop} onChanged={onChanged} notify={notify} />
                      ) : (
                        <p className="muted">Opening your shop…</p>
                      )
                    ) : (
                      <Merchants onViewed={onChanged} signedIn onRequested={onQuoteRequested} />
                    )}
                  </>
                )}
                {location.key === "work_hub" && <WorkHub />}
                {location.key === "hangout" && <Hangout onViewed={onChanged} />}
              </>
            )}
          </main>

          {board && (
            <div className="hide-md-down">
              <Quests board={board} onBoard={setBoard} onChanged={onChanged} notify={notify} />
            </div>
          )}
        </div>
      </div>

      <nav className="dock" aria-label="Main">
        <button type="button" className="dock-item" aria-current={tab === "map" && !phone ? "page" : undefined} onClick={goMap}>
          <MapIcon size={22} aria-hidden="true" />
          <span>Map</span>
        </button>
        <button type="button" className="dock-item" aria-current={tab === "shop" && !phone ? "page" : undefined} onClick={openShop}>
          <ShoppingBag size={22} aria-hidden="true" />
          <span>My shop</span>
        </button>
        <button type="button" className="dock-item" aria-current={tab === "market" && !phone ? "page" : undefined} onClick={openMarket}>
          <Store size={22} aria-hidden="true" />
          <span>Market</span>
        </button>
        <button type="button" className="dock-item" aria-current={phone ? "page" : undefined} onClick={() => setPhone("home")}>
          <span className="dock-icon-wrap">
            <Smartphone size={22} aria-hidden="true" />
            {readyQuests > 0 && <span className="dock-dot" aria-label={`${readyQuests} quests ready`} />}
          </span>
          <span>Phone</span>
        </button>
      </nav>

      {phone && (
        <Phone
          app={phone}
          setApp={setPhone}
          onClose={() => setPhone(null)}
          onMarket={openMarket}
          board={board}
          onBoard={setBoard}
          onChanged={onChanged}
          notify={notify}
          email={me.email}
          isAdmin={me.roles.includes("admin")}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <Coins size={18} aria-hidden="true" /> {toast}
        </div>
      )}
    </>
  );
}
