const apiKey = '7ffbf6abfaff1128113839610ff07031';

// DOM elements
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
let lastLocation = {
  lat: null,
  lon: null,
  name: ''
};

// ============ THEME ============ //
const themeToggle = document.getElementById('theme-toggle');
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
let savedTheme = localStorage.getItem('theme');

if (!savedTheme) {
  savedTheme = systemPrefersDark ? 'dark' : 'light';
  localStorage.setItem('theme', savedTheme);
}
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const newTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
  localStorage.setItem('theme', newTheme);
  applyTheme(newTheme);
});

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark');
    themeToggle.textContent = '☀️';
  } else {
    document.body.classList.remove('dark');
    themeToggle.textContent = '🌙';
  }
}

// ============ SEARCH ============ //
form.addEventListener('submit', e => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (!city) return;

  errorEl.textContent = '';
  weatherDiv.style.display = 'none';
  document.getElementById('forecast').style.display = 'none';

  fetchCoordinates(city);
});



function fetchCoordinates(city) {
  fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=5&appid=${apiKey}`)
  .then(res => res.json())
  .then(data => {
    if (data.length === 0) throw new Error('City not found');
    const place = data[0];
    const locationText = `${place.name}${place.state ? ', ' + place.state : ''}, ${place.country}`;
    fetchWeather(place.lat, place.lon, locationText);
    fetchForecast(place.lat, place.lon);  // pass lat, lon here
    saveRecentCity(locationText, place.lat, place.lon);
  })
  .catch(err => {
    errorEl.textContent = err.message;
  });
}

function fetchWeather(lat, lon, locationText) {
  lastLocation = { lat, lon, name: locationText };
  const url = `/weather?lat=${lat}&lon=${lon}&units=${tempUnit}`;
   fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('Weather data not available');
      return res.json();
    })
    .then(data => {
      locationEl.textContent = locationText;
      tempEl.textContent = Math.round(data.main.temp) + tempSymbol;
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

// ============ AUTOCOMPLETE ============ //
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

// ============ RECENT CITIES ============ //
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

// ============ GEOLOCATION ============ //
document.getElementById('geo-btn').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        reverseGeocodeAndFetchWeather(lat, lon);
      },
      err => {
        errorEl.textContent = 'Location permission denied.';
      }
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
      const loc = data[0];
      const name = `${loc.name}${loc.state ? ', ' + loc.state : ''}, ${loc.country}`;
      fetchWeather(lat, lon, name);
      fetchForecast(lat, lon);
      saveRecentCity(name, lat, lon);
    })
    .catch(err => {
      errorEl.textContent = 'Could not get your location weather.';
    });
}

// ============ INIT ============ //
renderRecentCities();

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      reverseGeocodeAndFetchWeather(lat, lon);
    },
    () => {} 
  );
}

let forecastChart; // global chart ref

function fetchForecast(lat, lon) {
  console.log('Fetching forecast for:', lat, lon);
  const url = `/forecast?lat=${lat}&lon=${lon}&units=${tempUnit}`;
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('Forecast data not available');
      return res.json();
    })
    .then(data => {
      updateForecastUI(data.list);
      updateForecastChart(data.list);
      document.getElementById('forecast').style.display = 'block';  // make sure forecast is visible
    })
    .catch(err => {
      errorEl.textContent = err.message;
    });
}


function updateForecastUI(forecastList) {
  console.log('Updating forecast UI with', forecastList.length, 'items');
  const forecastDiv = document.getElementById('forecast');
  const forecastCards = document.getElementById('forecast-cards');
  forecastCards.innerHTML = '';

  const daily = {};

  forecastList.forEach(entry => {
    const date = entry.dt_txt.split(' ')[0];
    if (!daily[date]) {
      daily[date] = [];
    }
    daily[date].push(entry);
  });

  const days = Object.keys(daily).slice(0, 5);

  days.forEach(date => {
    const entries = daily[date];
    const temps = entries.map(e => e.main.temp);
    const weatherIcon = entries[2]?.weather[0]?.icon || entries[0].weather[0].icon;
    const weatherDesc = entries[2]?.weather[0]?.main || entries[0].weather[0].main;

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
      <img src="https://openweathermap.org/img/wn/${weatherIcon}@2x.png" alt="${weatherDesc}">
      <p>${Math.round(min)}${tempSymbol} / ${Math.round(max)}${tempSymbol}</p>
      <p style="font-size: 0.8rem;">${weatherDesc}</p>
    `;

    forecastCards.appendChild(card);
  });

  forecastDiv.style.display = 'block';
}

let tempUnit = localStorage.getItem('unit') || 'metric';
let tempSymbol = tempUnit === 'metric' ? '°C' : '°F';


function updateForecastChart(forecastList) {
  console.log('Updating forecast chart');
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
        label: `Midday Temp (${tempSymbol})`,
        data: temps,
        fill: true,
        borderColor: '#00796b',
        backgroundColor: 'rgba(0,121,107,0.2)',
        tension: 0.3
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: false
        }
      }
    }
  });
}

document.getElementById('unit-toggle').addEventListener('click', () => {
  tempUnit = tempUnit === 'metric' ? 'imperial' : 'metric';
  tempSymbol = tempUnit === 'metric' ? '°C' : '°F';
  localStorage.setItem('unit', tempUnit);
  document.getElementById('unit-toggle').textContent = tempUnit === 'metric' ? '°F' : '°C';

  if (lastLocation.lat && lastLocation.lon) {
    fetchWeather(lastLocation.lat, lastLocation.lon, lastLocation.name);
    fetchForecast(lastLocation.lat, lastLocation.lon);
  }
});

document.getElementById('unit-toggle').textContent = tempUnit === 'metric' ? '°F' : '°C';
