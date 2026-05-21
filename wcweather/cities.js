// 16 FIFA World Cup 2026 host cities.
// `lat` and `lng` are decimal degrees (lng given as positive west of Greenwich
// to keep the arithmetic readable). `x` and `y` are percentages within the
// base map's bounding box, which spans 130°W → 60°W and 60°N → 14°N.
//
// To recalculate positions, change MAP_BOUNDS below and the values are derived
// at load time.

const MAP_BOUNDS = {
  westLng: 130,   // left edge
  eastLng: 60,    // right edge (smaller absolute value = further east)
  northLat: 60,   // top edge
  southLat: 14    // bottom edge
};

function project(lat, lngAbs) {
  const x = (MAP_BOUNDS.westLng - lngAbs) / (MAP_BOUNDS.westLng - MAP_BOUNDS.eastLng) * 100;
  const y = (MAP_BOUNDS.northLat - lat) / (MAP_BOUNDS.northLat - MAP_BOUNDS.southLat) * 100;
  return { x, y };
}

// `labelDir` controls where the city label sits relative to its pin dot:
//   n/s/e/w/ne/nw/se/sw. Default 's' (below the dot).
const CITY_DATA = [
  { id: 'vancouver',    name: 'Vancouver',     country: 'CA', lat: 49.28, lng: 123.12, labelDir: 'ne' },
  { id: 'seattle',      name: 'Seattle',       country: 'US', lat: 47.61, lng: 122.33, labelDir: 'se' },
  { id: 'san-francisco',name: 'San Francisco', country: 'US', lat: 37.77, lng: 122.42, labelDir: 'e'  },
  { id: 'los-angeles',  name: 'Los Angeles',   country: 'US', lat: 34.05, lng: 118.24, labelDir: 'e'  },
  { id: 'kansas-city',  name: 'Kansas City',   country: 'US', lat: 39.10, lng:  94.58, labelDir: 'n'  },
  { id: 'dallas',       name: 'Dallas',        country: 'US', lat: 32.78, lng:  96.80, labelDir: 'w'  },
  { id: 'houston',      name: 'Houston',       country: 'US', lat: 29.76, lng:  95.37, labelDir: 'e'  },
  { id: 'atlanta',      name: 'Atlanta',       country: 'US', lat: 33.75, lng:  84.39, labelDir: 's'  },
  { id: 'miami',        name: 'Miami',         country: 'US', lat: 25.76, lng:  80.19, labelDir: 'w'  },
  { id: 'philadelphia', name: 'Philadelphia',  country: 'US', lat: 39.95, lng:  75.17, labelDir: 's'  },
  { id: 'new-york',     name: 'New York / NJ', country: 'US', lat: 40.71, lng:  74.01, labelDir: 'e'  },
  { id: 'boston',       name: 'Boston',        country: 'US', lat: 42.36, lng:  71.06, labelDir: 'nw' },
  { id: 'toronto',      name: 'Toronto',       country: 'CA', lat: 43.65, lng:  79.38, labelDir: 'n'  },
  { id: 'monterrey',    name: 'Monterrey',     country: 'MX', lat: 25.69, lng: 100.32, labelDir: 'e'  },
  { id: 'guadalajara',  name: 'Guadalajara',   country: 'MX', lat: 20.66, lng: 103.35, labelDir: 'w'  },
  { id: 'mexico-city',  name: 'Mexico City',   country: 'MX', lat: 19.43, lng:  99.13, labelDir: 'e'  }
];

const CITIES = CITY_DATA.map(c => {
  const { x, y } = project(c.lat, c.lng);
  return { ...c, x, y };
});

window.CITIES = CITIES;
window.MAP_BOUNDS = MAP_BOUNDS;
