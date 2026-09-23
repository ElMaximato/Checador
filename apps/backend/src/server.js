require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { iniciarJobJornadasVencidas } = require("./jobs/jornadasVencidas");

const server = http.createServer(app);

// La TV se conecta aquí y escucha eventos como 'nuevo-registro' y
// 'anuncio-nuevo'. Los controllers de attendance emiten a través de
// esta misma instancia (ver TODOs en attendance.controller.js).
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("Cliente conectado (posible TV):", socket.id);
  socket.on("disconnect", () => console.log("Cliente desconectado:", socket.id));
});

app.set("io", io);

iniciarJobJornadasVencidas();

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Backend escuchando en puerto ${PORT}`));
