const API = {
  githubRepo: "https://api.github.com/repos/riteshM08/cloudops-control-center",
  githubCommits: "https://api.github.com/repos/riteshM08/cloudops-control-center/commits?per_page=30",
  cloudflareStatus: "https://www.cloudflarestatus.com/api/v2/summary.json",
};

const regions = [
  { name: "Mumbai", code: "IN", slug: "mumbai", latitude: 19.076, longitude: 72.8777, zone: "ap-south-1" },
  { name: "Singapore", code: "SG", slug: "singapore", latitude: 1.3521, longitude: 103.8198, zone: "ap-southeast-1" },
  { name: "London", code: "UK", slug: "london", latitude: 51.5074, longitude: -0.1278, zone: "eu-west-2" },
  { name: "Virginia", code: "US", slug: "virginia", latitude: 37.4316, longitude: -78.6569, zone: "us-east-1" },
  { name: "Tokyo", code: "JP", slug: "tokyo", latitude: 35.6762, longitude: 139.6503, zone: "ap-northeast-1" },
];

async function timedFetch(url, options = {}) {
  const started = performance.now();
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
  const duration = Math.round(performance.now() - started);

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return { data: await response.json(), duration };
}

async function getRepository() {
  return timedFetch(API.githubRepo);
}

async function getRecentCommits() {
  return timedFetch(API.githubCommits);
}

async function getPlatformStatus() {
  return timedFetch(API.cloudflareStatus);
}

async function getRegionWeather(region) {
  const params = new URLSearchParams({
    latitude: region.latitude,
    longitude: region.longitude,
    current: "temperature_2m,relative_humidity_2m,weather_code",
    timezone: "auto",
  });

  return timedFetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
}

async function getRegionalTelemetry() {
  return Promise.all(
    regions.map(async (region) => {
      try {
        const { data, duration } = await getRegionWeather(region);

        return {
          ...region,
          temperature: data.current?.temperature_2m,
          humidity: data.current?.relative_humidity_2m,
          weatherCode: data.current?.weather_code,
          measuredIn: data.current_units?.temperature_2m || "°C",
          latency: duration,
          available: true,
        };
      } catch (error) {
        return {
          ...region,
          available: false,
          error: error.message,
        };
      }
    })
  );
}

function getWeatherLabel(code) {
  const labels = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Heavy rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm + hail",
    99: "Thunderstorm + hail",
  };

  return labels[code] || "Telemetry available";
}

function getStatusTone(indicator) {
  if (indicator === "none") return "operational";
  if (indicator === "minor") return "degraded";
  return "incident";
}