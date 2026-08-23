// New Lagos — a pan-and-zoom isometric world laid out like Lagos (docs/city-plan.md), starting at Junction 101.
// Art is the Stitch raster set (public/art, provenance in *.json sidecars).
// Places are real buttons for keyboard and screen-reader access; drag never triggers a tap.
import { AD_ROTATE_SECONDS, HUSTLES_BY_KEY, MAX_RIDE_UNITS, RIDE_BY_MODE, RIDE_PICK_FROM, VENUES_BY_KEY, HOUSE_BY_KEY, WEATHER_ICON, WEATHER_LABEL, areasWithoutLight, businessArt, eventsOn, weatherAt, type Weather, type AvatarConfig, type HomeView, type MapHome, type PresencePlayer, type PresenceReply, type VehicleKind, type MapBusiness, type RideMode, type RideStart, type BillboardView, type LocationKey, type NeighbourShop } from "@hc/shared";
import { Home as HomeIcon, LandPlot, LocateFixed, Map as MapIcon, Megaphone, Minus, Plus, Sparkles, Store, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type SVGProps } from "react";
import { createPortal } from "react-dom";
import { BusinessCard, LandCard, LandList } from "./Land.js";
import { CityOverview } from "./Overview.js";
import { SoundToggle } from "./Ambience.js";
import { HomeCard, PlotCard } from "./Home.js";
import { OtherPlayers, PlayerCard, VisitHome } from "./Social.js";
import { AreaBoys, RidePicker } from "./Rides.js";
import type { Trip } from "./AvatarWalker.js";
import { api, formatCoins } from "../api.js";
import { INK } from "../prints.js";
import { clockLabel, useLagosLight } from "./lagosTime.js";
import { AvatarWalker } from "./AvatarWalker.js";
import { BillboardOnMap, BillboardSheet } from "./Billboards.js";
import { ShopVisit } from "./ShopVisit.js";
import { VenueBadge, VenueBuilding, VenueCard } from "./Venues.js";
import { DepthSorted, type DepthItem } from "./People.js";
import { StreetLife } from "./StreetLife.js";
import {
  ALL_SCENERY,
  BEACH_PATH,
  ROAD_PATHS,
  STREET_ENDS,
  strokeFor,
  flyHeight,
  yOn,
  walkRoute,
  roadRoute,
  BILLBOARD_SPOTS,
  DRIVEWAYS,
  STREETS,
  FOR_SALE,
  siteOf,
  BRANCHES,
  BRANCH_BY_KEY,
  starterRoom,
  FORESTS,
  GRASS,
  RUNWAY,
  iso,
  isoRect,
  ROUNDABOUT,
  TREES,
  VENUE_SPOTS,
  CX,
  CY,
  DISTRICTS,
  HALF,
  ISLAND_PATH,
  LAMPS,
  OCEAN_PATH,
  PAVEMENT,
  PARK,
  PILLARS,
  PLACES,
  PLOTS,
  PORT_AND_PLANES,
  PROPS,
  ZEBRAS,
  ROAD_A,
  ROAD_B,
  ROADS,
  SHORE_PATH,
  WATER_PATH,
  WORLD,
  bandPath,
  centrePath,
  kerbPath,
} from "./cityLayout.js";
import { buildingBox, propBox } from "./sprites.js";
import { usePanZoom } from "./usePanZoom.js";

const J = { x: CX - 400, y: CY - 300, w: 800, h: 640 };

/** Drawn height of the drawn (vector) tree kinds, width 120. */
const TREE_H = { leafy: 140, palm: 165, mango: 125, almond: 128, bush: 40 } as const;
/** Stitch art for the plants (export 12): width in world units. "leafy" trees use the neem art. */
const NATURE: Record<string, { art: string; w: number }> = {
  mango: { art: "/art/nature/mango.webp", w: 130 },
  almond: { art: "/art/nature/almond.webp", w: 140 },
  neem: { art: "/art/nature/neem.webp", w: 100 },
  leafy: { art: "/art/nature/neem.webp", w: 100 },
  plantain: { art: "/art/nature/plantain.webp", w: 100 },
  hedge: { art: "/art/nature/ixora-hedge.webp", w: 120 },
  bougainvillea: { art: "/art/nature/bougainvillea-wall.webp", w: 120 },
};
const LAMP = { art: "/art/props/street-lamp.webp", w: 46 };
/** Street furniture: stalls, shelters, poles and lamps. */
const STREET_PROPS = [...PROPS, ...PORT_AND_PLANES, ...LAMPS.map((l) => ({ ...l, art: LAMP.art, w: LAMP.w }))];

/** Branch buildings by their scenery key (they open like places). */
const BRANCH_BY_BUILDING = new Map(BRANCHES.map((b) => [b.key.slice(b.key.indexOf("@") + 1), b]));
/** Buildings, trees and street furniture in one back-to-front list so nearer things cover farther ones. */
const WORLD_OBJECTS = [
  ...ALL_SCENERY.map((b) => ({ ...b, type: "building" as const, box: buildingBox(b.art, b.x, b.y, b.scale) })),
  ...TREES.map((t) => ({ ...t, type: "tree" as const })),
  ...STREET_PROPS.filter((p) => !p.behind).map((p) => ({ ...p, type: "prop" as const, box: propBox(p.art, p.x, p.y, p.w) })),
].sort((a, b) => a.y - b.y);
/** Furniture on the far side of a road: drawn before the traffic and walkers, which pass in front of it. */
const BEHIND_PROPS = STREET_PROPS.filter((p) => p.behind)
  .map((p) => ({ ...p, box: propBox(p.art, p.x, p.y, p.w) }))
  .sort((a, b) => a.y - b.y);

/** A zebra crossing: white stripes along the road, across it from kerb to kerb. */
function zebraStripes(z: (typeof ZEBRAS)[number]) {
  const [ux, uy] = [z.x1 - z.x0, z.y1 - z.y0];
  // The road runs along the other iso axis: (1, 0.5) if the zebra runs along (1, -0.5), and the other way round.
  const r = Math.hypot(1, 0.5);
  const [vx, vy] = uy / ux < 0 ? [1 / r, 0.5 / r] : [1 / r, -0.5 / r];
  const [hx, hy] = [(vx * z.w) / 2, (vy * z.w) / 2];
  const n = Math.max(3, Math.round(Math.hypot(ux, uy) / 15));
  return Array.from({ length: n }, (_, i) => {
    const [t0, t1] = [(i + 0.2) / n, (i + 0.7) / n];
    const [ax, ay, bx, by] = [z.x0 + ux * t0, z.y0 + uy * t0, z.x0 + ux * t1, z.y0 + uy * t1];
    return `M${ax - hx} ${ay - hy}L${ax + hx} ${ay + hy}L${bx + hx} ${by + hy}L${bx - hx} ${by - hy}Z`;
  }).join("");
}

/** Each hustle's shop looks different on the map (Stitch art in public/art/buildings). */
const HUSTLE_ART: Record<string, string> = {
  trader: "/art/market-square.webp",
  chop: "/art/buildings/buka.webp",
  gadget: "/art/buildings/gadget-kiosk.webp",
  artisan: "/art/buildings/tailor-shop.webp",
};


const PHASE_LABEL = { dawn: "Early morning", day: "Daytime", dusk: "Evening", night: "Night" } as const;

/** Screen size (px) a world-unit size renders at, kept readable at any zoom. */
const readable = (k: number, worldSize: number, minPx: number, max = 8) => Math.min(max, Math.max(1, minPx / (worldSize * k)));

interface HotspotProps {
  part: "body" | "label";
  id: LocationKey;
  label: string;
  art: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visited: boolean;
  plateScale: number;
  onOpen: (id: LocationKey) => void;
}

function Hotspot({ part, id, label, art, x, y, w, h, visited, plateScale, onOpen }: HotspotProps) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onOpen(id);
    }
  };
  const plateW = label.length * 8.5 + 26;
  if (part === "label")
    return (
      <g transform={`translate(${x} ${y})`} aria-hidden="true" className="map-label">
        <g transform={`translate(${w / 2} ${h + 6}) scale(${plateScale}) translate(${-plateW / 2} 0)`}>
          <rect width={plateW} height="26" rx="13" fill={INK.indigoDeep} fillOpacity=".55" stroke={INK.yellow} strokeOpacity=".35" strokeWidth="1" />
          <text x={plateW / 2} y="17.5" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fillOpacity=".92">
            {label}
          </text>
        </g>
        {!visited && (
          <g transform={`translate(${w - 14} 18) scale(${Math.min(plateScale, 3)})`}>
            <circle r="14" fill={INK.yellow} stroke={INK.indigoDeep} strokeWidth="2.5" />
            <path d="M0-7l2.1 4.9L7-2.1 2.1 0 0 4.9-2.1 0-7-2.1l4.9-.5z" fill={INK.indigoDeep} />
          </g>
        )}
      </g>
    );
  return (
    <g
      className="hotspot"
      role="button"
      tabIndex={0}
      aria-label={`Go into ${label}${visited ? "" : " (not visited yet)"}`}
      onClick={() => onOpen(id)}
      onKeyDown={onKey}
      transform={`translate(${x} ${y})`}
    >
      <rect className="ring" x="-6" y="-6" width={w + 12} height={h + 54} rx="18" fill="transparent" />
      <ellipse cx={w / 2} cy={h - 6} rx={w * 0.42} ry="14" fill="rgb(0 0 0 / 35%)" />
      <g className="bld">
        <image href={art} width={w} height={h} preserveAspectRatio="xMidYMax meet" />
      </g>
    </g>
  );
}

function Diamond({ x, y, w, h, ...rest }: { x: number; y: number; w: number; h: number } & SVGProps<SVGPathElement>) {
  return <path d={`M${x} ${y - h / 2} L${x + w / 2} ${y} L${x} ${y + h / 2} L${x - w / 2} ${y}Z`} {...rest} />;
}

export function CityMap({
  onOpen,
  visited,
  onVisited,
  notify,
  onDistrict,
  avatar,
  nickname,
  onApp,
}: {
  /** Open a phone app (a venue like the school can). */
  onApp?: (app: "academy") => void;
  onOpen: (id: LocationKey) => void;
  visited: Set<string>;
  /** A shop visit happened (quest progress may have moved). */
  onVisited: () => void;
  notify: (msg: string) => void;
  /** An open district was tapped. */
  onDistrict: (name: string) => void;
  avatar: AvatarConfig;
  nickname: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [neighbours, setNeighbours] = useState<NeighbourShop[]>([]);
  const [peek, setPeek] = useState<NeighbourShop | null>(null);
  const [visiting, setVisiting] = useState<string | null>(null);
  const [boards, setBoards] = useState<BillboardView[]>([]);
  const [boardSheet, setBoardSheet] = useState<{ key: string | null } | null>(null);
  const [tick, setTick] = useState(0);
  const [walkTo, setWalkTo] = useState<Trip | null>(null);
  /** Where the player is now (kept by AvatarWalker), for pricing rides. */
  const meAt = useRef({ x: CX - 120, y: CY + 150 });
  // The camera follows you while you walk or ride: when you near the edge of the screen it glides to keep you in view.
  const [travelling, setTravelling] = useState(false);
  const pzRef = useRef<ReturnType<typeof usePanZoom> | null>(null);
  useEffect(() => {
    if (walkTo) setTravelling(true);
  }, [walkTo?.seq]);
  useEffect(() => {
    if (!travelling) return;
    const id = window.setInterval(() => {
      const pz = pzRef.current;
      if (!pz) return;
      const v = pz.view;
      const el = ref.current;
      if (!v || !el) return;
      const sx = meAt.current.x * v.k + v.x;
      const sy = meAt.current.y * v.k + v.y;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (sx < w * 0.25 || sx > w * 0.75 || sy < h * 0.3 || sy > h * 0.75) pz.flyTo(meAt.current.x, meAt.current.y - 40, v.k);
    }, 500);
    return () => window.clearInterval(id);
  }, [travelling]);
  const [ridePick, setRidePick] = useState<{ x: number; y: number; units: number; to: string; venue?: string } | null>(null);
  const [stopFor, setStopFor] = useState<{ rideId: string; done: () => void } | null>(null);
  /** A place to open on arrival (trips started from its card). */
  const arriveAt = useRef<string | null>(null);

  /** Go somewhere: short hops just walk; longer trips offer a ride. */
  const goTo = (to: { x: number; y: number }, label: string, venue?: string) => {
    const route = walkRoute(meAt.current, to);
    if (!route) return notify("You can't walk on water. Take the bridge to the Island.");
    let units = 0;
    // Fares go by the distance along the roads (the way the ride will actually go).
    (roadRoute(meAt.current, to) ?? route).reduce((a, b) => ((units += Math.hypot(b.x - a.x, b.y - a.y)), b), meAt.current);
    arriveAt.current = venue ?? null;
    if (units < RIDE_PICK_FROM) setWalkTo({ ...to, seq: Date.now(), mode: "walk" });
    else setRidePick({ ...to, units: Math.round(units), to: label, venue });
  };
  const ride = async (mode: RideMode | "own", vehicle?: VehicleKind) => {
    const pick = ridePick!;
    if (mode === "own") {
      const r = await api<RideStart>("POST", "/api/game/rides", { mode, vehicle, units: Math.min(pick.units, MAX_RIDE_UNITS) });
      setRidePick(null);
      onVisited();
      notify(`Driving to ${pick.to}: ${formatCoins(r.fare)} coins of fuel`);
      setWalkTo({ x: pick.x, y: pick.y, seq: Date.now(), mode, vehicle, rideId: r.rideId, stop: r.stop });
      return;
    }
    if (mode === "walk") {
      setRidePick(null);
      setWalkTo({ x: pick.x, y: pick.y, seq: Date.now(), mode });
      return;
    }
    const r = await api<RideStart>("POST", "/api/game/rides", { mode, units: Math.min(pick.units, MAX_RIDE_UNITS) });
    setRidePick(null);
    onVisited();
    notify(`${RIDE_BY_MODE.get(mode)!.label} to ${pick.to}: ${formatCoins(r.fare)} coins`);
    setWalkTo({ x: pick.x, y: pick.y, seq: Date.now(), mode, rideId: r.rideId, stop: r.stop });

  };
  const [venueOpen, setVenueOpen] = useState<string | null>(null);
  // A shared plot link (?plot=<id>) opens that plot's card.
  const [landOpen, setLandOpen] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get("plot");
    } catch {
      return null;
    }
  });
  const [landList, setLandList] = useState(false);
  const [overview, setOverview] = useState(false);
  // "Go fix it" from the needs panel opens a place's card here.
  useEffect(() => {
    const open = (e: Event) => setVenueOpen((e as CustomEvent<string>).detail);
    window.addEventListener("hc:open-venue", open);
    return () => window.removeEventListener("hc:open-venue", open);
  }, []);
  // Real businesses with a building on a plot (free in the beta).
  const [mapBiz, setMapBiz] = useState<MapBusiness[]>([]);
  const [bizOpen, setBizOpen] = useState<MapBusiness | null>(null);
  const loadMapBiz = () =>
    api<MapBusiness[]>("GET", "/api/map/businesses")
      .then(setMapBiz)
      .catch(() => undefined);
  useEffect(() => {
    void loadMapBiz();
  }, []);
  const bizByPlot = new Map(mapBiz.map((b) => [b.plotId, b]));
  // Homes: yours (starter room or your own plot) and other players' houses on their plots.
  const [home, setHome] = useState<HomeView | null>(null);
  const [homes, setHomes] = useState<MapHome[]>([]);
  const [homeOpen, setHomeOpen] = useState(false);
  /** One of your other plots (land or a house that isn't home). */
  const [plotOpen, setPlotOpen] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<VehicleKind[]>([]);
  const loadHomes = () => {
    api<HomeView>("GET", "/api/game/home")
      .then(setHome)
      .catch(() => undefined);
    api<MapHome[]>("GET", "/api/map/homes")
      .then(setHomes)
      .catch(() => undefined);
    api<VehicleKind[]>("GET", "/api/game/vehicles")
      .then(setVehicles)
      .catch(() => undefined);
  };
  useEffect(() => {
    loadHomes();
  }, []);
  const homeByPlot = new Map(homes.map((h) => [h.plotId, h]));
  // Other players online (presence), whoever's card is open, and a house you're visiting.
  const [others, setOthers] = useState<PresencePlayer[]>([]);
  const [playerOpen, setPlayerOpen] = useState<PresencePlayer | null>(null);
  const [visitHome, setVisitHome] = useState<MapHome | null>(null);
  const room = starterRoom(nickname);
  const myPlot = home?.plotId ? FOR_SALE.find((p) => p.id === home.plotId) : undefined;
  /** Where you are for other players: inside a place or a home, or out in the city. */
  const place = homeOpen ? `home:${home?.plotId ?? `room-${nickname}`}` : visitHome ? `home:${visitHome.plotId}` : venueOpen;
  const placeRef = useRef(place);
  const unreadRef = useRef(0);
  placeRef.current = place;
  useEffect(() => {
    let stop = false;
    const report = () => {
      if (document.visibilityState !== "visible") return;
      api<PresenceReply>("POST", "/api/presence", { x: Math.round(meAt.current.x), y: Math.round(meAt.current.y), place: placeRef.current ?? null })
        .then((r) => {
          if (stop) return;
          setOthers(r.players);
          if (r.unread > unreadRef.current) notify(`💬 New message${r.unread - unreadRef.current > 1 ? "s" : ""}: Phone → Chats`);
          unreadRef.current = r.unread;
          for (const p of r.pings)
            notify(p.kind === "wave" ? `👋 @${p.from} waved at you` : p.kind === "drink" ? `🍻 @${p.from} bought you a drink! +Social +Fun` : p.kind === "invite" ? `🏠 @${p.from} invited you to their house. Tap them on the map, then Visit their home.` : `🎉 @${p.from}: ${p.text ?? "doing something"}. Join in for a together bonus!`);
          if (r.pings.some((p) => p.kind === "drink")) onVisited();
        })
        .catch(() => undefined);
    };
    report();
    const id = window.setInterval(report, 5000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [place]);
  /** Where "home" is: your plot, or your room in the face-me block. */
  const homeSpot = myPlot ? { x: myPlot.x, y: myPlot.y + myPlot.hh } : { x: room.x, y: room.y + 30 };
  useEffect(() => {
    api<BillboardView[]>("GET", "/api/billboards")
      .then(setBoards)
      .catch(() => setBoards([]));
  }, []);
  useEffect(() => {
    api<NeighbourShop[]>("GET", "/api/game/neighbours")
      .then(setNeighbours)
      .catch(() => setNeighbours([]));
  }, []);
  // Home view: the junction plus the ring of player shops around it.
  // Phones get a closer start (the junction and its places), so buildings show instead of the far view.
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;
  // A shared link can open the map on an area: ?at=lekki-gardens (district names in lower case with dashes).
  const at = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("at") : null;
  const xy = at && /^\d+,\d+$/.test(at) ? { x: Number(at.split(",")[0]), y: Number(at.split(",")[1]) } : undefined;
  const spot = xy ?? (at ? DISTRICTS.find((d) => d.name.toLowerCase().replace(/\s+/g, "-") === at) : undefined);
  // Open the map where you are (your last spot), unless a link points somewhere.
  const lastSpot = (() => {
    try {
      const v = JSON.parse(localStorage.getItem("hc_avatar_pos") ?? "null") as { x: number; y: number } | null;
      return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? v : null;
    } catch {
      return null;
    }
  })();
  const centre = spot ?? lastSpot ?? { x: CX, y: CY + 60 };
  const HOME = narrow ? { x: centre.x - 430, y: centre.y - 580, w: 860, h: 1100 } : { x: centre.x - 680, y: centre.y - 680, w: 1360, h: 1420 };
  const pz = usePanZoom(ref, { minK: 0.05, maxK: 4, home: HOME, bounds: WORLD });
  pzRef.current = pz;

  // Banners take turns every 15 s. Each turn counts a view for boards actually on screen (close enough to
  // read, tab visible); counts are sent in batches every minute for advertiser reports.
  const viewsRef = useRef<Record<string, number>>({});
  const viewRef = useRef(pz.view);
  viewRef.current = pz.view;
  const boardsRef = useRef(boards);
  boardsRef.current = boards;
  useEffect(() => {
    let turn = 0;
    const rotate = window.setInterval(() => {
      const next = ++turn;
      setTick(next);
      {
        const v = viewRef.current;
        const el = ref.current;
        if (v && el && v.k >= 0.3 && document.visibilityState === "visible") {
          const [x0, y0] = [-v.x / v.k, -v.y / v.k];
          const [x1, y1] = [(el.clientWidth - v.x) / v.k, (el.clientHeight - v.y) / v.k];
          for (const spot of BILLBOARD_SPOTS) {
            const b = boardsRef.current.find((bb) => bb.key === spot.key);
            if (!b?.ads.length || spot.x < x0 || spot.x > x1 || spot.y < y0 || spot.y - 300 > y1) continue;
            const ad = b.ads[next % b.ads.length]!;
            viewsRef.current[ad.id] = (viewsRef.current[ad.id] ?? 0) + 1;
          }
        }
      }
    }, AD_ROTATE_SECONDS * 1000);
    const flush = window.setInterval(() => {
      const views = viewsRef.current;
      if (!Object.keys(views).length) return;
      viewsRef.current = {};
      void api("POST", "/api/billboards/views", { views }).catch(() => undefined);
    }, 60_000);
    return () => {
      window.clearInterval(rotate);
      window.clearInterval(flush);
    };
  }, []);
  const k = pz.view?.k ?? 1;
  const world = pz.view ? `translate(${pz.view.x} ${pz.view.y}) scale(${k})` : undefined;
  // Only draw what is on screen (with a margin; tall art stands above its foot, so more below).
  const box = pz.view && ref.current ? { x0: -pz.view.x / k - 350, y0: -pz.view.y / k - 250, x1: (ref.current.clientWidth - pz.view.x) / k + 350, y1: (ref.current.clientHeight - pz.view.y) / k + 650 } : null;
  const inView = (x: number, y: number) => !box || (x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1);
  const plateScale = readable(k, 20, 14);
  // District names: big signs when zoomed out to find your way; up close a small pill (about 13 px) that doesn't
  // cover the streets and buildings you're looking at.
  const districtNear = k >= 0.45;
  const districtScale = districtNear ? 13 / (56 * k) : readable(k, 56, 16, 20);
  const far = k < 0.3;
  const light = useLagosLight();
  // Weather: the same for everyone; re-checked every minute.
  // Events on now and areas without light: re-checked every minute (the clock tick above re-renders too).
  const [tickNow, setTickNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setTickNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const liveEvents = eventsOn(tickNow);
  const liveAt = (venueKey: string) => liveEvents.find((e) => e.venues.includes(venueKey));
  const dark = new Set(areasWithoutLight(tickNow));
  /** The area a point belongs to (nearest area centre). */
  const areaOf = (x: number, y: number) => DISTRICTS.reduce((b, d) => (Math.hypot(d.x - x, d.y - y) < Math.hypot(b.x - x, b.y - y) ? d : b)).name;
  const lit = (x: number, y: number) => !dark.has(areaOf(x, y));
  // (?weather=rain pins it, for screenshots, like ?hour=.)
  const pinnedWeather = (() => {
    try {
      return new URLSearchParams(window.location.search).get("weather") as Weather | null;
    } catch {
      return null;
    }
  })();
  const [weather, setWeather] = useState<Weather>(() => pinnedWeather ?? weatherAt(new Date()));
  useEffect(() => {
    if (pinnedWeather) return;
    const id = window.setInterval(() => setWeather(weatherAt(new Date())), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Everything that stands up on the buildings layer, with its foot point for depth order.
  const depthItems: DepthItem[] = [];
  for (const o of WORLD_OBJECTS) {
    // Zoomed far out, only each area's signature buildings are drawn (hundreds of houses would be dots anyway).
    if (!inView(o.x, o.y) || (far && (o.type !== "building" || !o.landmark))) continue;
    let node: ReactNode;
    const branch = o.type === "building" ? BRANCH_BY_BUILDING.get(o.key) : undefined;
    if (o.type === "building" && !myPlot && o.key === room.key) {
      depthItems.push({
        key: o.key,
        y: o.y,
        node: (
          <g className="hotspot venue" role="button" tabIndex={0} aria-label="Your room. Open." onClick={() => !pz.wasDragged() && setHomeOpen(true)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setHomeOpen(true))}>
            <image href={o.art} x={o.box.x} y={o.box.y} width={o.box.w} height={o.box.h} />
          </g>
        ),
      });
      continue;
    }
    if (branch && o.type === "building")
      // A branch (a repeated buka, salon, hotel…): tap it to go in.
      node = (
        <g className="hotspot venue" role="button" tabIndex={0} aria-label={`${branch.name}, ${branch.area}. Open.`} onClick={() => !pz.wasDragged() && setVenueOpen(branch.key)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setVenueOpen(branch.key))}>
          <image href={o.art} x={o.box.x} y={o.box.y} width={o.box.w} height={o.box.h} />
        </g>
      );
    else if (o.type === "building" || o.type === "prop") node = <image href={o.art} x={o.box.x} y={o.box.y} width={o.box.w} height={o.box.h} aria-hidden="true" />;
    else {
      const n = NATURE[o.kind];
      const b = n ? propBox(n.art, o.x, o.y + 10, n.w) : null;
      node = (
        <g aria-hidden="true">
          <ellipse cx={o.x + 10} cy={o.y} rx="46" ry="14" fill="rgb(0 0 0 / 22%)" />
          {n && b ? (
            <image href={n.art} x={b.x} y={b.y} width={b.w} height={b.h} />
          ) : o.kind === "bush" ? (
            <use href="#bush" x={o.x - 36} y={o.y - 36} width="72" height="40" />
          ) : (
            <use href="#palm" x={o.x - 60} y={o.y - TREE_H.palm} width="120" height={TREE_H.palm + 5} />
          )}
        </g>
      );
    }
    depthItems.push({ key: o.key, y: o.y, node });
  }
  if (!far) {
    depthItems.push({
      key: "park",
      y: PARK.y + PARK.h,
      node: <image href="/art/city-park.webp" x={PARK.x} y={PARK.y} width={PARK.w} height={PARK.h} preserveAspectRatio="xMidYMax meet" aria-hidden="true" />,
    });
    for (const pl of PLACES)
      depthItems.push({ key: `place-${pl.id}`, y: pl.y + pl.h, node: <Hotspot part="body" {...pl} visited={visited.has(pl.id)} plateScale={plateScale} onOpen={(id) => !pz.wasDragged() && onOpen(id)} /> });
    for (const spot of VENUE_SPOTS) {
      const v = VENUES_BY_KEY.get(spot.key);
      if (v && inView(spot.x, spot.y))
        depthItems.push({ key: `venue-${spot.key}`, y: spot.y, node: <VenueBuilding venue={v} x={spot.x} y={spot.y} scale={spot.scale} onOpen={() => !pz.wasDragged() && setVenueOpen(v.key)} /> });
    }
    for (const l of FOR_SALE) {
      if (!inView(l.x, l.y)) continue;
      const owned = homeByPlot.get(l.id);
      if (owned && !owned.design) {
        // Land a player bought but hasn't built on yet: a fenced plot with a sold sign.
        const open = () => !pz.wasDragged() && (owned.mine ? setPlotOpen(l.id) : undefined);
        depthItems.push({
          key: `land-${l.id}`,
          y: l.y + l.hh,
          node: (
            <g className={owned.mine ? "hotspot land-plot" : undefined} role={owned.mine ? "button" : undefined} aria-label={owned.mine ? "Your land. Open." : `@${owned.nickname}'s land`} onClick={open}>
              <Diamond x={l.x} y={l.y} w={l.hh * 4} h={l.hh * 2} fill={owned.mine ? "rgb(255 199 44 / 22%)" : "rgb(90 169 255 / 14%)"} stroke={owned.mine ? "#ffc72c" : "#5aa9ff"} strokeWidth="4" />
              <image href="/art/props/for-sale-sign.webp" x={l.x - l.hh * 0.6 - 40} y={l.y + l.hh * 0.25 - 87} width="82" height="89" opacity=".85" />
            </g>
          ),
        });
        continue;
      }
      if (owned) {
        // A player's house on their own plot.
        const scale = l.hh / 60;
        const foot = l.y + siteOf(scale).lift;
        const art = `/art/buildings/${HOUSE_BY_KEY.get(owned.design ?? "")?.art ?? "bungalow"}.webp`;
        const openMine = () => (owned.isHome ? setHomeOpen(true) : setPlotOpen(l.id));
        const box = buildingBox(art, l.x, foot, scale);
        depthItems.push({
          key: `home-${l.id}`,
          y: foot,
          node: owned.mine ? (
            <g className="hotspot venue" role="button" tabIndex={0} aria-label={owned.isHome ? "Your home. Open." : "Your house. Open."} onClick={() => !pz.wasDragged() && openMine()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openMine())}>
              <ellipse cx={l.x} cy={foot} rx={box.w * 0.42} ry={box.w * 0.09} fill="rgb(0 0 0 / 28%)" />
              <image href={art} x={box.x} y={box.y} width={box.w} height={box.h} />
            </g>
          ) : (
            <g className="hotspot venue" role="button" tabIndex={0} aria-label={`@${owned.nickname}'s home. Visit.`} onClick={() => !pz.wasDragged() && setVisitHome(owned)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setVisitHome(owned))}>
              <ellipse cx={l.x} cy={foot} rx={box.w * 0.42} ry={box.w * 0.09} fill="rgb(0 0 0 / 28%)" />
              <image href={art} x={box.x} y={box.y} width={box.w} height={box.h} />
            </g>
          ),
        });
        continue;
      }
      const biz = bizByPlot.get(l.id);
      if (biz) {
        // A real business's building, standing on its plot.
        const scale = l.hh / 60;
        const foot = l.y + siteOf(scale).lift;
        const art = businessArt(biz.category);
        const box = buildingBox(art, l.x, foot, scale);
        depthItems.push({
          key: `biz-${l.id}`,
          y: foot,
          node: (
            <g className="hotspot venue" role="button" tabIndex={0} aria-label={`${biz.name}, a real business. Open.`} onClick={() => !pz.wasDragged() && setBizOpen(biz)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setBizOpen(biz))}>
              <ellipse cx={l.x} cy={foot} rx={box.w * 0.42} ry={box.w * 0.09} fill="rgb(0 0 0 / 28%)" />
              <image href={art} x={box.x} y={box.y} width={box.w} height={box.h} />
            </g>
          ),
        });
        continue;
      }
      depthItems.push({
          key: `sale-${l.id}`,
          y: l.y + l.hh,
          node: (
            <g className="hotspot land-plot" role="button" tabIndex={0} aria-label={`Land for sale in ${l.area}. Open.`} onClick={() => !pz.wasDragged() && setLandOpen(l.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setLandOpen(l.id))}>
              <Diamond x={l.x} y={l.y} w={l.hh * 4} h={l.hh * 2} fill={landOpen === l.id ? "rgb(255 199 44 / 30%)" : "rgb(255 255 255 / 10%)"} stroke="#f2c14e" strokeWidth="3" strokeDasharray="12 9" />
              <image href="/art/props/for-sale-sign.webp" x={l.x - l.hh * 0.6 - 40} y={l.y + l.hh * 0.25 - 87} width="82" height="89" />
            </g>
          ),
        });
    }
    PLOTS.forEach((p, i) => {
      const shop = neighbours[i];
      if (!shop) return;
      depthItems.push({
        key: `plot-${i}`,
        y: p.y + 45,
        node: (
          <g
            className="hotspot"
            role="button"
            tabIndex={0}
            aria-label={`${shop.isMe ? "Your shop" : `${shop.nickname}'s shop`}: ${shop.shopName}`}
            onClick={() => !pz.wasDragged() && setPeek(shop)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                setPeek(shop);
              }
            }}
          >
            <Diamond x={p.x} y={p.y} w={240} h={120} fill={shop.isMe ? "rgb(255 199 44 / 30%)" : "rgb(255 255 255 / 16%)"} stroke={shop.isMe ? "#ffc72c" : "#8c6a3e"} strokeWidth="2" />
            <g className="bld">
              <image href={HUSTLE_ART[shop.hustle] ?? HUSTLE_ART.trader} x={p.x - 90} y={p.y + 45 - 150} width="180" height="150" preserveAspectRatio="xMidYMax meet" />
            </g>
          </g>
        ),
      });
    });
  }

  const open = (id: LocationKey) => {
    if (!pz.wasDragged()) onOpen(id);
  };

  return (
    <div className="map map-frame">
      <div
        ref={ref}
        className="map-viewport"
        tabIndex={0}
        role="application"
        aria-roledescription="map"
        aria-label="New Lagos map. Drag or use arrow keys to move, plus and minus to zoom, 0 to recentre. Tap the ground to walk there. Tab to the places."
        {...pz.handlers}
      >
        {/* Three stacked layers with one view transform: the ground and roads, the moving traffic and walkers,
            then buildings, people's shops and labels. Only the thin middle layer repaints while things move. */}
        <svg className="map-layer" aria-hidden="true">
          <defs>
            {/* Laterite sand: speckles of lighter and darker grains. */}
            <pattern id="sand" width="90" height="90" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="18" r="2.2" fill="#b98e58" />
              <circle cx="58" cy="9" r="1.6" fill="#e3c590" />
              <circle cx="40" cy="52" r="2.6" fill="#b48853" />
              <circle cx="78" cy="66" r="1.8" fill="#e6caa0" />
              <circle cx="22" cy="74" r="1.4" fill="#a97f4c" />
              <circle cx="70" cy="34" r="1.2" fill="#9c7444" />
            </pattern>
            {/* Cartoon trees with dark outlines, to sit with the Stitch art (until tree art arrives). */}
            <symbol id="tree" viewBox="0 0 120 145">
              <path d="M55 92h10l3 50H52z" fill="#6b4423" stroke="#2a1a0c" strokeWidth="3" strokeLinejoin="round" />
              <g stroke="#1d2a14" strokeWidth="3">
                <circle cx="34" cy="78" r="26" fill="#2f7a34" />
                <circle cx="86" cy="76" r="27" fill="#2f7a34" />
                <circle cx="60" cy="62" r="36" fill="#3f8f3a" />
                <circle cx="58" cy="34" r="25" fill="#4fa043" />
              </g>
              <circle cx="50" cy="28" r="9" fill="#7cc65a" />
              <circle cx="78" cy="58" r="7" fill="#6db84f" />
            </symbol>
            <symbol id="palm" viewBox="0 0 120 170">
              <path d="M54 168c2-40 4-80 10-118l9 2c-5 38-7 76-8 116z" fill="#8a5a2f" stroke="#2a1a0c" strokeWidth="3" strokeLinejoin="round" />
              <path d="M57 140h9M58 115h9M60 90h9M62 66h8" stroke="#5a3a1c" strokeWidth="2.5" />
              <g fill="#3f8f3a" stroke="#1d2a14" strokeWidth="3" strokeLinejoin="round">
                <path d="M68 50C50 30 26 30 6 46c22-4 40 0 58 10z" />
                <path d="M68 50c18-20 42-20 62-4-22-4-40 0-58 10z" />
                <path d="M68 50C60 26 44 12 24 8c16 12 28 26 38 46z" />
                <path d="M68 50c6-24 22-40 42-44-14 12-26 28-34 48z" />
                <path d="M68 50C52 58 40 74 34 96c12-18 24-30 38-40z" fill="#2f7a34" />
                <path d="M68 50c16 8 28 24 34 46-12-18-24-30-38-40z" fill="#2f7a34" />
              </g>
              <circle cx="66" cy="52" r="6" fill="#6b4423" stroke="#2a1a0c" strokeWidth="2" />
            </symbol>
            {/* Mango: a dense, dark round crown on a short trunk */}
            <symbol id="mango" viewBox="0 0 130 140">
              <path d="M58 96h12l3 42H55z" fill="#5a3a1c" stroke="#2a1a0c" strokeWidth="3" strokeLinejoin="round" />
              <g stroke="#14240f" strokeWidth="3">
                <ellipse cx="65" cy="62" rx="58" ry="46" fill="#1f5e2a" />
                <ellipse cx="45" cy="50" rx="28" ry="22" fill="#2b7434" />
                <ellipse cx="82" cy="44" rx="26" ry="20" fill="#2b7434" />
              </g>
              <circle cx="52" cy="72" r="5" fill="#e9a23b" />
              <circle cx="88" cy="70" r="5" fill="#e9a23b" />
            </symbol>
            {/* Almond (umbrella) tree: flat tiers of leaves, the Lagos compound shade tree */}
            <symbol id="almond" viewBox="0 0 140 150">
              <path d="M66 70h8l2 78H64z" fill="#6b4423" stroke="#2a1a0c" strokeWidth="3" strokeLinejoin="round" />
              <g stroke="#1d2a14" strokeWidth="3" strokeLinejoin="round">
                <path d="M8 96q62-26 124 0q-62 16-124 0z" fill="#3f8f3a" />
                <path d="M22 68q48-22 96 0q-48 14-96 0z" fill="#4fa043" />
                <path d="M38 42q32-16 64 0q-32 11-64 0z" fill="#62b14f" />
              </g>
            </symbol>
            {/* Bush: a low clump of shrubs */}
            <symbol id="bush" viewBox="0 0 90 50">
              <g stroke="#1d2a14" strokeWidth="3">
                <ellipse cx="26" cy="32" rx="22" ry="16" fill="#2f7a34" />
                <ellipse cx="62" cy="31" rx="24" ry="17" fill="#2f7a34" />
                <ellipse cx="44" cy="22" rx="24" ry="17" fill="#3f8f3a" />
              </g>
              <circle cx="36" cy="18" r="3" fill="#e2557a" />
              <circle cx="58" cy="24" r="3" fill="#e2557a" />
            </symbol>
            <pattern id="grass-blades" width="24" height="16" patternUnits="userSpaceOnUse">
              <path d="M4 14l2-8 2 8M14 12l1-7 2 7" fill="none" stroke="#3c7a2e" strokeWidth="1.6" />
            </pattern>
            {/* Cartoon water (Stitch export 13), tiled */}
            <pattern id="water-tex" width="1100" height="502" patternUnits="userSpaceOnUse">
              <image href="/art/nature/water.webp" width="1100" height="502" />
            </pattern>
            <pattern id="waves" width="160" height="56" patternUnits="userSpaceOnUse">
              <path d="M0 28q40-22 80 0t80 0" fill="none" stroke="#9fd3e8" strokeOpacity=".3" strokeWidth="5" />
            </pattern>
            <radialGradient id="sand-shade" cx="50%" cy="50%" r="60%">
              <stop offset="0.55" stopColor="#5a3d1c" stopOpacity="0" />
              <stop offset="1" stopColor="#5a3d1c" stopOpacity=".38" />
            </radialGradient>
            <radialGradient id="lamp-pool">
              <stop offset="0" stopColor="#ffd98a" stopOpacity=".5" />
              <stop offset=".55" stopColor="#ffb547" stopOpacity=".16" />
              <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="lamp-head">
              <stop offset="0" stopColor="#fffbe6" stopOpacity=".95" />
              <stop offset=".35" stopColor="#ffe7a3" stopOpacity=".55" />
              <stop offset="1" stopColor="#ffcf6e" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="window-glow">
              <stop offset="0" stopColor="#ffcf6e" stopOpacity=".42" />
              <stop offset=".6" stopColor="#ff9f3a" stopOpacity=".1" />
              <stop offset="1" stopColor="#ff9f3a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="glow-centre" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#e4c48e" />
              <stop offset="1" stopColor="#cfa874" stopOpacity="0" />
            </radialGradient>
          </defs>
          {pz.view && (
            <g transform={world}>
              <rect width={WORLD.w} height={WORLD.h} fill="#cfa874" />
              <rect width={WORLD.w} height={WORLD.h} fill="url(#sand)" />
              <ellipse cx={CX} cy={CY} rx="1400" ry="800" fill="url(#glow-centre)" />
              <rect width={WORLD.w} height={WORLD.h} fill="url(#sand-shade)" />

              {/* Lagoon, harbour and sea, then the Island on top */}
              <path d={WATER_PATH} fill="#2f7ea6" />
              {!far && <path d={WATER_PATH} fill="url(#water-tex)" />}
              {far && <path d={WATER_PATH} fill="url(#waves)" />}
              {/* The open Atlantic: the same water, deeper */}
              <path d={OCEAN_PATH} fill="rgb(12 40 86 / 34%)" />
              <path d={SHORE_PATH} fill="none" stroke="#e9f4f6" strokeOpacity=".55" strokeWidth="10" strokeLinecap="round" />
              <path d={ISLAND_PATH} fill="#d6b27e" stroke="#e9f4f6" strokeOpacity=".55" strokeWidth="10" />
              <path d={ISLAND_PATH} fill="url(#sand)" />
              <path d={BEACH_PATH} fill="#f0dcae" />
              {!far && (
                <g aria-hidden="true">
                  <text x="7800" y="4200" textAnchor="middle" fontSize="64" fontWeight="800" fontStyle="italic" fill="#cfe9f6" opacity=".8">
                    Lagos Lagoon
                  </text>
                  <text x="3000" y="6500" textAnchor="middle" fontSize="72" fontWeight="800" fontStyle="italic" fill="#cfe9f6" opacity=".8">
                    Atlantic Ocean
                  </text>
                </g>
              )}

              {/* Forest floor: dark green ground under the forest reserves (their trees are on the buildings layer) */}
              {FORESTS.map((f) => (
                <path key={f.name} d={f.path} fill="#3f6e33" stroke="#3f6e33" strokeWidth="90" strokeLinejoin="round" opacity=".9" />
              ))}
              {/* Airport: apron, taxiway and runway (centre line dashes, threshold bars at both ends) */}
              <path d={isoRect(RUNWAY.apron.a0, RUNWAY.apron.a1, RUNWAY.apron.b0, RUNWAY.apron.b1)} fill="#8f949b" stroke="#6d7279" strokeWidth="4" />
              <path d={isoRect(RUNWAY.a0, RUNWAY.a1, RUNWAY.taxiB - RUNWAY.taxiHalf, RUNWAY.taxiB + RUNWAY.taxiHalf)} fill="#4a4743" />
              <path d={isoRect(RUNWAY.a0 + 300, RUNWAY.a0 + 340, RUNWAY.apron.b1, RUNWAY.taxiB)} fill="#4a4743" />
              <path d={isoRect(RUNWAY.a1 - 340, RUNWAY.a1 - 300, RUNWAY.apron.b1, RUNWAY.taxiB)} fill="#4a4743" />
              <path d={isoRect(RUNWAY.a0, RUNWAY.a1, RUNWAY.b - RUNWAY.half, RUNWAY.b + RUNWAY.half)} fill="#3d3a37" stroke="#e8e2d0" strokeWidth="4" />
              {(() => {
                const [p, q] = [iso(RUNWAY.a0 + 160, RUNWAY.b), iso(RUNWAY.a1 - 160, RUNWAY.b)];
                return <path d={`M${p.x} ${p.y} L${q.x} ${q.y}`} stroke="#f4f1e8" strokeWidth="6" strokeDasharray="60 40" />;
              })()}
              {[RUNWAY.a0 + 30, RUNWAY.a1 - 110].map((a0) =>
                [-48, -24, 0, 24, 48].map((db) => <path key={`${a0}-${db}`} d={isoRect(a0, a0 + 80, RUNWAY.b + db - 6, RUNWAY.b + db + 6)} fill="#f4f1e8" />),
              )}

              {/* Grass patches: flat on the ground, under the roads and buildings */}
              {!far &&
                GRASS.filter((g) => inView(g.x, g.y)).map((g) => (
                  <g key={g.key}>
                    <ellipse cx={g.x} cy={g.y} rx={g.r} ry={g.r / 2} fill="#6fa64a" opacity=".75" />
                    <ellipse cx={g.x} cy={g.y} rx={g.r} ry={g.r / 2} fill="url(#grass-blades)" />
                  </g>
                ))}

              {/* Third Mainland Bridge pillars sit in the water under the deck */}
              {PILLARS.map((p) => (
                <rect key={p.key} x={p.x - 9} y={p.y + HALF - 4} width="18" height="70" rx="4" fill="#8a8f98" stroke="#5d626b" strokeWidth="2" />
              ))}

              {/* Roads as continuous centre lines, stroked in layers: pavement edge, pavement, laterite shoulder,
                  kerb, then asphalt. Every junction and every turn merges cleanly because all kerbs sit under
                  all asphalt. Turns (Tech Mile onto Third Mainland Bridge, the Eko Bridge fork) are curves. */}
              {(() => {
                const roads = ROAD_PATHS.filter((p) => p.kind === "road");
                const bridges = ROAD_PATHS.filter((p) => p.kind === "bridge");
                const streets = far ? [] : ROAD_PATHS.filter((p) => p.kind === "street");
                const alleys = far ? [] : ROAD_PATHS.filter((p) => p.kind === "alley");
                const line = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
                return (
                  <g aria-hidden="true">
                    {!far && DRIVEWAYS.filter((d) => inView(d.x0, d.y0)).map((d, i) => <path key={i} d={`M${d.x0} ${d.y0} L${d.x1} ${d.y1}`} stroke="#9a8f7c" strokeWidth="26" />)}
                    {roads.map((r) => <path key={`pe-${r.id}`} d={r.d} {...line} stroke="#b9a782" strokeWidth={strokeFor(HALF + PAVEMENT) + 5} />)}
                    {roads.map((r) => <path key={`pv-${r.id}`} d={r.d} {...line} stroke="#d6c7a5" strokeWidth={strokeFor(HALF + PAVEMENT)} />)}
                    {/* Alleys: packed laterite lanes, no pavement */}
                    {alleys.map((r) => <path key={`al-${r.id}`} d={r.d} {...line} stroke="#b4895a" strokeWidth={strokeFor(r.half!)} />)}
                    {streets.map((r) => <path key={`spv-${r.id}`} d={r.d} {...line} stroke="#cdbd9c" strokeWidth={strokeFor(r.half! + r.pav!)} />)}
                    {!far && STREET_ENDS.map((p) => <ellipse key={`sec-${p.key}`} cx={p.x} cy={p.y} rx={(p.half + p.pav) * 2.2} ry={p.half + p.pav + 6} fill="#cdbd9c" />)}
                    {roads.map((r) => <path key={`lt-${r.id}`} d={r.d} {...line} stroke="#a8653a" strokeWidth={strokeFor(HALF + 9)} />)}
                    {bridges.map((r) => <path key={`bf-${r.id}`} d={r.d} {...line} stroke="#9aa0a8" strokeWidth={strokeFor(HALF + 14)} strokeLinecap="butt" />)}
                    {/* kerbs: a slightly wider stroke under the asphalt */}
                    {roads.map((r) => <path key={`kb-${r.id}`} d={r.d} {...line} stroke="#e6d6b4" strokeWidth={strokeFor(HALF) + 8} />)}
                    {bridges.map((r) => <path key={`rl-${r.id}`} d={r.d} {...line} stroke="#cfd3d8" strokeWidth={strokeFor(HALF) + 14} strokeLinecap="butt" />)}
                    {streets.map((r) => <path key={`skb-${r.id}`} d={r.d} {...line} stroke="#d9c9a6" strokeWidth={strokeFor(r.half!) + 6} />)}
                    {!far && STREET_ENDS.map((p) => <ellipse key={`sek-${p.key}`} cx={p.x} cy={p.y} rx={p.half * 2.4 + 4} ry={p.half + 7} fill="#d9c9a6" />)}
                    {/* asphalt */}
                    {streets.map((r) => <path key={`sas-${r.id}`} d={r.d} {...line} stroke="#5c564f" strokeWidth={strokeFor(r.half!)} />)}
                    {!far && STREET_ENDS.map((p) => <ellipse key={`sea-${p.key}`} cx={p.x} cy={p.y} rx={p.half * 2.4} ry={p.half + 4} fill="#5c564f" />)}
                    {bridges.map((r) => <path key={`ba-${r.id}`} d={r.d} {...line} stroke="#55504a" strokeWidth={strokeFor(HALF)} strokeLinecap="butt" />)}
                    {roads.map((r) => <path key={`as-${r.id}`} d={r.d} {...line} stroke="var(--map-road)" strokeWidth={strokeFor(HALF)} />)}
                    {/* Lagos dual carriageway: a raised median with black-and-yellow striped kerbs */}
                    {roads.map((r) => (
                      <g key={`md-${r.id}`}>
                        <path d={r.d} {...line} strokeLinecap="butt" stroke="#2b2b2b" strokeWidth="12" />
                        <path d={r.d} {...line} strokeLinecap="butt" stroke="#f2c14e" strokeWidth="12" strokeDasharray="12 12" />
                      </g>
                    ))}
                    {bridges.map((r) => <path key={`bd-${r.id}`} d={r.d} {...line} stroke="var(--map-lane)" strokeWidth="3" strokeDasharray="20 16" />)}
                    {/* Zebra crossings: at the junction, at the far ends of its footpaths, and across every side street */}
                    {!far && <path d={ZEBRAS.map(zebraStripes).join("")} fill="#f4f1e8" opacity=".92" />}
                    {/* The roundabout: asphalt ring, grassed centre island and the fountain. On the ground layer, so the
                        traffic going round drives over it, not under it. */}
                    <ellipse cx={CX} cy={CY} rx={ROUNDABOUT.rx} ry={ROUNDABOUT.ry} fill="var(--map-road)" />
                    <ellipse cx={CX} cy={CY} rx={ROUNDABOUT.island.rx} ry={ROUNDABOUT.island.ry} fill="#5d9b45" stroke="#e6d6b4" strokeWidth="6" />
                    {!far && <image href="/art/props/fountain.webp" x={CX - 78} y={CY - 58} width="156" height="118" />}
                  </g>
                );
              })()}

              {/* Street furniture on the far kerbs, under the traffic and walkers passing in front of it */}
              {!far && (
                <g aria-hidden="true" className="map-scenery">
                  {BEHIND_PROPS.filter((p) => inView(p.x, p.y)).map((p) => (
                    <image key={p.key} href={p.art} x={p.box.x} y={p.box.y} width={p.box.w} height={p.box.h} />
                  ))}
                </g>
              )}

            </g>
          )}
        </svg>
        {/* Traffic and people (hidden when zoomed far out, and for reduced motion) */}
        <svg className="map-layer traffic-layer" aria-hidden="true">
          {pz.view && !far && (
            <g transform={world}>
              <StreetLife roads={ROADS} />
            </g>
          )}
        </svg>
        <svg
          className="map-layer map-top"
          onClick={(e) => {
            // Tap the ground to walk there. Places, shops and billboards handle their own taps.
            if (far || !pz.view || pz.wasDragged() || (e.target as Element).closest(".hotspot, .billboard, .venue-badge")) return;
            const box = ref.current!.getBoundingClientRect();
            const v = pz.view;
            goTo({ x: (e.clientX - box.left - v.x) / v.k, y: (e.clientY - box.top - v.y) / v.k }, "there");
          }}
        >
          {pz.view && (
            <g transform={world}>

              {/* Flyover: a raised deck on pillars over Road A (drawn above the traffic passing under it) */}
              {ROADS.filter((r) => r.flyover).map((r) => {
                const N = 24;
                const pts = Array.from({ length: N + 1 }, (_, i) => {
                  const x = r.x0 + ((r.x1 - r.x0) * i) / N;
                  return { x, y: yOn(r, x), h: flyHeight(r, x) };
                });
                // The deck narrows to the width of the street it lands on as it comes down, so each end meets
                // its ground street flush (Danfo Terminal's approach streets) instead of ending as a wide slab.
                const LAND_HALF = 34;
                const halfAt = (h: number) => LAND_HALF + (HALF - LAND_HALF) * Math.min(1, h / (r.flyover! * 0.6));
                const edge = (side: number) => pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y - p.h + side * halfAt(p.h)}`).join(" ");
                const deck = `${edge(-1)} ${[...pts].reverse().map((p) => `L${p.x} ${p.y - p.h + halfAt(p.h)}`).join(" ")}Z`;
                return (
                  <g key={r.id} aria-hidden="true">
                    {/* shadow on the ground */}
                    <path d={bandPath(r, HALF)} fill="rgb(0 0 0 / 22%)" transform="translate(0 18)" />
                    {pts.filter((p, i) => i % 3 === 0 && p.h > 20).map((p) => (
                      <rect key={p.x} x={p.x - 10} y={p.y - p.h + HALF - 4} width="20" height={p.h} rx="3" fill="#9ca1a9" stroke="#5d626b" strokeWidth="2" />
                    ))}
                    <path d={deck} fill="#5c564f" />
                    <path d={`${edge(-1)} ${edge(1)}`} fill="none" stroke="#cfd3d8" strokeWidth="8" />
                    <path d={edge(0)} fill="none" stroke="var(--map-lane)" strokeWidth="3" strokeDasharray="20 16" />
                  </g>
                );
              })}

              {/* Districts that open in later stages */}
              {DISTRICTS.filter((d) => !d.landmark).map((d) => (
                <g key={d.name} aria-hidden="true">
                  <Diamond x={d.x} y={d.y} w={1100} h={550} fill="rgb(255 255 255 / 7%)" stroke="#8c6a3e" strokeWidth="4" strokeDasharray="18 14" />
                </g>
              ))}

              {/* Junction 101 */}
              <g transform={`translate(${J.x} ${J.y})`}>
                {far ? (
                  <g
                    className="hotspot"
                    role="button"
                    tabIndex={0}
                    aria-label="Zoom in to Junction 101"
                    onClick={() => !pz.wasDragged() && pz.flyTo(CX, CY + 60, 0.55)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        pz.flyTo(CX, CY + 60, 0.55);
                      }
                    }}
                  >
                    <image href="/art/market-square.webp" x="200" y="150" width="400" height="300" preserveAspectRatio="xMidYMid meet" />
                  </g>
                ) : null}
              </g>
              {/* Open plots: flat on the ground, under everything that stands */}
              {!far &&
                PLOTS.map((p, i) =>
                  neighbours[i] ? null : (
                    <g key={i} aria-hidden="true">
                      <Diamond x={p.x} y={p.y} w={260} h={130} fill="rgb(30 110 60 / 14%)" stroke="#2f6b45" strokeWidth="3" strokeDasharray="10 8" />
                      <text x={p.x} y={p.y + 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#24533a" letterSpacing="2">
                        OPEN PLOT
                      </text>
                    </g>
                  ),
                )}

              {/* Buildings, trees, stalls, places, venues, shops and land signs, back to front, with the walkers
                  slotted in by depth (see People.tsx) */}
              <g className="map-scenery">
                <DepthSorted items={depthItems} people={!far} />
              </g>

              {/* Other players online right now */}
              {!far && <OtherPlayers players={others} plateScale={plateScale} onOpen={(p) => !pz.wasDragged() && setPlayerOpen(p)} />}

              {/* You: tap the ground to walk */}
              {!far && (
                <AvatarWalker
                  avatar={avatar}
                  nickname={nickname}
                  start={{ x: CX - 120, y: CY + 150 }}
                  target={walkTo}
                  plateScale={plateScale}
                  onBlocked={() => {
                    setTravelling(false);
                    notify("You can't walk on water. Take the bridge to the Island.");
                  }}
                  posOut={meAt}
                  onStop={(rideId) => new Promise<void>((done) => setStopFor({ rideId, done }))}
                  onArrive={() => {
                    setTravelling(false);
                    if (arriveAt.current === "__home") setHomeOpen(true);
                    else if (arriveAt.current) setVenueOpen(arriveAt.current);
                    arriveAt.current = null;
                  }}
                />
              )}

            </g>
          )}
        </svg>
        {/* Lagos time of day: one multiply tint over every layer below (ground, traffic and buildings). It is a plain
            element between the layers so it blends with all of them; inside one layer it would only reach that layer. */}
        {light.phase !== "day" && <div className="map-tint-layer" style={{ background: light.tint }} aria-hidden="true" />}
        {(weather === "rain" || weather === "storm") && <div className={`map-rain ${weather}`} aria-hidden="true" />}
        {(weather === "cloudy" || weather === "harmattan") && <div className={`map-haze ${weather}`} aria-hidden="true" />}
        {/* Lit things and labels above the tint: billboards, lamps and windows, names. Only their buttons take taps. */}
        <svg className="map-layer map-overlay">
          {pz.view && (
            <g transform={world}>

              {/* Billboards: paid ads from real businesses. Drawn above the night tint because their screens are lit. */}
              {!far &&
                BILLBOARD_SPOTS.map((spot) => {
                  const b = boards.find((bb) => bb.key === spot.key);
                  return b ? <BillboardOnMap key={spot.key} board={b} x={spot.x} y={spot.y} tick={tick} onOpen={() => !pz.wasDragged() && setBoardSheet({ key: b.key })} /> : null;
                })}

              {/* Night lights: street lamps, lit windows, the roundabout */}
              {light.lamps > 0 && (
                <g aria-hidden="true" className="map-lights" opacity={light.lamps}>
                  {!far &&
                    BILLBOARD_SPOTS.map((spot) => <ellipse key={`bb-${spot.key}`} cx={spot.x} cy={spot.y - 200} rx="220" ry="110" fill="url(#window-glow)" />)}
                  {LAMPS.filter((l) => inView(l.x, l.y) && lit(l.x, l.y)).map((l) => {
                    // The lamp head hangs off its arm, up and to the right of the pole: a soft glow under the head,
                    // and a flat pool on the ground straight below it (squashed 2:1 like the ground).
                    const box = propBox(LAMP.art, l.x, l.y, LAMP.w);
                    const hx = box.x + box.w * 0.86;
                    return (
                      <g key={l.key}>
                        <ellipse cx={hx} cy={l.y + 4} rx="64" ry="32" fill="url(#lamp-pool)" />
                        <ellipse cx={hx} cy={box.y + box.h * 0.2} rx="14" ry="10" fill="url(#lamp-head)" />
                      </g>
                    );
                  })}
                  {ALL_SCENERY.filter((b) => inView(b.x, b.y) && lit(b.x, b.y)).map((b) => {
                    const box = buildingBox(b.art, b.x, b.y, b.scale);
                    return <ellipse key={b.key} cx={b.x} cy={box.y + box.h * 0.55} rx={box.w * 0.42} ry={box.h * 0.32} fill="url(#window-glow)" />;
                  })}
                  {!far &&
                    PLOTS.map((p, i) => neighbours[i] && <ellipse key={i} cx={p.x} cy={p.y - 40} rx="80" ry="56" fill="url(#window-glow)" />)}
                  <ellipse cx={CX} cy={CY} rx="220" ry="110" fill="url(#lamp-pool)" />
                  {!far && PLACES.map((pl) => <ellipse key={pl.id} cx={pl.x + pl.w / 2} cy={pl.y + pl.h * 0.55} rx={pl.w * 0.6} ry={pl.h * 0.5} fill="url(#window-glow)" />)}
                </g>
              )}

              {/* Labels stay readable at every zoom and time of day */}
              <g className="map-labels" aria-hidden="true">
                {/* Venue icons show at every zoom (names only up close), so places are easy to find. */}
                {VENUE_SPOTS.map((spot) => {
                    const v = VENUES_BY_KEY.get(spot.key);
                    return v ? (
                      <VenueBadge key={spot.key} live={liveAt(spot.key)?.icon ?? null} venue={v} x={spot.x} y={far ? spot.y - 36 : buildingBox(v.art, spot.x, spot.y, spot.scale).y - 20} scale={Math.min(plateScale, 4)} showName={k >= 0.35} onOpen={() => !pz.wasDragged() && setVenueOpen(v.key)} />
                    ) : null;
                  })}
                {/* Branches: the original's icon over the roof, and the branch's own name up close */}
                {k >= 0.35 &&
                  BRANCHES.filter((b) => inView(b.x, b.y)).map((b) => {
                    const v = VENUES_BY_KEY.get(b.base);
                    if (!v) return null;
                    return (
                      <VenueBadge
                        key={b.key}
                        live={liveAt(b.base)?.icon ?? null}
                        venue={{ ...v, name: b.name }}
                        x={b.x}
                        y={buildingBox(b.art, b.x, b.y, b.scale).y - 12}
                        scale={Math.min(plateScale, 4) * 0.8}
                        showName={k >= 0.6}
                        onOpen={() => !pz.wasDragged() && setVenueOpen(b.key)}
                      />
                    );
                  })}
                {/* Homes: yours in yellow (always), other players' when close */}
                {(() => {
                  const top = myPlot
                    ? buildingBox(`/art/buildings/${HOUSE_BY_KEY.get(home?.design ?? "")?.art ?? "bungalow"}.webp`, myPlot.x, myPlot.y + siteOf(myPlot.hh / 60).lift, myPlot.hh / 60).y
                    : buildingBox(room.art, room.x, room.y, room.scale).y;
                  const x = myPlot ? myPlot.x : room.x;
                  const label = myPlot ? "🏠 Your home" : "🏠 Your room";
                  return (
                    <g className="venue-badge" transform={`translate(${x} ${top - 6}) scale(${Math.min(plateScale, 4)})`} onClick={() => !pz.wasDragged() && setHomeOpen(true)}>
                      <rect x="-58" y="-28" width="116" height="28" rx="14" fill="#ffc72c" stroke="#0a0f24" strokeWidth="2" />
                      <text y="-9" textAnchor="middle" fontSize="14" fontWeight="900" fill="#0a0f24">
                        {label}
                      </text>
                    </g>
                  );
                })()}
                {k >= 0.45 &&
                  homes
                    .filter((h) => !(h.mine && h.isHome))
                    .map((h) => {
                      const l = FOR_SALE.find((p) => p.id === h.plotId);
                      if (!l || !inView(l.x, l.y)) return null;
                      const scale = l.hh / 60;
                      const top = h.design ? buildingBox(`/art/buildings/${HOUSE_BY_KEY.get(h.design)?.art ?? "bungalow"}.webp`, l.x, l.y + siteOf(scale).lift, scale).y : l.y - 70;
                      const text = h.mine ? (h.design ? "🏠 Your house" : "📍 Your land") : h.design ? `🏠 @${h.nickname}` : `📍 @${h.nickname}'s land`;
                      const w = text.length * 8 + 20;
                      return (
                        <g key={`home-l-${h.plotId}`} aria-hidden="true" transform={`translate(${l.x} ${top - 6}) scale(${Math.min(plateScale, 4)})`}>
                          <rect x={-w / 2} y="-24" width={w} height="24" rx="12" fill="#0a0f24" stroke="#ffc72c" strokeWidth="1.5" />
                          <text y="-7" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#fff">
                            {text}
                          </text>
                        </g>
                      );
                    })}
                {/* Real businesses: a small storefront pill with the name (and a tick when verified) */}
                {k >= 0.35 &&
                  mapBiz.map((b) => {
                    const l = FOR_SALE.find((p) => p.id === b.plotId);
                    if (!l || !inView(l.x, l.y)) return null;
                    const scale = l.hh / 60;
                    const top = buildingBox(businessArt(b.category), l.x, l.y + siteOf(scale).lift, scale).y;
                    const label = `🏪 ${b.name}${b.verified ? " ✓" : ""}${b.deals ? " · 🏷️ Deal" : ""}`;
                    const w = label.length * 8.6 + 22;
                    return (
                      <g key={`bizl-${b.plotId}`} className="venue-badge" transform={`translate(${l.x} ${top - 8}) scale(${Math.min(plateScale, 4)})`} onClick={() => !pz.wasDragged() && setBizOpen(b)}>
                        <rect x={-w / 2} y="-26" width={w} height="26" rx="13" fill="#0e3b2a" stroke="#7ef0b0" strokeWidth="2" />
                        <text y="-8" textAnchor="middle" fontSize="13.5" fontWeight="800" fill="#e8fff2">
                          {label}
                        </text>
                      </g>
                    );
                  })}
                {DISTRICTS.filter((d) => d.landmark).map((d) => (
                  <text key={d.name} x={d.x} y={d.y + 330} textAnchor="middle" fontSize={districtNear ? 14 / k : 60} fontWeight="800" fontStyle="italic" fill="#fff5dc" stroke="#1f5a80" strokeWidth={districtNear ? 3 / k : 8} paintOrder="stroke">
                    {d.name}
                  </text>
                ))}
                {DISTRICTS.filter((d) => !d.landmark).map((d) => {
                  const plate = (
                    <>
                      <rect
                        x={-(d.name.length * 17 + 50)}
                        y="-62"
                        width={d.name.length * 34 + 100}
                        height={d.open ? 118 : 88}
                        rx="26"
                        fill={d.open ? "#166534" : INK.indigoDeep}
                        stroke={d.open ? INK.yellow : "none"}
                        strokeWidth="4"
                        opacity={d.open ? 1 : districtNear ? 0.72 : 0.9}
                      />
                      <text textAnchor="middle" fontSize="56" fontWeight="900" fill="#fff">
                        {d.name}
                      </text>
                      {d.open && (
                        <text textAnchor="middle" y="40" fontSize="24" fontWeight="700" fill={INK.yellow} letterSpacing="3">
                          {d.open}
                        </text>
                      )}
                    </>
                  );
                  return d.open ? (
                    // Open districts are real buttons: they take the player to what's there.
                    <g
                      key={`${d.name}-label`}
                      className="hotspot district-open"
                      role="button"
                      tabIndex={0}
                      aria-label={`${d.name}: ${d.open.toLowerCase()}. Find artisans.`}
                      transform={`translate(${d.x} ${d.y}) scale(${districtScale})`}
                      onClick={() => !pz.wasDragged() && onDistrict(d.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onDistrict(d.name);
                        }
                      }}
                    >
                      {plate}
                    </g>
                  ) : (
                    <g key={`${d.name}-label`} transform={`translate(${d.x} ${d.y}) scale(${districtScale})`}>
                      {plate}
                    </g>
                  );
                })}
                <g transform={`translate(${J.x} ${J.y})`}>
                  <g transform={`translate(400 ${far ? 305 : 352}) scale(${Math.min(districtScale, 6)})`}>
                    <text textAnchor="middle" fontSize="13" fontWeight="900" fill={INK.yellow} letterSpacing="1.4">
                      JUNCTION 101
                    </text>
                  </g>
                  {far && (
                    <g transform={`translate(400 470) scale(${districtScale})`}>
                      <rect x="-150" y="-34" width="300" height="60" rx="30" fill={INK.yellow} />
                      <text textAnchor="middle" y="6" fontSize="30" fontWeight="900" fill={INK.indigoDeep}>
                        Junction 101
                      </text>
                    </g>
                  )}
                </g>
                {!far && PLACES.map((pl) => <Hotspot key={pl.id} part="label" {...pl} visited={visited.has(pl.id)} plateScale={plateScale} onOpen={open} />)}
                {!far &&
                  PLOTS.map((p, i) => {
                    const shop = neighbours[i];
                    if (!shop) return null;
                    const label = shop.isMe ? "Your shop" : `@${shop.nickname}`;
                    const plateW = label.length * 11 + 34;
                    return (
                      <g key={i} transform={`translate(${p.x} ${p.y + 66}) scale(${plateScale * 0.9}) translate(${-plateW / 2} 0)`}>
                        <rect width={plateW} height="32" rx="16" fill={shop.isMe ? INK.yellow : INK.indigoDeep} stroke={INK.yellow} strokeOpacity=".5" />
                        <text x={plateW / 2} y="21" textAnchor="middle" fontSize="17" fontWeight="800" fill={shop.isMe ? INK.indigoDeep : "#fff"}>
                          {label}
                        </text>
                      </g>
                    );
                  })}
              </g>
            </g>
          )}
        </svg>
      </div>

      <div className="map-controls" role="group" aria-label="Map zoom">
        <button type="button" className="map-ctl" onClick={() => setBoardSheet({ key: null })} aria-label="Billboards: advertise your business">
          <Megaphone size={18} aria-hidden="true" />
        </button>
        <SoundToggle
          weather={weather}
          hour={light.hour}
          scene={(() => {
            const base = venueOpen ? (BRANCH_BY_KEY.get(venueOpen)?.base ?? venueOpen) : null;
            if (base && ["skyline_lounge", "royal_event_centre", "lagoon_boat_cruise", "viewing_centre"].includes(base)) return "club";
            if (base || homeOpen || visitHome) return "quiet";
            return "street";
          })()}
        />
        <button type="button" className="map-ctl home-ctl" onClick={() => goTo(homeSpot, "home", "__home")} aria-label="Go home" title="Go home">
          <HomeIcon size={18} aria-hidden="true" />
        </button>
        <button type="button" className="map-ctl" onClick={() => pz.zoomBy(1.4)} aria-label="Zoom in">
          <Plus size={18} aria-hidden="true" />
        </button>
        <button type="button" className="map-ctl" onClick={() => pz.zoomBy(1 / 1.4)} aria-label="Zoom out">
          <Minus size={18} aria-hidden="true" />
        </button>
        <button type="button" className="map-ctl" onClick={() => pz.flyTo(meAt.current.x, meAt.current.y - 40, Math.max(pz.view?.k ?? 0.7, 0.7))} aria-label="Find me" title="Find me">
          <LocateFixed size={18} aria-hidden="true" />
        </button>
      </div>
      <button type="button" className="map-land map-overview-btn" onClick={() => setOverview(true)}>
        <MapIcon size={15} aria-hidden="true" /> City map
      </button>
      <button type="button" className="map-land" onClick={() => setLandList(true)}>
        <LandPlot size={15} aria-hidden="true" /> Land for sale
      </button>
      <p className="map-clock tiny" aria-live="off">
        Lagos {clockLabel(light.hour)} · {PHASE_LABEL[light.phase]} · {WEATHER_ICON[weather]} {WEATHER_LABEL[weather]}
        {dark.size > 0 && ` · 🕯️ No light: ${[...dark].join(", ")}`}
      </p>
      {liveEvents.length > 0 && (
        <div className="map-events">
          {liveEvents.slice(0, 2).map((e) => (
            <button key={e.key} type="button" className="map-event" onClick={() => setVenueOpen(e.venues[0]!)}>
              {e.icon} {e.name} on now · {VENUES_BY_KEY.get(e.venues[0]!)?.name}
            </button>
          ))}
        </div>
      )}
      <p className="map-hint tiny">Tap the road to walk · drag to move · pinch to zoom</p>
      {peek && (
        <div className="map-peek" role="dialog" aria-label={`${peek.shopName}`}>
          <button type="button" className="map-peek-close" onClick={() => setPeek(null)} aria-label="Close">
            <X size={16} aria-hidden="true" />
          </button>
          <strong>{peek.shopName}</strong>
          <span className="small muted">
            {peek.isMe ? "Your shop" : `Run by @${peek.nickname}`} · {HUSTLES_BY_KEY.get(peek.hustle)?.title ?? "Trader"}
          </span>
          <span className="appeal-pill" style={{ justifySelf: "start" }}>
            <Sparkles size={14} aria-hidden="true" /> Appeal {peek.appeal}
          </span>
          {peek.isMe ? (
            <button type="button" className="btn sm go" onClick={() => onOpen("market_square")}>
              Go to my shop
            </button>
          ) : (
            <button type="button" className="btn sm go" onClick={() => setVisiting(peek.shopId)}>
              <Store size={16} aria-hidden="true" /> Visit shop
            </button>
          )}
        </div>
      )}
      {/* Windows over the map open at the top of the page: the full-screen map is its own stacking layer, so
          anything opened inside it would sit under the header and title card (and their close buttons too). */}
      {createPortal(
        <>
          {visiting && <ShopVisit shopId={visiting} onClose={() => setVisiting(null)} onVisited={onVisited} notify={notify} />}
          {boardSheet && (
        <BillboardSheet boards={boards} boardKey={boardSheet.key} signedIn onPick={(key) => setBoardSheet({ key })} onClose={() => setBoardSheet(null)} />
      )}
          {overview && (
            <CityOverview
              me={meAt.current}
              home={homeSpot}
              mapBiz={mapBiz}
              onClose={() => setOverview(false)}
              onShow={(spot) => {
                setOverview(false);
                if (spot.key === "home") window.setTimeout(() => setHomeOpen(true), 500);
                pz.flyTo(spot.x, spot.y, spot.kind === "area" ? 0.4 : 0.75);
                if (spot.venue && spot.venue !== "__home") window.setTimeout(() => setVenueOpen(spot.venue!), 500);
                if (spot.kind === "business") {
                  const b = mapBiz.find((m) => `biz-${m.plotId}` === spot.key);
                  if (b) window.setTimeout(() => setBizOpen(b), 500);
                }
              }}
              onGo={(spot) => {
                setOverview(false);
                goTo({ x: spot.x, y: spot.y + 30 }, spot.label, spot.venue);
              }}
            />
          )}
          {ridePick && (
            <RidePicker units={ridePick.units} hour={light.hour} coins={null} to={ridePick.to} onPick={ride} onClose={() => setRidePick(null)} vehicles={vehicles} />
          )}
          {stopFor && (
            <AreaBoys
              rideId={stopFor.rideId}
              onDone={() => {
                stopFor.done();
                setStopFor(null);
                onVisited();
              }}
            />
          )}
          {landList && (
            <LandList
              taken={new Set([...mapBiz.map((b) => b.plotId), ...homes.map((h) => h.plotId)])}
              onClose={() => setLandList(false)}
              onPick={(p) => {
                setLandList(false);
                pz.flyTo(p.x, p.y, 0.9);
                setLandOpen(p.id);
              }}
            />
          )}
          {bizOpen && (
            <BusinessCard
              biz={bizOpen}
              notify={notify}
              onClose={() => setBizOpen(null)}
              onGo={() => {
                const l = FOR_SALE.find((p) => p.id === bizOpen.plotId);
                setBizOpen(null);
                if (l) goTo({ x: l.x, y: l.y + l.hh }, bizOpen.name);
              }}
              onQuote={() => {
                setBizOpen(null);
                onDistrict("artisans");
              }}
            />
          )}
          {playerOpen && (
            <PlayerCard
              player={playerOpen}
              near={(!!place && place === playerOpen.place) || Math.hypot(playerOpen.x - meAt.current.x, playerOpen.y - meAt.current.y) < 900}
              home={homes.find((h) => h.nickname === playerOpen.nickname && h.isHome) ?? { plotId: `room-${playerOpen.nickname}`, design: "starter", nickname: playerOpen.nickname, mine: false, isHome: true }}
              onClose={() => setPlayerOpen(null)}
              notify={notify}
              onChanged={onVisited}
              onGo={() => {
                const p = playerOpen;
                setPlayerOpen(null);
                goTo({ x: p.x, y: p.y + 20 }, `@${p.nickname}`, p.place && !p.place.startsWith("home:") ? p.place : undefined);
              }}
              onVisitHome={() => {
                // Their own house, or their room in a face-me block.
                const h = homes.find((x) => x.nickname === playerOpen.nickname && x.isHome) ?? { plotId: `room-${playerOpen.nickname}`, design: "starter", nickname: playerOpen.nickname, mine: false, isHome: true };
                setPlayerOpen(null);
                setVisitHome(h);
              }}
            />
          )}
          {visitHome && (
            <VisitHome avatar={avatar} home={visitHome} inside={others.filter((p) => p.place === `home:${visitHome.plotId}`)} onClose={() => setVisitHome(null)} notify={notify} />
          )}
          {plotOpen && home && (() => {
            const mine = home.plots.find((p) => p.plotId === plotOpen);
            const l = FOR_SALE.find((p) => p.id === plotOpen);
            return mine && l ? (
              <PlotCard
                plot={mine}
                area={l.area}
                onClose={() => setPlotOpen(null)}
                onChanged={() => {
                  loadHomes();
                  onVisited();
                }}
                notify={notify}
              />
            ) : null;
          })()}
          {homeOpen && home && (
            <HomeCard
              area={myPlot?.area ?? areaOf(room.x, room.y)}
              hasLight={!dark.has(myPlot?.area ?? areaOf(room.x, room.y))}
              avatar={avatar}
              guests={others.filter((p) => p.place === `home:${home.plotId ?? `room-${nickname}`}`)}
              chatPlace={`home:${home.plotId ?? `room-${nickname}`}`}
              home={home}
              label={myPlot ? `${HOUSE_BY_KEY.get(home.design ?? "")?.label ?? "House"} · ${myPlot.area}` : "Room in a face-me-I-face-you"}
              onClose={() => setHomeOpen(false)}
              onChanged={() => {
                loadHomes();
                onVisited();
              }}
              notify={notify}
              onBuyLand={() => {
                setHomeOpen(false);
                setLandList(true);
              }}
            />
          )}
          {landOpen && !landList && !bizByPlot.has(landOpen) && !homeByPlot.has(landOpen) && (
            <LandCard
              ownedCount={home?.plots.length ?? 0}
              onBought={() => {
                loadHomes();
                onVisited();
              }}
              onBuilt={() => void loadMapBiz()}
              plotId={landOpen}
              onClose={() => setLandOpen(null)}
              notify={notify}
              onList={() => {
                setLandOpen(null);
                setLandList(true);
              }}
            />
          )}
          {venueOpen && (
        <VenueCard
          avatar={avatar}
          here={others.filter((p) => p.place === venueOpen)}
          onPlayer={(p) => setPlayerOpen(p)}
          venueKey={BRANCH_BY_KEY.get(venueOpen)?.base ?? venueOpen}
          branch={BRANCH_BY_KEY.get(venueOpen)}
          onClose={() => setVenueOpen(null)}
          onWalk={() => {
            const branchAt = BRANCH_BY_KEY.get(venueOpen);
            const spot = branchAt ?? VENUE_SPOTS.find((v) => v.key === venueOpen);
            const v = VENUES_BY_KEY.get(venueOpen);
            setVenueOpen(null);
            if (spot) goTo({ x: spot.x, y: spot.y + 30 }, branchAt?.name ?? v?.name ?? "there", venueOpen);
          }}
          onFindReal={() => {
            setVenueOpen(null);
            onDistrict("artisans");
          }}
          onChanged={onVisited}
          notify={notify}
          onApp={
            onApp &&
            ((app) => {
              setVenueOpen(null);
              onApp(app);
            })
          }
        />
      )}
        </>,
        document.body,
      )}
    </div>
  );
}
