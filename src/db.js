const knex = require("knex");

const db = knex({
  client: "pg",
  connection: {
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    user: process.env.PG_USERNAME,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    ssl: true,
  },
});

module.exports = {
  db,
};
