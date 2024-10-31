const bcrypt = require("bcrypt");


const signUp = (db) => async (req, res) => {
  const { name, surname, email, password, username, type } = req.body;

  const hash = await bcrypt.hash(password, 10);

  db.transaction((trx) => {
    trx("users")
      .insert({
        type,
        name,
        surname,
        email,
      })
      .returning("*")
      .then((user) => {
        if (user.length > 0) {
          trx("users_info")
            .insert({
              id: user[0].id,
              username,
              email: user[0].email,
              hash,
            })
            .returning("*")
            .then(([user2]) => {
              trx.commit()
              return res.json({ ...user[0], username: user2.username, id: user2.id });
            })
            .catch((err) => {
              trx.rollback()
              res.status(500).json("username is already in use");
            });
        } else {
          res.status(400).json("problems in the server!");
        }
      })
      .catch((err) => {
        trx.rollback()
        console.log(err)
        res.status(500).json("email is already in use");
      })

  });
};

const logIn = (db, jwt) => async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json("missing credentials");
  }

  db("users")
    .where({
      email,
    })
    .select("*")
    .first()
    .then((logInEmail) => {
      db("users_info")
        .where({
          email: logInEmail.email,
        })
        .select("*")
        .first()
        .then(async (userInfo) => {
          const isValidPassword = await bcrypt.compare(password, userInfo.hash);

          if (isValidPassword) {
            const header = {
              name: userInfo.username
            }
            const token = jwt.sign(header, process.env.JWT_SECRET, { expiresIn: '1h' })
            const refresh = jwt.sign(header, process.env.JWT_REFRESH_SECRET)
            db('refresh_tokens').insert({
              "refresh_token": refresh
            }).then(() => {
            }).catch(err => {
              console.log(err)
              return res.status(400).json(`the refresh token couldn't be insrted because of this error ${err}`)
            })
            return res.json({
              token,
              refresh,
              user: { ...logInEmail, username: userInfo.username }
            });

          } else {
            return res.status(400).json("wrong password");
          }
        })
        .catch((err) => {
          console.error(err);
          res.status(500).json(err);
        });
    })
    .catch((err) => {
      return res.status(400).json("wrong email");
    });
};

const token = (db, jwt) => (req, res) => {
  const refreshToken = req.body.refreshToken
  if (!token) return res.status(401).json('refresh token is missing')
  db('refresh_tokens').select("*").where("refresh_token", refreshToken)
    .first().then(refresh => {
      if (refresh) {

        jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, user) => {
          if (err) {

            if (err.name === "TokenExpiredError") {
              return res.status(401).json("Token has expired");
            
            } else if (err.name === "JsonWebTokenError") {
              return res.status(403).json("Invalid token");
            } else {
              return res.status(403).json("Token verification failed");
            }
          }
          const header = {
            name: user.name
          }
          const token = jwt.sign(header, process.env.JWT_SECRET, { expiresIn: '1h' })
          console.log(token)
          return res.json(token)
        })
      }else{
        return res.status(400).json(`Invalid token`)

      }
    })
    .catch(err=>{
      console.log(err)
      return res.status(400).json(`Invalid token`)
    })

}

const signOut = (db) => (req, res) => {

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Token missing in body" })
  }
  db('refresh_tokens')
    .where('refresh_token', token)
    .delete()
    .then((rowsDeleted) => {
      if (rowsDeleted > 0) {
        return res.json({ message: 'Success', deletedCount: rowsDeleted });
      } else {
        return res.status(404).json({ message: 'Token not found' });
      }
    })
    .catch((error) => {
      console.error('Error deleting token:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    });

}

const logInToken=(db,jwt)=>(req,res)=>{
  const {token}=req.body

  if(!token) return res.status(400).json('token is missing')

  jwt.verify(token,process.env.JWT_SECRET,async (err,user)=>{
    if(err){
      if (err.name === "TokenExpiredError") {
        return res.status(401).json("Token has expired");
      } else if (err.name === "JsonWebTokenError") {
        return res.status(403).json("Invalid token");
      } else {
        return res.status(403).json("Token verification failed");
      }
    }
    const dbUser= await db('users_info').where('username',user.name).select('*').first()
    
    if(!dbUser) return res.status(500).json('something went wrong with getting username from token')

    const finalUser=await db('users').where('email',dbUser.email).select('*').first()

    if(!finalUser) return res.status(500).json('something went wrong with getting username from token')
    
    res.json({...finalUser,username:dbUser.username})

  })
}

module.exports = {
  signUp,
  logIn,
  token,
  signOut,
  logInToken
};
