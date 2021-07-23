const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

const PORT = process.env.PORT || 5000;
const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, './build')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, './build/index.html'));
});

const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const queues = {
    battleship: []
}

const rooms = {
    battleship: {}
}

const codes = [];

function MakeID() {
    const characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const len = 5;
    let code = "";
    for (let i = 0; i<5; i++) {
        code += characters.charAt(Math.floor(Math.random()*characters.length));
    }
    return code;
}

function GenerateRandomMap() {
    let map = [
        ["","","","","","","","","",""],
        ["","","","","","","","","",""],
        ["","","","","","","","","",""],
        ["","","","","","","","","",""],
        ["","","","","","","","","",""],
        ["","","","","","","","","",""],
        ["","","","","","","","","",""],
        ["","","","","","","","","",""],
        ["","","","","","","","","",""],
        ["","","","","","","","","",""]
    ];
    let ships = [4, 4, 5, 3, 2];
    while(ships.length>0) {
        let x = Math.floor(Math.random()*10);
        let y = Math.floor(Math.random()*10);

        let shipLength = ships[ships.length-1];

        if (y+shipLength < 10) { // If ship can fit downwards
            let overlap = false;
            for (let i = 0; i<shipLength; i++) { // does it overlap a pre existing ship
                if (map[y+i][x] === "ship") {
                    overlap = true;
                    break;
                }
            }
            if (!overlap) {
                for (let i = 0; i<shipLength; i++) { // place ship
                    map[y+i][x] = "ship";
                }
                ships.pop();
                continue; // skip next if's
            }
        }
        if (x+shipLength < 10) { // If ship can fit right
            let overlap = false;
            for (let i = 0; i<shipLength; i++) { // does it overlap a pre existing ship
                if (map[y][x+i] === "ship") {
                    overlap = true;
                    break;
                }
            }
            if (!overlap) {
                for (let i = 0; i<shipLength; i++) { // place ship
                    map[y][x+i] = "ship";
                }
                ships.pop();
                continue; // skip next if's
            }
        }
    }
    return map;
}

function UpdateQueue(game) {
    let pairs = Math.floor(queues[game].length/2); // How many pairs of players there are
    for (let i = 0; i<pairs; i++) {
        switch(game) {
            case "battleship":
                let code = Battleship_CreateRoom();
                JoinRoom("battleship", code, queues.battleship[i*2]);
                JoinRoom("battleship", code, queues.battleship[i*2+1]);

        }
        queues[game].splice(i*2, 2);    
    }
}

function Battleship_CreateRoom() {
    let code = MakeID();
    while (codes.includes(code)) code = MakeID();
    codes.push(code);
    rooms.battleship[code] = {
        game: "battleship",
        code: code,
        turn: 0,
        winner: 2,
        players:[
            {
                id: "",
                map: GenerateRandomMap(),
                shots: [],
                rematch: false
            },
            {
                id: "",
                map: GenerateRandomMap(),
                shots: [],
                rematch: false
            }
        ]
    }
    return code;
}

function JoinRoom(game, code, player) {
    if (rooms[game][code].players[0].id === "") {
        rooms[game][code].players[0].id = player.id;
        io.to(player.id).emit("index", 0);
        player.join(code);
        if (rooms[game][code].players[1].id !== "") {
            SendRoomInfo(code, game);
        }
        else {
            io.to(code).emit("roomInfo", {
                waiting: true,
                code: code
            })
        }
    }
    else if (rooms[game][code].players[1].id === "") {
        rooms[game][code].players[1].id = player.id;
        io.to(player.id).emit("index", 1);
        player.join(code);
        if (rooms[game][code].players[0].id !== "") {
            SendRoomInfo(code, "battleship");
        }
        else {
            io.to(code).emit("roomInfo", {
                waiting: true,
                code: code
            })
        }
    }
}

function RematchRequest(code, game, idx) {
    rooms[game][code].players[idx].rematch = true;
    if (rooms[game][code].players[0].rematch && rooms[game][code].players[1].rematch) {
        Battleship_Restart(code);
    }
    SendRoomInfo(code, game);
}

function Battleship_Restart(code) {
    rooms.battleship[code] = {
        game: "battleship",
        code: code,
        turn: rooms.battleship[code].turn===0?1:0,
        winner: 2,
        players:[
            {
                id: rooms.battleship[code].players[0].id,
                map: GenerateRandomMap(),
                shots: [],
                rematch: false
            },
            {
                id: rooms.battleship[code].players[1].id,
                map: GenerateRandomMap(),
                shots: [],
                rematch: false
            }
        ]
    }
    SendRoomInfo(code, "battleship");
}

function Battleship_CheckForWinners(code) {
    let shipCount = 18;
    rooms.battleship[code].players.map((player, idx) => {
        if (player.shots.length >= shipCount) {
            let shipsLeft = shipCount;
            player.shots.map((shot) => {
                if (rooms.battleship[code].players[idx===0?1:0].map[shot[1]][shot[0]] === "ship") {
                    shipsLeft --;
                }
            })
            if (shipsLeft <= 0) {
                rooms.battleship[code].winner = idx;
                return;
            }
        }
    })
}

function Battleship_Shoot(code, coords) {
    rooms.battleship[code].players[rooms.battleship[code].turn].shots.push(coords);
    rooms.battleship[code].turn = rooms.battleship[code].turn===0?1:0;
    Battleship_CheckForWinners(code);
    SendRoomInfo(code, "battleship");
}

function GetGameAndCode(id) {
    var game;
    var code;
    for (let game in rooms) {
        for (let code in rooms[game]) {
            console.log(rooms[game][code].players[0]);
            if (rooms[game][code].players[0].id === id || rooms[game][code].players[1].id === id) {
                game = rooms[game][code].game;
                code = rooms[game][code].code;
                return `${game} ${code}`;
            }
        }
    }
}

function Disconnect(id) {
    console.log("Disconnecting");
    let gc = GetGameAndCode(id);
    if (gc) {
        gc = gc.split(" ");
        let game = gc[0];
        let code = gc[1];
        delete rooms[game][code];
        let codeIdx = codes.indexOf(code);
        codes.splice(codeIdx, 1);
        io.to(code).emit("roomInfo");
    }
}

function SendRoomInfo(code, game) {
    io.to(code).emit("roomInfo", rooms[game][code]);
}

io.on("connection", (socket) => {
    console.log(`${socket.id} Just Connected :)`);
    console.log(`Total Clients Connected: ${io.engine.clientsCount}`);

    socket.on("qbattleship", () => {
        queues.battleship.push(socket);
        socket.emit("roomInfo", {inQ: true});
        UpdateQueue("battleship");
    })
    socket.on("createbattleship", () => {
        let code = Battleship_CreateRoom();
        JoinRoom("battleship", code, socket);
    })
    socket.on("Join", (game, code) => {
        if (rooms[game].hasOwnProperty(code)) {
            JoinRoom(game, code, socket);
        }
        else {
            socket.emit("badCode")
        }
    })
    socket.on("b_shoot", (code, coords) => {
        Battleship_Shoot(code, coords);
    })
    socket.on("b_rematch", (code, idx) => {
        RematchRequest(code, "battleship", idx);
    })
    socket.on("reject", () => {
        Disconnect(socket.id);
    })
    socket.on("disconnect", () => {
        console.log(`${socket.id} Just Disconnected :)`);
        console.log(`Total Clients Connected: ${io.engine.clientsCount}`);
        Disconnect(socket.id);
    })
})

server.listen(PORT, () => console.log(`Listening On Port ${PORT}`));