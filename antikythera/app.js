(function () {
  "use strict";

  const names = ["moon", "mercury", "venus", "sun", "mars", "jupiter", "saturn"];
  const bodyNames = ["Moon", "Mercury", "Venus", "Sun", "Mars", "Jupiter", "Saturn"];
  const radiusPx = [270, 307, 345, 395, 432, 470, 510];
  const baseMax = Math.max(...radiusPx);

  const canvas = document.getElementById("ringsCanvas");
  const ctx = canvas.getContext("2d");
  const dateInput = document.getElementById("dateInput");
  const dateSlider = document.getElementById("dateSlider");
  const readout = document.getElementById("readout");
  const launchDate = new Date();
  const images = new Map();
  let angles = new Array(names.length).fill(0);
  let currentDate = new Date(launchDate.getTime());
  let imagesReady = false;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatUtcInput(date) {
    return [
      date.getUTCFullYear(),
      pad(date.getUTCMonth() + 1),
      pad(date.getUTCDate())
    ].join("-") + "T" + [
      pad(date.getUTCHours()),
      pad(date.getUTCMinutes())
    ].join(":");
  }

  function parseUtcInput(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }

    const [, year, month, day, hour, minute] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function daysBetween(a, b) {
    return (a.getTime() - b.getTime()) / 86400000;
  }

  function addUtcParts(date, parts) {
    const next = new Date(date.getTime());
    next.setUTCFullYear(next.getUTCFullYear() + (parts.years || 0));
    next.setUTCMonth(next.getUTCMonth() + (parts.months || 0));
    next.setUTCDate(next.getUTCDate() + (parts.days || 0));
    return next;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function calculateAngles(date) {
    const astroTime = Astronomy.MakeTime(date);
    angles = bodyNames.map((bodyName) => {
      const vector = Astronomy.GeoVector(Astronomy.Body[bodyName], astroTime, true);
      return Astronomy.Ecliptic(vector).elon;
    });
  }

  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);

    if (!imagesReady || width <= 0 || height <= 0) {
      return;
    }

    const diskSize = Math.min(width, height) * 0.67;
    const x0 = (width - diskSize) / 2;
    const y0 = (height - diskSize) / 2;
    const centerX = x0 + diskSize / 2;
    const centerY = y0 + diskSize / 2;

    names.forEach((name, index) => {
      const image = images.get(name);
      const scale = (radiusPx[index] * 2) / image.naturalWidth * (diskSize / (2 * baseMax));
      const size = image.naturalWidth * scale;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((-angles[index] * Math.PI) / 180);
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
      ctx.restore();
    });
  }

  function renderReadout() {
    readout.innerHTML = names.map((name, index) => (
      `<div><strong>${name}</strong>${angles[index].toFixed(2)} deg</div>`
    )).join("");
  }

  function setDate(date, options) {
    currentDate = date;
    calculateAngles(currentDate);

    if (!options || options.updateInput !== false) {
      dateInput.value = formatUtcInput(currentDate);
    }

    if (!options || options.updateSlider !== false) {
      dateSlider.value = String(daysBetween(currentDate, launchDate));
    }

    renderReadout();
    draw();
  }

  function loadImages() {
    return Promise.all(names.map((name) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        images.set(name, image);
        resolve();
      };
      image.onerror = () => reject(new Error(`Could not load ring image: ${name}`));
      image.src = `Rings/ring_${name}.png`;
    })));
  }

  dateSlider.addEventListener("input", () => {
    const offsetDays = Number(dateSlider.value);
    setDate(new Date(launchDate.getTime() + offsetDays * 86400000), { updateSlider: false });
  });

  dateInput.addEventListener("change", () => {
    const parsed = parseUtcInput(dateInput.value);
    if (parsed) {
      setDate(parsed, { updateInput: false });
    } else {
      dateInput.value = formatUtcInput(currentDate);
    }
  });

  document.querySelectorAll(".button-row button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "now") {
        setDate(new Date());
        return;
      }

      setDate(addUtcParts(currentDate, {
        days: Number(button.dataset.days || 0),
        months: Number(button.dataset.months || 0),
        years: Number(button.dataset.years || 0)
      }));
    });
  });

  window.addEventListener("resize", resizeCanvas);

  loadImages()
    .then(() => {
      imagesReady = true;
      setDate(currentDate);
      resizeCanvas();
    })
    .catch((error) => {
      readout.textContent = error.message;
    });
}());
