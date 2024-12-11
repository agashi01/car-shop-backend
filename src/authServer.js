require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const knex = require("knex");
const auth = require("./auth.js");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { app } = require("./appAuth.js");
const app2 = express();

const db = knex({
  client: "pg",
  connection: {
      host: process.env.PG_HOST,
      port:process.env.PG_PORT,
      user: process.env.PG_USERNAME,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
      ssl:true
  }
});
const corsOptions = {
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "guest"],
  credentials: true,
};
app2.use(cors(corsOptions));

app2.options("*", cors(corsOptions));

app2.use(express.json());
app2.use(cookieParser());

app(app2, jwt, auth, cookieParser, db);

const PORT= process.env.PORT||4000

app2.listen(PORT, () => console.log(`server is listening in port ${PORT}`));
