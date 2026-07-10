const camera = document.querySelector('#camera');
const cameraButton = document.querySelector('#cameraButton');
const imagePicker = document.querySelector('#imagePicker');
const overlay = document.querySelector('#overlay');
const welcome = document.querySelector('#welcome');
const opacity = document.querySelector('#opacity');
const opacityValue = document.querySelector('#opacityValue');
const opacityRow = document.querySelector('#opacityRow');
const imageActions = document.querySelector('#imageActions');
const resetButton = document.querySelector('#resetButton');
const removeButton = document.querySelector('#removeButton');
const pickerLabel = document.querySelector('#pickerLabel');
const awakeStatus = document.querySelector('#awakeStatus');
const notice = document.querySelector('#notice');

let cameraStream = null;
let wakeLock = null;
let imageURL = null;
let x = 0;
let y = 0;
let scale = 1;
const pointers = new Map();
let gestureStart = null;
let noticeTimer = null;

function showNotice(message, duration = 4200) {
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, duration);
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    awakeStatus.hidden = true;
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    awakeStatus.classList.add('active');
    wakeLock.addEventListener('release', () => awakeStatus.classList.remove('active'));
  } catch {
    awakeStatus.classList.remove('active');
  }
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showNotice('Camera access requires Safari and a secure HTTPS connection.');
    return;
  }

  try {
    cameraStream?.getTracks().forEach(track => track.stop());
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    camera.srcObject = cameraStream;
    await camera.play();
    cameraButton.textContent = 'Camera on';
    cameraButton.disabled = true;
    await requestWakeLock();
  } catch (error) {
    const denied = error?.name === 'NotAllowedError';
    showNotice(denied
      ? 'Camera permission was denied. Enable Camera for this website in Safari settings.'
      : 'The camera could not be started. Try closing other apps using the camera.');
  }
}

function renderTransform() {
  overlay.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`;
}

function resetTransform() {
  x = 0;
  y = 0;
  scale = 1;
  renderTransform();
}

function removeImage() {
  overlay.hidden = true;
  overlay.removeAttribute('src');
  if (imageURL) URL.revokeObjectURL(imageURL);
  imageURL = null;
  imagePicker.value = '';
  opacityRow.hidden = true;
  imageActions.hidden = true;
  welcome.hidden = false;
  pickerLabel.textContent = 'Choose picture';
  resetTransform();
}

function pointerDistance() {
  const points = [...pointers.values()];
  return Math.hypot(points[1].clientX - points[0].clientX, points[1].clientY - points[0].clientY);
}

function pointerCenter() {
  const points = [...pointers.values()];
  if (points.length === 1) return points[0];
  return {
    clientX: (points[0].clientX + points[1].clientX) / 2,
    clientY: (points[0].clientY + points[1].clientY) / 2
  };
}

overlay.addEventListener('pointerdown', event => {
  event.preventDefault();
  overlay.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, event);
  const center = pointerCenter();
  gestureStart = {
    x,
    y,
    scale,
    centerX: center.clientX,
    centerY: center.clientY,
    distance: pointers.size > 1 ? pointerDistance() : 0
  };
});

overlay.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId) || !gestureStart) return;
  event.preventDefault();
  pointers.set(event.pointerId, event);
  const center = pointerCenter();
  x = gestureStart.x + center.clientX - gestureStart.centerX;
  y = gestureStart.y + center.clientY - gestureStart.centerY;
  if (pointers.size > 1 && gestureStart.distance) {
    scale = Math.min(8, Math.max(.18, gestureStart.scale * pointerDistance() / gestureStart.distance));
  }
  renderTransform();
});

function finishPointer(event) {
  pointers.delete(event.pointerId);
  if (pointers.size) {
    const center = pointerCenter();
    gestureStart = { x, y, scale, centerX: center.clientX, centerY: center.clientY, distance: 0 };
  } else {
    gestureStart = null;
  }
}

overlay.addEventListener('pointerup', finishPointer);
overlay.addEventListener('pointercancel', finishPointer);

cameraButton.addEventListener('click', startCamera);
resetButton.addEventListener('click', resetTransform);
removeButton.addEventListener('click', removeImage);

opacity.addEventListener('input', () => {
  const value = Number(opacity.value);
  overlay.style.opacity = value / 100;
  opacityValue.textContent = `${value}%`;
});

imagePicker.addEventListener('change', async () => {
  const file = imagePicker.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showNotice('Please choose an image file.');
    return;
  }

  if (imageURL) URL.revokeObjectURL(imageURL);
  imageURL = URL.createObjectURL(file);
  overlay.src = imageURL;
  overlay.hidden = false;
  overlay.style.opacity = Number(opacity.value) / 100;
  welcome.hidden = true;
  opacityRow.hidden = false;
  imageActions.hidden = false;
  pickerLabel.textContent = 'Change picture';
  resetTransform();
  await requestWakeLock();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (cameraStream || imageURL)) requestWakeLock();
});

window.addEventListener('pagehide', () => {
  cameraStream?.getTracks().forEach(track => track.stop());
  wakeLock?.release();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}

renderTransform();
