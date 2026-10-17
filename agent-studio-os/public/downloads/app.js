async function getWeather() {
  const city = document.getElementById('cityInput').value;
  if (!city) return;

  // Using Open-Meteo Geocoding API first to get coords, then weather
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`);
    const geoData = await geoRes.json();

    if (!geoData.results) throw new Error('City not found');

    const { latitude, longitude, name } = geoData.results[0];
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`);
    const weatherData = await weatherRes.json();

    document.getElementById('cityName').innerText = name;
    document.getElementById('temperature').innerText = weatherData.current.temperature_2m;
    document.getElementById('weatherDisplay').classList.remove('hidden');
  } catch (error) {
    alert(error.message);
  }
}