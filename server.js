const express = require('express')
const { createServer } = require("http");
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const mariadb = require('mariadb')
const app = express()
const sock_app = express()
const port = 9000
const timeToLive = 120
const { v4: uuidv4 } = require('uuid');
const e = require('express');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());



// const pool = mariadb.createPool({
//     host: 'student.psu.ac.th',
//     user: 'admin',
//     password: 'eafeaf',
//     connectionLimit: 5
// })

// app.get('/', (req, res) => {
//     // console.log("เก๊ท")

//     res.json({ message: 'เก๊ท Method' });
// });
// app.get('/sql', (req, res) => {
//     pool.getConnection()
//         .then(conn => {
//             conn.query("SELECT * from scholarship.admin").then((row) => {
//                 // console.log(row.length)
//                 res.json({ amount: row.length, data: row })
//                 conn.end()
//             })
//         })
// });

// app.post('/sqlcmd', (req, res) => {
//     // console.log(req.body)
//     const dat = req.body

//     pool.getConnection()
//         .then(async conn => {
//             try {
//                 const row = await conn.query(dat.cmd)
//                 res.json({ data: row })
//             } catch (error) {
//                 res.status(500)
//                 res.json({ error: error }) // ใช้ Status ก่อน json ไม่งั้นมันไม่อ่าน


//             }

//         })
// })

// app.listen(port, () => {
//     // console.log(`Example app listening on port ${port}!`)
// })



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

io.on("connection", async (socket) => {


  // Don't Change socket.id [For Send One By One], Create UUID instead
  socket.uuid = await uuidv4();
  // // console.log(socket.rooms)

  // Room Manage
  // Main Room  : 000000        Used For Start / End Game
  // Host       : 000000_host
  // Player     : 000000_play
  // Spectator  : 000000_spec

  console.log("Socket Connected by " + socket.id + " / uuid : " + socket.uuid)


  // For Manage Room

  socket.on("submitStart", (data) => {
    if (data.mode == "host") {
      // create room
      const get_roomId = generateRoomCode();
      const get_passCode = generatePassword(4);

      socket.join(get_roomId) // for start stop
      socket.join(get_roomId + "_host") // for host manage


      // create data in array

      game_room.push({
        roomId: get_roomId,
        passCode: get_passCode,
        roomStatus: "REG",
        game: data.game,
        host: [{ socketId: socket.id, uuid: socket.uuid }],
        gameData: {},
        answerData: {}, // For Answer Prevent See in F12
        timerData: {},
        playerData: [],
        playersOnline: [], // array of id
        ttl: timeToLive
      })


      socket.emit("startHostComplete", {
        roomId: get_roomId,
        passCode: get_passCode,
        mode: "host",
        game: data.game,
        uuid: socket.uuid
      })


      // // console.log(game_room)
      console.log(socket.uuid + " created Room " + get_roomId)
      // console.log(socket.rooms)
    } else if (data.mode == 'co-host') {
      const idx = game_room.findIndex(e => e.roomId == data.roomId)

      if (idx == -1) { //room not found
        socket.emit("notFound")
      } else { // found room
        if (game_room[idx].passCode != data.passCode) { // wrong passcode
          socket.emit("wrongPassCode")
        } else { // if correct

          socket.join(data.roomId)
          socket.join(data.roomId + "_host") // for host manage
          game_room[idx].host.push({ socketId: socket.id, uuid: socket.uuid })

          socket.emit("startHostComplete", {
            roomId: data.roomId,
            passCode: data.passCode,
            mode: "host",
            game: game_room[idx].game,
            uuid: socket.uuid
          })


          // // console.log(game_room)
          console.log(socket.uuid + " co-host Room " + data.roomId)
        }


      }
    } else if (data.mode == "player") { // JOIN PLAYER

      const idx = game_room.findIndex(e => e.roomId == data.roomId)

      if (idx == -1) {
        socket.emit("notFound")
      } else { // foundฃ
        //check is REG
        if (game_room[idx].roomStatus == "REG") {
          socket.join(data.roomId)
          socket.join(data.roomId + "_play") // for player

          // socket.join(socket.id)

          game_room[idx].playersOnline.push({
            playerName: data.playerName,
            socketId: socket.id,
            uuid: socket.uuid
          })

          socket.emit("startJoinComplete", {
            roomId: data.roomId,
            mode: "player",
            game: game_room[idx].game,
            uuid: socket.uuid,
            playerName: data.playerName
          })
          // console.log(game_room)

        } else { // IS RUNNING
          socket.emit("roomRunning")

        }


      }


    }
    io.in('debug').emit('debinfo', game_room)



  })

  socket.on("joinByHost", (data) => {
    const idx = game_room.findIndex(e => {
      return e.roomId == data.roomId && e.passCode == data.passCode
    })

    if (idx == -1) {
      socket.emit("noRoom")
    } else { // habe room
      socket.uuid = data.uuid
      if (game_room[idx].host.findIndex(e => e.uuid == socket.uuid) == -1) {
        socket.join(data.roomId)
        socket.join(data.roomId + "_host") // for host manage
        // socket.join(socket.id)
        game_room[idx].host.push({ socketId: socket.id, uuid: socket.uuid })
      }


      game_room[idx].ttl = timeToLive

      socket.emit("hostRoomInfo", game_room[idx])




    }
    // console.log(game_room)
    // // console.log(socket.rooms)

    io.in('debug').emit('debinfo', game_room)


  })

  socket.on("joinBySpectator", (roomId) => { // data only roomId
    const idx = game_room.findIndex(e => {
      return e.roomId == roomId
    })

    if (idx == -1) {
      socket.emit("noRoom")
    } else { // have room
      socket.join(roomId) // 000000 
      socket.join(roomId + "_spec") // 000000_spec



      game_room[idx].ttl = timeToLive

      socket.emit("spectatorRoomInfo", game_room[idx])




    }
    // console.log(game_room)
    // // console.log(socket.rooms)

    io.in('debug').emit('debinfo', game_room)


  })

  socket.on("joinByPlayer", (data) => {
    const idx = game_room.findIndex(e => {
      return e.roomId == data.roomId
    })

    if (idx == -1) {
      socket.emit("noRoom")
    } else { // have room



      if (game_room[idx].roomStatus == "REG") { // IS REG
        socket.uuid = data.uuid
        if (game_room[idx].playersOnline.findIndex(e => e.uuid == socket.uuid) == -1) { // add player
          socket.join(data.roomId)
          socket.join(data.roomId + "_play") // for player
          // socket.join(socket.id)
          game_room[idx].playersOnline.push({ socketId: socket.id, uuid: socket.uuid, playerName: data.playerName })

          //send to host
          console.log("Rejoin Room " + data.roomId + " / " + socket.id + " / uuid : " + socket.uuid)





        }


        game_room[idx].ttl = timeToLive
        // For Host
        io.in(game_room[idx].roomId + "_host").emit("hostRoomInfo", game_room[idx])
        /*
        game_room[idx].host.forEach(e => {
          io.to(e.socketId).emit("hostRoomInfo", game_room[idx])
          // // console.log(e)
        })
        */
        // to spec
        io.in(game_room[idx].roomId + "_spec").emit("spectatorRoomInfo", game_room[idx])

      } else { // IS PLAYING 
        socket.uuid = data.uuid
        if (game_room[idx].playerData.findIndex(e => e.uuid == socket.uuid) != -1) { // have in player
          socket.join(data.roomId)
          socket.join(data.roomId + "_play")
          console.log("Rejoin Room " + data.roomId + " / " + socket.id + " / uuid : " + socket.uuid)

          // socket.join(socket.id)
          if (game_room[idx].playersOnline.findIndex(e => e.uuid == socket.uuid) == -1) { // add player
            game_room[idx].playersOnline.push({ socketId: socket.id, uuid: socket.uuid, playerName: data.playerName })

          }

          game_room[idx].ttl = timeToLive
          socket.emit("playerRoomInfo", { roomStatus: "INPLAY" })
          // For Host
          io.in(game_room[idx].roomId + "_host").emit("hostRoomInfo", game_room[idx])

          /*
game_room[idx].host.forEach(e => {
io.to(e.socketId).emit("hostRoomInfo", game_room[idx])
// // console.log(e)
})
*/
          io.in(game_room[idx].roomId + "_spec").emit("spectatorRoomInfo", game_room[idx])

        } else {
          socket.emit("noRoom")
        }

      }


      // socket.emit("playerRoomInfo", game_room[idx])




    }
    // console.log(game_room)
    // console.log(socket.rooms)

    io.in('debug').emit('debinfo', game_room)


  })

  socket.on("playerLeave", (data) => {
    const idx = game_room.findIndex(e => {
      return e.roomId == data.roomId
    })

    if (idx == -1) {
      socket.emit("noRoom")
    } else { // have room
      const pos = game_room[idx].playersOnline.findIndex(e => {
        return e.uuid == data.uuid
      })

      game_room[idx].playersOnline.splice(pos, 1)

      if (idx != -1) { // Have Room

        // send all host
        io.in(game_room[idx].roomId + "_host").emit("hostRoomInfo", game_room[idx])

        /*
game_room[idx].host.forEach(e => {
io.to(e.socketId).emit("hostRoomInfo", game_room[idx])
 
// // console.log(e)
})
*/
        io.in(game_room[idx].roomId + "_spec").emit("spectatorRoomInfo", game_room[idx])
        socket.emit("noRoom")
        socket.leave(data.roomId)


      }
      io.in('debug').emit('debinfo', game_room)

      // socket.emit("playerRoomInfo", game_room[idx])




    }
  })

  socket.on("hostLeave", (data) => {
    const idx = game_room.findIndex(e => {
      return e.roomId == data.roomId
    })

    if (idx == -1) {
      socket.emit("noRoom")
    } else { // have room
      const pos = game_room[idx].host.findIndex(e => {
        return e.uuid == data.uuid
      })


      if (idx != -1) { // Have Room 

        game_room[idx].host.splice(pos, 1) // cut
        socket.leave(data.roomId)
        socket.leave(data.roomId + '_host')


        io.in(game_room[idx].roomId + "_host").emit("hostRoomInfo", game_room[idx])
        /*
        game_room[idx].host.forEach(e => {
          io.to(e.socketId).emit("hostRoomInfo", game_room[idx])

          // // console.log(e)
        })
        */
        io.in(game_room[idx].roomId + "_spec").emit("spectatorRoomInfo", game_room[idx])
        socket.emit("noRoom")


      }
      io.in('debug').emit('debinfo', game_room)

      // socket.emit("playerRoomInfo", game_room[idx])




    }
  })
  socket.on("hostDestroy", (data) => {
    const idx = game_room.findIndex(e => {
      return e.roomId == data.roomId
    })

    if (idx == -1) {
      socket.emit("noRoom")
    } else { // have room > Let's Destroy


      console.log("Room " + game_room[idx].roomId + " was deleted")
      io.in(game_room[idx].roomId).emit("noRoom"); // send all 

      io.in(game_room[idx].roomId).socketsLeave(game_room[idx].roomId);
      io.in(game_room[idx].roomId + "_host").socketsLeave(game_room[idx].roomId + "_host");
      io.in(game_room[idx].roomId + "_play").socketsLeave(game_room[idx].roomId + "_play");
      io.in(game_room[idx].roomId + "_spec").socketsLeave(game_room[idx].roomId + "_spec");


      game_room.splice(idx, 1)



      io.in('debug').emit('debinfo', game_room)

      // socket.emit("playerRoomInfo", game_room[idx])




    }
  })

  socket.on("roomStart", (data) => {
    const idx = game_room.findIndex(e => {
      return e.roomId == data.roomId
    })
    if (idx != -1) { // Have Room > Start Room
      // Change Status
      game_room[idx].roomStatus = "INPLAY"

      switch (game_room[idx].game) {
        case "GTM":
          start_GTM(idx)
          break;
        case "WDWH":
          start_WDWH(idx)
          break;
        case "NFS":
          start_NFS(idx)
          break;
        case "KTC":
          start_KTC(idx)
          break;
        case "CC":
          start_CC(idx)
          break;
        default:
          break;
      }
      // Send To All in roomid
      io.in(data.roomId).emit("roomStart")
    }
    io.in('debug').emit('debinfo', game_room)

  })

  socket.on("roomEnd", (data) => {
    const idx = game_room.findIndex(e => {
      return e.roomId == data.roomId
    })

    if (idx != -1) { // Have Room > Start Room
      // Change Status & Clear Game Stat
      game_room[idx].roomStatus = "REG"
      game_room[idx].gameData = {}
      game_room[idx].answerData = {}
      game_room[idx].timerData = {}
      game_room[idx].playerData = []





      // Send To All in roomid
      io.in(data.roomId).emit("roomEnd")


    }

    io.in('debug').emit('debinfo', game_room)

  })



  // For Game

  socket.on("hostGameInfo", (data) => {
    const idx = game_room.findIndex(e => {
      return e.roomId == data.roomId
    })
    if (idx != -1) { // Have Room > Get Data
      socket.emit("hostGameInfo", { gameData: game_room[idx].gameData, playerData: game_room[idx].playerData, answerData: game_room[idx].answerData, timerData: game_room[idx].timerData })
    }

  })

  socket.on("spectatorGameInfo", (roomId) => {
    const idx = game_room.findIndex(e => {
      return e.roomId == roomId
    })
    if (idx != -1) { // Have Room > Get Data
      socket.emit("spectatorGameInfo", { gameData: game_room[idx].gameData, playerData: game_room[idx].playerData, timerData: game_room[idx].timerData })
    }
  })

  socket.on("playerGameInfo", (data) => {
    const idx = game_room.findIndex(e => {
      return e.roomId == data.roomId
    })
    if (idx != -1) { // Have Room > Get Data

      socket.emit("playerGameInfo", { gameData: game_room[idx].gameData, playerData: game_room[idx].playerData, timerData: game_room[idx].timerData })
    }
  })

  socket.on("hostGameUpdate", (data) => { // Host Game Update > Send All
    const idx = game_room.findIndex(e => {
      return e.roomId == data.roomId
    })

    let sendingData = {}

    if (data.gameData) {
      game_room[idx].gameData = data.gameData
      sendingData.gameData = game_room[idx].gameData
    }
    if (data.playerData) {
      game_room[idx].playerData = data.playerData
      sendingData.playerData = game_room[idx].playerData

    }

    if (data.timerData) {
      game_room[idx].timerData = data.timerData
      sendingData.timerData = game_room[idx].timerData

    }
    /*
    game_room[idx].host.forEach(e => {
      io.to(e.socketId).emit("hostGameInfo", { gameData: game_room[idx].gameData, playerData: game_room[idx].playerData })
      // // console.log(e)
    })
    */
    //send all player
    io.in(game_room[idx].roomId + "_play").emit("playerGameInfo", sendingData)
    /*
    game_room[idx].playersOnline.forEach(e => {
      io.to(e.socketId).emit("playerGameInfo", { gameData: game_room[idx].gameData, playerData: game_room[idx].playerData })
    })
    */
    //send all spctator
    io.in(game_room[idx].roomId + "_spec").emit("spectatorGameInfo", sendingData)

    if (data.answerData) {
      game_room[idx].answerData = data.answerData
      sendingData.answerData = game_room[idx].answerData

    }
    //send all host
    io.in(game_room[idx].roomId + "_host").emit("hostGameInfo", sendingData)



    io.in('debug').emit('debinfo', game_room)

  })

  socket.on("playerGameUpdate", (data) => { // Player Game Update > Send To selt ,spectator and Host Only
    const idx = game_room.findIndex(e => {
      return e.roomId == data.roomId
    })

    const pos = game_room[idx].playerData.findIndex(e => {
      return e.uuid == data.uuid
    })

    game_room[idx].playerData[pos] = data.myPlayerData

    if (idx != -1) { // Have Room
      //send to host
      io.in(game_room[idx].roomId + "_host").emit("hostGameInfo", { playerData: game_room[idx].playerData })

      /*
      game_room[idx].host.forEach(e => {
        io.to(e.socketId).emit("hostGameInfo", { playerData: game_room[idx].playerData })
        // // console.log(e)
      })
      */
      //send back to player
      socket.emit("playerGameInfo", { playerData: game_room[idx].playerData })
      //send to spectator
      io.in(game_room[idx].roomId + "_spec").emit("spectatorGameInfo", { playerData: game_room[idx].playerData })


    }
    io.in('debug').emit('debinfo', game_room)

  })

  socket.on("playerGameUpdateAll", (data) => { // Player Game Update > Send To selt ,spectator and Host Only
    const idx = game_room.findIndex(e => {
      return e.roomId == data.roomId
    })

    const pos = game_room[idx].playerData.findIndex(e => {
      return e.uuid == data.uuid
    })

    game_room[idx].playerData[pos] = data.myPlayerData

    if (idx != -1) { // Have Room
      //send to host
      io.in(game_room[idx].roomId + "_host").emit("hostGameInfo", { playerData: game_room[idx].playerData })
      /*
      game_room[idx].host.forEach(e => {
        io.to(e.socketId).emit("hostGameInfo", { playerData: game_room[idx].playerData })
        // // console.log(e)
      })
      */
      //send back to player NO NEED BECAUSE USED BY SEND ALL PLAYER
      // socket.emit("playerGameInfo", { gameData: game_room[idx].gameData, playerData: game_room[idx].playerData })
      //send all player
      io.in(game_room[idx].roomId + "_play").emit("playerGameInfo", { playerData: game_room[idx].playerData })
      /*
      game_room[idx].playersOnline.forEach(e => {
        io.to(e.socketId).emit("playerGameInfo", { gameData: game_room[idx].gameData, playerData: game_room[idx].playerData })
      })
      */

      //send to spectator
      io.in(game_room[idx].roomId + "_spec").emit("spectatorGameInfo", { playerData: game_room[idx].playerData })


    }
    io.in('debug').emit('debinfo', game_room)

  })




  socket.on("disconnecting", (reason) => {
    console.log("disconnected is     " + socket.id)
    socket.rooms.forEach(room => {

      const idx = game_room.findIndex(e => {
        return e.roomId == room
      })
      if (idx != -1 && game_room[idx].host.findIndex(e => e.uuid == socket.uuid) != -1) game_room[idx].host.splice(game_room[idx].host.findIndex(e => e.uuid == socket.uuid), 1);
      if (idx != -1 && game_room[idx].playersOnline.findIndex(e => e.uuid == socket.uuid) != -1) {
        game_room[idx].playersOnline.splice(game_room[idx].playersOnline.findIndex(e => e.uuid == socket.uuid), 1);

        //send all host
        io.in(game_room[idx].roomId + "_host").emit("hostRoomInfo", game_room[idx])
        /*
        game_room[idx].host.forEach(e => {
          console.log(io.to(e.socketId).emit("hostRoomInfo", game_room[idx]))
        })
        */

        io.in(game_room[idx].roomId + "_spec").emit("spectatorRoomInfo", game_room[idx])
      }


    })
    // console.log(socket.rooms)

    // console.log(game_room)
    io.in('debug').emit('debinfo', game_room)
  })


  socket.on('deb', () => {
    socket.join('debug')
    socket.emit("debinfo", game_room)
  })


})


setInterval(() => {
  // // console.log("tick")
  // io.emit('boi', { name: "eiei" })
  let change = false

  game_room.forEach((e, i) => {
    let cnt = 0
    cnt = e.host.length + e.playersOnline.length

    if (cnt == 0) {
      e.ttl = e.ttl - 1;
      change = true
    }

    // // console.log(e.roomId + " : " + e.ttl)
    if (e.ttl < 0) {
      // console.log(e.roomId + " was deleted [No one has been in the room for 2 min.]")

      io.in(e.roomId).emit("noRoom");
      io.in(e.roomId).socketsLeave(e.roomId);
      io.in(e.roomId + "_host").socketsLeave(e.roomId + "_host");
      io.in(e.roomId + "_play").socketsLeave(e.roomId + "_play");
      io.in(e.roomId + "_spec").socketsLeave(e.roomId + "_spec");
      game_room.splice(i, 1)
    }
  })

  if (change) io.in('debug').emit('debinfo', game_room)

}, 1000);



// Normal Function

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

// Function GUESSTIMATE

function start_GTM(idx) { // FOR ADMIN
  // 0 - prepare 
  // 1 - ShowQuestion 
  // 2 - Show Player Answer(Cannot Answered) 
  // 3 - Show Correct Answer(include calculate)
  game_room[idx].gameData.inGameStage = 0
  game_room[idx].gameData["quiz"] = { // For Quiz Only
    questionType: "", // E - Exactly | R1 - Range V1
    question: "",
    questionPic: "",
    questionExplain: "",
    answerPrefix: "",
    answerSuffix: "",

  }
  game_room[idx].gameData["answer"] = { // For Answer Of Quiz [Spreate for admin]
    answer: ""
  }

  // game_room[idx].gameData["playerData"] = []

  game_room[idx].playersOnline.forEach(e => {
    game_room[idx].playerData.push({
      uuid: e.uuid,
      playerName: e.playerName,
      min: null,
      max: null,
      size: null,
      ans: null,
      lockDown: false,
      answerStatus: "", // correct_smallest,correct,correct_largest,incorrect
      score: 0
    })
  });

}

function start_WDWH(idx) {
  // 01 set word
  // 02 shuffle word
  // 03 shuffle category
  // 04 write story
  // 05 reading story
  // 06 give ranking
  // 07 reveal ranking point
  game_room[idx].gameData.phase = 1
  game_room[idx].gameData.category = ""
  game_room[idx].gameData.player_order = []
  game_room[idx].gameData.player_present_now = ""

  game_room[idx].playersOnline.forEach(e => {
    game_room[idx].playerData.push({
      uuid: e.uuid,
      playerName: e.playerName,
      score: 0,
      score_vote: 0,
      q_who: "",
      q_do: "",
      q_where: "",
      q_how: "",
      word_set: [],
      short_story: "",
      show_short_story: "",
      short_story_postion: -1,
      short_story_all_split: null,
      send_score: [],
      is_ready: false,

    })
  });
}

function start_NFS(idx) {
  // 00 Settings Game (can back)
  // 01 shuffle category
  // 02 Random Number
  // 03 write story
  // 04 reading story / Tell Story
  // 05 guess most & least
  // 06 reveal Answer
  // 07 Reveal Correct & challenge End Here
  // 08 Result
  game_room[idx].gameData.phase = 0
  game_room[idx].gameData.writing = false // phase 03 จะเขียนหรือเล่า
  game_room[idx].gameData.category = "" // หมวดหมู่
  game_room[idx].gameData.result = { mostLevel: null, leastLevel: null }; // เลขมากสุด - น้อยสุด
  game_room[idx].gameData.player_order = [] // ลำดับของผู้เล่น
  game_room[idx].gameData.player_present_now = "" //ผู้เล่นปัจจุบัน

  game_room[idx].playersOnline.forEach(e => {
    game_room[idx].playerData.push({
      uuid: e.uuid,
      playerName: e.playerName,
      score: 0, // คะแนนทั้งหมด

      level: null, // ระดับของเรื่องเล่า

      score_guess: 0, // คะแนนที่ได้จากรอบ
      score_challenged: 0, // จำนวนที่ถูก Challenge
      short_story: "", // เรื่องเล่า
      show_short_story: "",
      short_story_postion: -1, // ตำแหน่งที่แสดง
      short_story_all_split: null, // ส่วนที่แสดงทั้งหมด
      send_answer: { mostPlayer: null, leastPlayer: null }, // คำตอบ คนที่มีเลขสูงสุด ต่ำสุด
      challenge_list: [], //รายชื่อที่จะ Challenge
      is_ready: false,

    })
  });
}

function start_KTC(idx) {
  // 0 - setup 
  // 1 - prepareQuiz 
  // 2 - ShowQuiz
  // 3 - Place Chip (Answer the question) 
  // 4 - Lock Down (Time up for answer)
  // 5 - Reveal Player Answer
  // 6 - Reveal Correct Answer
  // 7 - Summary Remaining
  game_room[idx].gameData.phase = 0


  game_room[idx].gameData["quiz"] = { // For Quiz Only
    quiz_topic: "", // หัวข้อ
    quiz_question: "", // คำถาม
    quiz_choice: [], // ตัวเลือก
    quiz_picLink: "", // Link รูปคำถาม

  }
  game_room[idx].gameData["answer"] = { // For Answer Of Quiz 
    answer: "" // ต้องตรงกับ quiz_choice ทุกตัวอักษร
  }


  game_room[idx].answerData = {
    answer: ""
  }

  game_room[idx].timerData = {
    fullTime: null,
    remainTime: null,
    millTime: null,
  }


  // game_room[idx].gameData["playerData"] = []

  game_room[idx].playersOnline.forEach(e => {
    game_room[idx].playerData.push({
      uuid: e.uuid,
      playerName: e.playerName,

      chip_tmp: 0, // use for temp when write wrong question 
      chip_remain: 0,
      chip_unchoose: 0,
      chip_choice: [], // [1,2,3,4,5,6]
      lockDown: false
    })
  });

}

function start_CC(idx) {
  // -1 - setup Game 
  // 0 - Edit Detail
  // 1 - prepareQuiz 
  // 2 - ShowTopic / Place Bet Play
  // 3 - ShowBet / ShowQuiz
  // 4 - Show Answer
  // 5 - Place Chip (Answer the question) 
  // 6 - Lock Down (Time up for answer)
  // 7 - Reveal Player Answer
  // 8 - Reveal Correct Answer
  // 9 - Summary Remaining
  game_room[idx].gameData.phase = -1

  // 0 - No Show
  // 1+ - Show / By Order
  game_room[idx].gameData.showNow = 0
  game_room[idx].gameData.requireQuizPlay = 0
  game_room[idx].gameData.requireChipPerQuiz = 1
  game_room[idx].gameData.nowQuiz = 0


  game_room[idx].gameData["quiz"] = { // For Quiz Only
    quiz_type: "", // MCQ / SORT

    quiz_topic: "", // หัวข้อ
    quiz_question: "", // คำถาม
    quiz_choice: [], // ตัวเลือก / คำตอบที่เรียงแล้ว และจะถูก
    quiz_picLink: "", // Link รูปคำถาม

  }
  game_room[idx].gameData["answer"] = { // For Answer Of Quiz 
    answer: "", // ต้องตรงกับ quiz_choice ทุกตัวอักษร
    answer_sort: []
  }


  game_room[idx].answerData = {
    answer: "",
    answer_sort: []

  }

  game_room[idx].timerData = {
    fullTime: null,
    remainTime: null,
    millTime: null,
  }


  // game_room[idx].gameData["playerData"] = []

  game_room[idx].playersOnline.forEach(e => {
    game_room[idx].playerData.push({
      uuid: e.uuid,
      playerName: e.playerName,

      chip_unscore: 0, // Unscored Chip
      chip_inplay: 0, // Play Chip
      quiz_play_remain: 0,
      score: 0, // Score Form Correct answer Chip
      result_quiz_score: 0,

      chip_unchoose: 0,
      chip_choice: [], // [1,2,3,4,5,6]


      my_helper: { // ตัวช่วย
        fold: 0, // หมอบ
        cut2c: 0, // ตัด 2 ตัวเลือก
        cut2c_cut: []
      },


      quiz_play: false,
      lockDown: false
    })
  });

}

websockServer.listen(3000)