const express = require('express')
const { createServer } = require("http");
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const mariadb = require('mariadb')
const app = express()
const sock_app = express()
const port = 9000
const { v4: uuidv4 } = require('uuid');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());



const pool = mariadb.createPool({
    host: 'student.psu.ac.th',
    user: 'admin',
    password: 'kk2549#$',
    connectionLimit: 5
})

app.get('/', (req, res) => {
    console.log("เก๊ท")

    res.json({ message: 'เก๊ท Method' });
});
app.get('/sql', (req, res) => {
    pool.getConnection()
        .then(conn => {
            conn.query("SELECT * from scholarship.admin").then((row) => {
                console.log(row.length)
                res.json({ amount: row.length, data: row })
                conn.end()
            })
        })
});

app.post('/sqlcmd', (req, res) => {
    console.log(req.body)
    const dat = req.body

    pool.getConnection()
        .then(async conn => {
            try {
                const row = await conn.query(dat.cmd)
                res.json({ data: row })
            } catch (error) {
                res.status(500)
                res.json({ error: error }) // ใช้ Status ก่อน json ไม่งั้นมันไม่อ่าน


            }

        })
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}!`)
})



//websocket
const websockServer = createServer(sock_app);
const io = new Server(websockServer, {
    origins: ["*"],
    cors: {
        // methods: ["GET", "POST"],
        allowedHeaders: ["Access-Control-Allow-Origin:*"],
        // credentials: true
    }
})

// start connection

let game_room = []

io.on("connection", async(socket) => {

    // uuidv4
    socket.id = await uuidv4();

    // console.log(uuidv4())


    console.log("Socket Connected by " + socket.id)
        // console.log(socket.rooms)

    // socket.join("698714")
    // console.log(socket.rooms)

    socket.emit('foralert')


    socket.on("hehe", () => {
        // socket.emit("boi", { name: "Naito" })
        socket.emit("boi", { name: socket.id })
    })

    socket.on("submitStart", (data) => {
        if (data.mode == "host") {
            // create room
            const get_roomId = generateRoomCode();
            const get_passCode = generatePassword(4);
            socket.join(get_roomId)

            // create data in array

            game_room.push({
                roomId: get_roomId,
                passCode: get_passCode,
                host: [socket.id],
                game: data.game,
                gameInfo: {},
                players: [], // array of object
                players_online: [], // array of id
                ttl: 120
            })


            socket.emit("startHostComplete", {
                roomId: get_roomId,
                passCode: get_passCode,
                mode: "host",
                game: data.game,
                id: socket.id
            })


            console.log(game_room)
            console.log(socket.id + " created Room " + get_roomId)
                // console.log(socket.rooms)
        }
    })

    socket.on("disconnecting", (reason) => {
        console.log("disconnected is     " + socket.id)
        socket.rooms.forEach(room => {

                const idx = game_room.findIndex(e => {
                    return e.roomId == room
                })
                if (idx == -1) return;
                game_room[idx].host.splice(game_room[idx].host.findIndex(e => e == socket.id), 1)

            })
            // console.log(socket.rooms)

        console.log(game_room)
    })


})


setInterval(() => {
    // console.log("tick")
    // io.emit('boi', { name: "eiei" })

    game_room.forEach((e, i) => {
        let cnt = 0
        cnt = e.host.length + e.players_online.length

        if (cnt == 0) e.ttl = e.ttl - 1;
        // console.log(e.roomId + " : " + e.ttl)
        if (e.ttl < 0) {
            console.log(e.roomId + " was deleted [No one has been in the room for 2 min.]")
            game_room.splice(i, 1)
        }
    })

}, 1000);




function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString().substring(0, 6);
}

function generatePassword(length) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}


websockServer.listen(3000)