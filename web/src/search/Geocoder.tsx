import { useEffect, useRef, useState } from 'react';

// Free geocoding via OpenStreetMap Nominatim. Usage policy: <=1 req/s, identify the
// app. For a private single-user app this is well within limits.
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

interface Place {
  display_name: string;
  lat: string;
  lon: string;
}

export interface GeocoderProps {
  onSelect: (r: { lng: number; lat: number; label: string }) => void;
}

export function Geocoder({ onSelect }: GeocoderProps) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(debounce.current);
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    debounce.current = window.setTimeout(async () => {
      try {
        const url = `${NOMINATIM}?format=json&limit=6&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        if (!res.ok) return;
        setResults((await res.json()) as Place[]);
        setOpen(true);
      } catch {
        /* ignore transient search errors */
      }
    }, 350);
    return () => window.clearTimeout(debounce.current);
  }, [q]);

  function pick(p: Place) {
    onSelect({ lng: parseFloat(p.lon), lat: parseFloat(p.lat), label: p.display_name });
    setQ(p.display_name.split(',')[0]);
    setOpen(false);
  }

  return (
    <div className="cg-geocoder">
      <input
        className="cg-search-input"
        placeholder="Search places…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
      />
      {open && results.length > 0 && (
        <ul className="cg-search-results">
          {results.map((p, i) => (
            <li key={i} onMouseDown={() => pick(p)}>
              {p.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
