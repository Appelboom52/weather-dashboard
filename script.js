const apiKey = '7ffbf6abfaff1128113839610ff07031';

// === DOM Elements ===
const form = document.getElementById('search-form');
const cityInput = document.getElementById('city-input');
const suggestionsList = document.getElementById('suggestions');
const weatherDiv = document.getElementById('weather');
const locationEl = document.getElementById('location');
const iconEl = document.getElementById('icon');
const tempEl = document.getElementById('temp');
const descEl = document.getElementById('description');
const humidityEl = document.getElementById('humidity');
const windEl = document.getElementById('wind');
const errorEl = document.getElementById('error-message');
const recentList = document.getElementById('recent-list');
const recentContainer = document.getElementById('recent-cities');
const clearRecentBtn = document.getElementById('clear-recent');
const forecastDiv = document.getElementById('forecast');
let lastLocation = { lat: null, lon: null, name: '' };
let forecastChart;

// === Theme ===
const themeToggle = document.getElementById('theme-toggle');
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
let savedTheme = localStorage.getItem('theme') || (systemPrefersDark ? 'dark' : 'light');
applyTheme(savedTheme);
themeToggle.addEventListener('click', () => {
  const newTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
  localStorage.setItem('theme', newTheme);
  applyTheme(newTheme);
});
function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// === Temperature Unit Utility ===
function getTempUnitAndSymbol() {
  const unit = localStorage.getItem('unit') || 'metric';
  const symbol = unit === 'metric' ? '°C' : '°F';
  return { unit, symbol };
}

// === Search Submit ===
form.addEventListener('submit', e => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (!city) return;
  errorEl.textContent = '';
  weatherDiv.classList.remove('visible');
  forecastDiv.classList.remove('visible');
  fetchCoordinates(city);
});

// === Coordinates from City Name ===
function fetchCoordinates(city) {
  fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=5&appid=${apiKey}`)
    .then(res => res.json())
    .then(data => {
      if (data.length === 0) throw new Error('City not found');
      const place = data[0];
      const locationText = `${place.name}${place.state ? ', ' + place.state : ''}, ${place.country}`;
      fetchWeather(place.lat, place.lon, locationText);
      fetchForecast(place.lat, place.lon);
      saveRecentCity(locationText, place.lat, place.lon);
    })
    .catch(err => {
      errorEl.textContent = err.message;
    });
}

// === Fetch Weather ===
function fetchWeather(lat, lon, locationText) {
  lastLocation = { lat, lon, name: locationText };
  const { unit, symbol } = getTempUnitAndSymbol();
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${unit}&appid=${apiKey}`;
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('Weather data not available');
      return res.json();
    })
    .then(data => {
      locationEl.textContent = locationText;
      tempEl.textContent = Math.round(data.main.temp) + symbol;
      descEl.textContent = data.weather[0].description;
      humidityEl.textContent = data.main.humidity;
      windEl.textContent = data.wind.speed;
      iconEl.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
      iconEl.alt = data.weather[0].description;
      weatherDiv.style.display = 'block';
    })
    .catch(err => {
      errorEl.textContent = err.message;
    });
}

// === Fetch Forecast ===
function fetchForecast(lat, lon) {
  const { unit, symbol } = getTempUnitAndSymbol();
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${unit}&appid=${apiKey}`;
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('Forecast data not available');
      return res.json();
    })
    .then(data => {
      updateForecastUI(data.list, symbol);
      updateForecastChart(data.list, symbol);
      forecastDiv.style.display = 'block';
    })
    .catch(err => {
      errorEl.textContent = err.message;
    });
}

// === Update Forecast UI ===
function updateForecastUI(forecastList, symbol) {
  const forecastCards = document.getElementById('forecast-cards');
  forecastCards.innerHTML = '';
  const daily = {};
  forecastList.forEach(entry => {
    const date = entry.dt_txt.split(' ')[0];
    if (!daily[date]) daily[date] = [];
    daily[date].push(entry);
  });
  const days = Object.keys(daily).slice(0, 5);
  days.forEach(date => {
    const entries = daily[date];
    const temps = entries.map(e => e.main.temp);
    const icon = entries[2]?.weather[0]?.icon || entries[0].weather[0].icon;
    const desc = entries[2]?.weather[0]?.main || entries[0].weather[0].main;
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const card = document.createElement('div');
    card.className = 'forecast-card';
    const dayName = new Date(date).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    card.innerHTML = `
      <p>${dayName}</p>
      <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}">
      <p>${Math.round(min)}${symbol} / ${Math.round(max)}${symbol}</p>
      <p style="font-size: 0.8rem;">${desc}</p>
    `;
    forecastCards.appendChild(card);
  });
}

// === Update Forecast Chart ===
function updateForecastChart(forecastList, symbol) {
  const middayPoints = forecastList.filter(entry => entry.dt_txt.includes('12:00:00')).slice(0, 5);
  const labels = middayPoints.map(e =>
    new Date(e.dt_txt).toLocaleDateString(undefined, { weekday: 'short' })
  );
  const temps = middayPoints.map(e => e.main.temp);
  const ctx = document.getElementById('forecastChart').getContext('2d');
  if (forecastChart) forecastChart.destroy();
  forecastChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `Midday Temp (${symbol})`,
        data: temps,
        fill: true,
        borderColor: '#00796b',
        backgroundColor: 'rgba(0,121,107,0.2)',
        tension: 0.3
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: false }
      }
    }
  });
}

// === Autocomplete with Keyboard Navigation ===
let currentSuggestionIndex = -1;

cityInput.addEventListener('input', () => {
  const query = cityInput.value.trim();
  suggestionsList.innerHTML = '';
  currentSuggestionIndex = -1;

  if (query.length < 3) return;

  fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${apiKey}`)
    .then(res => res.json())
    .then(data => {
      if (data.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No results found';
        li.classList.add('no-results');
        suggestionsList.appendChild(li);
        return;
      }

      data.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.name}${item.state ? ', ' + item.state : ''}, ${item.country}`;
        li.addEventListener('click', () => {
          cityInput.value = li.textContent;
          suggestionsList.innerHTML = '';
          fetchWeather(item.lat, item.lon, li.textContent);
          fetchForecast(item.lat, item.lon);
          saveRecentCity(li.textContent, item.lat, item.lon);
        });
        suggestionsList.appendChild(li);
      });
    });
});

cityInput.addEventListener('keydown', e => {
  const items = suggestionsList.querySelectorAll('li:not(.no-results)');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    currentSuggestionIndex = (currentSuggestionIndex + 1) % items.length;
  } else if (e.key === 'ArrowUp') {
    currentSuggestionIndex = (currentSuggestionIndex - 1 + items.length) % items.length;
  } else if (e.key === 'Enter') {
    if (currentSuggestionIndex >= 0) {
      e.preventDefault();
      items[currentSuggestionIndex].click();
    }
  }

  items.forEach((li, i) => {
    li.classList.toggle('active', i === currentSuggestionIndex);
  });
});

// === Recent Cities ===
function saveRecentCity(name, lat, lon) {
  const existing = JSON.parse(localStorage.getItem('recentCities')) || [];
  const updated = [{ name, lat, lon }, ...existing.filter(c => c.name !== name)].slice(0, 5);
  localStorage.setItem('recentCities', JSON.stringify(updated));
  renderRecentCities();
}
function renderRecentCities() {
  const cities = JSON.parse(localStorage.getItem('recentCities')) || [];
  recentList.innerHTML = '';
  if (cities.length === 0) {
    recentContainer.style.display = 'none';
    return;
  }
  cities.forEach(city => {
    const li = document.createElement('li');
    li.textContent = city.name;
    li.addEventListener('click', () => {
      cityInput.value = city.name;
      fetchWeather(city.lat, city.lon, city.name);
      fetchForecast(city.lat, city.lon);
    });
    recentList.appendChild(li);
  });
  recentContainer.style.display = 'block';
}
clearRecentBtn.addEventListener('click', () => {
  localStorage.removeItem('recentCities');
  renderRecentCities();
});

// === Unit Toggle ===
document.getElementById('unit-toggle').addEventListener('click', () => {
  const current = localStorage.getItem('unit') || 'metric';
  const newUnit = current === 'metric' ? 'imperial' : 'metric';
  localStorage.setItem('unit', newUnit);
  const { symbol } = getTempUnitAndSymbol();
  document.getElementById('unit-toggle').textContent = newUnit === 'metric' ? '°F' : '°C';
  if (lastLocation.lat && lastLocation.lon) {
    fetchWeather(lastLocation.lat, lastLocation.lon, lastLocation.name);
    fetchForecast(lastLocation.lat, lastLocation.lon);
  }
});
document.getElementById('unit-toggle').textContent =
  getTempUnitAndSymbol().unit === 'metric' ? '°F' : '°C';

// === Geolocation ===
document.getElementById('geo-btn').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => reverseGeocodeAndFetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => { errorEl.textContent = 'Location permission denied.'; }
    );
  } else {
    errorEl.textContent = 'Geolocation not supported.';
  }
});
function reverseGeocodeAndFetchWeather(lat, lon) {
  fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`)
    .then(res => res.json())
    .then(data => {
      if (!data.length) throw new Error('Location not found');
      const place = data[0];
      const name = `${place.name}${place.state ? ', ' + place.state : ''}, ${place.country}`;
      fetchWeather(lat, lon, name);
      fetchForecast(lat, lon);
      saveRecentCity(name, lat, lon);
    })
    .catch(() => {
      errorEl.textContent = 'Could not get your location weather.';
    });
}

// === Init ===
renderRecentCities();
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    pos => reverseGeocodeAndFetchWeather(pos.coords.latitude, pos.coords.longitude),
    () => {}
  );
}
