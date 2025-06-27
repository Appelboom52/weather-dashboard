const apiKey = process.env.API_KEY;

// ========== DOM Elements ==========
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
const unitToggle = document.getElementById('unit-toggle');
const geoBtn = document.getElementById('geo-btn');
const themeToggle = document.getElementById('theme-toggle');

let lastLocation = { lat: null, lon: null, name: '' };
let forecastChart;
let currentSuggestionIndex = -1;

// ========== Theme ==========
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

// ========== Temperature Units ==========
function getTempUnitAndSymbol() {
  const unit = localStorage.getItem('unit') || 'metric';
  const symbol = unit === 'metric' ? '°C' : '°F';
  return { unit, symbol };
}

// Init unit toggle button text
unitToggle.textContent = getTempUnitAndSymbol().unit === 'metric' ? '°F' : '°C';

unitToggle.addEventListener('click', () => {
  const current = localStorage.getItem('unit') || 'metric';
  const newUnit = current === 'metric' ? 'imperial' : 'metric';
  localStorage.setItem('unit', newUnit);
  unitToggle.textContent = newUnit === 'metric' ? '°F' : '°C';

  if (lastLocation.lat && lastLocation.lon) {
    fetchWeather(lastLocation.lat, lastLocation.lon, lastLocation.name);
    fetchForecast(lastLocation.lat, lastLocation.lon);
  }
});

// ========== Search ==========
form.addEventListener('submit', e => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (!city) return;

  errorEl.textContent = '';
  weatherDiv.classList.remove('visible');
  forecastDiv.classList.remove('visible');
  fetchCoordinates(city);
});

function fetchCoordinates(city) {
  fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=5&appid=${apiKey}`)
    .then(res => res.json())
    .then(data => {
      if (!data.length) throw new Error('City not found');
      const place = data[0];
      const name = `${place.name}${place.state ? ', ' + place.state : ''}, ${place.country}`;
      fetchWeather(place.lat, place.lon, name);
      fetchForecast(place.lat, place.lon);
      saveRecentCity(name, place.lat, place.lon);
    })
    .catch(err => {
      errorEl.textContent = err.message;
    });
}

// ========== Weather ==========
function fetchWeather(lat, lon, name) {
  lastLocation = { lat, lon, name };
  const { unit, symbol } = getTempUnitAndSymbol();
  fetch(`/weather?lat=${lat}&lon=${lon}&units=${unit}`)
    .then(res => {
      if (!res.ok) throw new Error('Weather data not available');
      return res.json();
    })
    .then(data => {
      locationEl.textContent = name;
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

// ========== Forecast ==========
function fetchForecast(lat, lon) {
  const { unit, symbol } = getTempUnitAndSymbol();
  fetch(`/forecast?lat=${lat}&lon=${lon}&units=${unit}`)
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

function updateForecastUI(forecastList, symbol) {
  const container = document.getElementById('forecast-cards');
  container.innerHTML = '';

  const daily = {};
  forecastList.forEach(entry => {
    const date = entry.dt_txt.split(' ')[0];
    (daily[date] ||= []).push(entry);
  });

  Object.entries(daily).slice(0, 5).forEach(([date, entries]) => {
    const temps = entries.map(e => e.main.temp);
    const icon = entries[2]?.weather[0]?.icon || entries[0].weather[0].icon;
    const desc = entries[2]?.weather[0]?.main || entries[0].weather[0].main;
    const min = Math.min(...temps);
    const max = Math.max(...temps);

    const dayName = new Date(date).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric'
    });

    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.innerHTML = `
      <p>${dayName}</p>
      <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}">
      <p>${Math.round(min)}${symbol} / ${Math.round(max)}${symbol}</p>
      <p style="font-size: 0.8rem;">${desc}</p>
    `;
    container.appendChild(card);
  });
}

function updateForecastChart(forecastList, symbol) {
  const ctx = document.getElementById('forecastChart').getContext('2d');
  const points = forecastList.filter(e => e.dt_txt.includes('12:00:00')).slice(0, 5);

  if (forecastChart) forecastChart.destroy();

  forecastChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: points.map(e =>
        new Date(e.dt_txt).toLocaleDateString(undefined, { weekday: 'short' })
      ),
      datasets: [{
        label: `Midday Temp (${symbol})`,
        data: points.map(e => e.main.temp),
        fill: true,
        borderColor: '#00796b',
        backgroundColor: 'rgba(0,121,107,0.2)',
        tension: 0.3
      }]
    },
    options: { scales: { y: { beginAtZero: false } } }
  });
}

// ========== Autocomplete ==========
cityInput.addEventListener('input', () => {
  const query = cityInput.value.trim();
  suggestionsList.innerHTML = '';
  currentSuggestionIndex = -1;
  if (query.length < 3) return;

  fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${apiKey}`)
    .then(res => res.json())
    .then(data => {
      if (!data.length) {
        const li = document.createElement('li');
        li.textContent = 'No results found';
        li.classList.add('no-results');
        suggestionsList.appendChild(li);
        return;
      }
      data.forEach(place => {
        const name = `${place.name}${place.state ? ', ' + place.state : ''}, ${place.country}`;
        const li = document.createElement('li');
        li.textContent = name;
        li.addEventListener('click', () => {
          cityInput.value = name;
          suggestionsList.innerHTML = '';
          fetchWeather(place.lat, place.lon, name);
          fetchForecast(place.lat, place.lon);
          saveRecentCity(name, place.lat, place.lon);
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
  } else if (e.key === 'Enter' && currentSuggestionIndex >= 0) {
    e.preventDefault();
    items[currentSuggestionIndex].click();
  }

  items.forEach((li, i) => {
    li.classList.toggle('active', i === currentSuggestionIndex);
  });
});

// ========== Recent Cities ==========
function saveRecentCity(name, lat, lon) {
  const existing = JSON.parse(localStorage.getItem('recentCities')) || [];
  const updated = [{ name, lat, lon }, ...existing.filter(c => c.name !== name)].slice(0, 5);
  localStorage.setItem('recentCities', JSON.stringify(updated));
  renderRecentCities();
}

function renderRecentCities() {
  const cities = JSON.parse(localStorage.getItem('recentCities')) || [];
  recentList.innerHTML = '';
  if (!cities.length) {
    recentContainer.style.display = 'none';
    return;
  }

  cities.forEach(({ name, lat, lon }) => {
    const li = document.createElement('li');
    li.textContent = name;
    li.addEventListener('click', () => {
      cityInput.value = name;
      fetchWeather(lat, lon, name);
      fetchForecast(lat, lon);
    });
    recentList.appendChild(li);
  });

  recentContainer.style.display = 'block';
}

clearRecentBtn.addEventListener('click', () => {
  localStorage.removeItem('recentCities');
  renderRecentCities();
});

// ========== Geolocation ==========
geoBtn.addEventListener('click', () => {
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

// ========== Init ==========
renderRecentCities();
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    pos => reverseGeocodeAndFetchWeather(pos.coords.latitude, pos.coords.longitude),
    () => {}
  );
}
