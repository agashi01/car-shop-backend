const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const objToList = (list) => {
  const answer = [];
  for (let i = 0; i < list.length; i++) {
    let solution = Object.entries(list[i]);
    for (let x = 0; x < solution.length; x++) {
      answer.push(solution[x][1]);
    }
  }

  return answer;
};

const signUp = (db) => async (req, res) => {
  const { name, surname, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  db.transaction((trx) => {
    trx("users")
      .insert({
        name,
        surname,
        email,
      })
      .returning("*")
      .then((user) => {
        if (user.length > 0) {
          trx("users_info").insert({
            id: user[0].id,
            email: user[0].email,
            hash,
          });
          req.user = user[0];
        } else {
          res.status(400).json("wrong credentials");
        }
      })
      .catch((err) => {
        res.status(500).json("email is already in use");
      })
      .then(trx.commit)
      .catch((err) => trx.rollback);
  });
  next();
};

const logIn = (db) => async (req, res) => {
  const { email, password } = req.body;
  if (!email && !password) {
    res.status(400).json("missing credentials");
  }

  db("users_info")
    .where({
      email,
    })
    .select("*")
    .returning("*")
    .then(async (userInfo) => {
      const compare = await bcrypt.compare(password, userInfo[0].hash);

      if (compare) {
        db("users")
          .where({
            email: userInfo[0].email,
          })
          .select("*")
          .returning("*")
          .then((user) => {
            const userEmail = user[0].email; // Replace with your actual email value
            db("users as u")
              .select("*")
              .join(
                db
                  .select("*")
                  .from("cars as c")
                  .join("dealers as d", "c.dealer_id", "d.id")
                  .as("test"),
                "u.id",
                "=",
                "test.owner_id"
              )
              .where("u.email", userEmail)
              .returning("*")
              .then((result) => {
                res.json(result[0]);
              })
              .catch((err) => {
                res.status(500).json(err.message);
              });
          })
          .catch((err) => res.status(500).json("problem in the server"));
      } else {
        res.status(400).json("wrong passworrd");
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json(err);
    });
};
const verify = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (token == null) {
    req.status(403).json();
  }
  jwt.verify(token, SECRET, (err, user) => {
    if (err) {
      res.status(401).json("wrong credentials");
    }
    req.user = user;
  });
  next();
};

const token = (req, res) => {
  const token = jwt.sign(req.user, process.env.SECRET);
  res.json({ token });
};

module.exports = {
  signUp,
  logIn,
};

const func10 = (List) => {
  return { ...List };
};

const func = (user) => {};

const d = (user, projects) => (req, res, next) => {
  if ((req.project.id = user.id)) {
    for (let i = 0; i < projects.length; i++) {
      if (projects[i].id === user.id) {
        projects.splice(i, 1);
      }
    }
  }
};
