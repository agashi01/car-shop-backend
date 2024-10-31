const knex = require("knex");


const db = knex({
    client: "pg",
    connection: {
        host: "localhost",
        user: "postgres",
        password: process.env.PASSWORD,
        database: process.env.DATABASE,
    },
});

module.exports={
    db
}