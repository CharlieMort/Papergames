const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

const PORT = process.env.PORT || 5000;
const app = express();
app.use(express.json());
app.use(cors());

if (!(!process.env.NODE_ENV || process.env.NODE_ENV === "development")) {
    app.use(express.static(path.join(__dirname, './build')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, './build/index.html'));
    });
}

const userRouter = require("./routes/user");
app.use("/api/user", userRouter);

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
const battleships = [3,2,5,4,4];

function MakeID() {
    const characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const len = 5;
    let code = "";
    for (let i = 0; i<len; i++) {
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
    let ships = [...battleships];
    while(ships.length>0) {
        let x = Math.floor(Math.random()*10);
        let y = Math.floor(Math.random()*10);

        let shipLength = ships[ships.length-1];
        let verticalOrHorizontal = Math.floor(Math.random()*2);
        if (verticalOrHorizontal === 0) { // Vertical First
            if (y+shipLength < 10) { // If ship can fit downwards
                let overlap = false;
                for (let i = 0; i<shipLength; i++) { // does it overlap a pre existing ship
                    if (map[y+i][x].length > 4) {
                        overlap = true;
                        break;
                    }
                }
                if (!overlap) {
                    for (let i = 0; i<shipLength; i++) { // place ship
                        map[y+i][x] = `ship _${ships.length-1}`;
                    }
                    ships.pop();
                    continue; // skip next if's
                }
            }
            if (x+shipLength < 10) { // If ship can fit right
                let overlap = false;
                for (let i = 0; i<shipLength; i++) { // does it overlap a pre existing ship
                    if (map[y][x+i].length > 4) {
                        overlap = true;
                        break;
                    }
                }
                if (!overlap) {
                    for (let i = 0; i<shipLength; i++) { // place ship
                        map[y][x+i] = `ship _${ships.length-1}`;
                    }
                    ships.pop();
                    continue; // skip next if's
                }
            }
        }
        else {
            if (x+shipLength < 10) { // If ship can fit right
                let overlap = false;
                for (let i = 0; i<shipLength; i++) { // does it overlap a pre existing ship
                    if (map[y][x+i].length > 4) {
                        overlap = true;
                        break;
                    }
                }
                if (!overlap) {
                    for (let i = 0; i<shipLength; i++) { // place ship
                        map[y][x+i] = `ship _${ships.length-1}`;
                    }
                    ships.pop();
                    continue; // skip next if's
                }
            }
            if (y+shipLength < 10) { // If ship can fit downwards
                let overlap = false;
                for (let i = 0; i<shipLength; i++) { // does it overlap a pre existing ship
                    if (map[y+i][x].length > 4) {
                        overlap = true;
                        break;
                    }
                }
                if (!overlap) {
                    for (let i = 0; i<shipLength; i++) { // place ship
                        map[y+i][x] = `ship _${ships.length-1}`;
                    }
                    ships.pop();
                    continue; // skip next if's
                }
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
                rematch: false,
                user: {}
            },
            {
                id: "",
                map: GenerateRandomMap(),
                shots: [],
                rematch: false,
                user: {}
            }
        ]
    }
    return code;
}

function JoinRoom(game, code, player) {
    if (rooms[game][code].players[0].id === "") {
        rooms[game][code].players[0].id = player.socket.id;
        rooms[game][code].players[0].user = player.user;
        console.log(player.user);
        io.to(player.socket.id).emit("index", 0);
        player.socket.join(code);
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
        rooms[game][code].players[1].id = player.socket.id;
        rooms[game][code].players[1].user = player.user;
        io.to(player.socket.id).emit("index", 1);
        player.socket.join(code);
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
                rematch: false,
                user: rooms.battleship[code].players[0].user
            },
            {
                id: rooms.battleship[code].players[1].id,
                map: GenerateRandomMap(),
                shots: [],
                rematch: false,
                user: rooms.battleship[code].players[1].user
            }
        ]
    }
    SendRoomInfo(code, "battleship");
}

function Battleship_CheckForWinners(code) {
    let shipCount = 0;
    battleships.forEach((ship) => shipCount += ship)
    console.log(shipCount);
    rooms.battleship[code].players.map((player, idx) => {
        if (player.shots.length >= shipCount) {
            let shipsLeft = shipCount;
            player.shots.map((shot) => {
                if (rooms.battleship[code].players[idx===0?1:0].map[shot[1]][shot[0]].length > 4) {
                    shipsLeft --;
                }
            })
            console.log("shipsleft:"+shipsLeft);
            if (shipsLeft <= 0) {
                rooms.battleship[code].winner = idx;
                return;
            }
        }
    })
}

function Battleship_Shoot(code, coords) {
    rooms.battleship[code].players[rooms.battleship[code].turn].shots.push(coords); // add shot to record
    rooms.battleship[code].turn = rooms.battleship[code].turn===0?1:0; // change to enemy turn
    let shotCounter = [0,0,0,0,0];
    let room = rooms.battleship[code];
    room.players[room.turn===0?1:0].shots.map((shot) => { // Loop through shots the one who last shot
        let val = room.players[room.turn].map[shot[1]][shot[0]];
        if (val.length > 4) {
            let num = parseInt(val.split(" ")[1].split("")[1]);
            if (!isNaN(num)) {
                shotCounter[num]++;
                if (shotCounter[num] === battleships[num]) {
                    room.players[room.turn===0?1:0].shots.map((shot2) => {
                        let val2 = room.players[room.turn].map[shot2[1]][shot2[0]];
                        if (val2.length > 4) {
                            let num2 = parseInt(val2.split(" ")[1].split("")[1]);
                            if (!isNaN(num2)) {
                                if (num === num2) {
                                    rooms.battleship[code].players[room.turn].map[shot2[1]][shot2[0]] = "ship DEAD";
                                }
                            }
                        }
                    })
                }
            }
        }
    })
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
    else {
        for (let game in queues) {
            queues[game].forEach((socket, idx) => {
                if (socket.socket.id === id) {
                    queues[game].splice(idx, 1);
                    return;
                }
            })
        }
    }
}

function SendRoomInfo(code, game) {
    io.to(code).emit("roomInfo", rooms[game][code]);
}

io.on("connection", (socket) => {
    console.log(`${socket.id} Just Connected :)`);
    console.log(`Total Clients Connected: ${io.engine.clientsCount}`);

    socket.on("qbattleship", (user) => {
        console.log(user);
        queues.battleship.push({
            socket,
            user
        });
        socket.emit("roomInfo", {inQ: true});
        UpdateQueue("battleship");
    })
    socket.on("createbattleship", (user) => {
        let code = Battleship_CreateRoom();
        JoinRoom("battleship", code, {
            socket,
            user
        });
    })
    socket.on("Join", (game, code, user) => {
        if (rooms[game].hasOwnProperty(code)) {
            JoinRoom(game, code, socket, {
                socket,
                user
            });
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