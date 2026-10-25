// ========== API Configuration ==========
const API_KEY = '47b9f9710cdd569547970b9522c3dbe3'; // Get from: https://openweathermap.org/api
const API_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const GEO_API_URL = 'https://api.openweathermap.org/geo/1.0';

// ========== State Management ==========
let currentUnit = 'C';
let currentCity = null;
let weatherData = null;
let forecastData = null;
let searchTimeout = null;

// ========== DOM Elements ==========
const searchInput = document.getElementById('searchInput');
const autocompleteList = document.getElementById('autocompleteList');
const mainContent = document.getElementById('mainContent');
const btnLocation = document.getElementById('btnLocation');
const tempBtns = document.querySelectorAll('.temp-btn');

// ========== Event Listeners ==========
searchInput.addEventListener('input', handleSearch);
searchInput.addEventListener('focus', () => {
    if (autocompleteList.children.length > 0) {
        autocompleteList.classList.remove('hidden');
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        autocompleteList.classList.add('hidden');
    }
});

btnLocation.addEventListener('click', getUserLocation);

tempBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        tempBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentUnit = e.target.dataset.unit;
        if (weatherData) renderWeather();
    });
});

// ========== Search & Autocomplete ==========
async function handleSearch(e) {
    const query = e.target.value.trim();

    if (query.length < 2) {
        autocompleteList.classList.add('hidden');
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => fetchCities(query), 300);
}

async function fetchCities(query) {
    try {
        const response = await fetch(
            `${GEO_API_URL}/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`
        );
        const data = await response.json();

        if (data.length === 0) {
            autocompleteList.innerHTML = '<li class="autocomplete-item">No cities found</li>';
            autocompleteList.classList.remove('hidden');
            return;
        }

        autocompleteList.innerHTML = data.map(city => `
            <li class="autocomplete-item" data-lat="${city.lat}" data-lon="${city.lon}">
                <strong>${city.name}</strong>${city.state ? ', ' + city.state : ''}, ${city.country}
            </li>
        `).join('');

        autocompleteList.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const lat = item.dataset.lat;
                const lon = item.dataset.lon;
                searchInput.value = item.textContent.trim();
                autocompleteList.classList.add('hidden');
                fetchWeather(lat, lon);
            });
        });

        autocompleteList.classList.remove('hidden');
    } catch (error) {
        console.error('Error fetching cities:', error);
        showError('Unable to fetch cities. Please check your API key.');
    }
}

// ========== Location Services ==========
function getUserLocation() {
    btnLocation.innerHTML = '<div class="spinner"></div> Getting location...';
    btnLocation.disabled = true;

    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        btnLocation.innerHTML = '<i class="fas fa-map-marker-alt"></i> Current Location';
        btnLocation.disabled = false;
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            fetchWeather(latitude, longitude);
            btnLocation.innerHTML = '<i class="fas fa-map-marker-alt"></i> Current Location';
            btnLocation.disabled = false;
        },
        (error) => {
            console.error('Geolocation error:', error);
            showError('Unable to get your location. Please check permissions.');
            btnLocation.innerHTML = '<i class="fas fa-map-marker-alt"></i> Current Location';
            btnLocation.disabled = false;
        }
    );
}

// ========== Weather Data Fetching ==========
async function fetchWeather(lat, lon) {
    try {
        mainContent.innerHTML = '<div class="status"><div class="spinner"></div> Loading weather data...</div>';

        // Fetch current weather
        const weatherResponse = await fetch(
            `${API_BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
        );
        weatherData = await weatherResponse.json();

        if (!weatherResponse.ok) {
            throw new Error('Weather data not found');
        }

        // Fetch forecast
        const forecastResponse = await fetch(
            `${API_BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
        );
        forecastData = await forecastResponse.json();

        currentCity = { lat, lon };

        // Save last city so it loads again next visit
        try {
            localStorage.setItem('lastCity', JSON.stringify(currentCity));
        } catch (e) {
            console.warn('Could not save last city:', e);
        }

        renderWeather();
        updateBackgroundByWeather();
    } catch (error) {
        console.error('Error fetching weather:', error);
        showError('Failed to fetch weather data. Please try again.');
    }
}

// ========== Render Weather ==========
function renderWeather() {
    if (!weatherData) return;

    const current = weatherData;
    const temp = convertTemp(current.main.temp);
    const feelsLike = convertTemp(current.main.feels_like);
    const windSpeed = currentUnit === 'C' ? current.wind.speed : current.wind.speed * 2.237;

    const currentDate = new Date(current.dt * 1000);
    const dateStr = currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = currentDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const sunrise = new Date(current.sys.sunrise * 1000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const sunset = new Date(current.sys.sunset * 1000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    // Main grid HTML
    let html = `
        <div class="main-grid">
            <!-- Current Weather -->
            <div class="glass-card current-weather">
                <div class="city-name">${current.name}, ${current.sys.country}</div>
                <div class="date-time">${dateStr} • ${timeStr}</div>
                <i class="fas ${getWeatherIcon(current.weather[0].main)} weather-icon-large"></i>
                <div class="temperature-large">${Math.round(temp)}°${currentUnit}</div>
                <div class="weather-description">${current.weather[0].description}</div>
                <div style="font-size: 0.9rem; opacity: 0.8; margin-top: 10px;">
                    Feels like ${Math.round(feelsLike)}°${currentUnit}
                </div>
            </div>

            <!-- Metrics Grid -->
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-icon"><i class="fas fa-droplet"></i></div>
                    <div class="metric-value">${current.main.humidity}%</div>
                    <div class="metric-label">Humidity</div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i class="fas fa-wind"></i></div>
                    <div class="metric-value">${windSpeed.toFixed(1)}</div>
                    <div class="metric-label">Wind ${currentUnit === 'C' ? 'm/s' : 'mph'}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i class="fas fa-eye"></i></div>
                    <div class="metric-value">${(current.visibility / 1000).toFixed(1)}km</div>
                    <div class="metric-label">Visibility</div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i class="fas fa-sun"></i></div>
                    <div class="metric-value">${current.main.pressure}</div>
                    <div class="metric-label">Pressure (hPa)</div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i class="fas fa-cloud-sun"></i></div>
                    <div class="metric-value">${current.clouds.all}%</div>
                    <div class="metric-label">Cloudiness</div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon"><i class="fas fa-clock"></i></div>
                    <div class="metric-value">${sunrise} / ${sunset}</div>
                    <div class="metric-label">Sunrise / Sunset</div>
                </div>
            </div>
        </div>
    `;

    // Hourly Forecast
    html += `
        <div class="glass-card forecast-section">
            <div class="forecast-title">
                <i class="fas fa-hourglass-half"></i> Hourly Forecast
            </div>
            <div class="hourly-forecast" id="hourlyForecast">
                ${renderHourlyForecast()}
            </div>
        </div>
    `;

    // Daily Forecast
    html += `
        <div class="glass-card forecast-section">
            <div class="forecast-title">
                <i class="fas fa-calendar-days"></i> 7-Day Forecast
            </div>
            <div class="daily-forecast">
                ${renderDailyForecast()}
            </div>
        </div>
    `;

    mainContent.innerHTML = html;
}

// ========== Hourly Forecast ==========
function renderHourlyForecast() {
    if (!forecastData) return '';

    // Get next 24 hours (8 forecasts of 3-hour intervals)
    const hourlyForecasts = forecastData.list.slice(0, 8);

    return hourlyForecasts.map(forecast => {
        const time = new Date(forecast.dt * 1000);
        const hour = time.toLocaleTimeString('en-US', {
            hour: '2-digit',
            hour12: true
        });
        const temp = convertTemp(forecast.main.temp);

        return `
            <div class="hour-card">
                <div class="hour-time">${hour}</div>
                <i class="fas ${getWeatherIcon(forecast.weather[0].main)} hour-icon"></i>
                <div class="hour-temp">${Math.round(temp)}°</div>
            </div>
        `;
    }).join('');
}

// ========== Daily Forecast ==========
function renderDailyForecast() {
    if (!forecastData) return '';

    // Group by day and get daily data
    const dailyForecasts = {};

    forecastData.list.forEach(forecast => {
        const date = new Date(forecast.dt * 1000).toLocaleDateString('en-US');

        if (!dailyForecasts[date]) {
            dailyForecasts[date] = {
                temps: [],
                weather: forecast.weather[0],
                date: new Date(forecast.dt * 1000)
            };
        }

        dailyForecasts[date].temps.push(forecast.main.temp);
    });

    return Object.values(dailyForecasts)
        .slice(0, 7)
        .map(day => {
            const maxTemp = Math.max(...day.temps);
            const minTemp = Math.min(...day.temps);
            const dayName = day.date.toLocaleDateString('en-US', { weekday: 'short' });

            return `
                <div class="day-card">
                    <div class="day-name">${dayName}</div>
                    <div class="day-description">
                        <div class="day-icon">
                            <i class="fas ${getWeatherIcon(day.weather.main)}"></i>
                        </div>
                        <div class="day-info">
                            <div class="day-condition">${day.weather.description}</div>
                        </div>
                    </div>
                    <div class="day-temps">
                        <div class="temp-high">${Math.round(convertTemp(maxTemp))}°</div>
                        <div class="temp-low">${Math.round(convertTemp(minTemp))}°</div>
                    </div>
                </div>
            `;
        }).join('');
}

// ========== Utility Functions ==========
function convertTemp(celsius) {
    return currentUnit === 'C' ? celsius : (celsius * 9 / 5) + 32;
}

function getWeatherIcon(weatherMain) {
    const iconMap = {
        'Clear': 'fa-sun',
        'Clouds': 'fa-cloud',
        'Rain': 'fa-cloud-rain',
        'Drizzle': 'fa-cloud-rain',
        'Thunderstorm': 'fa-bolt',
        'Snow': 'fa-snowflake',
        'Mist': 'fa-smog',
        'Smoke': 'fa-smog',
        'Haze': 'fa-smog',
        'Dust': 'fa-smog',
        'Fog': 'fa-smog',
        'Sand': 'fa-smog',
        'Ash': 'fa-smog',
        'Squall': 'fa-wind',
        'Tornado': 'fa-tornado'
    };

    return iconMap[weatherMain] || 'fa-cloud';
}

function updateBackgroundByWeather() {
    if (!weatherData) return;

    const isNight = weatherData.sys.sunset < weatherData.dt;
    const condition = weatherData.weather[0].main.toLowerCase();

    document.body.className = '';

    if (condition.includes('clear')) {
        document.body.classList.add(isNight ? 'clear-night' : 'clear-day');
    } else if (condition.includes('cloud')) {
        document.body.classList.add('cloudy');
    } else if (condition.includes('rain') || condition.includes('drizzle')) {
        document.body.classList.add('rainy');
    } else if (condition.includes('snow')) {
        document.body.classList.add('snowy');
    } else {
        document.body.classList.add(isNight ? 'clear-night' : 'clear-day');
    }
}

function showError(message) {
    mainContent.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            ${message}
        </div>
    `;
}

// ========== Initial Load ==========
function init() {
    // Try to load last searched city from localStorage
    let savedCity = null;
    try {
        savedCity = localStorage.getItem('lastCity');
    } catch (e) {
        console.warn('Could not read last city:', e);
    }

    if (savedCity) {
        const { lat, lon } = JSON.parse(savedCity);
        fetchWeather(lat, lon);
    } else {
        mainContent.innerHTML = `
            <div class="status">
                <p>👋 Welcome! Search for a city or use the "Current Location" button to get started.</p>
            </div>
        `;
    }
}

// Initialize on page load
window.addEventListener('load', init);