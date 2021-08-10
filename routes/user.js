const router = require("express").Router();
const sqlite3 = require("sqlite3");

router.route("/").get((req, res) => {
    let db = new sqlite3.Database("./userinfo.db");
    let stmt = `SELECT * FROM login ORDER BY id;`;
    db.all(stmt, (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        res.send(rows);
        rows.forEach((row) => {
            console.log(row);
        })
    })
    db.close();
})

router.route("/signup").post((req, res) => {
    let db = new sqlite3.Database("./userinfo.db");
    let stmt = `INSERT INTO login(username, password) VALUES ("${req.body.username}", "${req.body.password}");`;
    db.run(stmt, (err) => {
        if (err) {
            res.send("2");
            console.log(err);
        }
        else res.send("1");
    })
    db.close();
})

router.route("/login/id/:id").get((req, res) => {
    let db = new sqlite3.Database("./userinfo.db");
    let stmt = `SELECT * FROM login WHERE id = ${req.params.id}`;
    db.all(stmt, (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        res.send(rows[0]);
        console.log(rows[0]);
    })
    db.close();
})

router.route("/login/username/:username").get((req, res) => {
    let db = new sqlite3.Database("./userinfo.db");
    let stmt = `SELECT * FROM login WHERE username = "${req.params.username}";`;
    db.all(stmt, (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        res.send(rows[0]);
        console.log(rows[0]);
    });
    db.close();
})

router.route("/addscore/:username").get((req, res) => {
    console.log(req.params.username);
    let db = new sqlite3.Database("./userinfo.db");
    let stmt = `SELECT score FROM login WHERE username = "${req.params.username}";`;
    db.all(stmt, (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(rows[0]);
        let score = parseInt(rows[0].score);
        score ++;
        console.log(score);
        let stmt2 = `UPDATE login SET score = ${score} WHERE username = "${req.params.username}";`;
        db.run(stmt2, (err) => {
            if (err) {
                res.send("2");
                console.log(err);
            }
            else res.send("New Score:"+score);
        })
    })
    db.close();
})

router.route("/leaderboard").get((req, res) => {
    let db = new sqlite3.Database("./userinfo.db");
    let stmt = "SELECT username, score FROM login ORDER BY score DESC LIMIT 5";
    db.all(stmt, (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        res.send(rows);
    })
    db.close();
})

module.exports = router;