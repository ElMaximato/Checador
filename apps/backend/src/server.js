require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { iniciarJobJornadasVencidas } = require("./jobs/jornadasVencidas");
const { opcionesSocket } = require("./config/cors");
const { MODO: MODO_ROSTRO, precalentar: precalentarRostro } = require("./utils/rostro");

const server = http.createServer(app);

// La TV se conecta aquí y escucha eventos como 'nuevo-registro' y
// 'anuncio-nuevo'. Los controllers de attendance emiten a través de
// esta misma instancia (ver TODOs en attendance.controller.js).
const io = new Server(server, opcionesSocket);

io.on("connection", (socket) => {
  console.log("Cliente conectado (posible TV):", socket.id);
  socket.on("disconnect", () => console.log("Cliente desconectado:", socket.id));
});

app.set("io", io);

iniciarJobJornadasVencidas();

// Carga el detector de rostros ahora, para ver en consola si quedó bien instalado
// (si no, la primera foto real tardaría más y el error aparecería ahí).
if (MODO_ROSTRO !== "desactivado") {
  precalentarRostro()
    .then(() => console.log(`Verificación de rostro lista (modo ${MODO_ROSTRO})`))
    .catch((err) => console.error(`[rostro] El detector NO arrancó (modo ${MODO_ROSTRO}): ${err.message}`));
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Backend escuchando en puerto ${PORT}`));