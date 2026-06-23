import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 1800 }); // 30 min cache

export interface EnvironmentData {
  humidity: number;
  temperature: number;
  uvIndex: number;
  aqi: number;
  season: 'summer' | 'monsoon' | 'winter' | 'spring';
  city: string;
}

function detectSeason(month: number): EnvironmentData['season'] {
  if (month >= 3 && month <= 5) return 'summer';
  if (month >= 6 && month <= 9) return 'monsoon';
  if (month >= 10 && month <= 11) return 'spring';
  return 'winter';
}

export async function getEnvironmentData(city: string): Promise<EnvironmentData> {
  const cacheKey = city.toLowerCase().trim();
  const cached = cache.get<EnvironmentData>(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey || apiKey === 'your_openweathermap_api_key_here') {
    return getFallbackEnvironmentData(city);
  }

  try {
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!weatherRes.ok) return getFallbackEnvironmentData(city);

    const weatherData: any = await weatherRes.json();
    const humidity = weatherData.main.humidity as number;
    const temperature = Math.round(weatherData.main.temp as number);
    const lat = weatherData.coord.lat as number;
    const lon = weatherData.coord.lon as number;

    let uvIndex = 5;
    try {
      const uvRes = await fetch(
        `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (uvRes.ok) { const uvData: any = await uvRes.json(); uvIndex = Math.round(uvData.value); }
    } catch {}

    let aqi = 75;
    try {
      const aqiRes = await fetch(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (aqiRes.ok) {
        const aqiData: any = await aqiRes.json();
        const pm25 = aqiData.list?.[0]?.components?.pm2_5 || 0;
        aqi = pm25ToAqi(pm25);
      }
    } catch {}

    const month = new Date().getMonth() + 1;
    const result: EnvironmentData = { humidity, temperature, uvIndex, aqi, season: detectSeason(month), city };
    cache.set(cacheKey, result);
    return result;
  } catch {
    return getFallbackEnvironmentData(city);
  }
}

function pm25ToAqi(pm25: number): number {
  const bp = [
    { lo: 0, hi: 12.0, alo: 0, ahi: 50 }, { lo: 12.1, hi: 35.4, alo: 51, ahi: 100 },
    { lo: 35.5, hi: 55.4, alo: 101, ahi: 150 }, { lo: 55.5, hi: 150.4, alo: 151, ahi: 200 },
  ];
  for (const b of bp) {
    if (pm25 >= b.lo && pm25 <= b.hi)
      return Math.round(((b.ahi - b.alo) / (b.hi - b.lo)) * (pm25 - b.lo) + b.alo);
  }
  return Math.min(500, Math.round(pm25 * 2));
}

export function getFallbackEnvironmentData(city = 'India'): EnvironmentData {
  const month = new Date().getMonth() + 1;
  const season = detectSeason(month);
  return {
    humidity: season === 'monsoon' ? 82 : season === 'summer' ? 35 : 55,
    temperature: season === 'summer' ? 38 : season === 'winter' ? 18 : 28,
    uvIndex: season === 'summer' ? 9 : season === 'monsoon' ? 4 : 6,
    aqi: 80,
    season,
    city,
  };
}

export function summariseEnvironment(env: EnvironmentData): string {
  const humDesc = env.humidity > 75 ? 'very humid' : env.humidity < 35 ? 'very dry' : 'moderate humidity';
  const uvDesc = env.uvIndex > 8 ? 'extreme UV' : env.uvIndex > 5 ? 'high UV' : 'moderate UV';
  const aqiDesc = env.aqi > 150 ? 'poor air quality' : env.aqi > 100 ? 'moderate pollution' : 'good air';
  return `${env.season} | ${env.temperature}°C | ${humDesc} (${env.humidity}%) | ${uvDesc} (UV ${env.uvIndex}) | ${aqiDesc} (AQI ${env.aqi})`;
}
