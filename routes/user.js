const router = require("express").Router();
const sqlite3 = require("sqlite3");

router.route("/").get((req, res) => {
    let db = new sqlite3.Database("./userinfo.db");
    let stmt = `SELECT id, username FROM login ORDER BY id;`;
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

router.route("/:id").get((req, res) => {
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

router.route("/login/:username").get((req, res) => {
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

router.route("/addscore").get((req, res) => {
    let db = new sqlite3.Database("./userinfo.db");
    let stmt = `SELECT score FROM login WHERE username = "${req.params.username}";`;
    db.all(stmt, (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(rows[0]);
        let score = parseInt(rows[0]);
        score ++;
        let stmt2 = `INSERT INTO login(score) VALUES(${score});`;
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

module.exports = router;