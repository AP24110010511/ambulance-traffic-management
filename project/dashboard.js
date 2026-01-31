
const socket = io("http://localhost:3000");

// Ambulance starting position - south of all signals
let lat = 17.3835;
let lng = 78.4867;
let tracking = false;
let intervalId = null;

let map, ambulanceMarker;
let signalMarkers = {};
let roadPolyline;

// Signal configuration - 3 signals along a straight road going north
// Road: Latitudes from 17.3835 to 17.3870 (North direction)
let signals = [
  { id: "S1", lat: 17.3845, lng: 78.4867, state: "RED", name: "Signal 1" },
  { id: "S2", lat: 17.3855, lng: 78.4867, state: "RED", name: "Signal 2" },
  { id: "S3", lat: 17.3865, lng: 78.4867, state: "RED", name: "Signal 3" }
];

// Hospital destinations with coordinates
const hospitals = {
  "Apollo": { lat: 17.3880, lng: 78.4867 },
  "KIMS": { lat: 17.3875, lng: 78.4867 },
  "Continental": { lat: 17.3870, lng: 78.4867 }
};

// Initialize Leaflet map
function initMap(){
  map = L.map('map').setView([lat,lng],16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Create road path (straight line going north)
  roadPolyline = L.polyline([
    [17.3830, 78.4867],  // South of Signal 1
    [17.3875, 78.4867]   // North of Signal 3
  ], {
    color: '#3b82f6',    // Blue road
    weight: 12,
    opacity: 0.7
  }).addTo(map);

  // Add road labels
  L.marker([17.3832, 78.4872], {
    icon: L.divIcon({
      className: 'road-label',
      html: '📍 START',
      iconSize: [60, 20]
    })
  }).addTo(map);

  // Create ambulance marker
  ambulanceMarker = L.marker([lat,lng], {
    icon: L.divIcon({
      className: 'ambulance-icon',
      html: '🚑',
      iconSize: [40, 40]
    })
  }).addTo(map);

  // Create signal markers along the road
  signals.forEach(s => {
    const signalIcon = L.divIcon({
      className: 'signal-marker',
      html: `<div style="
        background: #ef4444;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 4px solid white;
        box-shadow: 0 0 15px #ef4444;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        color: white;
        transition: all 0.3s ease;
      ">${s.id}</div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    signalMarkers[s.id] = L.marker([s.lat, s.lng], {icon: signalIcon})
      .addTo(map)
      .bindPopup(`<b>${s.name}</b><br>State: <span style="color:#ef4444">🔴 RED</span>`);
  });
}
window.onload = initMap;

// Check login and display user info
function checkLogin(){
  const username = localStorage.getItem('username');
  const userRole = localStorage.getItem('userRole');
  
  if(!username){
    window.location.href = 'login.html';
    return;
  }
  
  const roleIcon = userRole === 'admin' ? '👮' : '🚑';
  document.getElementById('userInfo').textContent = `${roleIcon} ${username}`;
}

// Logout function
function logout(){
  localStorage.removeItem('username');
  localStorage.removeItem('userRole');
  window.location.href = 'login.html';
}

// Run check login on page load
checkLogin();

// Hospital selection - only for drivers
const hospitalSelect = document.getElementById("hospital");
if(hospitalSelect){
  hospitalSelect.addEventListener("change", function(e){
    if(e.target.value){
      const userRole = localStorage.getItem('userRole');
      if(userRole === 'driver'){
        document.getElementById("hospitalStatus").textContent = "Destination Set";
        document.getElementById("destinationName").textContent = e.target.options[e.target.selectedIndex].text;
        document.getElementById("hospitalStatus").className = "green";
        
        socket.emit("hospital_destination", {
          hospital: e.target.value,
          hospitalName: e.target.options[e.target.selectedIndex].text
        });
      } else {
        document.getElementById("hospitalStatus").textContent = "Admin View Only";
        document.getElementById("hospitalStatus").className = "yellow";
      }
    }
  });
}

// Update ambulance position
function updateMap(){
  ambulanceMarker.setLatLng([lat,lng]);
  map.setView([lat,lng]);
}

// Start / Stop
document.getElementById("controlBtn").onclick = ()=>{
  const userRole = localStorage.getItem('userRole');
  if(userRole === 'driver'){
    const hospital = document.getElementById("hospital").value;
    if(!hospital){
      alert('⚠️ Please select a hospital destination first!');
      return;
    }
  }
  
  tracking = !tracking;
  document.getElementById("controlBtn").textContent = tracking?"Stop Ambulance":"Start Ambulance";
  if(tracking) startTracking(); else stopTracking();
};

// Simulate GPS - ambulance moves north along the road
function startTracking(){
  if(intervalId) return;
  intervalId = setInterval(()=>{
    if(!tracking) return;

    // Move ambulance north (increase latitude)
    lat += 0.00003;
    
    document.getElementById("lat").textContent = lat.toFixed(4);
    document.getElementById("lng").textContent = lng.toFixed(4);
    updateMap();

    // Find nearest signal
    let nearest = signals[0];
    let minD = Infinity;
    signals.forEach(s=>{
      let d = map.distance([lat,lng],[s.lat,s.lng]);
      if(d<minD){ nearest=s; minD=d; }
    });

    // Update dashboard
    document.getElementById("distance").textContent=Math.floor(minD);
    document.getElementById("eta").textContent=Math.floor(minD/20);
    document.getElementById("nearestSignal").textContent=nearest.id;

    // Send location to backend for signal control
    socket.emit("ambulance_location",{lat,lng,speed:60});

    // Stop when ambulance reaches beyond last signal
    if(lat > 17.3875){
      stopTracking();
      document.getElementById("controlBtn").textContent = "Start Ambulance";
      tracking = false;
      alert("🏥 Hospital reached! Destination: " + document.getElementById("hospital").options[document.getElementById("hospital").selectedIndex].text);
    }

  },300);
}

function stopTracking(){ clearInterval(intervalId); intervalId=null; }

// Receive nearest signal info
socket.on("nearest_signal",data=>{
  document.getElementById("distance").textContent=data.distance;
  document.getElementById("eta").textContent=data.eta;
  document.getElementById("nearestSignal").textContent=data.id;
});

// Receive signal updates from backend
socket.on("signal_update",signals=>{
  signals.forEach(s=>{
    if(signalMarkers[s.id]){
      const isGreen = s.state === "GREEN";
      const color = isGreen ? '#22c55e' : '#ef4444';
      
      // Update marker appearance
      const newHtml = `<div style="
        background: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 4px solid white;
        box-shadow: 0 0 15px ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        color: white;
        transition: all 0.3s ease;
      ">${s.id}</div>`;
      
      signalMarkers[s.id].setIcon(L.divIcon({
        className: 'signal-marker',
        html: newHtml,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      }));
      
      signalMarkers[s.id].getPopup().setContent(
        `<b>${s.name}</b><br>State: <span style="color:${color}">${isGreen ? '🟢 GREEN' : '🔴 RED'}</span>`
      );
    }
  });
  
  // Update traffic light panel
  const anyGreen = signals.some(s => s.state === "GREEN");
  if(anyGreen){
    document.getElementById("green").classList.add("active");
    document.getElementById("red").classList.remove("active");
  } else {
    document.getElementById("red").classList.add("active");
    document.getElementById("green").classList.remove("active");
  }
});

