
const app = (app,jwt,auth,cookieParser,db) => {
  
  app.post("/log-in-token", auth.logInToken(db, jwt));
  app.post("/token", auth.token(db, jwt));
  app.post("/sign-up", auth.signUp(db));
  app.post("/log-in", auth.logIn(db, jwt));
  app.post("/sign-out", auth.signOut(db));
};

module.exports = {
  app,
};
