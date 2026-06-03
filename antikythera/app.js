(function () {
  "use strict";

  const names = ["moon", "mercury", "venus", "sun", "mars", "jupiter", "saturn"];
  const bodyNames = ["Moon", "Mercury", "Venus", "Sun", "Mars", "Jupiter", "Saturn"];
  const radiusPx = [270, 307, 345, 395, 432, 470, 510];
  const calendarMonths = [
    { name: "Jan", days: 31 },
    { name: "Feb", days: 28 },
    { name: "Mar", days: 31 },
    { name: "Apr", days: 30 },
    { name: "May", days: 31 },
    { name: "Jun", days: 30 },
    { name: "Jul", days: 31 },
    { name: "Aug", days: 31 },
    { name: "Sep", days: 30 },
    { name: "Oct", days: 31 },
    { name: "Nov", days: 30 },
    { name: "Dec", days: 31 }
  ];
  const calendarYearDays = 365;
  const janFirstSunLongitude = 280;
  const moonLayer = "moon";
  const overlayLayers = names.filter((name) => name !== moonLayer);
  const imageFiles = {
    moon: "ring_moon_masked.png",
    mercury: "ring_mercury.png",
    venus: "ring_venus.png",
    sun: "ring_sun.png",
    mars: "ring_mars.png",
    jupiter: "ring_jupiter.png",
    saturn: "ring_saturn.png"
  };
  const baseMax = Math.max(...radiusPx);

  const canvas = document.getElementById("ringsCanvas");
  const ctx = canvas.getContext("2d");
  const dateInput = document.getElementById("dateInput");
  const dateSlider = document.getElementById("dateSlider");
  const timeZoneSelect = document.getElementById("timeZoneSelect");
  const readout = document.getElementById("readout");
  const launchDate = new Date();
  const images = new Map();
  let angles = new Array(names.length).fill(0);
  let lunarNodeLongitude = 0;
  let currentDate = new Date(launchDate.getTime());
  let imagesReady = false;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function getSelectedTimeZone() {
    return timeZoneSelect.value || "UTC";
  }

  function getZonedParts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    const parts = {};
    formatter.formatToParts(date).forEach((part) => {
      parts[part.type] = part.value;
    });

    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second)
    };
  }

  function formatDateInput(date, timeZone) {
    const parts = getZonedParts(date, timeZone);
    return [
      parts.year,
      pad(parts.month),
      pad(parts.day)
    ].join("-") + "T" + [
      pad(parts.hour),
      pad(parts.minute)
    ].join(":");
  }

  function getTimeZoneOffsetMs(date, timeZone) {
    const parts = getZonedParts(date, timeZone);
    const zonedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    return zonedAsUtc - date.getTime();
  }

  function parseDateInput(value, timeZone) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }

    const [, year, month, day, hour, minute] = match.map(Number);
    const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    let utcTime = localAsUtc;

    for (let i = 0; i < 3; i += 1) {
      utcTime = localAsUtc - getTimeZoneOffsetMs(new Date(utcTime), timeZone);
    }

    const date = new Date(utcTime);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function daysBetween(a, b) {
    return (a.getTime() - b.getTime()) / 86400000;
  }

  function addZonedParts(date, parts, timeZone) {
    const zoned = getZonedParts(date, timeZone);
    const localDate = new Date(Date.UTC(
      zoned.year + (parts.years || 0),
      zoned.month - 1 + (parts.months || 0),
      zoned.day + (parts.days || 0),
      zoned.hour,
      zoned.minute,
      0
    ));
    return parseDateInput(formatDateInput(localDate, "UTC"), timeZone);
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

    lunarNodeLongitude = calculateLunarNodeLongitude(date);
  }

  function angularDelta(fromDegrees, toDegrees) {
    return ((((toDegrees - fromDegrees) % 360) + 540) % 360) - 180;
  }

  function calculateLunarNodeLongitude(date) {
    const targetTime = Astronomy.MakeTime(date);
    let node = Astronomy.SearchMoonNode(targetTime.AddDays(-35));
    let previousAscending = null;
    let nextAscending = null;

    for (let i = 0; i < 6; i += 1) {
      if (node.kind === Astronomy.NodeEventKind.Ascending) {
        if (node.time.ut <= targetTime.ut) {
          previousAscending = node;
        } else {
          nextAscending = node;
          break;
        }
      }

      node = Astronomy.NextMoonNode(node);
    }

    if (!previousAscending || !nextAscending) {
      return Astronomy.EclipticGeoMoon(node.time).lon;
    }

    const startLongitude = Astronomy.EclipticGeoMoon(previousAscending.time).lon;
    const endLongitude = Astronomy.EclipticGeoMoon(nextAscending.time).lon;
    const fraction = (targetTime.ut - previousAscending.time.ut) / (nextAscending.time.ut - previousAscending.time.ut);
    return (startLongitude + angularDelta(startLongitude, endLongitude) * fraction + 360) % 360;
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

    function drawRing(name) {
      const index = names.indexOf(name);
      const image = images.get(name);
      const scale = (radiusPx[index] * 2) / image.naturalWidth * (diskSize / (2 * baseMax));
      const size = image.naturalWidth * scale;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((-angles[index] * Math.PI) / 180);
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    function drawDraconicPointer() {
      const pointerRadius = diskSize * 0.49;
      const shaftStart = pointerRadius * 0.76;
      const shaftEnd = -pointerRadius * 0.93;
      const headLength = Math.max(18, diskSize * 0.052);
      const headWidth = Math.max(14, diskSize * 0.038);
      const tailWidth = Math.max(12, diskSize * 0.032);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((-lunarNodeLongitude * Math.PI) / 180);

      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.48)";
      ctx.lineWidth = Math.max(7, diskSize * 0.016);
      ctx.beginPath();
      ctx.moveTo(2, shaftStart + 2);
      ctx.lineTo(2, shaftEnd + 2);
      ctx.stroke();

      ctx.strokeStyle = "#111111";
      ctx.lineWidth = Math.max(5, diskSize * 0.011);
      ctx.beginPath();
      ctx.moveTo(0, shaftStart);
      ctx.lineTo(0, shaftEnd);
      ctx.stroke();

      ctx.strokeStyle = "#d8b46a";
      ctx.lineWidth = Math.max(2, diskSize * 0.005);
      ctx.beginPath();
      ctx.moveTo(0, shaftStart);
      ctx.lineTo(0, shaftEnd);
      ctx.stroke();

      ctx.fillStyle = "#e6d4a5";
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, shaftEnd - headLength);
      ctx.lineTo(-headWidth, shaftEnd + headLength * 0.22);
      ctx.lineTo(0, shaftEnd);
      ctx.lineTo(headWidth, shaftEnd + headLength * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#c7a45b";
      ctx.beginPath();
      ctx.moveTo(0, shaftStart + headLength * 0.65);
      ctx.lineTo(-tailWidth, shaftStart - headLength * 0.16);
      ctx.lineTo(tailWidth, shaftStart - headLength * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    function polarPoint(radius, longitudeDegrees) {
      const radians = (-longitudeDegrees - 90) * Math.PI / 180;
      return {
        x: Math.cos(radians) * radius,
        y: Math.sin(radians) * radius
      };
    }

    function drawTextOnRing(text, radius, longitudeDegrees, size, color, weight) {
      const point = polarPoint(radius, longitudeDegrees);

      ctx.save();
      ctx.translate(centerX + point.x, centerY + point.y);
      ctx.rotate((-longitudeDegrees * Math.PI) / 180);
      ctx.fillStyle = color;
      ctx.font = `${weight || 650} ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }

    function calendarLongitude(dayOfYear) {
      return (janFirstSunLongitude + (dayOfYear / calendarYearDays) * 360) % 360;
    }

    function drawCalendarRing() {
      const outerRadius = diskSize * 0.482;
      const innerRadius = diskSize * 0.445;
      const midRadius = (outerRadius + innerRadius) / 2;
      let monthStartDay = 0;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.strokeStyle = "rgba(30, 24, 15, 0.62)";
      ctx.lineWidth = Math.max(1, diskSize * 0.002);
      [innerRadius, outerRadius].forEach((radius) => {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
      });

      for (let day = 0; day < calendarYearDays; day += 5) {
        const longitude = calendarLongitude(day);
        const tick = day % 30 === 0 ? 0.018 : 0.011;
        const start = polarPoint(outerRadius, longitude);
        const end = polarPoint(outerRadius - diskSize * tick, longitude);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }

      calendarMonths.forEach((month) => {
        const boundaryLongitude = calendarLongitude(monthStartDay);
        const start = polarPoint(outerRadius, boundaryLongitude);
        const end = polarPoint(innerRadius, boundaryLongitude);

        ctx.strokeStyle = "rgba(30, 24, 15, 0.78)";
        ctx.lineWidth = Math.max(1.2, diskSize * 0.003);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        monthStartDay += month.days;
      });
      ctx.restore();

      monthStartDay = 0;
      calendarMonths.forEach((month) => {
        const centerDay = monthStartDay + month.days / 2;
        drawTextOnRing(
          month.name,
          midRadius,
          calendarLongitude(centerDay),
          Math.max(8, diskSize * 0.018),
          "rgba(18, 14, 9, 0.82)",
          700
        );
        monthStartDay += month.days;
      });
    }

    drawRing(moonLayer);
    overlayLayers.forEach(drawRing);
    drawCalendarRing();
    drawDraconicPointer();
  }

  function renderReadout() {
    const planetReadout = names.map((name, index) => (
      `<div><strong>${name}</strong>${angles[index].toFixed(2)} deg</div>`
    ));
    planetReadout.push(`<div><strong>node</strong>${lunarNodeLongitude.toFixed(2)} deg</div>`);
    readout.innerHTML = planetReadout.join("");
  }

  function setDate(date, options) {
    currentDate = date;
    calculateAngles(currentDate);

    if (!options || options.updateInput !== false) {
      dateInput.value = formatDateInput(currentDate, getSelectedTimeZone());
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
      image.src = `Rings/${imageFiles[name]}`;
    })));
  }

  dateSlider.addEventListener("input", () => {
    const offsetDays = Number(dateSlider.value);
    setDate(new Date(launchDate.getTime() + offsetDays * 86400000), { updateSlider: false });
  });

  dateInput.addEventListener("change", () => {
    const parsed = parseDateInput(dateInput.value, getSelectedTimeZone());
    if (parsed) {
      setDate(parsed, { updateInput: false });
    } else {
      dateInput.value = formatDateInput(currentDate, getSelectedTimeZone());
    }
  });

  timeZoneSelect.addEventListener("change", () => {
    dateInput.value = formatDateInput(currentDate, getSelectedTimeZone());
  });

  document.querySelectorAll(".button-row button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "now") {
        setDate(new Date());
        return;
      }

      setDate(addZonedParts(currentDate, {
        days: Number(button.dataset.days || 0) + Number(button.dataset.weeks || 0) * 7,
        months: Number(button.dataset.months || 0),
        years: Number(button.dataset.years || 0)
      }, getSelectedTimeZone()));
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
