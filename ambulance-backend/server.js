
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Traffic signals along a straight road (going north)
// Ambulance starts south and travels north
let signals = [
  { id: "S1", lat: 17.3845, lng: 78.4867, state: "RED", name: "Signal 1" },
  { id: "S2", lat: 17.3855, lng: 78.4867, state: "RED", name: "Signal 2" },
  { id: "S3", lat: 17.3865, lng: 78.4867, state: "RED", name: "Signal 3" }
];

// Track which signal was last turned green
let currentGreenSignal = null;
let passedSignals = [];

io.on("connection", socket => {
  console.log("🚑 Ambulance connected");

  socket.on("ambulance_location", data => {
    // Calculate distance to each signal
    let signalDistances = signals.map(signal => ({
      ...signal,
      distance: getDistance(data.lat, data.lng, signal.lat, signal.lng)
    }));

    // Sort by distance (nearest first)
    signalDistances.sort((a, b) => a.distance - b.distance);

    const nearest = signalDistances[0];
    const DISTANCE_THRESHOLD = 30; // meters

    // Reset all signals to RED first
    signals.forEach(s => s.state = "RED");

    // Only turn signal green if ambulance is within 30 meters AND hasn't passed it yet
    if(nearest && nearest.distance <= DISTANCE_THRESHOLD && !passedSignals.includes(nearest.id)){
      signals.find(s => s.id === nearest.id).state = "GREEN";
      currentGreenSignal = nearest.id;
      console.log(`🟢 Signal ${nearest.id} turned GREEN (ambulance ${Math.floor(nearest.distance)}m away)`);
    }

    // Mark signals as passed when ambulance moves beyond them
    // A signal is "passed" when ambulance is north of it and more than 50m away
    signalDistances.forEach(s => {
      if(data.lat > s.lat + 0.0002 && s.distance > 50 && !passedSignals.includes(s.id)){
        passedSignals.push(s.id);
        console.log(`✅ Ambulance passed ${s.id}`);
      }
    });

    // Reset passed signals if ambulance starts over (for demo purposes)
    if(data.lat < 17.3840){
      passedSignals = [];
      console.log("🔄 Route reset - ambulance at start");
    }

    // Send nearest signal info to dashboard
    io.emit("nearest_signal", {
      id: nearest.id,
      distance: Math.floor(nearest.distance),
      eta: Math.floor(nearest.distance / 20)
    });

    // Send all signals states
    io.emit("signal_update", signals);
  });

  socket.on("hospital_destination", data => {
    console.log("🏥 Ambulance heading to:", data.hospitalName);
    io.emit("destination_update", data);
  });
});

function getDistance(lat1, lng1, lat2, lng2){
  // Haversine-like approximation for small distances
  const dx = (lat1 - lat2) * 111000;
  const dy = (lng1 - lng2) * 111000;
  return Math.sqrt(dx*dx + dy*dy);
}

server.listen(3000, () => {
  console.log("✅ Backend running on http://localhost:3000");
  console.log("🚑 Ambulance Traffic Signal Preemption System");
  console.log("📍 Route: South → North (3 signals: S1 → S2 → S3)");
});

