const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");
const sqlite3 = require("sqlite3");

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
    battleship: [],
    tictactoe: [],
    connect4: []
}

const rooms = {
    battleship: {},
    tictactoe: {},
    connect4: {}
}

const codes = [];
const battleships = [3,2,4,4,5];

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
                let bCode = Battleship_CreateRoom();
                JoinRoom("battleship", bCode, queues.battleship[i*2]);
                JoinRoom("battleship", bCode, queues.battleship[i*2+1]);
                break;
            case "tictactoe":
                let tCode = Tictactoe_CreateRoom();
                JoinRoom("tictactoe", tCode, queues.tictactoe[i*2]);
                JoinRoom("tictactoe", tCode, queues.tictactoe[i*2+1]);
                break;
            case "connect4":
                let cCode = Connect4_CreateRoom();
                JoinRoom("connect4", cCode, queues.connect4[i*2]);
                JoinRoom("connect4", cCode, queues.connect4[i*2+1]);
                break;

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
                user: {},
                score: 0
            },
            {
                id: "",
                map: GenerateRandomMap(),
                shots: [],
                rematch: false,
                user: {},
                score: 0
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
            SendRoomInfo(code, game);
        }
        else {
            io.to(code).emit("roomInfo", {
                waiting: true,
                code: code
            })
        }
    }
    console.log(rooms[game][code]);
}

function RematchRequest(code, game, idx) {
    rooms[game][code].players[idx].rematch = true;
    if (rooms[game][code].players[0].rematch && rooms[game][code].players[1].rematch) {
        switch(game) {
            case "battleship":
                Battleship_Restart(code);
                break;
            case "tictactoe":
                Tictactoe_Restart(code);
                break;
            case "connect4":
                Connect4_Restart(code);
                break;
        }
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
                user: rooms.battleship[code].players[0].user,
                score: rooms.battleship[code].players[0].score
            },
            {
                id: rooms.battleship[code].players[1].id,
                map: GenerateRandomMap(),
                shots: [],
                rematch: false,
                user: rooms.battleship[code].players[1].user,
                score: rooms.battleship[code].players[1].score
            }
        ]
    }
    SendRoomInfo(code, "battleship");
}

function Battleship_CheckForWinners(code) {
    let shipCount = 0;
    battleships.forEach((ship) => shipCount += ship)
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
                rooms.battleship[code].players[idx].score ++;
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

function Tictactoe_CreateRoom() {
    let code = MakeID();
    while (codes.includes(code)) code = MakeID();
    codes.push(code);
    rooms.tictactoe[code] = {
        game: "tictactoe",
        code: code,
        turn: 0,
        winner: 2,
        map: [
            ["","",""],
            ["","",""],
            ["","",""]
        ],
        players:[
            {
                id: "",
                rematch: false,
                user: {},
                score: 0
            },
            {
                id: "",
                rematch: false,
                user: {},
                score: 0
            }
        ]
    }
    return code;
}

function Tictactoe_Shoot(code, coords) {
    if (rooms.tictactoe[code].map[coords[1]][coords[0]] === "") {
        rooms.tictactoe[code].map[coords[1]][coords[0]] = rooms.tictactoe[code].turn===0?"x":"o";
        rooms.tictactoe[code].turn = rooms.tictactoe[code].turn===0?1:0;
        Tictactoe_CheckForWinners(code);
        SendRoomInfo(code, "tictactoe");
    }
}

function Tictactoe_CheckForWinners(code) {
    const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];
    let map = [];
    let count = 0;
    rooms.tictactoe[code].map.forEach((row) => {
        row.forEach((cell) => {
            map.push(cell);
            if (cell !== "") {
                count++;
            }
        });
    });
    if (count >= 9) {
        rooms.tictactoe[code].winner = 3;
        return;
    }
    for (let i = 0; i<lines.length; i++) {
        const [a, b, c] = lines[i];
        if (map[a] && 
            map[a] == map[b] && 
            map[a] == map[c]) {
            rooms.tictactoe[code].winner = rooms.tictactoe[code].turn===0?1:0;
            rooms.tictactoe[code].players[rooms.tictactoe[code].turn===0?1:0].score++;
            return;
        }
    }
}

function Tictactoe_Restart(code) {
    rooms.tictactoe[code] = {
        game: "tictactoe",
        code: code,
        turn: rooms.tictactoe[code].turn===0?1:0,
        winner: 2,
        map: [
            ["","",""],
            ["","",""],
            ["","",""]
        ],
        players:[
            {
                id: rooms.tictactoe[code].players[0].id,
                rematch: false,
                user: rooms.tictactoe[code].players[0].user,
                score: rooms.tictactoe[code].players[0].score
            },
            {
                id: rooms.tictactoe[code].players[1].id,
                rematch: false,
                user: rooms.tictactoe[code].players[1].user,
                score: rooms.tictactoe[code].players[1].score
            }
        ]
    }
    rooms.tictactoe[code].turn = rooms.tictactoe[code].turn===0?1:0;
    SendRoomInfo(code, "tictactoe");
}

function Connect4_CreateRoom() {
    let code = MakeID();
    while (codes.includes(code)) code = MakeID();
    codes.push(code);
    rooms.connect4[code] = {
        game: "connect4",
        code: code,
        turn: 0,
        winner: 2,
        map: [
            ["","","","","","",""],
            ["","","","","","",""],
            ["","","","","","",""],
            ["","","","","","",""],
            ["","","","","","",""],
            ["","","","","","",""],
        ],
        players:[
            {
                id: "",
                rematch: false,
                user: {},
                score: 0
            },
            {
                id: "",
                rematch: false,
                user: {},
                score: 0
            }
        ]
    }
    return code;
}

function Connect4_Shoot(code, coords) {
    let idy;
    for (let i = 5; i>=0; i--) {
        if (rooms.connect4[code].map[i][coords[0]] === "") {
            idy = i;
            break;
        }
    }
    if (idy !== undefined) {
        rooms.connect4[code].map[idy][coords[0]] = rooms.connect4[code].turn===0?"light":"dark";
        rooms.connect4[code].turn = rooms.connect4[code].turn===0?1:0;
        Connect4_CheckForWinners(code);
        SendRoomInfo(code, "connect4");
    }
}

function Connect4_CheckForWinners(code) {
    const winningCombos = [
        [0, 1, 2, 3],
        [41, 40, 39, 38],
        [7, 8, 9, 10],
        [34, 33, 32, 31],
        [14, 15, 16, 17],
        [27, 26, 25, 24],
        [21, 22, 23, 24],
        [20, 19, 18, 17],
        [28, 29, 30, 31],
        [13, 12, 11, 10],
        [35, 36, 37, 38],
        [6, 5, 4, 3],
        [0, 7, 14, 21],
        [41, 34, 27, 20],
        [1, 8, 15, 22],
        [40, 33, 26, 19],
        [2, 9, 16, 23],
        [39, 32, 25, 18],
        [3, 10, 17, 24],
        [38, 31, 24, 17],
        [4, 11, 18, 25],
        [37, 30, 23, 16],
        [5, 12, 19, 26],
        [36, 29, 22, 15],
        [6, 13, 20, 27],
        [35, 28, 21, 14],
        [0, 8, 16, 24],
        [41, 33, 25, 17],
        [7, 15, 23, 31],
        [34, 26, 18, 10],
        [14, 22, 30, 38],
        [27, 19, 11, 3],
        [35, 29, 23, 17],
        [6, 12, 18, 24],
        [28, 22, 16, 10],
        [13, 19, 25, 31],
        [21, 15, 9, 3],
        [20, 26, 32, 38],
        [36, 30, 24, 18],
        [5, 11, 17, 23],
        [37, 31, 25, 19],
        [4, 10, 16, 22],
        [2, 10, 18, 26],
        [39, 31, 23, 15],
        [1, 9, 17, 25],
        [40, 32, 24, 16],
        [9, 17, 25, 33],
        [8, 16, 24, 32],
        [11, 17, 23, 29],
        [12, 18, 24, 30],
        [1, 2, 3, 4],
        [5, 4, 3, 2],
        [8, 9, 10, 11],
        [12, 11, 10, 9],
        [15, 16, 17, 18],
        [19, 18, 17, 16],
        [22, 23, 24, 25],
        [26, 25, 24, 23],
        [29, 30, 31, 32],
        [33, 32, 31, 30],
        [36, 37, 38, 39],
        [40, 39, 38, 37],
        [7, 14, 21, 28],
        [8, 15, 22, 29],
        [9, 16, 23, 30],
        [10, 17, 24, 31],
        [11, 18, 25, 32],
        [12, 19, 26, 33],
        [13, 20, 27, 34],
    ];
    let map = [];
    let count = 0;
    rooms.connect4[code].map.forEach((row) => {
        row.forEach((cell) => {
            map.push(cell);
            if (cell !== "") {
                count ++;
            }
        })
    });
    if (count >= 42) {
        rooms.connect4[code].winner = 3;
        SendRoomInfo(code, "connect4");
        return;
    }
    for (let combo of winningCombos) {
        let vals = [map[combo[0]], map[combo[1]], map[combo[2]], map[combo[3]]];
        if (vals[0] === vals[1] && vals[1] === vals[2] && vals[2] === vals[3] && vals[0] !== "") {
            rooms.connect4[code].winner = vals[0]==="light"?0:1;
            rooms.connect4[code].players[rooms.connect4[code].turn===0?1:0].score++;
            SendRoomInfo(code, "connect4");
            return;
        } 
    }
}

function Connect4_Restart(code) {
    rooms.connect4[code] = {
        game: "connect4",
        code: code,
        turn: rooms.connect4[code].turn===0?1:0,
        winner: 2,
        map: [
            ["","","","","","",""],
            ["","","","","","",""],
            ["","","","","","",""],
            ["","","","","","",""],
            ["","","","","","",""],
            ["","","","","","",""],
        ],
        players:[
            {
                id: rooms.connect4[code].players[0].id,
                rematch: false,
                user: rooms.connect4[code].players[0].user,
                score: rooms.connect4[code].players[0].score
            },
            {
                id: rooms.connect4[code].players[1].id,
                rematch: false,
                user: rooms.connect4[code].players[1].user,
                score: rooms.connect4[code].players[1].score
            }
        ]
    }
    rooms.connect4[code].turn = rooms.connect4[code].turn===0?1:0;
    SendRoomInfo(code, "connect4");
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

function Addscore(user, add, game) {
    let db = new sqlite3.Database("./userinfo.db");
    let stmt = `SELECT ${game}Score FROM login WHERE username = "${user.username}";`;
    db.all(stmt, (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(rows[0]);
        let score = parseInt(rows[0][`${game}Score`]);
        console.log(add);
        score += add;
        console.log(score);
        let stmt2 = `UPDATE login SET ${game}Score = ${score} WHERE username = "${user.username}";`;
        db.run(stmt2, (err) => {
            if (err) {
                console.log(err);
            }
        })
    })
    db.close();
}

function Disconnect(id) {
    console.log("Disconnecting");
    let gc = GetGameAndCode(id);
    if (gc) {
        gc = gc.split(" ");
        let game = gc[0];
        let code = gc[1];
        rooms[game][code].players.forEach((player) => {
            if (!player.user.guest) Addscore(player.user, player.score, game);
        })
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
            JoinRoom(game, code, {
                socket,
                user
            });
        }
        else {
            console.log("BadCode");
            socket.emit("badCode")
        }
    })
    socket.on("b_shoot", (code, coords) => {
        Battleship_Shoot(code, coords);
    })
    socket.on("b_rematch", (code, idx) => {
        RematchRequest(code, "battleship", idx);
    })
    socket.on("qtictactoe", (user) => {
        queues.tictactoe.push({
            socket,
            user
        })
        socket.emit("roomInfo", {inQ: true});
        UpdateQueue("tictactoe");
    })
    socket.on("createtictactoe", (user) => {
        let code = Tictactoe_CreateRoom();
        JoinRoom("tictactoe", code, {
            socket,
            user
        });
    })
    socket.on("t_shoot", (code, coords) => {
        Tictactoe_Shoot(code, coords);
    })
    socket.on("t_rematch", (code, idx) => {
        RematchRequest(code, "tictactoe", idx);
    })
    socket.on("qconnect4", (user) => {
        queues.connect4.push({
            socket,
            user
        })
        socket.emit("roomInfo", {inQ: true});
        UpdateQueue("connect4");
    })
    socket.on("createconnect4", (user) => {
        let code = Connect4_CreateRoom();
        JoinRoom("connect4", code, {
            socket,
            user
        });
    })
    socket.on("c_shoot", (code, coords) => {
        Connect4_Shoot(code, coords);
    })
    socket.on("c_rematch", (code, idx) => {
        RematchRequest(code, "connect4", idx);
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