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
    host: "localhost",
    user: "postgres",
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
  },
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

app2.listen(4000, () => console.log("server is listening in port 4000"));
