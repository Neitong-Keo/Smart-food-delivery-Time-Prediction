import { House, Utensils } from "lucide-react";

const STREETS_X = [70, 160, 250, 430, 520, 610];
const STREETS_Y = [60, 140, 220, 300, 470, 550, 630, 710];
const ROUTE = "M160 470H250V390H430V220H520V140";

/** Illustrated product preview. The order shown is an example, not live data. */
export function HeroRoute() {
  return (
    <div className="hero-map">
      <svg
        className="hero-map-svg"
        viewBox="0 0 820 680"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="Map preview showing a delivery route from a restaurant to a home"
      >
        <path
          className="hero-map-water"
          d="M720-20C680 110 745 230 705 360S665 560 730 700H860V-20Z"
        />
        <g transform="rotate(-4 410 340)">
          <rect className="hero-map-park" x="262" y="72" width="156" height="136" rx="4" />
          {STREETS_X.map((x) => (
            <path key={`x-${x}`} className="hero-map-street" d={`M${x} -80V780`} />
          ))}
          {STREETS_Y.map((y) => (
            <path key={`y-${y}`} className="hero-map-street" d={`M-80 ${y}H664`} />
          ))}
          <path className="hero-map-boulevard" d="M-80 390H664" />
          <path className="hero-map-boulevard" d="M340 -80V780" />
          <path className="hero-map-boulevard" d="M664 -80V780" />

          <path className="hero-map-route-casing" d={ROUTE} />
          <path className="hero-map-route" d={ROUTE} pathLength={1} />

          <g transform="translate(160 470) rotate(4)">
            <circle r="20" fill="#252525" stroke="#fff" strokeWidth="3" />
            <Utensils x={-9} y={-9} width={18} height={18} color="#faf9f6" />
          </g>
          <g transform="translate(520 140) rotate(4)">
            <g className="hero-map-destination">
              <circle r="20" fill="#e58a45" stroke="#fff" strokeWidth="3" />
              <House x={-9} y={-9} width={18} height={18} color="#252525" />
            </g>
          </g>
        </g>
      </svg>

      <div className="hero-ticket">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/restaurants/beef-lok-lak.jpg" alt="" width={72} height={72} />
        <div className="hero-ticket-copy">
          <p className="hero-ticket-label">Example order</p>
          <p className="hero-ticket-name">Brigade Grill</p>
          <p className="hero-ticket-meta">4.7 km by road</p>
        </div>
        <p className="hero-ticket-time">
          17<span>minutes</span>
        </p>
      </div>
    </div>
  );
}
