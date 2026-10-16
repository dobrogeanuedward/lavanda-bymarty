# Geographic index

`places.json.gz` is a compressed, adapted extract of [GeoNames cities500](https://download.geonames.org/export/dump/readme.txt), retrieved 2026-10-16. GeoNames supplies cities with population above 500 and administrative seats down to PPLA4; coverage is not every inhabited place. Administrative labels come from `admin1CodesASCII.txt`.

Data © GeoNames contributors, [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Commercial use is allowed. Adaptation by Lavanda: selected fields and aliases, normalized lookup, gzip compression. Attribution is also shown on the natal-chart page. No map tiles or external geocoding service are called at runtime.

Refresh deliberately with `node scripts/import-places.mjs` after removing the cached source files in `.cache/` if a new download is wanted. Never refresh automatically during a production build.

Each row is `[id, name, aliases[], latitude, longitude, countryCode, admin1, timezone, population]`. Coordinates are WGS84 city centers; time zones are IANA identifiers, not present-day UTC offsets. The birth-time converter uses historical offsets from the user's browser's time-zone database.
